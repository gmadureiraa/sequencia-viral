import type { DesignTemplateId } from "@/lib/carousel-templates";
import {
  buildTemplateLockBlock,
  normalizeDesignTemplate,
} from "@/lib/carousel-templates";

/**
 * Extrai "ordens diretas" do briefing do usuário — título fixo entre aspas,
 * pedido de fidelidade literal (siga EXATAMENTE), modo "referência solta"
 * (use como exemplo mas foque em X). Essas diretivas passam como bloco de
 * alta prioridade antes do prompt principal, porque o Writer tinha tendência
 * de parafrasear/ignorar instruções literais.
 */
function parseBriefingOverrides(topic: string): {
  requiredTitle: string | null;
  strictFidelity: boolean;
  referenceWithTwist: boolean;
  literalQuotes: string[];
} {
  const text = topic || "";

  // Aspas unicode + ascii — usuário copia/cola de tudo quanto é lugar.
  // Regex case-insensitive captura o conteúdo dentro das aspas logo após
  // marcadores como "o título deve ser", "título:", "titulo tem que ser".
  const titlePatterns = [
    /(?:o\s+)?t[ií]tulo\s+(?:deve\s+ser|tem\s+que\s+ser|precisa\s+ser|ser[áa])\s*:?\s*["“”'‘’]{1,2}([^"“”'‘’]{3,200})["“”'‘’]{1,2}/i,
    /(?:o\s+)?t[ií]tulo\s*:\s*["“”'‘’]{1,2}([^"“”'‘’]{3,200})["“”'‘’]{1,2}/i,
    /(?:the\s+)?title\s+(?:should\s+be|must\s+be|has\s+to\s+be)\s*:?\s*["“”'‘’]{1,2}([^"“”'‘’]{3,200})["“”'‘’]{1,2}/i,
  ];
  let requiredTitle: string | null = null;
  for (const p of titlePatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      requiredTitle = m[1].trim();
      break;
    }
  }

  const strictFidelity =
    /siga\s+exat(a|amente)|reproduz(a|ir)\s+(o|esse|este)\s+conte[úu]do|copie\s+(o|esse|este)\s+conte[úu]do|use\s+o\s+mesmo\s+texto|exatamente\s+o\s+mesmo|palavra\s+por\s+palavra|verbatim/i.test(
      text
    );
  const referenceWithTwist =
    !strictFidelity &&
    /use\s+como\s+(refer[êe]ncia|inspira[çc][ãa]o|exemplo|base)|baseado\s+em|inspir(ado|ada|e-se)|no\s+estilo\s+de/i.test(
      text
    );

  // Coleta frases curtas entre aspas (≠ título) pra usar como "texto literal
  // que o user quer ver em algum slide ou CTA". Limita a 5 pra não poluir.
  const quoteMatches = Array.from(
    text.matchAll(/["“”'‘’]{1,2}([^"“”'‘’]{4,180})["“”'‘’]{1,2}/g)
  )
    .map((m) => m[1].trim())
    .filter((q) => !!q && q !== requiredTitle);
  const literalQuotes = Array.from(new Set(quoteMatches)).slice(0, 5);

  return { requiredTitle, strictFidelity, referenceWithTwist, literalQuotes };
}
import { extractContentFromUrl } from "@/lib/url-extractor";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import {
  firecrawlScrape,
  formatFirecrawlAsExtractorOutput,
  isFirecrawlConfigured,
} from "@/lib/firecrawl";
import { perplexityQuery, isPerplexityConfigured } from "@/lib/perplexity";
import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey, getRequestIp } from "@/lib/server/rate-limit";
import { captureRouteError } from "@/lib/server/sentry";
import { PLANS, FREE_PLAN_USAGE_LIMIT } from "@/lib/pricing";
import { getPostHogClient } from "@/lib/posthog-server";
import {
  geminiWithRetry,
  isGeminiQuotaExhausted,
} from "@/lib/server/gemini-retry";
import { GoogleGenAI } from "@google/genai";
import {
  extractSourceFacts,
  emptyFacts,
  formatFactsBlock,
} from "@/lib/server/source-ner";
import {
  validateImageQuery,
  buildFallbackImageQuery,
} from "@/lib/server/generate-carousel";
import { translateSourceIfNeeded } from "@/lib/server/translate-source";
import {
  describeImages,
  type ImageDescription,
} from "@/lib/server/describe-images";

// 120s cobre com folga: IG extract (~12s) + NER (~5s) + Pro writer (~45s)
// + retry Flash (~15s) + overhead. Antes era 60s — bug recorrente em gerações
// com URL Instagram justamente porque o pipeline todo passava de 60s quando
// incluía Apify + Gemini Vision OCR + Pro + retry strict.
export const maxDuration = 120;

/**
 * Frameworks narrativos opcionais (Content Machine 5.4 — BrandsDecoded).
 * Cada um força uma arquitetura narrativa específica no writer. Quando
 * não setado, o writer segue a "escada padrão" (hook → evidence → claim
 * → mechanism → ...). Útil pra usuário avançado que sabe o formato que
 * performa melhor pro tema dele.
 */
type ContentFramework =
  | "story-arc"         // Problema → Ponto de virada → Nova realidade (3 atos analíticos)
  | "problem-solution"  // Friction explícito → mecanismo → aplicação (mais tático)
  | "mechanism-first"   // Abre com o "POR QUE" contra-intuitivo, depois prova
  | "transformation";   // Antes/Depois narrativo (cena inicial → costura → consequência)

interface AdvancedGenerationOptions {
  /** CTA exato que o usuário quer fechar o carrossel. Sobrescreve CTA auto-gerado. */
  customCta?: string;
  /** Direcionamento do gancho / ângulo do slide 1 (ex: "foca em founders B2B que já tentaram ads"). */
  hookDirection?: string;
  /** Número de slides desejado (6-12). Default: 8. */
  numSlides?: number;
  /** Se setado, trava essa variação (não gera 3 variações, só 1). */
  preferredStyle?: "data" | "story" | "provocative";
  /** Contexto extra que o usuário quer injetar no prompt (links, dados, quotes). */
  extraContext?: string;
  /** URLs de imagens upadas pelo usuário pra usar em slides específicos (ordem = slide). */
  uploadedImageUrls?: string[];
  /** Framework narrativo do Content Machine 5.4. Default: escada automática. */
  contentFramework?: ContentFramework;
}

type GenerationMode = "writer" | "layout-only";

interface GenerateRequest {
  topic: string;
  sourceType: "idea" | "link" | "video" | "instagram" | "ai";
  sourceUrl?: string;
  niche: string;
  tone: string;
  language: string;
  /** Aceito por compatibilidade; a redação não depende do template (só preview/imagens no app). */
  designTemplate?: DesignTemplateId;
  /** Modo avançado — campos opcionais pra dar mais controle ao usuário. */
  advanced?: AdvancedGenerationOptions;
  /**
   * Writer (default): IA usa briefing como inspiração, escreve com archetypes + escada.
   * Layout-only: IA APENAS distribui o texto em slides, preserva wording, zero reescrita.
   */
  mode?: GenerationMode;
  /**
   * Opt-in para rodar uma query no Perplexity antes do writer e injetar
   * o resultado como bloco "FACT CHECK LIVE" no prompt. Default: false.
   * Quando false, ainda pode ativar via auto-detect (NER com dataPoints
   * recentes / números específicos). Falha silenciosa — se Perplexity
   * indisponível ou timeout, writer segue sem.
   */
  useFactCheck?: boolean;
}

type SlideVariant =
  | "cover"
  | "headline"
  | "photo"
  | "quote"
  | "split"
  | "cta"
  // Novas variantes BrandsDecoded overhaul (2026-04-22)
  | "solid-brand"
  | "text-only"
  | "full-photo-bottom";

interface Slide {
  heading: string;
  body: string;
  imageQuery: string;
  variant: SlideVariant;
  /** Optional: URL direta quando o usuário subiu imagem no modo avançado. */
  imageUrl?: string;
}

const VALID_VARIANTS: readonly SlideVariant[] = [
  "cover",
  "headline",
  "photo",
  "quote",
  "split",
  "cta",
  "solid-brand",
  "text-only",
  "full-photo-bottom",
] as const;

/**
 * Distribuição narrativa default quando o modelo esquece de preencher variant
 * ou devolve um valor inválido.
 *
 * Overhaul 2026-04-22: ritmo BrandsDecoded fixo. Primeiro slide = cover,
 * último = cover (CTA/closing com handle pill centralizado). Entre eles,
 * alterna entre `solid-brand` (fundo cor da marca, texto CAPS topo, imagem
 * quadrada meio) e `full-photo-bottom` (foto full-bleed, texto no bottom 1/3),
 * com `text-only` pulando quando o conteúdo pede denso.
 */
function fallbackVariant(index: number, total: number): SlideVariant {
  // Edge: 1 slide → só cover; 2 slides → cover + cta.
  if (total <= 1) return "cover";
  if (index === 0) return "cover";
  // Slide final: cover (fecha com mesma energia da capa + handle pill).
  if (index === total - 1) return "cover";
  // Penúltimo: foto impactante.
  if (index === total - 2) return "full-photo-bottom";

  // Ritmo fixo slide a slide (alternância BrandsDecoded):
  // 2 → solid-brand, 3 → full-photo-bottom, 4 → solid-brand,
  // 5 → full-photo-bottom, 6 → text-only (denso), 7 → solid-brand, ...
  const rotation: SlideVariant[] = [
    "solid-brand",         // slide 2
    "full-photo-bottom",   // slide 3
    "solid-brand",         // slide 4
    "full-photo-bottom",   // slide 5
    "text-only",           // slide 6
    "solid-brand",         // slide 7
    "full-photo-bottom",   // slide 8
  ];
  return rotation[(index - 1) % rotation.length];
}

/**
 * Mapeia variantes legacy (do Gemini antigo ou rascunhos) para as novas
 * variantes overhaul. Garante que nenhum slide fique com layout obsoleto.
 */
function mapLegacyVariant(v: SlideVariant): SlideVariant {
  switch (v) {
    case "photo":
      return "full-photo-bottom";
    case "headline":
      return "solid-brand";
    case "quote":
      return "text-only";
    case "split":
      return "solid-brand";
    // cover, cta, solid-brand, text-only, full-photo-bottom passam
    default:
      return v;
  }
}

function normalizeVariant(raw: unknown, index: number, total: number): SlideVariant {
  if (typeof raw === "string") {
    const v = raw.toLowerCase().trim() as SlideVariant;
    if (VALID_VARIANTS.includes(v)) return mapLegacyVariant(v);
  }
  return fallbackVariant(index, total);
}

interface Variation {
  title: string;
  style: "data" | "story" | "provocative";
  ctaType?: "save" | "comment" | "share";
  slides: Slide[];
}

interface GenerateResponse {
  variations: Variation[];
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    const { user } = auth;

    // Throttle por IP (5/min) para mitigar abuso quando atacante cria
    // múltiplos usuários autenticados rapidamente. Roda em paralelo com
    // o limite por user.id (50/h).
    const ipKey = `generate-ip:${getRequestIp(request)}`;
    const [ipLimiter, userLimiter] = await Promise.all([
      rateLimit({ key: ipKey, limit: 5, windowMs: 60 * 1000 }),
      rateLimit({
        key: getRateLimitKey(request, "generate", user.id),
        limit: 50,
        windowMs: 60 * 60 * 1000,
      }),
    ]);
    const limiter = !ipLimiter.allowed ? ipLimiter : userLimiter;
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

