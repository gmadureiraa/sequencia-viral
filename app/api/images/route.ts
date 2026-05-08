import type { DesignTemplateId, ImagePeopleMode } from "@/lib/carousel-templates";
import {
  getDesignTemplateMeta,
  imagePeopleModeImagenInstruction,
  imagePeopleModeSearchSuffix,
  normalizeDesignTemplate,
  normalizeImagePeopleMode,
} from "@/lib/carousel-templates";
import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey, getRequestIp } from "@/lib/server/rate-limit";
import { captureRouteError } from "@/lib/server/sentry";
import {
  costForCall,
  costForImages,
  recordGeneration,
} from "@/lib/server/generation-log";
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
import {
  isUnsplashConfigured,
  unsplashSearch,
  unsplashTriggerDownload,
} from "@/lib/unsplash";
import {
  cacheExternalImage,
  cacheExternalImages,
} from "@/lib/server/scrape-cache";

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

/**
 * Validação ESTRITA pra URLs que vão virar <img src> no browser — rejeita
 * tudo que não seja 2xx (inclusive 403, que é hotlink bloqueado na maioria
 * dos casos). Tenta GET parcial se HEAD falhar, porque alguns CDNs (ex:
 * Cloudflare News) respondem 403 em HEAD mas 200 em GET.
 * Bug 24/04: Serper devolvia URLs de news/blog sites com hotlinking off,
 * frontend recebia e renderizava broken image no slide.
 */
