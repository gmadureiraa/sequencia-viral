import type { DesignTemplateId, ImagePeopleMode } from "@/lib/carousel-templates";
import {
  getDesignTemplateMeta,
  imagePeopleModeImagenInstruction,
  imagePeopleModeSearchSuffix,
  normalizeDesignTemplate,
  normalizeImagePeopleMode,
} from "@/lib/carousel-templates";
import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { costForImages, recordGeneration } from "@/lib/server/generation-log";
import { saveToUserGallery } from "@/lib/server/user-images";
import {
  getCachedThemeImage,
  recordThemeImage,
} from "@/lib/server/image-strategy";
import {
  buildImagePromptFromStructured,
  decideSlideImage,
  type ImageDecision,
  type StructuredImagePrompt,
} from "@/lib/server/image-decider";

export const maxDuration = 60;

const MAX_QUERY_LEN = 500;

function clip(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

/**
 * Valida uma URL de imagem via HEAD request (timeout 3s). Retorna true se
 * respondeu 2xx/3xx. Usado pra não salvar URLs quebradas no slide.
 * Ignora falhas de rede com um warn — URLs internas (Supabase) raramente
 * falham HEAD se upload foi OK; mas hosts externos podem bloquear HEAD
 * e permitir GET, então em caso de erro de rede, assume OK (permissivo).
 */
async function validateImageUrl(url: string): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith("data:")) return true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    // 2xx/3xx = válido. 405 (method not allowed) = host não aceita HEAD, assume OK.
    if (res.ok) return true;
    if (res.status === 405 || res.status === 403) return true; // alguns CDNs bloqueiam HEAD
    console.warn(
      `[images] validateImageUrl FAIL status=${res.status} url=${url.slice(0, 120)}`
    );
    return false;
  } catch (err) {
    // Timeout/network — assume válido (permissivo, evita false negatives).
    console.warn(
      "[images] validateImageUrl network error (assuming valid):",
      err instanceof Error ? err.message : err
    );
    return true;
  }
}