    // Atomic check-and-increment — elimina race condition onde duas
    // requests simultâneas com count = limit - 1 passariam pelo check
    // e ambas incrementariam. A RPC faz UPDATE condicional e retorna se
    // foi permitido. Se não tiver RPC disponível (ambiente antigo), faz
    // fallback pro check + increment sequencial (mantém compatibilidade
    // enquanto migration não roda).
    const sb = createServiceRoleSupabaseClient();
    let brandContext = "";
    let feedbackContext = "";
    let generationMemoryContext = "";
    let usageAlreadyIncremented = false;
    if (sb) {
      const { data: gate, error: gateErr } = await sb.rpc(
        "try_increment_usage_count",
        { uid: user.id }
      );
      if (!gateErr && Array.isArray(gate) && gate[0]) {
        const row = gate[0] as {
          out_allowed: boolean;
          out_new_count: number;
          out_usage_limit: number;
          out_plan: string;
        };
        if (!row.out_allowed) {
          return Response.json(
            {
              error: `Você atingiu o limite de ${row.out_usage_limit} carrosséis do plano ${row.out_plan || "free"}. Faça upgrade para continuar gerando.`,
              code: "PLAN_LIMIT_REACHED",
            },
            { status: 403 }
          );
        }
        usageAlreadyIncremented = true;
      } else if (gateErr) {
        console.warn(
          "[generate] try_increment_usage_count RPC indisponível, usando fallback:",
          gateErr.message
        );
      }

      const { data: prof } = await sb
        .from("profiles")
        .select("usage_count, usage_limit, plan, brand_analysis")
        .eq("id", user.id)
        .single();
      if (prof) {
        // Cap automático por plano — fonte de verdade é `lib/pricing.ts`.
        // Se o usage_limit no banco vier desalinhado (user legado com 9999,
        // overrides manuais, etc), aplicamos o cap do plano por cima.
        const dbLimit = prof.usage_limit ?? 5;
        const planCap =
          prof.plan === "business"
            ? PLANS.business.carouselsPerMonth
            : prof.plan === "pro"
              ? PLANS.pro.carouselsPerMonth
              : FREE_PLAN_USAGE_LIMIT;
        const limit = Math.min(dbLimit, planCap);
        const count = prof.usage_count ?? 0;
        if (!usageAlreadyIncremented && count >= limit) {
          return Response.json(
            {
              error: `Você atingiu o limite de ${limit} carrosséis do plano ${prof.plan || "free"}. Faça upgrade para continuar gerando.`,
              code: "PLAN_LIMIT_REACHED",
            },
            { status: 403 }
          );
        }
        // Extract brand context from same query
        const ba = prof.brand_analysis as Record<string, unknown> | null;
        if (ba && typeof ba === "object") {
          const pillars = Array.isArray(ba.content_pillars) ? (ba.content_pillars as string[]).join(", ") : "";
          const topics = Array.isArray(ba.top_topics) ? (ba.top_topics as string[]).join(", ") : "";
          const tone_detected = (ba.tone_detected as string) || "";
          const audience = (ba.audience_description as string) || "";
          const voice = (ba.voice_preference as string) || "";
          const voiceSamples = Array.isArray(ba.voice_samples)
            ? (ba.voice_samples as string[])
                .map((s) => (typeof s === "string" ? s.slice(0, 240) : ""))
                .filter(Boolean)
                .join("\n---\n")
            : "";
          const tabus = Array.isArray(ba.tabus)
            ? (ba.tabus as string[]).filter(Boolean).join(", ")
            : "";
          const contentRules = Array.isArray(ba.content_rules)
            ? (ba.content_rules as string[]).filter(Boolean).join("; ")
            : "";
          const voiceDna = (ba.__voice_dna ?? null) as {
            summary?: string;
            tone?: string[];
            hook_patterns?: string[];
            cta_style?: string;
            structure_signature?: string;
            vocabulary_markers?: string[];
            dos?: string[];
            donts?: string[];
            sample_captions?: string[];
          } | null;
          let voiceDnaBlock = "";
          if (voiceDna && typeof voiceDna === "object") {
            const dnaLines: string[] = [];
            if (voiceDna.summary) dnaLines.push(`Resumo: ${voiceDna.summary}`);
            if (voiceDna.tone?.length) dnaLines.push(`Tom: ${voiceDna.tone.join(", ")}`);
            if (voiceDna.hook_patterns?.length)
              dnaLines.push(`Padrões de hook: ${voiceDna.hook_patterns.join(" | ")}`);
            if (voiceDna.structure_signature)
              dnaLines.push(`Estrutura: ${voiceDna.structure_signature}`);
            if (voiceDna.cta_style) dnaLines.push(`CTA estilo: ${voiceDna.cta_style}`);
            if (voiceDna.vocabulary_markers?.length)
              dnaLines.push(`Marcadores vocabulário: ${voiceDna.vocabulary_markers.join(", ")}`);
            if (voiceDna.dos?.length)
              dnaLines.push(`Replicar: ${voiceDna.dos.join(" | ")}`);
            if (voiceDna.donts?.length)
              dnaLines.push(`Evitar: ${voiceDna.donts.join(" | ")}`);
            if (voiceDna.sample_captions?.length)
              dnaLines.push(
                `Trechos reais:\n${voiceDna.sample_captions.map((c) => `· ${c}`).join("\n")}`
              );
            if (dnaLines.length > 0) {
              voiceDnaBlock = `\n- VOICE DNA (carrosséis reais do criador, imite ritmo e estrutura sem copiar literalmente):\n${dnaLines.join("\n")}\n`;
            }
          }
          if (pillars || topics || tone_detected || audience || voice || voiceSamples || tabus || contentRules || voiceDnaBlock) {
            brandContext = `
USER BRAND CONTEXT (use this to make content sound authentically like this creator, not generic AI):
- Content pillars: ${pillars || "not specified"}
- Typical topics: ${topics || "not specified"}
- Detected writing tone: ${tone_detected || "not specified"}
- Target audience: ${audience || "not specified"}
- Voice preference: ${voice || "not specified"}
${voiceSamples ? `- Voice samples (imite ritmo e estrutura, NÃO copie literalmente):\n${voiceSamples}\n` : ""}${voiceDnaBlock}${tabus ? `- NEVER use these words or phrases: ${tabus}\n` : ""}${contentRules ? `- Rules to follow strictly: ${contentRules}\n` : ""}`;
          }

          // Memoria aprendida com feedback pos-download (ver
          // /api/feedback/carousel). Regras curtas, imperativas, extraidas
          // pelo Gemini Flash do texto livre do user. Aplicar com peso ALTO
          // no writer — user disse explicitamente o que quer.
          const memory = ba.__generation_memory as
            | { text_rules?: unknown; image_rules?: unknown }
            | undefined;
          const textRules = Array.isArray(memory?.text_rules)
            ? (memory.text_rules as unknown[])
                .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
                .slice(0, 20)
            : [];
          if (textRules.length > 0) {
            generationMemoryContext = `\n## DIRETRIZES APRENDIDAS COM FEEDBACK DO USER\n\nRegras vindas de feedback passado (PESO ALTO, respeitar sempre):\n${textRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nSe você violar qualquer uma dessas regras, o carrossel será rejeitado.\n`;
          }
        }
      }

      // Últimos 5 carrosséis com feedback negativo ou positivo + comment,
      // pra IA aprender com o sinal do próprio usuário. Falha silenciosa.
      try {
        const { data: fbRows } = await sb
          .from("carousels")
          .select("title,style,updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(40);
        if (Array.isArray(fbRows) && fbRows.length > 0) {
          const negatives: string[] = [];
          const positives: string[] = [];
          for (const row of fbRows) {
            const fb = (row.style as Record<string, unknown> | null)?.feedback as
              | Record<string, unknown>
              | undefined;
            if (!fb || typeof fb !== "object") continue;
            const s = fb.sentiment;
            const comment =
              typeof fb.comment === "string" ? fb.comment.trim() : "";
            if (s === "down") {
              negatives.push(
                `- "${(row.title || "sem título").slice(0, 60)}"${comment ? ` — ${comment.slice(0, 280)}` : ""}`
              );
            } else if (s === "up" && comment) {
              positives.push(
                `- "${(row.title || "sem título").slice(0, 60)}" — ${comment.slice(0, 280)}`
              );
            }
            if (negatives.length >= 5 && positives.length >= 3) break;
          }
          const parts: string[] = [];
          if (negatives.length) {
            parts.push(
              `CARROSSÉIS QUE ESTE USUÁRIO MARCOU COMO RUINS — EVITE esses padrões (tema, estrutura, clichês, tom):\n${negatives.slice(0, 5).join("\n")}`
            );
          }
          if (positives.length) {
            parts.push(
              `CARROSSÉIS QUE ESTE USUÁRIO MARCOU COMO BONS — reforce esses padrões quando fizer sentido:\n${positives.slice(0, 3).join("\n")}`
            );
          }
          if (parts.length) {
            feedbackContext = `\n${parts.join("\n\n")}\n`;
          }
        }
      } catch (err) {
        console.warn(
          "[generate] falha ao ler feedback do user:",
          err instanceof Error ? err.message : err
        );
      }
    }

    const body: GenerateRequest = await request.json();
    const { topic, sourceType, sourceUrl, niche, tone, language, advanced } = body;
    const mode: GenerationMode =
      body.mode === "layout-only" ? "layout-only" : "writer";
    const useFactCheckFlag = body.useFactCheck === true;
    // designTemplate AGORA é respeitado pelo writer (2026-04-25 — fix de fidelidade visual).
    // Antes era ignorado e o carrossel saía fora da referência. Hoje o template trava:
    //  - quantidade de slides (blockCount)
    //  - paleta (preferPalette / avoidPalette)
    //  - modifier estético injetado em TODAS as imageQuery
    //  - style guide narrativo coerente com o visual
    const designTemplateNormalized = normalizeDesignTemplate(body.designTemplate);
    const templateLockBlock = buildTemplateLockBlock(designTemplateNormalized);

    // Sanitiza campos do modo avançado — proteção contra prompt injection e tamanhos absurdos.
    const advCustomCta =
      typeof advanced?.customCta === "string"
        ? advanced.customCta.trim().slice(0, 300)
        : "";
    const advHookDirection =
      typeof advanced?.hookDirection === "string"
        ? advanced.hookDirection.trim().slice(0, 400)
        : "";
    const advExtraContext =
      typeof advanced?.extraContext === "string"
        ? advanced.extraContext.trim().slice(0, 2000)
        : "";
    const advNumSlides =
      typeof advanced?.numSlides === "number" &&
      advanced.numSlides >= 6 &&
      advanced.numSlides <= 12
        ? Math.round(advanced.numSlides)
        : null;
    const advPreferredStyle =
      advanced?.preferredStyle === "data" ||
      advanced?.preferredStyle === "story" ||
      advanced?.preferredStyle === "provocative"
        ? advanced.preferredStyle
        : null;
    const advUploadedImages = Array.isArray(advanced?.uploadedImageUrls)
      ? advanced.uploadedImageUrls
          .filter((u): u is string => typeof u === "string" && u.length < 2000)
          .slice(0, 12)
      : [];

    // Visão prévia das imagens — Gemini Flash analisa cada imagem ANTES do writer,
    // pra que a copy de cada slide case semanticamente com a imagem correspondente.
    let imageDescriptions: ImageDescription[] = [];
    if (advUploadedImages.length > 0) {
      try {
        imageDescriptions = await describeImages(advUploadedImages);
        console.log(
          `[generate] describe-images: ${imageDescriptions.length} imagens analisadas`
        );
      } catch (err) {
        console.warn("[describe-images] falhou, seguindo sem visão:", err);
      }
    }

    const advContentFramework: ContentFramework | null =
      advanced?.contentFramework === "story-arc" ||
      advanced?.contentFramework === "problem-solution" ||
      advanced?.contentFramework === "mechanism-first" ||
      advanced?.contentFramework === "transformation"
        ? advanced.contentFramework
        : null;
    const advancedActive =
      !!(advCustomCta || advHookDirection || advExtraContext || advNumSlides || advPreferredStyle || advContentFramework);

    if (sourceType === "idea" && !topic) {
      return Response.json({ error: "Topic is required" }, { status: 400 });
    }

    if (topic && topic.length > 5000) {
      return Response.json({ error: "Topic is too long (max 5000 chars)" }, { status: 400 });
    }
    if (sourceUrl && sourceUrl.length > 2000) {
      return Response.json({ error: "URL is too long (max 2000 chars)" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("[generate] GEMINI_API_KEY missing");
      return Response.json(
        { error: "Geração com IA não está configurada no servidor." },
        { status: 503 }
      );
    }

    // 1. Gather source content
    const t0 = Date.now();
    const timing = { source: 0, ner: 0, writer: 0 };
    let sourceContent = "";

    if (sourceType === "link" && sourceUrl) {
      // Fluxo preferido: Firecrawl (LLM-ready markdown, bypass de cookie/js/ad).
      // Se retornar null ou <200 chars, cai no url-extractor legado (fetch+regex).
      let usedMethod: "firecrawl" | "fallback" = "fallback";
      if (isFirecrawlConfigured()) {
        try {
          const fc = await firecrawlScrape(sourceUrl, { timeoutMs: 20_000 });
          if (fc && fc.markdown.length > 200) {
            sourceContent = formatFirecrawlAsExtractorOutput(fc, {
              maxChars: 8000,
            });
            usedMethod = "firecrawl";
          }
        } catch (err) {
          // firecrawlScrape já faz silent-fail, mas trancar aqui por garantia.
          console.warn(
            "[generate] firecrawl falhou, caindo pro scraper legado:",
            err instanceof Error ? err.message : String(err)
          );
        }
      }
      if (!sourceContent) {
        try {
          sourceContent = await extractContentFromUrl(sourceUrl);
          usedMethod = "fallback";
        } catch (err) {
          console.error("[generate] URL extraction failed:", err);
          return Response.json(
            {
              error: `Não foi possível extrair conteúdo da URL: ${err instanceof Error ? err.message : "erro desconhecido"}. Dica: cole o texto manualmente no campo "Minha ideia".`,
            },
            { status: 400 }
          );
        }
      }
      console.log(
        `[source] usado=${usedMethod} length=${sourceContent.length}`
      );
      // Track do scrape no generations log (custo zero no tier free mas
      // aparecer no admin é útil pra ver qual caminho foi usado).
      if (sb && usedMethod === "firecrawl") {
        try {
          await sb.from("generations").insert({
            user_id: user.id,
            model: "firecrawl",
            provider: "firecrawl",
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
            prompt_type: "source-scrape",
          });
        } catch {
          /* silent */
        }
      }
    } else if (sourceType === "video" && sourceUrl) {
      try {
        sourceContent = await getYouTubeTranscript(sourceUrl);
      } catch (err) {
        console.error("[generate] YouTube transcript failed:", err);
        return Response.json(
          {
            error: `Não foi possível extrair a transcrição do YouTube: ${err instanceof Error ? err.message : "erro desconhecido"}. O vídeo pode não ter legendas disponíveis.`,
          },
          { status: 400 }
        );
      }
    } else if (sourceType === "instagram" && sourceUrl) {
      try {
        const { extractInstagramContent } = await import(
          "@/lib/instagram-extractor"
        );
        sourceContent = await extractInstagramContent(sourceUrl);
        // Track scrape IG (Apify primário + possível ScrapeCreators
        // fallback + Gemini Vision OCR dos slides). Admin vê volume.
        if (sb) {
          try {
            await sb.from("generations").insert({
              user_id: user.id,
              model: "apify",
              provider: "apify",
              input_tokens: 0,
              output_tokens: 0,
              cost_usd: 0.02,
              prompt_type: "ig-scrape",
            });
          } catch {
            /* silent */
          }
        }
      } catch (err) {
        console.error("[generate] Instagram extraction failed:", err);
        return Response.json(
          {
            error: `Falha ao extrair o post do Instagram: ${
              err instanceof Error ? err.message : "erro desconhecido"
            }. Dica: cole a legenda como texto no modo "Minha ideia".`,
          },
          { status: 400 }
        );
      }
    }

    // 1.5. Pre-translate source if it's in a divergent language vs target.
    // Sem isso, o writer (com prompt cheio de "cite literal do source") tende
    // a copiar o idioma do source e ignorar a regra de LANGUAGE.
    sourceContent = await translateSourceIfNeeded(sourceContent, language);

    // 2. Build the prompt
    const langCode = (language || "pt-br").toLowerCase();
    const isPtBr = langCode === "pt-br" || langCode === "pt";
    const languageInstruction = isPtBr
      ? `LANGUAGE: PORTUGUÊS BRASILEIRO (pt-BR). Escreva TODO o conteúdo — headings, body, CTA, image queries — em português brasileiro coloquial. NUNCA use inglês no heading ou body. Use "você", não "tu". Imagem queries devem ser em inglês (são usadas em busca de imagens stock).`
      : langCode === "en"
        ? "LANGUAGE: ENGLISH. Write all heading, body, and CTA in English."
        : langCode === "es"
          ? "LANGUAGE: ESPAÑOL. Escribe todo el heading, body y CTA en español."
          : `LANGUAGE: ${language}`;

    // Arquiteturas narrativas do Content Machine 5.4. Cada uma é um "contrato"
    // de estrutura — a escada de slides tem papéis fixos por posição. Prompt
    // aplica só quando o user ativa via advanced.contentFramework.
    const frameworkSpec: Record<ContentFramework, string> = {
      "story-arc":
        "ARQUITETURA STORY-ARC (3 atos analíticos): Slide 1 = CAPA contraintuitiva. Slide 2 = CENÁRIO ANTIGO (o que todos conhecem). Slide 3 = RUPTURA (o ponto de virada, o que mudou). Slides 4 a N-1 = NOVA REALIDADE (consequências, evidências, mecanismo). Último slide = CTA que referencia o hook. Cada slide responde a pergunta deixada pelo anterior.",
      "problem-solution":
        "ARQUITETURA PROBLEM-SOLUTION: Slide 1 = sintoma/dor em cena concreta. Slide 2 = nomear o problema real (≠ sintoma). Slide 3 = FRICÇÃO CENTRAL (a tensão escondida que ninguém enxerga). Slides 4-5 = MECANISMO (por que o problema acontece). Slides 6-N-1 = APLICAÇÃO tática (passo a passo, checklist, exemplo). Último slide = CTA específico de experimentação.",
      "mechanism-first":
        "ARQUITETURA MECHANISM-FIRST: Slide 1 = afirmação contra-intuitiva que inverte a crença popular. Slide 2 = explicar POR QUE o fenômeno acontece (mecanismo explícito). Slide 3 = evidência/caso real. Slides 4-5 = implicação sistêmica (o que isso muda pra o leitor). Slide 6 = exceção/refinamento ('menos em X situação'). Slides 7+ = aplicação prática. Último = CTA.",
      "transformation":
        "ARQUITETURA TRANSFORMATION (antes/depois narrativo): Slide 1 = cena inicial forte (estado anterior — número, cena, confissão). Slides 2-3 = TRANSFORMAÇÃO (o que mudou com costura e consequência — não é só 'de X pra Y', é o PORQUÊ da virada). Slides 4-5 = o que EXATAMENTE virou a chave (mecanismo, decisão, descoberta). Slides 6+ = nova realidade e como replicar. Último = CTA que convida o leitor a começar a própria transformação.",
    };

    // Bloco de direcionamento do MODO AVANÇADO (sobrescreve defaults quando presente).
    const advancedBlock = advancedActive
      ? `
# MODO AVANÇADO — DIRECIONAMENTOS EXPLÍCITOS DO USUÁRIO (prioridade alta)
Esses direcionamentos VENCEM as defaults do prompt. Respeite literalmente.
${advHookDirection ? `- Gancho (slide 1) deve: ${advHookDirection}\n` : ""}${advCustomCta ? `- CTA final EXATO a usar (não reescreva, mantenha a intenção): "${advCustomCta}"\n` : ""}${advNumSlides ? `- Número de slides desejado: EXATAMENTE ${advNumSlides} (incluindo hook e CTA).\n` : ""}${advPreferredStyle ? `- Estilo forçado: ENTREGUE APENAS A VARIAÇÃO "${advPreferredStyle}" (ignore as outras 2 — array variations terá 1 item só).\n` : ""}${advContentFramework ? `- Framework narrativo ATIVO: ${frameworkSpec[advContentFramework]}\n` : ""}${advExtraContext ? `- Contexto adicional a considerar (dados, provas, quotes, exemplos do usuário):\n"""\n${advExtraContext}\n"""\n` : ""}
Se algum desses itens contradizer outra instrução genérica, o direcionamento do usuário vence.
`
      : "";

    // ── LAYOUT-ONLY MODE — prompt minimalista, NÃO escreve ──
    // 2026-04-25: templateLockBlock também aqui — mesmo no layout-only o
    // template trava blockCount, variants permitidas e modifier do imageQuery.
    const layoutOnlyPrompt = `🔒 REGRA INVIOLÁVEL #1 — IDIOMA DA SAÍDA

LANGUAGE = ${language === "pt-br" ? "português brasileiro (pt-BR)" : language}

Esta regra VENCE qualquer outra instrução deste prompt — incluindo "fidelidade ao source", citações literais, exemplos. Se o source/refs estão em outro idioma, você TRADUZ E ADAPTA mantendo significado, não copia o idioma original.

Exceção única: nomes próprios (pessoas, marcas, ferramentas), termos técnicos universalmente conhecidos (API, framework, ROI), e códigos/símbolos. TUDO o mais é traduzido.

Use "você" (não "tu" ou "tú"). Tom natural brasileiro, não Portugal.

Você é um FORMATADOR de texto em slides de carrossel. O usuário já escreveu o conteúdo. Sua ÚNICA função é distribuir esse texto em slides de Instagram/LinkedIn.

${templateLockBlock}

${languageInstruction}

# REGRAS INEGOCIÁVEIS

1. **PRESERVE O WORDING**: use as frases do usuário literalmente. NÃO reescreva. NÃO "melhore". NÃO adicione adjetivos. NÃO troque palavras por sinônimos.
2. **PRESERVE A ORDEM**: a ordem narrativa do texto do usuário é a ordem dos slides.
3. **PRESERVE DADOS E NOMES**: todo número, percentual, valor, empresa, pessoa, ferramenta citado pelo usuário vai LITERAL nos slides.
4. **PRESERVE O CTA**: se o usuário terminou com um CTA, esse é o último slide (variant "cta"). Não invente CTA novo.
5. **ZERO REESCRITA**: se a frase do usuário pode virar heading OU body sem mudar palavras, use assim. Quebra de heading/body é OPÇÃO DE EDIÇÃO, não de reescrita.

# O QUE VOCÊ FAZ

- DIVIDE o texto em 6-10 slides. Cada slide tem UMA ideia central.
- EXTRAI heading (frase curta, cortante, até 10 palavras) do trecho — pode ser a primeira frase OU uma síntese LITERAL do trecho.
- COLOCA o resto como body (preserva parágrafos do usuário).
- APLICA variant visual pra ritmo (BrandsDecoded overhaul): slide 1 = "cover", último = "cta", meio alterna entre "solid-brand" (fundo cor da marca) e "full-photo-bottom" (foto full-bleed + texto no bottom), com "text-only" como quebra quando tem parágrafo denso. Nunca 2 iguais seguidos.
- GERA imageQuery por slide: 4-6 palavras em inglês, cena concreta, modifier estético ("editorial documentary natural light"). Slide que fala de dados → close-up da consequência; slide de história → cena com pessoa.

# O QUE VOCÊ NÃO FAZ

- NÃO adiciona slides novos que o usuário não escreveu.
- NÃO reescreve frases "ruins" — o gosto é do usuário, não seu.
- NÃO adiciona cliffhangers, hooks, archetypes se não estavam lá.
- NÃO muda o CTA.
- NÃO inventa dado, empresa, nome, número.

${advancedBlock}

# OUTPUT
Retorne APENAS 1 variação (array \`variations\` com 1 item), style: "story" como default.

\`\`\`json
{
  "variations": [
    {
      "title": "título curto baseado no texto do usuário",
      "style": "story",
      "ctaType": "save",
      "slides": [
        { "heading": "string literal do user", "body": "resto do trecho preservado", "imageQuery": "english keywords", "variant": "cover|solid-brand|full-photo-bottom|text-only|cta", "imageRef": "number 1-based ou null se não usar imagem do user" }
      ]
    }
  ]
}
\`\`\`

TESTE ANTES DE RETORNAR: leia os slides gerados. O usuário reconhece as frases dele? Se você reescreveu qualquer frase, VOLTA e usa o wording original.`;

    // ── NICHE CONTEXTUALIZATION — reforço de nicho ──
    // Condensado em 24/04 pra reduzir tamanho do prompt.
    // IMPORTANTE: quando sourceType === "instagram", o niche guide é
    // SUPRIMIDO. O conteúdo vem de uma referência concreta do IG (caption
    // + OCR dos slides) — forçar niche sobre isso fazia o writer inventar
    // carrossel "de AI" em cima de ref motivacional (exemplo real: ref
    // @anajords sobre ambição virou carrossel sobre Claude/GPT).
    const nicheRefs: Record<string, string> = {
      "crypto/web3":
        "Bitcoin, Ethereum, Solana, wallets (Metamask, Phantom), DeFi (Uniswap, Aave), Vitalik, CZ, ETF BTC, halving",
      ai:
        "Claude, GPT-5, Gemini 2.5, Cursor, Windsurf, MCP, agents, RAG, Sam Altman, Dario Amodei",
      marketing:
        "LinkedIn, X, TikTok, HubSpot, Notion, Ahrefs, CAC, LTV, CTR, SEO, newsletter, founder-led",
      business:
        "ARR, MRR, burn, runway, rule of 40, OKR, a16z, Sequoia, YC, Bezos, Naval",
    };
    const shouldApplyNiche =
      niche && niche !== "general" && sourceType !== "instagram";
    const nicheGuide = shouldApplyNiche
      ? `

# NICHO: ${niche}
Todo exemplo/número/nome próprio no carrossel vem desse universo. Refs úteis: ${nicheRefs[niche] || "use refs reais do nicho"}. Se não sabe algo específico do briefing, use grounding (busca web). PROIBIDO: "empresa X" sem nome real, "a maioria" sem atribuição, analogia de fora do nicho.`
      : "";

    // Bloco IG-specific — PRIORIDADE MÁXIMA quando sourceType === "instagram".
    // A fonte é um carrossel IG com OCR dos slides. Esses slides SÃO o
    // carrossel. Writer estrutura e estiliza, NÃO reinventa.
    // Bug real 24/04 @anajords: ref motivacional virou carrossel AI genérico
    // porque o writer seguiu niche em vez da ref. Este bloco resolve isso.
    const igFidelityBlock =
      sourceType === "instagram"
        ? `

# 🔴 REFERÊNCIA IG = ESPINHA DORSAL LITERAL (vence TODAS as outras regras)
A fonte é um carrossel do Instagram com OCR dos slides originais. Essa ref NÃO é inspiração — é BASE. Regras duras:

1. **MAPEAMENTO 1:1**: cada slide OCR da ref vira 1 slide do seu carrossel. Se a ref tem 8 slides, seu carrossel tem 8 slides (não 6, não 10). Mesma ordem. O slide 1 da ref corresponde ao slide 1 seu, slide 2 ao slide 2, e assim por diante.

2. **WORDING PRESERVADO**: as frases dos slides OCR entram LITERAL no body dos seus slides. Você ESTRUTURA (escolhe variant, formata heading vs body, adiciona cliffhanger mínimo se falta), NÃO reescreve. Se a ref fala "O talento que busca está na habilidade que não pratica", seu slide fala EXATAMENTE "O talento que busca está na habilidade que não pratica" — não "A habilidade que você ignora é o talento que te falta".

3. **PADRÃO ESTRUTURAL PRESERVADO**: se a ref tem um padrão repetitivo ("A X que você busca está no Y que evita..."), as 3 variações (data/story/provocative) PRESERVAM o padrão. O que muda entre variações é APENAS capa (slide 1) e CTA (último). Meio idêntico.

4. **TEMA DA REF VENCE O NICHE**: ref sobre ambição/mentalidade → carrossel sobre ambição/mentalidade, mesmo que niche=ai. Niche dorme quando há ref IG.

5. **CAPTION DA REF**: a legenda original (quando forte) vai em 1 slide como frase literal entre aspas, OU vira o título da variação.

6. **ZERO CITAÇÕES FABRICADAS**: não invente dados/nomes/empresas que não estão na ref. Se a ref é motivacional sem dado, seu carrossel é motivacional sem dado (o critério "1 dado + 1 nome em slides 2-3" NÃO se aplica em IG com ref).

7. **SLIDE 1 (capa)**: use a frase de abertura da ref como hook OU crie hook que PREVIEW o padrão da ref. SLIDE FINAL (cta): ecoa a tese final da ref + 1 ação semantica.

Se ignorar essas regras: ref vira "inspiração solta" e o carrossel sai fora do tema. Teste: um espectador que leu a ref original reconhece seu carrossel como a mesma coisa? Se não, reescreva.`
        : "";

    // ── WRITER MODE — prompt compacto (v2 24/04) ──
    // Encolhido ~22% (14.5K → 11K chars) pra reduzir confusão de instruções
    // conflitantes, preservando 6 papéis CM5.4, 4 qualidades de headline,
    // STAIRCASE, PATTERN INTERRUPT e os 12 archetypes (com exemplos).
    // Seções CORTADAS completamente por redundância:
    // - "ANTÍDOTO A CONTEÚDO GENÉRICO" (fundido em SLIDE 1 + GROUND TRUTH)
    // - "RADICAL SPECIFICITY" (fundido em GROUND TRUTH)
    // - "CONTAGEM E EXEMPLOS CONCRETOS" (fundido em GROUND TRUTH)
    // - "STORY ARC CHECK" (fundido em QUALITY GATES)
    // - Niche guide com 4 parágrafos de refs → 1 linha por nicho
    //
    // 2026-04-25: templateLockBlock injetado NO TOPO. Sem isso, o writer
    // ignora o template visual e gera slides com layout/paleta/quantidade
    // fora da referência. Bloco vence qualquer regra estética abaixo.
    const writerPrompt = `🔒 REGRA INVIOLÁVEL #1 — IDIOMA DA SAÍDA

LANGUAGE = ${language === "pt-br" ? "português brasileiro (pt-BR)" : language}

Esta regra VENCE qualquer outra instrução deste prompt — incluindo "fidelidade ao source", citações literais, exemplos. Se o source/refs estão em outro idioma, você TRADUZ E ADAPTA mantendo significado, não copia o idioma original.

Exceção única: nomes próprios (pessoas, marcas, ferramentas), termos técnicos universalmente conhecidos (API, framework, ROI), e códigos/símbolos. TUDO o mais é traduzido.

Use "você" (não "tu" ou "tú"). Tom natural brasileiro, não Portugal.

You are the senior editorial director of BrandsDecoded meets Morning Brew meets Paul Graham. Every slide is a scene that earns the next swipe.

${templateLockBlock}

# LINGUAGEM (obrigatória)
Escreva como se uma criança de 12 anos precisasse entender sem reler. Frases máx 18 palavras. Zero jargão, zero corporês. Se não falaria em conversa com amigo, reescreva. Exceção: tom analítico pode usar 1-2 termos do nicho que o leitor reconhece.

${languageInstruction}
TONE: ${tone || "professional"}${shouldApplyNiche ? ` | NICHE: ${niche}` : ""}${nicheGuide}${igFidelityBlock}${advancedBlock}

Briefing do usuário é inspiração — você ESCREVE o carrossel, não só formata. Preserve dados/nomes (zero invenção).${brandContext ? `

# BRAND VOICE
${brandContext}
WEAVE, não acknowledge. O carrossel precisa soar como ESSE criador, não IA genérica.` : ""}${feedbackContext ? `

# FEEDBACK DO USUÁRIO (ground truth)
${feedbackContext}` : ""}${generationMemoryContext || ""}

# MISSÃO
Carrossel 6-10 slides em NARRATIVE TENSION — conflito entre o que todos assumem vs o que é real. Arco macro: leitura de superfície → fricção → reframe → mecanismo → prova → implicação → CTA específico.

# CONTENT MACHINE 5.4 — rode internamente antes de escrever (NÃO cole no JSON)
1. TRIAGEM: identifique (a) Transformação (virada + POR QUE + consequência), (b) Fricção central (tensão escondida, NÃO resumo do tema), (c) Âncoras (3-6 fatos/nomes/dados verificáveis).
2. HEADLINES com 4 qualidades: INTERRUPÇÃO + RELEVÂNCIA + CLAREZA + TENSÃO. Estrutura bi-linha: L1 captura (?/:), L2 ancora (.!).
3. 10 NATUREZAS DE ABORDAGEM (leituras, 3 variações = 3 naturezas diferentes): reenquadramento, conflito oculto, implicação sistêmica, contradição, ameaça/oportunidade, nomeação, diagnóstico cultural, inversão, ambição de mercado, mecanismo social.
4. ESPINHA DORSAL em 6 papéis (todos presentes): HOOK → MECANISMO (por quê) → PROVA (dado/caso) → APLICAÇÃO (consequência prática) → IMPLICAÇÃO MAIOR (zoom out) → DIREÇÃO (próximo passo — o que observar/testar, não "compre isso").

# SLIDE 1 — CAPA (padrão editorial)
Fórmula: "Afirmação Contraintuitiva + Pergunta de Aprofundamento" (12-25 palavras) OU compacta 6-8 palavras se archetype compacto (DATA SHOCK / CONFESSION / ENEMY NAMING). CAIXA ALTA. Dispositivos: hipérbole ("A MORTE DE X"), paradoxo ("ter 100 mil seguidores pode ser ruim"), informação privilegiada, contraste extremo. Body abre um LOOP que só o próximo slide fecha.

PROIBIDO: pergunta retórica ("Você já...", "E se eu te dissesse..."), verbos-zumbi ("descubra", "domine", "desvende", "revelado"), clichê ("tudo mudou", "jogo virou", "céu é o limite", "a revolução chegou").

# SLIDES 2 A N-1 — STAIRCASE (papéis narrativos, não repita 2 iguais seguidos)
SETUP · CLAIM · EVIDENCE · MECHANISM · EXCEPTION · APPLICATION · STAKES · TWIST · CALLBACK-CTA.

Escadas exemplo (8 slides):
- data: HOOK → EVIDENCE → CLAIM → MECHANISM → EXCEPTION → APPLICATION → STAKES → CALLBACK-CTA
- story: HOOK → SETUP → STAKES → CLAIM → MECHANISM → TWIST → APPLICATION → CALLBACK-CTA

REGRAS POR SLIDE:
- Slide 2 = SETUP. Slide 3 = RUPTURA que CONTRADIZ slide 1 (não expande). Slide 2 E 3: obrigatório 1 dado numérico + 1 nome próprio cada (puxe dos NER facts/factsBlock primeiro; sem isso, anedota específica).
- Uma ideia só. Body max 3 linhas com quebra. Primeiras 3 palavras = mini-hook.
- Micro-cliffhanger no final do body referenciando DADO/NOME/CENA do próprio slide. Nunca frase templática ("mas tem um detalhe que muda tudo", "aqui que a maioria para").
- PATTERN INTERRUPT: a cada 3 slides, quebre ritmo (statement → pergunta, analítico → metáfora curta). Nunca 4 seguidos com mesma estrutura.

# HOOK ARCHETYPES (12 — 1 por variação, 3 variações = 3 diferentes)
DATA SHOCK ("95% das agências falham aos 18 meses") · CONFESSION ("Queimei R$230k contratando") · ENEMY NAMING ("Seu ICP tá errado") · FORBIDDEN KNOWLEDGE ("O que agência 50+ NUNCA te conta") · ANTI-GURU ("Pare de postar todo dia") · SPECIFIC LOSS ("Perdi 3 clientes em 11 dias") · TIME COMPRESSION ("O briefing de 40 min que vale R$18k") · BEFORE/AFTER ("2023: 70h/semana. 2026: 20h") · RITUAL EXPOSÉ ("O que founders Série A fazem às 6h") · META-CRITIQUE ("Você vai scrollar 90% desse carrossel") · STATUS GAME ("Existe um mercado de M&A em agência") · QUESTION DE RUPTURA ("E se o problema não for o alcance?").

# CLOSING — CTA SEMÂNTICO (última linha = melhor linha)
(a) Fecha o loop do slide 1 por tema (não paráfrase literal). (b) UMA ação específica ao carrossel — teste: troca o tema, o CTA ainda serve? Se sim, falhou. (c) Opcional: prova social implícita.

✓ "Comenta qual dessas 3 métricas você mede hoje" · "Releia o slide 4 antes do seu próximo briefing" · "Testa em 1 cliente essa semana. Me conta" · "Comenta CLAUDE que eu mando o prompt na DM"
✗ "Salva esse carrossel" · "Me siga pra mais" · "Manda pra aquele amigo que..." · "O que você acha?"

# STYLES (3 variações, ARQUITETURAS diferentes, não adjetivos)
- **data**: arco em 3-5 dados encadeados. Voz analítica. Mechanism explícito.
- **story**: 1ª pessoa ou case específico. Cena, personagem, tempo, consequência.
- **provocative**: contradiz premissa do nicho, nomeia inimigo, traz prova. Nassim Taleb, não Pablo Marçal.

# GROUND TRUTH (inegociável)
NUNCA INVENTE números, empresas, valores, datas, citações. Sem dado no source → (a) número derivável com caveat ("1 em cada 3"), (b) anedota ("no meu último teste com X..."), (c) nome/cena concreta.
Briefing pede N itens reais? Entregue exatamente N com nomes reais. Ex: "5 skills do Claude" → Computer Use, Artifacts, Projects, Claude Code, MCP servers. Se não sabe 5: reduza pra 3 nomeados OU peça especificação. Nunca invente produtos/skills que não existem.
BANIDAS: "muitas pessoas", "a maioria", "resultados incríveis", "game-changer", "descubra como", "o segredo", "guia definitivo", "um olhar sobre", "análise de", "aspectos importantes", "estudo de caso", "nesse sentido", "atualmente".

# VISUAL RHYTHM — variant por slide
- "cover" — full-bleed + handle pill + título CAPS terço inferior. Abre e fecha (slide 1 E último SE quiser ciclo).
- "solid-brand" — cor sólida + título CAPS topo + imagem quadrada + body bottom. Meio do carrossel (2-4 usos).
- "full-photo-bottom" — full-bleed + gradient + título/body terço inferior. Cinemático. Quebra ritmo (1-3 usos).
- "text-only" — fundo escuro + 2-3 parágrafos center. Só em densidade analítica. Max 1x.
- "cta" — último. Accent button + handle.
Legacy aceitos (prefira os novos): headline, photo, quote, split.
RITMO FORÇADO (8 slides): cover → solid-brand → full-photo-bottom → solid-brand → full-photo-bottom → (solid-brand ou text-only) → full-photo-bottom → cta. Slide 1 = cover, último = cta, nunca 2 iguais seguidos, text-only max 1x.

# IMAGE QUERY — cena concreta DESSE slide
4-8 keywords inglês: SUBJECT + AÇÃO + AMBIENTE. Tema abstrato → "QUEM faz isso, em QUAL ambiente, com QUAL objeto". Dado/contraste → cena da CONSEQUÊNCIA ("burnout entrepreneur receipts scattered desk" > "financial crisis chart").

MODIFIER POR VARIAÇÃO (mesmo em todos slides da variação):
- data → "close-up macro shallow depth of field 35mm film grain"
- story → "cinematic still hard shadow 35mm film grain warm palette"
- provocative → "editorial documentary natural window light muted palette"

BANIDAS keywords: strategy, innovation, growth, AI, future, success, business, digital, mindset, impact, transformation, leadership, technology.

# QUALITY GATES (falhou qualquer → reescreva)
1. ESCADA: lendo só headings em sequência, a história fecha?
2. SLIDE 2 CONTRADIZ slide 1 (não só expande)?
3. ESPECIFICIDADE slides 2-3: cada um com 1 dado + 1 nome próprio?
4. INVENÇÃO ZERO: todo número/empresa existe no source, é anedota, ou tem caveat?
5. STORY ARC: se removo slide do meio, o próximo ainda faz sentido? Se sim, slide desperdício — reescreva.
6. CTA CITA algo específico DESSE carrossel (troca tema → CTA quebra)?
7. 3 VARIAÇÕES = 3 archetypes + 3 naturezas diferentes?
8. 6 PAPÉIS CM5.4 presentes (hook/mecanismo/prova/aplicação/implicação/direção)?
9. VARIANTS: slide 1 cover, último cta, nenhum repetido 2x seguidas, text-only max 1x?
10. ZERO clichês (descubra/domine/revelado/céu é o limite/jogo virou/pergunta retórica no slide 1)?

# OUTPUT FORMAT (JSON estrito, 3 variações)
{
  "variations": [
    {
      "title": "string",
      "style": "data" | "story" | "provocative",
      "ctaType": "save" | "comment" | "share",
      "slides": [
        { "heading": "string", "body": "string", "imageQuery": "4-8 english keywords", "variant": "cover" | "solid-brand" | "full-photo-bottom" | "text-only" | "cta", "imageRef": number | null }
      ]
    }
  ]
}
6-10 slides por variação. Toda slide tem variant válido.`;

    // Source content (transcrição YouTube, scrape de link, legenda de Instagram):
    // Video/podcast de 40-60min gera 10-15k chars de transcript. Cortar em 6k
    // perde as teses centrais (que costumam vir depois de 20min de warm-up).
    // Agora: 18k pra video (suficiente pra ~40min de fala densa), 10k pros outros.
    const SOURCE_SLICE = sourceType === "video" ? 18000 : 10000;
    if (sourceContent) {
      console.log(
        `[generate] sourceType=${sourceType} sourceContent=${sourceContent.length}chars (sliced to ${Math.min(
          sourceContent.length,
          SOURCE_SLICE
        )})`
      );
    }

    // ── NER pre-processing — roda SÓ se tem sourceContent ──
    // Extrai entities/dataPoints/quotes/arguments estruturados do source pra
    // forçar o writer a citar fatos específicos. Custo: ~$0.0005 (Flash).
    // Silent-fail: se der erro, segue sem o facts block.
    //
    // PIPELINE SIMPLIFICADO PRO INSTAGRAM (24/04 após bug athanasio.team):
    // Instagram tem 3 etapas pesadas de Gemini antes do writer (OCR dos
    // slides no extractor, NER aqui, Perplexity depois). Isso triplica
    // pontos de falha. Pulamos NER + Perplexity e confiamos no OCR da
    // extração + writer simples. Menos etapas = menos 500/safety/parse
    // errors. Tradeoff: perde um pouco de citação de fatos explícitos,
    // mas o writer ainda recebe o content completo com slides transcritos.
    const shouldRunNer = sourceContent && sourceType !== "instagram";
    timing.source = Date.now() - t0;
    const tNer = Date.now();
    const facts = shouldRunNer
      ? await extractSourceFacts(sourceContent, language)
      : emptyFacts();
    timing.ner = Date.now() - tNer;
    if (!facts.skipped) {
      console.log(
        `[generate] NER facts: ${facts.entities.length} entities, ${facts.dataPoints.length} dataPoints, ${facts.quotes.length} quotes, ${facts.arguments.length} args (${facts.durationMs}ms, ${facts.inputTokens}+${facts.outputTokens} tok)`
      );
    } else if (sourceType === "instagram") {
      console.log("[generate] NER pulado (sourceType=instagram — pipeline simplificado)");
    }
    const factsBlock = formatFactsBlock(facts);

    // ── FACT-CHECK LIVE (Perplexity) — opt-in + auto-detect ──
    // Só roda em writer mode (layout-only preserva wording do user, fact-check
    // é contra-produtivo ali). Critério auto-detect: NER achou dataPoints com
    // datas >=2024 OU números específicos (%, $, milhões) OU temos entities
    // recentes. Opt-in vence auto-detect — se user pediu, roda.
    let factCheckBlock = "";
    let perplexityMeta: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    } | null = null;
    const shouldAutoFactCheck = (() => {
      if (!isPerplexityConfigured()) return false;
      if (mode === "layout-only") return false;
      // IG skip (pipeline simplificado — ver comentário do NER acima)
      if (sourceType === "instagram") return false;
      if (useFactCheckFlag) return true;
      if (facts.skipped) return false;
      // Heurística: dataPoint com ano >=2024 ou com $/R$/% ou palavra "bilhão/milhão".
      const hasRecentOrSpecific = facts.dataPoints.some((d) => {
        if (/20(2[4-9]|[3-9]\d)/.test(d)) return true;
        if (/[%$€]/.test(d) || /R\$/i.test(d)) return true;
        if (/\b(bilh[ãa]o|milh[ãa]o|trilh[ãa]o|billion|million)\b/i.test(d))
          return true;
        return false;
      });
      return hasRecentOrSpecific && facts.keyPoints.length > 0;
    })();

    if (shouldAutoFactCheck) {
      // Monta query compacta com os 2 primeiros keyPoints (já são frases com
      // contexto do source) + ano atual pra Perplexity trazer o que mudou/ficou
      // verificável.
      const year = new Date().getFullYear();
      const kpSource = facts.keyPoints.slice(0, 2);
      const fallbackQuery = `Tema: ${topic ? topic.slice(0, 200) : "assunto do carrossel"}`;
      const queryBase =
        kpSource.length > 0
          ? kpSource.map((k, i) => `${i + 1}. ${k}`).join(" | ")
          : fallbackQuery;
      const question = `Em ${year}, verifique esses fatos e traga dados atualizados e fontes: ${queryBase}`;
      try {
        const pplx = await perplexityQuery(question, {
          timeoutMs: 15_000,
          model: "sonar",
          maxTokens: 500,
        });
        if (pplx && pplx.answer) {
          const citesStr =
            pplx.citations.length > 0
              ? `\n\nFONTES:\n${pplx.citations.slice(0, 5).map((c, i) => `[${i + 1}] ${c}`).join("\n")}`
              : "";
          factCheckBlock = `\n\n# FACT CHECK LIVE (Perplexity ${pplx.modelUsed})\nUse como ground truth adicional ao source. Se contradizer NER/source, preferir o dado mais recente verificável (priorize citar fontes reais do output):\n\n${pplx.answer}${citesStr}`;
          perplexityMeta = {
            model: pplx.modelUsed,
            inputTokens: pplx.inputTokens,
            outputTokens: pplx.outputTokens,
            costUsd: pplx.costUsd,
          };
          console.log(
            `[generate] perplexity fact-check ok: model=${pplx.modelUsed} in=${pplx.inputTokens} out=${pplx.outputTokens} cost=$${pplx.costUsd}`
          );
        } else {
          console.warn(
            "[generate] perplexity retornou null — seguindo sem fact-check"
          );
        }
      } catch (err) {
        console.warn(
          "[generate] perplexity query falhou, seguindo sem:",
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    // Parse ORDENS DIRETAS do briefing (título fixo, fidelidade literal,
    // modo "referência+twist"). Esse bloco vai PRIMEIRO no userMessage e é
    // marcado como prioridade máxima — o writer tinha hábito de parafrasear
    // instruções literais como "o título deve ser X".
    const overrides = parseBriefingOverrides(topic);
    const overrideLines: string[] = [];
    if (overrides.requiredTitle) {
      overrideLines.push(
        `• TÍTULO OBRIGATÓRIO (slide 1 / capa): use EXATAMENTE "${overrides.requiredTitle}" — não parafraseie, não encurte, não mude caixa. Se pedir CAPS no template, aplicar só na renderização; a string em si fica idêntica.`
      );
    }
    if (overrides.strictFidelity) {
      overrideLines.push(
        `• FIDELIDADE LITERAL: o usuário pediu pra SEGUIR EXATAMENTE a fonte/conteúdo. Reproduza wording, ordem e exemplos do source. Não reinvente ângulo, não "melhore" a voz. Mudanças só em quebra de slide.`
      );
    }
    if (overrides.referenceWithTwist) {
      overrideLines.push(
        `• REFERÊNCIA + TWIST: usuário quer USAR a fonte como base/inspiração mas adicionar um ângulo próprio. Respeite estrutura e fatos da fonte; só reescreva a voz se o briefing disser pra focar em outro ponto.`
      );
    }
    if (overrides.literalQuotes.length > 0) {
      overrideLines.push(
        `• TEXTOS ENTRE ASPAS NO BRIEFING (use como literal em algum slide ou CTA):\n${overrides.literalQuotes.map((q) => `  - "${q}"`).join("\n")}`
      );
    }
    const overridesBlock =
      overrideLines.length > 0
        ? `# ORDENS DIRETAS DO USUÁRIO (PRIORIDADE MÁXIMA — obedeça antes de qualquer regra estética ou de estilo do prompt)\n${overrideLines.join("\n")}\n\n`
        : "";

    // Bloco extra de fidelidade quando sourceContent existe. Writer tende a
    // usar fonte como "inspiracao solta" e criar carrossel generico. Isso
    // forca a citar fatos especificos do transcript. Versão IG é hard —
    // mapeamento 1:1 slides OCR → slides do carrossel.
    const sourceFidelityBlock = !sourceContent
      ? ""
      : sourceType === "instagram"
        ? `\n\n# 🔴 FIDELIDADE AO CARROSSEL DE INSTAGRAM (REGRA DURA — não ignore)
A fonte abaixo é um carrossel do Instagram com OCR dos slides originais. Esses slides SÃO o carrossel — você ESTRUTURA, não reinventa.

1. MAPEAMENTO 1:1 — mesma quantidade de slides da ref, mesma ordem. Slide N da ref = Slide N seu.
2. WORDING LITERAL — as frases dos slides OCR entram palavra-por-palavra no body dos seus slides. NUNCA reescreva "pra melhorar". Se a ref diz "A clareza que você quer está no tempo que não passa sozinho", você escreve EXATAMENTE isso.
3. PADRÃO — se a ref tem estrutura repetida ("A X que busca está no Y que evita"), as 3 variações preservam o padrão. Só muda capa (slide 1) e CTA (último).
4. TEMA DA REF VENCE — ref sobre ambição/mentalidade = carrossel sobre ambição/mentalidade, mesmo com niche=ai. Ignore niche guide.
5. CAPTION original em 1 slide (literal, entre aspas) ou como título da variação.
6. ZERO FABRICATION — se a ref não tem dado/nome, você não inventa ("1 dado + 1 nome nos slides 2-3" NÃO se aplica aqui).
7. imageQuery usa nomes/objetos/cenas da própria ref, não genérico do niche.

TESTE: alguém que leu a ref original reconhece seu carrossel como a mesma coisa? Se NÃO, reescreva.`
        : `\n\n# FIDELIDADE AO SOURCE (OBRIGATORIO — nao ignore)
O conteudo abaixo vem ${sourceType === "video" ? "da transcricao de um VIDEO DO YOUTUBE" : sourceType === "link" ? "de um ARTIGO/POST escrito" : "da fonte"}. Esse material e GROUND TRUTH. Regras:

1. CITE NOMES PROPRIOS que aparecem na fonte (pessoas, empresas, produtos). NAO reescreva pra generico. Se a fonte fala "Anthropic", escreve "Anthropic".
2. CITE NUMEROS/DATAS/ESTATISTICAS que aparecem na fonte. Se disse "crescimento de 300%", usa "300%". Nao arredonda, nao invente.
3. CITE FRASES DE IMPACTO do autor (max 80 chars) em 1 slide entre aspas.
4. NAO REESCREVA pra "melhorar" — voz do autor VALE MAIS que sua reinterpretacao. Seu trabalho e ESTRUTURAR, nao criar conteudo novo.
5. Fonte contradiz regra estilistica? Fonte vence.
6. imageQuery usa nomes/objetos/cenas especificas da fonte, nao generico.

Se ignorar, o carrossel fica shallow e generico — não é o que o criador quer.`;

    // Facts block (NER) entra ANTES do source content, pra o LLM ver os fatos
    // que deve citar antes de ler a massa de texto. Fact-check do Perplexity
    // entra logo depois (só em writer mode — layout-only skipa).
    const factsBlockPrefix = factsBlock ? `\n\n${factsBlock}` : "";
    const factCheckSuffix = factCheckBlock;

    // Bloco de imagens do usuário — injetado ANTES do conteúdo principal pra que
    // o writer associe semanticamente cada slide às imagens disponíveis.
    // O modelo deve retornar `imageRef` (1-based) em cada slide que quiser usar imagem.
    const imagesBlock =
      imageDescriptions.length > 0
        ? `\n\n# IMAGENS QUE O USER QUER USAR (você DEVE incorporar nos slides certos)\n${imageDescriptions
            .map(
              (img, i) =>
                `- Imagem #${i + 1}: ${img.kind} · ${img.description} · mood ${img.mood}`
            )
            .join("\n")}\n\nREGRA: cada slide que use imagem deve ter copy que CASA com a imagem. Você decide a ORDEM pelo conteúdo. Devolva no JSON: slides[i].imageRef = índice (1, 2, 3...) da imagem que casa, ou null se não usar imagem nesse slide.`
        : "";

    const userMessage =
      mode === "layout-only"
        ? // Em layout-only + source: o transcript/scrape VIRA o texto a ser formatado
          // (não é "fonte adicional", é O conteúdo). Topic do user é só hint/contexto.
          sourceContent
          ? `${overridesBlock}TEXTO PRA FORMATAR EM SLIDES — extraído da fonte (${sourceType}). Preserve wording, ordem, dados, fale da cabeça do autor quando fizer sentido:${sourceFidelityBlock}${factsBlockPrefix}${imagesBlock}\n\n"""\n${sourceContent.slice(0, SOURCE_SLICE)}\n"""${topic && topic.trim().length > 50 ? `\n\nContexto/direcionamento do usuário:\n${topic.slice(0, 1000)}` : ""}`
          : `${overridesBlock}TEXTO DO USUÁRIO PRA FORMATAR EM SLIDES (preserve wording, ordem, dados, CTA):${imagesBlock}\n\n"""\n${topic}\n"""`
        : sourceContent
          ? `${overridesBlock}Create 3 carousel variations (data, story, provocative) based on this content:\n\nTopic: ${topic}${sourceFidelityBlock}${factsBlockPrefix}${imagesBlock}${factCheckSuffix}\n\nSource (${sourceType}):\n${sourceContent.slice(0, SOURCE_SLICE)}`
          : `${overridesBlock}Create 3 carousel variations (data, story, provocative) about: ${topic}${imagesBlock}${factCheckSuffix}`;

    // Se o usuário pediu fidelidade literal, força layout-only — writer
    // ainda parafraseia mesmo com instrução. Layout-only é o único modo
    // que GARANTE preservação de wording.
    const effectiveMode: GenerationMode =
      overrides.strictFidelity && sourceContent ? "layout-only" : mode;
    if (effectiveMode !== mode) {
      console.log(
        "[generate] briefing com 'siga exatamente' + source — forçando layout-only"
      );
    }

    // Escolhe o prompt baseado no effectiveMode (UI + overrides).
    const systemPrompt =
      effectiveMode === "layout-only" ? layoutOnlyPrompt : writerPrompt;

    // 3. Increment usage BEFORE calling AI — ensures quota is always counted
    //    even if the response fails or user closes the tab. Se a RPC
    //    atômica já fez o increment, pula essa etapa.
    if (sb && !usageAlreadyIncremented) {
      const { error: incErr } = await sb.rpc("increment_usage_count", { uid: user.id });
      if (incErr) {
        console.warn("[generate] RPC increment failed, falling back:", incErr.message);
        const { data: currentProfile } = await sb
          .from("profiles")
          .select("usage_count")
          .eq("id", user.id)
          .single();
        if (currentProfile) {
          await sb
            .from("profiles")
            .update({ usage_count: (currentProfile.usage_count ?? 0) + 1 })
            .eq("id", user.id);
        }
      }
    }

    // 4. Call Gemini
    // - Writer mode: Pro (qualidade prioritária — criação de conteúdo do zero).
    //   + Google Search grounding ativo → IA busca fatos recentes quando
    //     o tópico exige (nome de ferramenta, release, evento, stat). Custo
    //     extra: $35/1K grounding queries. Vale pra qualidade.
    //   ⚠️ Tools + responseMimeType="application/json" são mutuamente exclusivos
    //     no Gemini. Quando grounding ativo, dropamos mimeType e parseamos JSON
    //     manualmente (regex fallback já existe).
    // - Layout-only mode: Flash + JSON mime (sem grounding — layout é só
    //   formatação, não precisa pesquisa).
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    // IG source: Flash como writer default. Motivo: IG content (OCR de
    // slides + caption) é curto e direto, não precisa da "criatividade"
    // do Pro. Flash é mais rápido (~15s vs 40s), mais obediente em JSON
    // strict e elimina o ponto de falha do parse que afeta Pro com
    // prompts de 49K chars. Tradeoff: qualidade editorial um pouco menor
    // — aceitável dado que IG é ingestão de conteúdo já pronto.
    // Twitter template: conteúdo é screenshot de tweet (texto puro, sem
    // estética cinematográfica). Flash dá conta com qualidade equivalente
    // e corta ~25-40s do tempo total (Pro 40s → Flash 15s). Decisão
    // 2026-04-28 após user reportar 90s na geração.
    const modelId =
      effectiveMode === "layout-only"
        ? "gemini-2.5-flash"
        : sourceType === "instagram"
          ? "gemini-2.5-flash"
          : designTemplateNormalized === "twitter"
            ? "gemini-2.5-flash"
            : "gemini-2.5-pro";
    // Thinking budget calibrado (writer): 8000 dá raciocínio pra estrutura
    // 3-atos + escolher dados específicos. Antes era 12000 mas gastava ~10s
    // extras sem ganho visível de qualidade (thoughtsTokens P50 ~2200, bem
    // abaixo do limite). Output: 10000 cabe com folga 3 variations × 10
    // slides (~1500 tokens de conteúdo).
    //
    // IG source especial: content curto (captions + OCR de slides,
    // ~1000 chars), não precisa de thinking pesado. 6000 já sobra.
    // Isso reduz latência total: 60s → ~48s no P95 pra gerar a partir
    // de Instagram, evitando timeout do Vercel.
    const thinkingBudget =
      effectiveMode === "layout-only"
        ? 2000
        : sourceType === "instagram"
          ? 6000
          : 8000;
    const maxOutputTokens = effectiveMode === "layout-only" ? 10000 : 10000;
    // GROUNDING DESATIVADO como default após descoberta (24/04) que Pro +
    // grounding + system "output JSON" retorna JSON DENTRO de ```json fences
    // com frequência, quebrando o parse. Grounding é mutuamente exclusivo
    // com responseMimeType=application/json — só tem sentido se precisar
    // pesquisar fatos recentes no meio da geração. Mas:
    //   (a) fact-check via Perplexity já roda ANTES do writer (mais
    //       confiável e previsível)
    //   (b) JSON mode + Pro funciona 100% em todos testes
    //   (c) retry estrito com Flash sempre cai em JSON mode mesmo
    // Se precisar grounding pontualmente no futuro, passa override via body.
    const useGrounding = false;

    // Helper: roda 1 tentativa do writer Gemini + parse + validate.
    // Retorno tipado permite diferenciar retry-eligível de fatal.
    type AttemptResult =
      | {
          ok: true;
          result: GenerateResponse;
          textResponse: string;
          inputTokens: number;
          outputTokens: number;
        }
      | {
          ok: false;
          reason: "gemini-error" | "empty" | "parse" | "structure";
          details: Record<string, unknown>;
          retryable: boolean;
        };

    // Prompt MINIMAL pra retry estrito. O systemPrompt original tem ~49k
    // chars (12k tokens) — enorme e às vezes confunde Gemini sobre o
    // formato de output. O prompt minimal abaixo força JSON cru sem
    // gastar contexto em voice coaching (mesmo modelo já foi treinado
    // nas instruções na attempt 1).
    const minimalStrictSystemPrompt = `Você é um gerador de carrossel Instagram em português brasileiro.

Gere 3 variações do carrossel (data, story, provocative) a partir do conteúdo fornecido pelo usuário.

OUTPUT OBRIGATÓRIO — apenas este JSON, sem fences, sem markdown, sem texto antes ou depois:

{
  "variations": [
    {
      "title": "string",
      "style": "data",
      "slides": [
        { "heading": "string", "body": "string", "imageQuery": "string em inglês" }
      ]
    },
    { "title": "...", "style": "story", "slides": [...] },
    { "title": "...", "style": "provocative", "slides": [...] }
  ]
}

Regras:
- 6-8 slides por variação
- heading curto (≤ 60 chars), body ≤ 180 chars
- imageQuery em inglês, 4-6 palavras, cena concreta
- texto em português brasileiro, tom direto, sem guru
- Primeiro caractere da resposta é '{', último é '}'`;

    async function runWriterAttempt(strict: boolean): Promise<AttemptResult> {
      // Attempt 1 (strict=false): Pro + systemPrompt completo + JSON mode + temp 0.85
      // Attempt 2 (strict=true):  Flash + systemPrompt MINIMAL + JSON mode + temp 0.3
      //                           — troca prompt de 49K chars por ~600 chars pra
      //                           eliminar recency bias e confusão de formato.
      const attemptSystem = strict ? minimalStrictSystemPrompt : systemPrompt;
      const attemptModel = strict ? "gemini-2.5-flash" : modelId;
      const attemptThinkingBudget = strict ? 4000 : thinkingBudget;

      let textResponse = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let finishReason: string | undefined;

      try {
        const genResult = await geminiWithRetry(() =>
          ai.models.generateContent({
            model: attemptModel,
            contents: `${userMessage}\n\n[variation-seed: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}]`,
            config: {
              systemInstruction: attemptSystem,
              temperature: strict ? 0.3 : 0.85,
              topP: strict ? 0.8 : 0.9,
              maxOutputTokens,
              // Sempre JSON mode — grounding off resolve o bug de fences.
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: attemptThinkingBudget },
            },
          })
        );
        textResponse = genResult.text || "";
        finishReason = genResult.candidates?.[0]?.finishReason;
        const usage = genResult.usageMetadata;
        if (usage) {
          inputTokens = usage.promptTokenCount ?? 0;
          outputTokens = usage.candidatesTokenCount ?? 0;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          reason: "gemini-error",
          details: {
            msg,
            stack: err instanceof Error ? err.stack : undefined,
            strict,
          },
          // Retryable true — Flash pode resolver onde Pro falhou.
          retryable: true,
        };
      }

      // Log finishReason sempre — MAX_TOKENS/SAFETY/etc quebram output.
      if (finishReason && finishReason !== "STOP") {
        console.warn(
          `[generate] finishReason=${finishReason} strict=${strict} outputLen=${textResponse.length}`
        );
      }

      if (!textResponse) {
        return {
          ok: false,
          reason: "empty",
          details: { strict },
          retryable: true,
        };
      }

      // Parse JSON — defensive ladder:
      // 1. Parse direto (JSON mode puro)
      // 2. Strip markdown fences ```json ... ``` (defensivo caso modelo
      //    ainda vaze fence mesmo com responseMimeType)
      // 3. Regex match do primeiro `{...}` balanceado
      let parsed: unknown;
      const stripFences = (s: string): string => {
        // Remove ```json\n...\n``` ou ```...```
        const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (fenceMatch) return fenceMatch[1].trim();
        return s.trim();
      };

      try {
        parsed = JSON.parse(textResponse);
      } catch {
        const stripped = stripFences(textResponse);
        if (stripped !== textResponse.trim()) {
          try {
            parsed = JSON.parse(stripped);
          } catch {
            // segue pro próximo fallback
            const match = stripped.match(/\{[\s\S]*\}/);
            if (match) {
              try {
                parsed = JSON.parse(match[0]);
              } catch (parseErr) {
                return {
                  ok: false,
                  reason: "parse",
                  details: {
                    textResponseLen: textResponse.length,
                    textResponseHead: textResponse.slice(0, 800),
                    finishReason: finishReason ?? "unknown",
                    parseErrMsg:
                      parseErr instanceof Error
                        ? parseErr.message
                        : String(parseErr),
                    strict,
                  },
                  retryable: true,
                };
              }
            } else {
              return {
                ok: false,
                reason: "parse",
                details: {
                  textResponseLen: textResponse.length,
                  textResponseHead: textResponse.slice(0, 800),
                  finishReason: finishReason ?? "unknown",
                  strict,
                },
                retryable: true,
              };
            }
          }
        } else {
          const match = textResponse.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              parsed = JSON.parse(match[0]);
            } catch (parseErr) {
              return {
                ok: false,
                reason: "parse",
                details: {
                  textResponseLen: textResponse.length,
                  textResponseHead: textResponse.slice(0, 800),
                  finishReason: finishReason ?? "unknown",
                  parseErrMsg:
                    parseErr instanceof Error
                      ? parseErr.message
                      : String(parseErr),
                  strict,
                },
                retryable: true,
              };
            }
          } else {
            return {
              ok: false,
              reason: "parse",
              details: {
                textResponseLen: textResponse.length,
                textResponseHead: textResponse.slice(0, 800),
                finishReason: finishReason ?? "unknown",
                strict,
              },
              retryable: true,
            };
          }
        }
      }

      const typed = parsed as { variations?: unknown };
      if (!typed.variations || !Array.isArray(typed.variations)) {
        return {
          ok: false,
          reason: "structure",
          details: {
            resultKeys: Object.keys(typed ?? {}),
            variationsType: typeof typed?.variations,
            strict,
          },
          retryable: true,
        };
      }

      return {
        ok: true,
        result: parsed as GenerateResponse,
        textResponse,
        inputTokens,
        outputTokens,
      };
    }