async function validateImageUrlForDisplay(url: string): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith("data:")) return true;
  try {
    const controller = new AbortController();
    // 28/04: timeout 2500ms → 1500ms. HEAD que não responde em 1.5s
    // tipicamente nunca responde (rede ruim, host morto). Diminui o
    // critical path em ~1s por slide. Pessimismo aceitável: rejeitamos
    // a URL e o pipeline cai pra próxima candidata Serper.
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (res.ok) {
      // Se HEAD OK, confirma que é imagem (não html, não pdf)
      const ct = res.headers.get("content-type") || "";
      return ct.startsWith("image/") || ct === "" || ct === "application/octet-stream";
    }
    // 405: host não aceita HEAD → tenta GET parcial (1 byte)
    if (res.status === 405) {
      try {
        const ctrl2 = new AbortController();
        const to2 = setTimeout(() => ctrl2.abort(), 1500);
        const res2 = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          signal: ctrl2.signal,
          redirect: "follow",
        });
        clearTimeout(to2);
        return res2.ok || res2.status === 206;
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    // Timeout/network: REJEITA nesse modo estrito. Não queremos assumir
    // válido e renderizar broken — pior que filtrar falsos negativos.
    return false;
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
      page,
      useDecider,
      slideNumber,
      totalSlides,
      facts: factsFromBody,
      model: modelOverride,
    } = body as {
      query?: string;
      mode?: "search" | "stock" | "generate";
      niche?: string;
      tone?: string;
      designTemplate?: DesignTemplateId;
      contextHeading?: string;
      contextBody?: string;
      peopleMode?: ImagePeopleMode;
      isCover?: boolean;
      count?: number;
      /** Paginação manual (picker UI). Default 1. Serper + Unsplash aceitam page. */
      page?: number;
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
    let mode: "search" | "stock" | "generate" | undefined = modeFromBody;

    // Rate limit dividido por modo: generate (Imagen, $0.04/imagem) é
    // mais restrito que search (Serper, ~grátis). Quando useDecider=true
    // tratamos como generate-tier (pessimistic) já que ainda não sabemos
    // a escolha do agente mas provavelmente vai custar imagem.
    // Audit P1: trocado checkRateLimit (sync, in-memory only) por
    // await rateLimit (async, usa Upstash Redis quando configurado).
    // Rate limit in-memory por instância serverless permitia bypass
    // trivial em /api/images — usuário podia atingir Nx limite real
    // se requests caíssem em N instâncias diferentes.
    const rlLikelyGenerate = mode === "generate" || useDecider;
    const rlBucket = rlLikelyGenerate ? "images-generate" : "images-search";
    const rlLimit = rlLikelyGenerate ? 40 : 120;
    // IP-tier roda ANTES do user-tier no modo generate. User-only era
    // bypassável: atacante com N contas multiplicava o cap real (40 × N).
    // Mesmo pattern de /api/generate (linhas 274-282). Search mode segue
    // só com user-tier (Serper é grátis, custo de abuso é baixo).
    if (rlLikelyGenerate) {
      const ipLimiter = await rateLimit({
        key: `images-generate-ip:${getRequestIp(request)}`,
        limit: 20,
        windowMs: 60 * 1000,
      });
      if (!ipLimiter.allowed) {
        return Response.json(
          { error: "Rate limit exceeded. Try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(ipLimiter.retryAfterSec),
            },
          }
        );
      }
    }
    const limiter = await rateLimit({
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
      } catch (err) {
        // Falha aqui = perde brand aesthetic (paleta, mood, image rules
        // que vieram de feedback do user). Imagem ainda gera, mas com
        // estética genérica — degradação invisível pro user. Log.
        console.warn(
          "[images] falha ao carregar brand_analysis (aesthetic):",
          err instanceof Error ? err.message : String(err)
        );
        captureRouteError(err, {
          route: "/api/images",
          userId: user.id,
          tags: { stage: "load-brand-aesthetic" },
        });
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
    let deciderStockQueryOverride: string | null = null;
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
          // Template lock — decider respeita paleta + modifier estético do template.
          designTemplate: tmplId,
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
        if (deciderDecision.mode === "stock" && deciderDecision.stockQuery) {
          deciderStockQueryOverride = deciderDecision.stockQuery;
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
      (mode === "generate" ||
        mode === "stock" ||
        (mode === "search" && (count ?? 1) <= 1));
    if (shouldUseCache && supabaseForCache) {
      try {
        const cachedUrl = await getCachedThemeImage(
          supabaseForCache,
          cacheQueryKey,
          mode as "generate" | "search" | "stock",
          user.id
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
      } catch (err) {
        // Cache miss não é crítico — segue gerando do zero. Mas falha
        // recorrente aqui significa Supabase/Storage com problema, e o user
        // perde o cache hit (paga 1 imagem nova quando deveria reusar).
        console.warn(
          "[images] cache lookup falhou:",
          err instanceof Error ? err.message : String(err)
        );
        captureRouteError(err, {
          route: "/api/images",
          userId: user.id,
          tags: { stage: "cache-lookup", cacheMode: String(mode ?? "unknown") },
        });
      }
    }

    // ── MODE: STOCK (Unsplash) ──────────────────────────────────────
    // Decider escolheu "stock" pra conceito abstrato clássico
    // (produtividade, café, foco, trabalho, leitura etc). Unsplash é
    // grátis e tem qualidade editorial — substitui geração IA em ~X%
    // dos slides internos, economizando ~$0.008/img.
    //
    // Fallback: se Unsplash não retornar ≥1 resultado ou não estiver
    // configurado, mode vira "generate" e caímos no branch abaixo
    // (Imagen 4 / Flash Image). Nunca falha silenciosamente.
    if (mode === "stock") {
      const rawStockQuery = deciderStockQueryOverride || query;
      const stockQ = rawStockQuery.trim().slice(0, 80);
      if (isUnsplashConfigured() && stockQ) {
        try {
          const photos = await unsplashSearch(stockQ, {
            perPage: 5,
            orientation: "squarish",
            timeoutMs: 6_000,
          });
          if (photos.length >= 1) {
            const pick = photos[0];
            // Trigger obrigatório pra cumprir Unsplash API Guidelines.
            // Fire-and-forget — não bloqueia resposta.
            void unsplashTriggerDownload(pick.downloadLocation);

            // Cache no Supabase: Unsplash CDN é estável, mas cachear garante
            // que o zip de download e o IG publish nao falhem se a Unsplash
            // estiver lenta/fora. Fallback pra URL original se falhar.
            const cachedUrl = await cacheExternalImage(user.id, pick.url);
            const finalUrl = cachedUrl ?? pick.url;
            if (!cachedUrl) {
              console.warn(
                `[images] unsplash slide=${slideNumber ?? "?"} cache miss — usando URL externa pick=${pick.url.slice(0, 80)}`
              );
            }

            // Registra no log de geração (custo 0, provider unsplash) pra
            // admin enxergar a fonte da imagem do slide.
            void recordGeneration({
              userId: user.id,
              model: "unsplash",
              provider: "unsplash",
              inputTokens: 0,
              outputTokens: 0,
              costUsd: 0,
              promptType: "stock-search",
            });

            // Cache tematico: proximos slides com mesma query reusam.
            // user.id na chave garante isolamento entre usuarios.
            if (supabaseForCache && cacheQueryKey) {
              void recordThemeImage(
                supabaseForCache,
                cacheQueryKey,
                "stock",
                finalUrl,
                user.id
              );
            }

            console.log(
              `[images] OK slide=${slideNumber ?? "?"} source=unsplash query="${stockQ.slice(0, 60)}" author=${pick.author} cached=${!!cachedUrl}`
            );

            return Response.json({
              images: [
                {
                  url: finalUrl,
                  thumbnailUrl: pick.thumbUrl,
                  title: pick.description || stockQ,
                  source: `Unsplash — ${pick.author}`,
                  link: pick.authorUrl,
                  generated: false,
                  stock: true,
                  attribution: {
                    provider: "unsplash",
                    author: pick.author,
                    authorUrl: pick.authorUrl,
                    photoId: pick.id,
                  },
                },
              ],
            });
          }
          console.warn(
            `[images] unsplash slide=${slideNumber ?? "?"} empty query="${stockQ.slice(0, 60)}" — fallback para generate`
          );
        } catch (err) {
          console.warn(
            `[images] unsplash slide=${slideNumber ?? "?"} exception msg=${err instanceof Error ? err.message : String(err)} — fallback para generate`
          );
        }
      } else if (!isUnsplashConfigured()) {
        console.warn(
          `[images] unsplash slide=${slideNumber ?? "?"} skipped: UNSPLASH_ACCESS_KEY não configurada — fallback para generate`
        );
      }
      // Fallback: vira generate. Se já temos StructuredImagePrompt do
      // decider, usa. Senão, o branch generate monta prompt genérico.
      mode = "generate";
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
                    // Template lock — cover-scene respeita style guide visual.
                    designTemplate: tmplId,
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

          // Modifier estético único do template — repete em TODAS as 8
          // imagens do mesmo carrossel pra coerência visual entre slides.
          // Sem isso, cada slide saía com mood/lighting próprios e o
          // carrossel parecia uma colagem de templates diferentes.
          // Bloco STYLE GUIDE + MODIFIER agora vai em TODAS as branches
          // (cover, structured, inner, twitter) — antes só ia em cover/structured.
          const styleGuideLine = `TEMPLATE STYLE GUIDE (${tmplMeta.name}): ${tmplMeta.styleGuidePrompt}`;
          const modifierLine = `SHARED AESTHETIC MODIFIER (must be applied to EVERY slide in this carousel for visual consistency): ${tmplMeta.slideAestheticModifier}.`;

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
              styleGuideLine,
              modifierLine,
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
              styleGuideLine,
              modifierLine,
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
            // 2026-04-25: agora também recebe styleGuide + modifier completos.
            // Antes só passava o nome do template, o que deixava a Imagen
            // livre pra inventar mood/paleta/textura — quebrava a coerência
            // visual do carrossel inteiro.
            const coreSubject = slideThemeHint
              ? `${slideThemeHint}. Visual focus: ${query}.`
              : query;
            imagePrompt = [
              NO_TEXT_HEADER,
              aestheticPrefix,
              userImageRulesBlock,
              styleGuideLine,
              modifierLine,
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

                // Grava no cache tematico: proximos slides/carrosseis do mesmo
                // usuario com a mesma query reusam essa URL sem gastar API.
                // user.id na chave garante que o cache NAO vaza entre usuarios.
                if (cacheQueryKey) {
                  await recordThemeImage(
                    supabase,
                    cacheQueryKey,
                    "generate",
                    pub.publicUrl,
                    user.id
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

          // 2026-05-08: Imagen+FlashImage falharam. SEM fallback automático
          // pra Serper/Unsplash — Gabriel quer zero stock photos. Frontend
          // recebe 502 e marca slide como imageFailed pro user clicar
          // "regenerar" manualmente.
          console.error(
            `[images] FALHA slide=${slideNumber ?? "?"} reason=no-image-bytes-after-all-providers isCover=${!!isCover}`
          );
        } catch (err) {
          console.error(
            `[images] FALHA slide=${slideNumber ?? "?"} reason=gemini-outer-exception msg=${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    // ── MODE: SEARCH (Serper + Unsplash em paralelo) ────────────────

    const serperKey = process.env.SERPER_API_KEY;
    const desiredCount = Math.max(
      1,
      Math.min(40, typeof count === "number" && count > 0 ? count : 5)
    );
    const requestedPage = Math.max(
      1,
      Math.min(10, typeof page === "number" && page > 0 ? Math.floor(page) : 1)
    );

    // Picker manual (count > 10 OU page > 1) ativa o modo "mix":
    // Serper + Unsplash em paralelo. Dedupe por URL. Retorna combined.
    // - Custo: Serper = 1 query/página cobrada; Unsplash = 1 req/página,
    //   grátis (tier demo 50/h ou prod 5000/h).
    // - Ganho: ~40 Serper + ~30 Unsplash = ~70 fotos por página, com
    //   variedade maior (Unsplash é stock editorial, Serper é Google
    //   Images genérico). Sem custo extra versus pedir só Serper.
    // - Pagination: Serper aceita `page` (1-indexed); Unsplash aceita `page`
    //   (1-indexed). Cada chamada "load more" = 1 página nova de cada fonte.
    const isPickerManualMode = desiredCount > 10 || requestedPage > 1;

    if (isPickerManualMode) {
      type MergedImage = {
        url: string;
        thumbnailUrl: string;
        title: string;
        source: string;
        link: string;
        generated: false;
        provider: "serper" | "unsplash";
        /** Atribuição obrigatória Unsplash. null pra Serper. */
        author?: string;
        authorUrl?: string;
        /** Pings de download pro Unsplash. Caller faz quando user escolhe. */
        downloadLocation?: string;
      };

      async function fetchSerper(): Promise<MergedImage[]> {
        if (!serperKey) return [];
        try {
          const useLicenseFilter =
            process.env.SERPER_DISABLE_LICENSE_FILTER !== "1";
          const serperBody: Record<string, unknown> = {
            q: searchQuery,
            num: Math.min(40, desiredCount),
          };
          if (useLicenseFilter) serperBody.tbs = "il:cl";
          if (requestedPage > 1) serperBody.page = requestedPage;

          const resp = await fetch("https://google.serper.dev/images", {
            method: "POST",
            headers: {
              "X-API-KEY": serperKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(serperBody),
            signal: AbortSignal.timeout(10_000),
          });
          if (!resp.ok) return [];
          const data = await resp.json();
          return ((data.images || []) as Array<{
            imageUrl?: string;
            thumbnailUrl?: string;
            title?: string;
            source?: string;
            link?: string;
          }>)
            .map((img) => ({
              url: img.imageUrl || "",
              thumbnailUrl: img.thumbnailUrl || img.imageUrl || "",
              title: img.title || "",
              source: img.source || "",
              link: img.link || "",
              generated: false as const,
              provider: "serper" as const,
            }))
            .filter((img) => !!img.url);
        } catch (err) {
          console.warn(
            `[images] serper exception page=${requestedPage}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          return [];
        }
      }

      async function fetchUnsplashImages(): Promise<MergedImage[]> {
        try {
          // unsplashSearch não suporta page nativamente — usamos fetch direto
          // pra controlar paginação. Mesma auth/timeout.
          if (!process.env.UNSPLASH_ACCESS_KEY) return [];
          const qs = new URLSearchParams({
            query: searchQuery,
            per_page: "30",
            page: String(requestedPage),
            orientation: "squarish",
          });
          const res = await fetch(
            `https://api.unsplash.com/search/photos?${qs.toString()}`,
            {
              method: "GET",
              headers: {
                Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
                "Accept-Version": "v1",
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(6_000),
            }
          );
          if (!res.ok) return [];
          const data = (await res.json()) as {
            results?: Array<{
              id?: string;
              description?: string | null;
              alt_description?: string | null;
              urls?: { regular?: string; small?: string; small_s3?: string; thumb?: string };
              user?: { name?: string; username?: string; links?: { html?: string } };
              links?: { download_location?: string; html?: string };
            }>;
          };
          return (data.results || [])
            .map((r) => {
              const url =
                r.urls?.regular || r.urls?.small || "";
              const thumbUrl =
                r.urls?.small_s3 || r.urls?.thumb || r.urls?.small || url;
              const author = r.user?.name || r.user?.username || "Unknown";
              const authorUrl = r.user?.links?.html || "https://unsplash.com";
              return {
                url,
                thumbnailUrl: thumbUrl,
                title:
                  r.description?.trim() ||
                  r.alt_description?.trim() ||
                  `Foto de ${author}`,
                source: "Unsplash",
                link: r.links?.html || "https://unsplash.com",
                generated: false as const,
                provider: "unsplash" as const,
                author,
                authorUrl,
                downloadLocation: r.links?.download_location,
              };
            })
            .filter((img) => !!img.url);
        } catch (err) {
          console.warn(
            `[images] unsplash exception page=${requestedPage}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          return [];
        }
      }

      const [serperImgs, unsplashImgs] = await Promise.all([
        fetchSerper(),
        fetchUnsplashImages(),
      ]);

      // Log de uso das 2 fontes — admin precisa ver volume de cada API.
      // Custo cosmético (Unsplash grátis; Serper $0.0003/query).
      if (serperImgs.length > 0) {
        void recordGeneration({
          userId: user.id,
          model: "serper",
          provider: "serper",
          inputTokens: 0,
          outputTokens: 0,
          costUsd: costForCall("serper"),
          promptType: "image-picker-search",
        });
      }
      if (unsplashImgs.length > 0) {
        void recordGeneration({
          userId: user.id,
          model: "unsplash",
          provider: "unsplash",
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          promptType: "image-picker-search",
        });
      }

      // Dedupe por URL. Intercala serper + unsplash pra variedade visual
      // (em vez de 40 do google + 30 unsplash em blocos).
      const seen = new Set<string>();
      const interleaved: MergedImage[] = [];
      const max = Math.max(serperImgs.length, unsplashImgs.length);
      for (let i = 0; i < max; i++) {
        for (const src of [serperImgs[i], unsplashImgs[i]]) {
          if (!src) continue;
          if (seen.has(src.url)) continue;
          seen.add(src.url);
          interleaved.push(src);
        }
      }

      console.log(
        `[images] OK picker-mix slide=${slideNumber ?? "?"} page=${requestedPage} serper=${serperImgs.length} unsplash=${unsplashImgs.length} merged=${interleaved.length}`
      );

      // hasMore heurístico: se alguma fonte retornou >= seu "per_page",
      // provavelmente tem mais páginas. Frontend usa pra habilitar o botão.
      const hasMore =
        serperImgs.length >= Math.min(40, desiredCount) ||
        unsplashImgs.length >= 30;

      return Response.json({
        images: interleaved,
        page: requestedPage,
        hasMore,
        counts: {
          serper: serperImgs.length,
          unsplash: unsplashImgs.length,
          merged: interleaved.length,
        },
      });
    }

    // ── Fluxo single-source (count ≤ 10) ────────────────────────────
    //
    // 2026-05-08: Auto-flow do carrossel SÓ usa generate (Imagen/Flash Image).
    // Se chegou aqui com mode != "search" significa que Imagen falhou pra
    // valer — retorna 502 e o front mostra "regenerar" no slide.
    //
    // Serper continua disponível APENAS quando o caller pede explicitamente
    // mode="search" (= botão "Buscar foto" no editor, ação manual do user).
    // Picker manual usa o branch isPickerManualMode acima (Serper+Unsplash).
    const isAutoFlow = !!useDecider || !!isCover || mode !== "search";
    if (isAutoFlow) {
      console.error(
        `[images] FALHA slide=${slideNumber ?? "?"} reason=auto-flow-gen-failed useDecider=${!!useDecider} isCover=${!!isCover} mode=${mode}`
      );
      return Response.json(
        {
          error:
            "Não foi possível gerar a imagem com IA agora. Tenta de novo daqui a pouco — ou clica em 'Regenerar' no slide.",
          images: [],
        },
        { status: 502 }
      );
    }

    // mode="search" explícito do user (handleSearchImage no editor).
    if (serperKey) {
      try {
        const useLicenseFilter =
          process.env.SERPER_DISABLE_LICENSE_FILTER !== "1";
        const serperBody: Record<string, unknown> = {
          q: searchQuery,
          num: desiredCount,
        };
        if (useLicenseFilter) {
          serperBody.tbs = "il:cl";
        }
        const resp = await fetch("https://google.serper.dev/images", {
          method: "POST",
          headers: {
            "X-API-KEY": serperKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(serperBody),
          signal: AbortSignal.timeout(10_000),
        });

        if (resp.ok) {
          const data = await resp.json();
          const rawImages = (data.images || [])
            .slice(0, Math.max(desiredCount * 3, 6))
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

          void recordGeneration({
            userId: user.id,
            model: "serper",
            provider: "serper",
            inputTokens: 0,
            outputTokens: 0,
            costUsd: costForCall("serper"),
            promptType: "image-picker-search",
          });

          const checked = await Promise.all(
            rawImages.map(async (img: { url: string }) => ({
              img,
              ok: await validateImageUrlForDisplay(img.url),
            }))
          );
          const validImages = checked
            .filter((c) => c.ok)
            .map((c) => c.img)
            .slice(0, desiredCount);

          if (validImages.length === 0) {
            console.warn(
              `[images] FALHA slide=${slideNumber ?? "?"} reason=serper-all-broken raw=${rawImages.length} query=${searchQuery.slice(0, 80)}`
            );
            return Response.json({ images: validImages });
          }

          const externalUrls = validImages.map(
            (img: { url: string }) => img.url
          );
          const cacheMap = await cacheExternalImages(user.id, externalUrls);
          let cachedCount = 0;
          const cachedImages = validImages.map(
            (img: { url: string; thumbnailUrl: string }) => {
              const cached = cacheMap.get(img.url);
              if (cached) {
                cachedCount++;
                return { ...img, url: cached, thumbnailUrl: cached };
              }
              return img;
            }
          );

          console.log(
            `[images] OK slide=${slideNumber ?? "?"} source=serper raw=${rawImages.length} valid=${validImages.length} cached=${cachedCount}`
          );
          return Response.json({ images: cachedImages });
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

    return Response.json({
      images: [],
      warning: "Nenhum resultado pra essa busca. Tenta outra query.",
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