/** Junta termo de busca com trechos do slide para resultados mais alinhados ao conteúdo. */
function mergeImageSearchText(
  query: string,
  contextHeading?: string,
  contextBody?: string
): string {
  const base = query.trim();
  const ctx = [contextHeading, contextBody]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!ctx) return clip(base, MAX_QUERY_LEN);
  return clip(`${base} ${ctx}`, MAX_QUERY_LEN);
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    const { user } = auth;

    const body = await request.json();
    const {
      query,
      mode: modeFromBody,
      niche,
      tone,
      designTemplate,
      contextHeading,
      contextBody,
      peopleMode: peopleModeRaw,
      isCover,
      count,
      useDecider,
      slideNumber,
      totalSlides,
      facts: factsFromBody,
      model: modelOverride,
    } = body as {
      query?: string;
      mode?: "search" | "generate";
      niche?: string;
      tone?: string;
      designTemplate?: DesignTemplateId;
      contextHeading?: string;
      contextBody?: string;
      peopleMode?: ImagePeopleMode;
      isCover?: boolean;
      count?: number;
      useDecider?: boolean;
      slideNumber?: number;
      totalSlides?: number;
      facts?: {
        entities?: string[];
        dataPoints?: string[];
        summary?: string[];
      };
      /**
       * Override explícito do modelo de geração de imagem. Quando omitido,
       * default é Gemini 3.1 Flash Image ($0.008/img). Passar
       * "imagen-4.0-generate-001" pra ativar modo PREMIUM (Imagen 4, $0.04/img).
       * Outros valores são ignorados e o default é usado.
       */
      model?: "imagen-4.0-generate-001" | "gemini-3.1-flash-image-preview";
    };

    // `mode` é reatribuído depois do decider — precisa ser mutável.
    let mode: "search" | "generate" | undefined = modeFromBody;

    // Rate limit dividido por modo: generate (Imagen, $0.04/imagem) é
    // mais restrito que search (Serper, ~grátis). Quando useDecider=true
    // tratamos como generate-tier (pessimistic) já que ainda não sabemos
    // a escolha do agente mas provavelmente vai custar imagem.
    const rlLikelyGenerate = mode === "generate" || useDecider;
    const rlBucket = rlLikelyGenerate ? "images-generate" : "images-search";
    const rlLimit = rlLikelyGenerate ? 40 : 120;
    const limiter = checkRateLimit({
      key: getRateLimitKey(request, rlBucket, user.id),
      limit: rlLimit,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSec),
          },
        }
      );
    }

    if (!query || typeof query !== "string") {
      return Response.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }
    if (query.length > MAX_QUERY_LEN) {
      return Response.json(
        { error: "Query too long (max 500 chars)" },
        { status: 400 }
      );
    }

    const heading =
      typeof contextHeading === "string" ? contextHeading : undefined;
    const bodyCtx =
      typeof contextBody === "string" ? contextBody : undefined;
    const mergedSearch = mergeImageSearchText(query, heading, bodyCtx);
    const tmplId = normalizeDesignTemplate(designTemplate);
    const tmplMeta = getDesignTemplateMeta(tmplId);
    const peopleMode = normalizeImagePeopleMode(peopleModeRaw);
    const peopleSearch = imagePeopleModeSearchSuffix(peopleMode);

    const slideThemeHint = [heading, bodyCtx]
      .filter(Boolean)
      .join(" — ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);

    // Puxa a descrição estética da marca (se configurada em Ajustes →
    // Branding → Referências visuais). Vai como prefix do prompt do Imagen
    // pra todas as imagens geradas seguirem a mesma linguagem visual.
    // Puxado ANTES do decider — ele usa brandAesthetic como contexto.
    //
    // Tambem carrega imageRules de profile.brand_analysis.__generation_memory
    // (regras vindas de feedback pos-download). Essas regras viram instrucao
    // direta no decider + reforço inline no prompt do Imagen/Flash Image.
    let brandAesthetic = "";
    let imageRules: string[] = [];
    const sbForAesthetic = createServiceRoleSupabaseClient();
    if (sbForAesthetic) {
      try {
        const { data: prof } = await sbForAesthetic
          .from("profiles")
          .select("brand_analysis")
          .eq("id", user.id)
          .single();
        const ba = prof?.brand_analysis as Record<string, unknown> | null;
        const aesthetic = ba?.__image_aesthetic as
          | { description?: string }
          | undefined;
        if (aesthetic?.description && typeof aesthetic.description === "string") {
          brandAesthetic = aesthetic.description.trim();
        }
        const memory = ba?.__generation_memory as
          | { image_rules?: unknown }
          | undefined;
        if (Array.isArray(memory?.image_rules)) {
          imageRules = (memory.image_rules as unknown[])
            .filter(
              (v): v is string => typeof v === "string" && v.trim().length > 0
            )
            .slice(0, 10);
        }
      } catch {
        /* silently fall back to no aesthetic */
      }
    }

    // ── IMAGE DECIDER ───────────────────────────────────────────────
    // Se useDecider=true, roda agente Gemini Flash 2.5 pra decidir entre
    // search (foto real de entidade nomeada) e generate (cena cinematográfica
    // com StructuredImagePrompt). Substitui a heurística antiga de
    // alternância fixa par/ímpar.
    //
    // Decider também retorna:
    //   - searchQuery específico (quando mode=search) — sobrescreve heuristica
    //   - StructuredImagePrompt rico (quando mode=generate) — caller monta
    //     prompt Imagen de ~300-500 chars via buildImagePromptFromStructured.
    let deciderDecision: ImageDecision | null = null;
    let structuredPromptOverride: StructuredImagePrompt | null = null;
    let deciderSearchQueryOverride: string | null = null;
    if (useDecider) {
      try {
        deciderDecision = await decideSlideImage({
          heading: heading || query,
          body: bodyCtx || "",
          slideNumber: typeof slideNumber === "number" ? slideNumber : 1,
          totalSlides: typeof totalSlides === "number" ? totalSlides : 8,
          isCover: !!isCover,
          niche,
          tone,
          brandAesthetic: brandAesthetic || undefined,
          imageRules: imageRules.length > 0 ? imageRules : undefined,
          facts: factsFromBody
            ? {
                entities: Array.isArray(factsFromBody.entities)
                  ? factsFromBody.entities.filter(
                      (x): x is string => typeof x === "string"
                    )
                  : [],
                dataPoints: Array.isArray(factsFromBody.dataPoints)
                  ? factsFromBody.dataPoints.filter(
                      (x): x is string => typeof x === "string"
                    )
                  : [],
                summary: Array.isArray(factsFromBody.summary)
                  ? factsFromBody.summary.filter(
                      (x): x is string => typeof x === "string"
                    )
                  : [],
              }
            : undefined,
        });
        console.log(
          `[images] decider slide=${slideNumber ?? "?"} mode=${deciderDecision.mode} reasoning="${deciderDecision.reasoning}"`
        );
        mode = deciderDecision.mode;
        if (deciderDecision.mode === "search" && deciderDecision.searchQuery) {
          deciderSearchQueryOverride = deciderDecision.searchQuery;
        }
        if (
          deciderDecision.mode === "generate" &&
          deciderDecision.generatePrompt
        ) {
          structuredPromptOverride = deciderDecision.generatePrompt;
        }
      } catch (err) {
        console.warn(
          "[images] decider falhou, caindo pra heurística:",
          err instanceof Error ? err.message : err
        );
      }
    }

    // Picker manual (count > 10) não deve sobrescrever a query do user com
    // hints de template — isso gera resultados vazios quando user busca algo
    // específico. Only append hints quando é fetch automático pelo template.
    const isManualPicker = typeof count === "number" && count > 10;
    const baseSearchText = deciderSearchQueryOverride
      ? mergeImageSearchText(deciderSearchQueryOverride, heading, bodyCtx)
      : mergedSearch;
    const searchQuery = isManualPicker
      ? clip(query.trim(), MAX_QUERY_LEN)
      : clip(
          `${baseSearchText} ${tmplMeta.imageSearchStyleHint} ${peopleSearch}`
            .replace(/\s+/g, " ")
            .trim(),
          MAX_QUERY_LEN
        );

    // ── CACHE TEMATICO: antes de chamar Imagen/Serper, checa se ja temos
    //    imagem recente (ultimos 7d) pro mesmo tema. Economia de ~40-60%
    //    em carrosseis repetitivos do mesmo nicho. Desabilitado pra manual
    //    picker (count=1 mode=search e count>1) pra nao mostrar sempre a
    //    mesma foto quando user pede opcoes alternativas.
    const supabaseForCache = createServiceRoleSupabaseClient();
    const cacheQueryKey = (query ?? "").trim();
    const shouldUseCache =
      supabaseForCache &&
      cacheQueryKey &&
      (mode === "generate" || (mode === "search" && (count ?? 1) <= 1));
    if (shouldUseCache && supabaseForCache) {
      try {
        const cachedUrl = await getCachedThemeImage(
          supabaseForCache,
          cacheQueryKey,
          mode as "generate" | "search"
        );
        if (cachedUrl) {
          console.log(
            `[images] cache hit (${mode}) for theme:`,
            cacheQueryKey.slice(0, 60)
          );
          return Response.json({
            images: [
              { url: cachedUrl, generated: mode === "generate", cached: true },
            ],
          });
        }
      } catch {
        /* best-effort */
      }
    }

    // ── MODE: GENERATE (Gemini Imagen) ──────────────────────────────
    if (mode === "generate") {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const peopleInstr = imagePeopleModeImagenInstruction(peopleMode);
          const nicheHint = niche ? `Niche/context: ${niche}.` : "";
          const toneHint = tone ? `Editorial tone: ${tone}.` : "";
          const preferHex = tmplMeta.preferPalette.length
            ? `Prefer palette: ${tmplMeta.preferPalette.join(", ")}.`
            : "";
          const avoidHex = tmplMeta.avoidPalette.length
            ? `AVOID these colors (conflict with template accent): ${tmplMeta.avoidPalette.join(", ")}.`
            : "";
          // Baseline BRANDSDECODED-like (cinematográfico, dramático,
          // futurista, editorial moderno) quando o usuário não configurou
          // brand aesthetic.
          const DEFAULT_BASELINE =
            "BASELINE AESTHETIC: cinematic editorial photography inspired by BrandsDecoded / Netflix poster / Vogue magazine cover. Strong dramatic lighting (red glow, amber sunset, blue hour, hard neon, harsh sun-shadow). High contrast. Subject in center frame or powerful environmental shot. Cinematic color grading, film grain, shallow depth of field. Futuristic but grounded — real humans in real scenes, not 3D render. Mood: powerful, cool, modern, scroll-stopping.";
          const aestheticPrefix = brandAesthetic
            ? `BRAND AESTHETIC (follow this visual language strictly): ${brandAesthetic}`
            : DEFAULT_BASELINE;

          // Regras aprendidas com feedback pos-download do proprio user.
          // Peso ALTO — user disse explicitamente o que quer/nao quer nas
          // imagens. Injetado logo apos o aestheticPrefix pra alta prioridade.
          const userImageRulesBlock =
            imageRules.length > 0
              ? `USER IMAGE RULES (learned from past feedback, MUST respect every one): ${imageRules.slice(0, 10).join("; ")}.`
              : "";

          // CINEMATIC BOOST pra TODOS os slides de template editorial
          // (Gabriel reclamou que só a capa ficava cinematográfica). Cover
          // ainda recebe reforço adicional por ser a primeira impressão.
          const isTwitterTpl = tmplId === "twitter";
          const cinematicBase = isTwitterTpl
            ? ""
            : "CINEMATIC SHOT: make this a scroll-stopping cinematic frame. Intentional lighting (red/amber glow, blue hour, hard window light, neon reflection). High contrast, emotional framing, visual tension. This must look like a Netflix poster, Vogue editorial, or BrandsDecoded carousel cover — NOT a stock photo.";

          // COVER 2-PASS: pra capa de template editorial, chama Gemini Flash
          // primeiro pra planejar uma cena narrativa rica, depois injeta como
          // prompt principal no Imagen. Resultado é MUITO melhor que só
          // reforçar o prompt generico.
          //
          // Se decider já produziu StructuredImagePrompt, pulamos o cover-scene
          // (redundante — decider já planejou a cena com campos estruturados).
          let coverScenePrompt = "";
          const shouldUseCoverScene =
            isCover && !isTwitterTpl && !structuredPromptOverride;
          if (shouldUseCoverScene) {
            try {
              const sceneRes = await fetch(
                new URL("/api/generate/cover-scene", request.url).toString(),
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: request.headers.get("Authorization") || "",
                  },
                  body: JSON.stringify({
                    heading: contextHeading ?? query,
                    body: contextBody,
                    niche,
                    tone,
                    brandAesthetic: brandAesthetic || undefined,
                  }),
                  signal: AbortSignal.timeout(12_000),
                }
              );
              if (sceneRes.ok) {
                const scene = (await sceneRes.json()) as {
                  sceneDescription?: string;
                  lighting?: string;
                  mood?: string;
                  paletteHints?: string[];
                };
                if (scene.sceneDescription) {
                  coverScenePrompt = `CINEMATIC COVER SCENE (primary directive — follow this composition exactly): ${scene.sceneDescription}${scene.lighting ? ` Lighting: ${scene.lighting}.` : ""}${scene.mood ? ` Mood: ${scene.mood}.` : ""}${Array.isArray(scene.paletteHints) && scene.paletteHints.length ? ` Dominant palette: ${scene.paletteHints.join(", ")}.` : ""}`;
                }
              }
            } catch (err) {
              console.warn(
                "[images] cover-scene falhou, seguindo com prompt default:",
                err instanceof Error ? err.message : err
              );
            }
          }

          const coverBoost = isCover && !isTwitterTpl
            ? (coverScenePrompt
                ? " " + coverScenePrompt
                : " COVER SHOT: this is the OPENING SLIDE — the viewer must stop scrolling in 0.3 seconds. Maximum drama. Subject dead-centered or composed with rule of thirds. The single strongest composition from the slide theme.") +
              " CRITICAL COMPOSITION: leave the BOTTOM THIRD of the frame visually simpler and darker — text overlay will sit there. Subject in center-upper or middle third."
            : "";
          /**
           * Prompt strategy (2026-04-22): cover-heavy, lean on inner.
           *
           * COVER: full photorealistic structured prompt (format from
           * ai.google.dev/gemini-api/docs/image-generation):
           *   "A photorealistic [shot] of [subject], [action]. Lit by
           *   [lighting]. [Lens]. Emphasizing [textures]. [Aspect ratio]."
           * Plus cover-scene output as primary directive, plus brand aesthetic.
           *
           * INNER SLIDES: short, direct prompt — subject + style + no-text.
           * Removes cinematic/magazine/film-grain boilerplate that slows
           * output without improving visibly non-cover frames. Target
           * smaller generation latency.
           *
           * NO-TEXT stays hard constraint on both.
           */
          // Sandwich strategy: regra no inicio (prioridade) + no final (reforco).
          // Imagen 4 pondera inicio mais forte. Negative prompt tb aplicado via config.
          const NO_TEXT_HEADER =
            "[HARD CONSTRAINT — TEXT FREE IMAGE] The output MUST NOT contain any readable text, letters, numbers, words, alphabet, characters, or typography anywhere in the frame. Every surface that would normally show text (screens, books, posters, signs, t-shirts, newspapers, billboards, logos, labels) must be BLANK, BLURRED, or replaced with abstract shapes.";
          const NO_TEXT_RULE =
            "ABSOLUTELY NO TEXT, NO LETTERS, NO NUMBERS, NO WORDS, NO ALPHABET, NO CHARACTERS, NO TYPOGRAPHY anywhere in the image. No signs, no labels, no titles, no captions, no billboards with readable content, no newspaper headlines, no book covers, no magazine covers, no street signs, no shop signs, no neon signs, no screen text, no phone UI, no laptop UI, no app UI, no website mockups. No logos, no watermarks, no brand names, no monograms, no insignias. If the scene would normally contain text (e.g. a screen, a book, a poster, a t-shirt print, a road sign), render those surfaces COMPLETELY BLANK or BLURRED BEYOND RECOGNITION — never with legible characters. This is a HARD OUTPUT CONSTRAINT: any readable character anywhere in the frame = failed generation.";
          const NEGATIVE_PROMPT =
            "text, letters, numbers, words, typography, captions, titles, subtitles, headlines, logos, watermarks, brand names, signs, billboards, book covers, magazine covers, newspaper, screen UI, phone UI, app UI, website screenshot, t-shirt print, road sign, license plate, poster text, neon sign, street sign, shop sign, written language, readable characters";

          let imagePrompt: string;
          if (structuredPromptOverride) {
            // DECIDER OVERRIDE: prompt veio do image-decider como
            // StructuredImagePrompt rico (subject/composition/lighting/mood/
            // palette/camera/textures/negative). Monta prompt Imagen-style
            // compacto via helper + wrappers obrigatórios (NO_TEXT, aesthetic,
            // template hints, palette rules).
            const structuredBody = buildImagePromptFromStructured(
              structuredPromptOverride
            );
            imagePrompt = [
              NO_TEXT_HEADER,
              aestheticPrefix,
              userImageRulesBlock,
              `TEMPLATE STYLE GUIDE (${tmplMeta.name}): ${tmplMeta.styleGuidePrompt}`,
              isCover && !isTwitterTpl ? cinematicBase : "",
              isCover && !isTwitterTpl ? coverBoost : "",
              structuredBody,
              peopleInstr,
              nicheHint,
              toneHint,
              preferHex,
              avoidHex,
              NO_TEXT_RULE,
            ]
              .filter(Boolean)
              .join(" ");
          } else if (isCover && !isTwitterTpl) {
            // Cover — rich structured cinematic prompt.
            imagePrompt = [
              NO_TEXT_HEADER,
              aestheticPrefix,
              userImageRulesBlock,
              `TEMPLATE STYLE GUIDE (${tmplMeta.name}): ${tmplMeta.styleGuidePrompt}`,
              cinematicBase,
              coverBoost,
              "FORMAT: A photorealistic cinematic medium shot.",
              slideThemeHint
                ? `SUBJECT: ${slideThemeHint}. Primary visual focus: ${query}.`
                : `SUBJECT: ${query}.`,
              "LIGHTING: intentional and dramatic (rim light + key light + practicals — amber sunset, blue hour, hard neon, or harsh window light as appropriate to the scene).",
              "CAMERA: 35mm or 50mm prime lens, shallow depth of field, rule-of-thirds composition with subject in upper third, bottom third simpler/darker for text overlay.",
              "TEXTURES: emphasize skin, fabric, material grain, authentic light fall-off. Subtle film grain. Editorial magazine finish.",
              "ASPECT RATIO: 1:1 Instagram carousel square.",
              peopleInstr,
              nicheHint,
              toneHint,
              preferHex,
              avoidHex,
              "Mood: powerful, cool, modern, scroll-stopping. Netflix poster / Vogue editorial / BrandsDecoded carousel.",
              NO_TEXT_RULE,
            ]
              .filter(Boolean)
              .join(" ");
          } else {
            // Inner slide OR twitter template — lean prompt for speed.
            const coreSubject = slideThemeHint
              ? `${slideThemeHint}. Visual focus: ${query}.`
              : query;
            imagePrompt = [
              NO_TEXT_HEADER,
              aestheticPrefix,
              userImageRulesBlock,
              `TEMPLATE STYLE: ${tmplMeta.name}.`,
              `Subject: ${coreSubject}`,
              isTwitterTpl
                ? "Clean documentary photography, natural light, sharp focus on subject, neutral background, 1:1 Instagram square."
                : "Editorial photography, natural or directional light, subject centered, 1:1 Instagram square, shallow depth of field.",
              peopleInstr,
              nicheHint,
              toneHint,
              preferHex,
              avoidHex,
              NO_TEXT_RULE,
            ]
              .filter(Boolean)
              .join(" ");
          }

          // ── ESTRATEGIA DE MODELO (2026-04-22 — atualizada) ─────────
          // DEFAULT: Gemini 3.1 Flash Image ($0.008/img) pra TODOS os slides
          // (capa + inner). Qualidade aprovada em teste A/B, custo 5x menor
          // que Imagen 4 ($0.04/img).
          //
          // PREMIUM: Imagen 4 só quando caller manda `model="imagen-4.0-generate-001"`
          // explicitamente (ex: toggle premium no editor avançado). Nesse caso
          // a chain inverte — tenta Imagen primeiro, Flash Image como fallback.
          //
          // FALLBACK (default): Flash Image falha (safety/quota/no-bytes) →
          // tenta Imagen 4 como retry pra não devolver slide sem imagem.
          const isPremiumImagen =
            modelOverride === "imagen-4.0-generate-001";
          const preferredModel: "imagen-4.0-generate-001" | "gemini-3.1-flash-image-preview" =
            isPremiumImagen ? "imagen-4.0-generate-001" : "gemini-3.1-flash-image-preview";
          const fallbackModel: "imagen-4.0-generate-001" | "gemini-3.1-flash-image-preview" =
            isPremiumImagen ? "gemini-3.1-flash-image-preview" : "imagen-4.0-generate-001";

          let imageBytes: string | undefined;
          let actualModelUsed:
            | "imagen-4.0-generate-001"
            | "gemini-3.1-flash-image-preview" = preferredModel;

          async function tryFlashImage(): Promise<string | undefined> {
            // Gemini Flash Image usa generateContent com responseModalities
            // ['IMAGE']. Output vem em candidates[0].content.parts[].inlineData.
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const gRes: any = await ai.models.generateContent({
                model: "gemini-3.1-flash-image-preview",
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `${imagePrompt}\n\nNEGATIVE (absolutely avoid): ${NEGATIVE_PROMPT}`,
                      },
                    ],
                  },
                ],
                config: {
                  responseModalities: ["IMAGE"],
                },
              });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parts = gRes.candidates?.[0]?.content?.parts ?? [];
              for (const p of parts) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inline = (p as any).inlineData;
                if (inline?.data) {
                  return inline.data as string;
                }
              }
              console.warn(
                `[images] FALHA slide=${slideNumber ?? "?"} reason=flash-image-no-bytes isCover=${!!isCover}`
              );
              return undefined;
            } catch (err) {
              console.warn(
                `[images] FALHA slide=${slideNumber ?? "?"} reason=flash-image-exception isCover=${!!isCover} msg=${err instanceof Error ? err.message : String(err)}`
              );
              return undefined;
            }
          }

          async function tryImagen4(): Promise<string | undefined> {
            try {
              const res = await ai.models.generateImages({
                model: "imagen-4.0-generate-001",
                prompt: imagePrompt,
                config: {
                  numberOfImages: 1,
                  aspectRatio: "1:1",
                  negativePrompt: NEGATIVE_PROMPT,
                },
              });
              const bytes = res.generatedImages?.[0]?.image?.imageBytes;
              if (!bytes) {
                console.error(
                  `[images] FALHA slide=${slideNumber ?? "?"} reason=imagen-no-bytes isCover=${!!isCover}`
                );
              }
              return bytes;
            } catch (err) {
              console.error(
                `[images] FALHA slide=${slideNumber ?? "?"} reason=imagen-exception isCover=${!!isCover} msg=${err instanceof Error ? err.message : String(err)}`
              );
              return undefined;
            }
          }

          // Tenta modelo preferido primeiro, depois fallback.
          if (preferredModel === "gemini-3.1-flash-image-preview") {
            imageBytes = await tryFlashImage();
            if (!imageBytes) {
              console.warn(
                `[images] slide=${slideNumber ?? "?"} fallback Flash Image → Imagen 4`
              );
              imageBytes = await tryImagen4();
              if (imageBytes) actualModelUsed = "imagen-4.0-generate-001";
            }
          } else {
            imageBytes = await tryImagen4();
            if (!imageBytes) {
              console.warn(
                `[images] slide=${slideNumber ?? "?"} fallback Imagen 4 → Flash Image (premium failed)`
              );
              imageBytes = await tryFlashImage();
              if (imageBytes) actualModelUsed = "gemini-3.1-flash-image-preview";
            }
          }
          // Silenciar warning do linter: fallbackModel fica documentado mas não lido direto.
          void fallbackModel;

          if (imageBytes) {
            // Registra custo ANTES do upload (API ja foi cobrada de qualquer jeito).
            await recordGeneration({
              userId: user.id,
              model: actualModelUsed,
              provider: "google",
              inputTokens: 0,
              outputTokens: 0,
              costUsd: costForImages(actualModelUsed, 1),
              promptType: "image",
            });

            // Try to upload to Supabase Storage
            const supabase = createServiceRoleSupabaseClient();
            if (supabase) {
              const buffer = Buffer.from(imageBytes, "base64");
              const path = `generated/${user.id}/${Date.now()}.png`;
              const { error: uploadError } = await supabase.storage
                .from("carousel-images")
                .upload(path, buffer, {
                  contentType: "image/png",
                  upsert: false,
                  cacheControl: "31536000",
                });

              if (!uploadError) {
                const { data: pub } = supabase.storage
                  .from("carousel-images")
                  .getPublicUrl(path);

                // Valida URL final — upload OK mas getPublicUrl pode devolver
                // URL errada se bucket tiver RLS estranho ou path codificado.
                const urlOk = await validateImageUrl(pub.publicUrl);
                if (!urlOk) {
                  console.error(
                    `[images] FALHA slide=${slideNumber ?? "?"} reason=public-url-invalid url=${pub.publicUrl}`
                  );
                  // Fallback pra data URL — ao menos o carrossel renderiza.
                  return Response.json({
                    images: [
                      {
                        url: `data:image/png;base64,${imageBytes}`,
                        title: query,
                        source: "Gemini (data URL)",
                        generated: true,
                      },
                    ],
                  });
                }

                // Salva na galeria do user pra reuso futuro.
                await saveToUserGallery({
                  userId: user.id,
                  url: pub.publicUrl,
                  source: "generated",
                  title: query.slice(0, 200),
                  prompt: imagePrompt.slice(0, 2000),
                  tags: [tmplId, ...(niche ? [niche] : [])],
                  supabase,
                });

                // Grava no cache tematico global: proximos slides/carrosseis
                // com a mesma query reusam essa URL em vez de gastar API.
                if (cacheQueryKey) {
                  await recordThemeImage(
                    supabase,
                    cacheQueryKey,
                    "generate",
                    pub.publicUrl
                  );
                }

                console.log(
                  `[images] OK slide=${slideNumber ?? "?"} model=${actualModelUsed} isCover=${!!isCover}`
                );

                return Response.json({
                  images: [
                    {
                      url: pub.publicUrl,
                      title: query,
                      source:
                        actualModelUsed === "imagen-4.0-generate-001"
                          ? "Imagen 4"
                          : "Gemini Flash Image",
                      generated: true,
                    },
                  ],
                });
              }
              console.warn(
                `[images] FALHA slide=${slideNumber ?? "?"} reason=supabase-upload msg=${uploadError.message} — returning data URL`
              );
            }

            // Fallback: return as data URL if storage upload fails
            return Response.json({
              images: [
                {
                  url: `data:image/png;base64,${imageBytes}`,
                  title: query,
                  source: "Gemini Imagen",
                  generated: true,
                },
              ],
            });
          }

          // imageBytes nao veio nem do Flash Image nem do Imagen → cai pro Serper.
          console.error(
            `[images] FALHA slide=${slideNumber ?? "?"} reason=no-image-bytes-after-all-providers isCover=${!!isCover} — fallback pro Serper search`
          );
        } catch (err) {
          console.error(
            `[images] FALHA slide=${slideNumber ?? "?"} reason=gemini-outer-exception msg=${err instanceof Error ? err.message : String(err)}`
          );
          // Fall through to search mode as fallback
        }
      }

      // If Gemini failed, fall through to Serper search as fallback
    }

    // ── MODE: SEARCH (Serper / Unsplash) ────────────────────────────

    // Strategy 1: Serper.dev Google Image Search
    const serperKey = process.env.SERPER_API_KEY;
    // Count: default 5 pro fluxo automático; picker na UI pede count=24 pra
    // grid de seleção manual. Cap em 40 (limite Serper free).
    const desiredCount = Math.max(
      1,
      Math.min(40, typeof count === "number" && count > 0 ? count : 5)
    );
    if (serperKey) {
      try {
        const resp = await fetch("https://google.serper.dev/images", {
          method: "POST",
          headers: {
            "X-API-KEY": serperKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: searchQuery, num: desiredCount }),
          signal: AbortSignal.timeout(10_000),
        });

        if (resp.ok) {
          const data = await resp.json();
          const images = (data.images || [])
            .slice(0, desiredCount)
            .map(
              (img: {
                imageUrl?: string;
                thumbnailUrl?: string;
                title?: string;
                source?: string;
                link?: string;
              }) => ({
                url: img.imageUrl || "",
                thumbnailUrl: img.thumbnailUrl || img.imageUrl || "",
                title: img.title || "",
                source: img.source || "",
                link: img.link || "",
                generated: false,
              })
            )
            .filter((img: { url: string }) => !!img.url);

          if (images.length === 0) {
            console.warn(
              `[images] FALHA slide=${slideNumber ?? "?"} reason=serper-empty query=${searchQuery.slice(0, 80)}`
            );
          } else {
            console.log(
              `[images] OK slide=${slideNumber ?? "?"} source=serper count=${images.length}`
            );
          }
          return Response.json({ images });
        }
        console.warn(
          `[images] FALHA slide=${slideNumber ?? "?"} reason=serper-non-ok status=${resp.status}`
        );
      } catch (err) {
        console.error(
          `[images] FALHA slide=${slideNumber ?? "?"} reason=serper-exception msg=${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else {
      console.warn(
        `[images] FALHA slide=${slideNumber ?? "?"} reason=no-serper-key`
      );
    }

    // Strategy 2: Sem fallback — devolver array vazio com aviso.
    // O endpoint source.unsplash.com foi deprecado em 2024 e retorna 404.
    // Preferimos sinalizar explicitamente pro front mostrar placeholder
    // + botão de "gerar com IA" ou "upload manual".
    //
    // Quando o fluxo é auto (useDecider=true ou isCover=true), devolvemos
    // status 502 explicito com error claro, pro editor detectar e marcar
    // imageFailed=true no slide em vez de receber array vazio silencioso.
    console.error(
      `[images] FALHA slide=${slideNumber ?? "?"} reason=no-sources-available useDecider=${!!useDecider} isCover=${!!isCover}`
    );
    const isAutoFlow = !!useDecider || !!isCover;
    if (isAutoFlow) {
      return Response.json(
        {
          error:
            "Nenhuma fonte de imagem conseguiu entregar. Tente gerar com IA manualmente ou subir uma imagem.",
          images: [],
        },
        { status: 502 }
      );
    }
    return Response.json({
      images: [],
      warning: "Nenhuma fonte de imagem disponível. Tente gerar com IA ou subir uma imagem.",
    });
  } catch (error) {
    console.error("Images API error:", error);
    return Response.json(
      {
        error: process.env.NODE_ENV === "production"
          ? "Erro ao buscar imagens. Tente novamente."
          : (error instanceof Error ? error.message : "Internal server error"),
      },
      { status: 500 }
    );
  }
}