    // Rollback de uso (decrementa) quando 2 tentativas falham. User não paga
    // por falha do modelo — é problema nosso, não dele. Chama só se o uso foi
    // efetivamente incrementado antes.
    async function rollbackUsage() {
      if (!sb || !usageAlreadyIncremented) return;
      try {
        const { data: prof } = await sb
          .from("profiles")
          .select("usage_count")
          .eq("id", user.id)
          .single();
        const current = prof?.usage_count ?? 0;
        if (current > 0) {
          await sb
            .from("profiles")
            .update({ usage_count: current - 1 })
            .eq("id", user.id);
          console.log(
            `[generate] usage rollback: userId=${user.id} ${current} → ${current - 1}`
          );
        }
      } catch (err) {
        console.error(
          "[generate] rollback falhou:",
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    const tWriter = Date.now();
    // Telemetria de retry — antes a falha do attempt 1 era invisível.
    // Audit P3 (Antigravity): "retry silencioso degrada qualidade sem avisar".
    // meta.retried=true sinaliza pro front (e logs) que foi attempt 2 (Flash).
    let wasRetried = false;
    let actualModelUsed: string = modelId;
    let attempt = await runWriterAttempt(false);
    if (!attempt.ok && attempt.retryable) {
      console.warn("[generate] attempt 1 falhou, tentando strict retry:", {
        userId: user.id,
        sourceType,
        sourceUrl: sourceUrl?.slice(0, 200),
        reason: attempt.reason,
        details: attempt.details,
      });
      wasRetried = true;
      actualModelUsed = "gemini-2.5-flash";
      attempt = await runWriterAttempt(true);
    }

    if (!attempt.ok) {
      console.error("[generate] ambas tentativas falharam:", {
        userId: user.id,
        sourceType,
        sourceUrl: sourceUrl?.slice(0, 200),
        reason: attempt.reason,
        details: attempt.details,
      });
      await rollbackUsage();
      if (attempt.reason === "gemini-error") {
        const msg = (attempt.details.msg as string | undefined) ?? "falha na IA";
        // Quota exhausted (Free Tier da Gemini API ou billing pausado).
        // Frontend tem handler dedicado pra 503 com msg amigável. Não
        // mandar 502 porque o fallback do cliente é "modelo devolveu
        // resposta inválida" — mentira, o modelo nem foi chamado.
        if (isGeminiQuotaExhausted({ message: msg })) {
          console.warn(
            "[generate] quota Gemini esgotada — retornando 503 (billing?)"
          );
          return Response.json(
            {
              error:
                "IA indisponível agora (cota diária atingida). Tenta em alguns minutos — já tô resolvendo do nosso lado.",
            },
            { status: 503 }
          );
        }
        return Response.json(
          {
            error:
              process.env.NODE_ENV === "production"
                ? `Geração com IA falhou. ${msg.slice(0, 120)}`
                : `Geração com IA falhou. ${msg}`,
          },
          { status: 502 }
        );
      }
      return Response.json(
        {
          error:
            "Modelo devolveu resposta inválida. Tenta novamente em alguns segundos — não cobramos esse erro no seu plano.",
        },
        { status: 502 }
      );
    }

    const textResponse = attempt.textResponse;
    const inputTokens = attempt.inputTokens;
    const outputTokens = attempt.outputTokens;
    const result = attempt.result;
    timing.writer = Date.now() - tWriter;
    console.log(
      `[generate][timing] source=${timing.source}ms ner=${timing.ner}ms writer=${timing.writer}ms total=${Date.now() - t0}ms mode=${effectiveMode} out_tokens=${outputTokens}`
    );

    // 5b. Normalize + sanitize slides:
    //     - variant: apenas corrige inválidos. NÃO força slide 1 = cover
    //       (Gabriel reclamou que os 2 primeiros slides sempre eram iguais).
    //       O prompt já pede pra variar abertura entre variações.
    //     - heading/body: se Gemini esqueceu, preenche fallback pra não crashar.
    for (const variation of result.variations) {
      if (!variation?.slides || !Array.isArray(variation.slides)) continue;
      const total = variation.slides.length;
      variation.slides = variation.slides.map((s, i) => {
        const raw = s as {
          heading?: unknown;
          body?: unknown;
          imageQuery?: unknown;
          variant?: unknown;
          imageUrl?: unknown;
        };
        const heading =
          typeof raw.heading === "string" && raw.heading.trim()
            ? raw.heading
            : "(sem título)";
        const body =
          typeof raw.body === "string" && raw.body.trim()
            ? raw.body
            : "";
        let imageQuery =
          typeof raw.imageQuery === "string" ? raw.imageQuery : "";
        // Validação de imageQuery: rejeita se for genérico ou tiver banned keyword.
        // Se falhar, injeta fallback usando entity do NER + slice do heading.
        const imgValidation = validateImageQuery(imageQuery);
        if (!imgValidation.ok) {
          const fallback = buildFallbackImageQuery(
            typeof raw.heading === "string" ? raw.heading : "",
            typeof raw.body === "string" ? raw.body : "",
            facts
          );
          console.log(
            `[generate] imageQuery rejected (${imgValidation.reason}): "${imageQuery}" → "${fallback}"`
          );
          imageQuery = fallback;
        }
        const imageUrl =
          typeof raw.imageUrl === "string" && raw.imageUrl.trim()
            ? raw.imageUrl
            : undefined;
        // Overhaul 2026-04-22: slide 1 = cover (capa BrandsDecoded com handle
        // pill), último = cta (CTA com handle pill + accent button). Ambos
        // fixos. Meio segue o ritmo solid-brand / full-photo-bottom /
        // text-only alternado pela distribuição (normalizeVariant + fallback).
        let variant: SlideVariant;
        if (total <= 1) {
          variant = "cover";
        } else if (i === 0) {
          variant = "cover";
        } else if (i === total - 1) {
          variant = "cta";
        } else {
          variant = normalizeVariant(raw.variant, i, total);
        }
        return { heading, body, imageQuery, variant, ...(imageUrl ? { imageUrl } : {}) };
      });

      // Anti-monotonia: nunca 2 slides iguais consecutivos. Percorre toda
      // a sequência e troca duplicatas pelo variant de maior contraste.
      const contrast: Record<SlideVariant, SlideVariant> = {
        cover: "solid-brand",
        headline: "full-photo-bottom",
        photo: "solid-brand",
        quote: "solid-brand",
        split: "full-photo-bottom",
        cta: "solid-brand",
        "solid-brand": "full-photo-bottom",
        "full-photo-bottom": "solid-brand",
        "text-only": "full-photo-bottom",
      };
      for (let i = 1; i < variation.slides.length; i++) {
        if (variation.slides[i].variant === variation.slides[i - 1].variant) {
          const prev = variation.slides[i - 1].variant;
          variation.slides[i] = {
            ...variation.slides[i],
            variant: contrast[prev] ?? "solid-brand",
          };
        }
      }
    }

    // MODO AVANÇADO — pós-processamento
    // Se o user travou um estilo, filtra as variações pra ficar só com ele.
    if (advPreferredStyle && result.variations.length > 1) {
      const filtered = result.variations.filter(
        (v) => (v as { style?: string }).style === advPreferredStyle
      );
      if (filtered.length > 0) {
        result.variations = filtered.slice(0, 1);
      }
    }

    // Pós-processamento de imagens do usuário.
    // Se o modelo retornou imageRef (1-based) nos slides, usa esse mapeamento semântico.
    // Fallback posicional (comportamento antigo) cobre slides sem imageRef.
    if (advUploadedImages.length > 0 && result.variations[0]?.slides) {
      // Etapa 1: aplica imageRef do modelo (mapeamento semântico)
      for (let i = 0; i < result.variations[0].slides.length; i++) {
        const slide = result.variations[0].slides[i] as {
          imageUrl?: string;
          imageRef?: number;
        };
        if (
          typeof slide.imageRef === "number" &&
          slide.imageRef >= 1 &&
          slide.imageRef <= advUploadedImages.length
        ) {
          slide.imageUrl = advUploadedImages[slide.imageRef - 1];
        }
      }
      // Etapa 2: fallback posicional para slides que ainda não têm imageUrl
      // (cobre o caso onde o modelo não retornou imageRef ou ignorou a instrução)
      const usedIndices = new Set<number>();
      for (const s of result.variations[0].slides) {
        const ref = (s as { imageRef?: number }).imageRef;
        if (typeof ref === "number" && ref >= 1 && ref <= advUploadedImages.length) {
          usedIndices.add(ref - 1);
        }
      }
      let nextUnused = 0;
      for (let i = 0; i < result.variations[0].slides.length; i++) {
        const slide = result.variations[0].slides[i] as { imageUrl?: string };
        if (slide.imageUrl) continue; // já tem imagem (via imageRef)
        while (usedIndices.has(nextUnused) && nextUnused < advUploadedImages.length) {
          nextUnused++;
        }
        if (nextUnused < advUploadedImages.length) {
          slide.imageUrl = advUploadedImages[nextUnused];
          usedIndices.add(nextUnused);
          nextUnused++;
        }
      }
    }

    // Record generation with real token counts (usage already incremented above).
    // 2 rows: 1 pro carousel (writer) + 1 pro NER (se rodou). Assim o
    // cost-breakdown consegue isolar unit economics de cada processo.
    if (sb) {
      // Pricing by model: Flash ($0.15/$0.60 per 1M) vs Pro ($1.25/$5.00 per 1M).
      const pricing =
        modelId === "gemini-2.5-pro"
          ? { input: 0.00000125, output: 0.0000050 }
          : { input: 0.00000015, output: 0.00000060 };
      const costUsd =
        inputTokens * pricing.input + outputTokens * pricing.output;
      try {
        await sb.from("generations").insert({
          user_id: user.id,
          model: modelId,
          provider: "google",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: Math.round(costUsd * 1_000_000) / 1_000_000,
          // Unifica carrossel em "carousel". sourceType (topic/video/link/instagram)
          // agora vai pra coluna `source_type` se existir, ou fica no metadata.
          prompt_type: "carousel",
        });
      } catch (e) {
        console.warn("[generate] Failed to record carousel generation:", e);
      }
      // Log NER separado (quando rodou) pra analytics isolar o custo do pre-processing.
      if (!facts.skipped && (facts.inputTokens > 0 || facts.outputTokens > 0)) {
        const nerCost =
          facts.inputTokens * 0.00000015 + facts.outputTokens * 0.00000060;
        try {
          await sb.from("generations").insert({
            user_id: user.id,
            model: "gemini-2.5-flash",
            provider: "google",
            input_tokens: facts.inputTokens,
            output_tokens: facts.outputTokens,
            cost_usd: Math.round(nerCost * 1_000_000) / 1_000_000,
            prompt_type: "source-ner",
          });
        } catch (e) {
          console.warn("[generate] Failed to record NER generation:", e);
        }
      }
      // Log Perplexity fact-check (quando rodou).
      if (perplexityMeta) {
        try {
          // Normaliza o model id retornado pro enum do PRICING (sonar/sonar-pro).
          const modelForLog: "sonar" | "sonar-pro" =
            perplexityMeta.model.toLowerCase().includes("pro")
              ? "sonar-pro"
              : "sonar";
          await sb.from("generations").insert({
            user_id: user.id,
            model: modelForLog,
            provider: "perplexity",
            input_tokens: perplexityMeta.inputTokens,
            output_tokens: perplexityMeta.outputTokens,
            cost_usd: perplexityMeta.costUsd,
            prompt_type: "fact-check",
          });
        } catch (e) {
          console.warn(
            "[generate] Failed to record Perplexity generation:",
            e
          );
        }
      }
    }

    getPostHogClient().capture({
      distinctId: user.id,
      event: "carousel_generated",
      properties: {
        source_type: sourceType,
        niche,
        tone,
        language,
        slide_count: result.variations?.[0]?.slides?.length ?? 0,
        variation_count: result.variations?.length ?? 0,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    });

    // Primeiro carrossel: dispara email "bem-vindo, salvou" com idempotência
    // via brand_analysis.__lifecycle.first_carousel_sent_at.
    if (sb) {
      try {
        const { data: profRow } = await sb
          .from("profiles")
          .select("email,name,brand_analysis")
          .eq("id", user.id)
          .single();
        const ba = (profRow?.brand_analysis ?? {}) as Record<string, unknown>;
        const lifecycle = (ba.__lifecycle as Record<string, unknown>) ?? {};
        const alreadySent = lifecycle.first_carousel_sent_at;
        if (!alreadySent && profRow?.email) {
          const { sendFirstCarousel } = await import("@/lib/email/dispatch");
          const title =
            result.variations?.[0]?.title?.slice(0, 80) ||
            (topic || "Seu primeiro carrossel").slice(0, 80);
          await sendFirstCarousel(
            { email: profRow.email, name: profRow.name ?? undefined },
            { carouselTitle: title }
          );
          const nextBa = { ...ba };
          nextBa.__lifecycle = {
            ...lifecycle,
            first_carousel_sent_at: new Date().toISOString(),
          };
          await sb
            .from("profiles")
            .update({ brand_analysis: nextBa })
            .eq("id", user.id);
        }
      } catch (e) {
        console.warn("[generate] first-carousel email falhou (não bloqueante):", e);
      }
    }

    // promptUsed: systemPrompt + userMessage completos, pra transparência.
    // Visível pra admin no editor (painel Debug IA). Users normais ignoram.
    const promptUsed = `${systemPrompt}\n\n========== USER MESSAGE ==========\n\n${userMessage}`;

    return Response.json({
      ...result,
      promptUsed,
      // Metadados úteis pro front auditar
      meta: {
        effectiveMode,
        sourceChars: sourceContent.length,
        // Audit P3: visibility do retry silencioso. Se retried=true e model
        // != Pro, o front pode mostrar nota "Gerado em modo simplificado pra
        // garantir entrega" ou esconder painel de qualidade.
        retried: wasRetried,
        model: actualModelUsed,
        facts: facts.skipped
          ? null
          : {
              entities: facts.entities,
              dataPoints: facts.dataPoints,
              quotes: facts.quotes,
              arguments: facts.arguments,
            },
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[generate] Unhandled error:", {
      message: msg,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
    });
    captureRouteError(error, {
      route: "/api/generate",
      tags: { stage: "unhandled" },
    });
    return Response.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? `Erro interno. ${msg.slice(0, 120)}`
            : msg,
      },
      { status: 500 }
    );
  }
}

