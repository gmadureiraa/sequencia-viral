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

export const maxDuration = 60;

const MAX_QUERY_LEN = 500;

function clip(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
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
      mode,
      niche,
      tone,
      designTemplate,
      contextHeading,
      contextBody,
      peopleMode: peopleModeRaw,
      isCover,
      count,
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
    };

    // Rate limit dividido por modo: generate (Imagen, $0.04/imagem) é
    // mais restrito que search (Serper, ~grátis).
    const rlBucket = mode === "generate" ? "images-generate" : "images-search";
    const rlLimit = mode === "generate" ? 40 : 120;
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
    const searchQuery = clip(
      `${mergedSearch} ${tmplMeta.imageSearchStyleHint} ${peopleSearch}`
        .replace(/\s+/g, " ")
        .trim(),
      MAX_QUERY_LEN
    );
    const slideThemeHint = [heading, bodyCtx]
      .filter(Boolean)
      .join(" — ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);

    // Puxa a descrição estética da marca (se configurada em Ajustes →
    // Branding → Referências visuais). Vai como prefix do prompt do Imagen
    // pra todas as imagens geradas seguirem a mesma linguagem visual.
    let brandAesthetic = "";
    const sbForAesthetic = createServiceRoleSupabaseClient();
    if (sbForAesthetic && (mode === "generate" || !mode)) {
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
      } catch {
        /* silently fall back to no aesthetic */
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
          let coverScenePrompt = "";
          const shouldUseCoverScene = isCover && !isTwitterTpl;
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
          const imagePrompt = [
            // 1. Estética dominante (brand + template style guide)
            aestheticPrefix,
            `TEMPLATE STYLE GUIDE (${tmplMeta.name}): ${tmplMeta.styleGuidePrompt}`,
            // 2. Cinematic base pra todo slide (exceto twitter) + cover boost
            cinematicBase,
            coverBoost,
            // 3. Frame + people
            "Instagram carousel square frame (1:1).",
            peopleInstr,
            // 4. Contexto de nicho/tom
            nicheHint,
            toneHint,
            // 5. Tema do slide (REFORÇADO)
            slideThemeHint
              ? `CRITICAL — this image must DIRECTLY depict: ${slideThemeHint}. The mood, setting, and subject must be unmistakably connected to this theme.`
              : "",
            `Primary subject / visual focus: ${query}.`,
            // 6. Paleta
            preferHex,
            avoidHex,
            // 7. Técnica
            isTwitterTpl
              ? "Technical: sharp focus on subject, natural color, believable shadows, 8K detail, documentary realism."
              : "Technical: ultra-sharp focus, cinematic color grading, dramatic shadows, subtle film grain, 8K detail, shallow depth of field, editorial magazine photography.",
            // 8. NO-TEXT constraint (CRÍTICO — Imagen às vezes coloca
            //    letras borradas no fundo). Reforçamos 3x pra pesar.
            "ABSOLUTELY NO TEXT, NO LETTERS, NO NUMBERS, NO WORDS in the image. No signs, no labels, no billboards with readable content, no newspaper headlines, no street signs. No logos, no watermarks, no UI mockups. If the scene would normally contain text (e.g. a screen, a book, a poster), render those surfaces BLANK or BLURRED beyond recognition. This is a hard constraint — any readable character is a failure.",
          ]
            .filter(Boolean)
            .join(" ");

          const res = await ai.models.generateImages({
            model: "imagen-4.0-generate-001",
            prompt: imagePrompt,
            config: { numberOfImages: 1, aspectRatio: "1:1" },
          });

          const imageBytes = res.generatedImages?.[0]?.image?.imageBytes;
          if (imageBytes) {
            // Registra custo Imagen ANTES do upload (se upload falhar, o
            // custo da API já foi cobrado de qualquer jeito).
            await recordGeneration({
              userId: user.id,
              model: "imagen-4.0-generate-001",
              provider: "google",
              inputTokens: 0,
              outputTokens: 0,
              costUsd: costForImages("imagen-4.0-generate-001", 1),
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

                return Response.json({
                  images: [
                    {
                      url: pub.publicUrl,
                      title: query,
                      source: "Gemini Imagen",
                      generated: true,
                    },
                  ],
                });
              }
              console.warn("[images] Supabase upload failed, returning data URL:", uploadError.message);
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
        } catch (err) {
          console.error("[images] Gemini Imagen error:", err);
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

          return Response.json({ images });
        }
      } catch (err) {
        console.error("Serper API error:", err);
      }
    }

    // Strategy 2: Sem fallback — devolver array vazio com aviso.
    // O endpoint source.unsplash.com foi deprecado em 2024 e retorna 404.
    // Preferimos sinalizar explicitamente pro front mostrar placeholder
    // + botão de "gerar com IA" ou "upload manual".
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
