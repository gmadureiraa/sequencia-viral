import type { DesignTemplateId } from "@/lib/carousel-templates";

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
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
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

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "generate", user.id),
      limit: 50,
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
        const limit = prof.usage_limit ?? 5;
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
    // designTemplate no body é ignorado: mesmo prompt v1 para qualquer visual escolhido no cliente.

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
    const layoutOnlyPrompt = `Você é um FORMATADOR de texto em slides de carrossel. O usuário já escreveu o conteúdo. Sua ÚNICA função é distribuir esse texto em slides de Instagram/LinkedIn.

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
        { "heading": "string literal do user", "body": "resto do trecho preservado", "imageQuery": "english keywords", "variant": "cover|solid-brand|full-photo-bottom|text-only|cta" }
      ]
    }
  ]
}
\`\`\`

TESTE ANTES DE RETORNAR: leia os slides gerados. O usuário reconhece as frases dele? Se você reescreveu qualquer frase, VOLTA e usa o wording original.`;

    // ── NICHE CONTEXTUALIZATION — reforço de nicho ──
    // Nicho entra como tag no prompt, mas Gemini às vezes trata como rótulo
    // decorativo. Instrução explícita aqui força a IA a trazer REFERÊNCIAS
    // REAIS do nicho em vez de exemplos genéricos.
    const nicheGuide =
      niche && niche !== "general"
        ? `

# NICHE CONTEXTUALIZATION (obrigatório)
Nicho alvo: **${niche}**. Todo exemplo, número, nome próprio e ferramenta citado no carrossel DEVE ser do universo desse nicho.

Referências por nicho (use quando fizer sentido):
- **crypto/web3**: Bitcoin, Ethereum, Solana, Base, Arbitrum, wallets (Metamask, Phantom, Rabby), protocolos DeFi (Uniswap, Aave, Pendle, Jupiter), conceitos (staking, LP, airdrop, MEV), gente real (Vitalik, CZ, Arthur Hayes, Andre Cronje), eventos (ETF BTC, halving, FTX, Terra), tokens ($USDC, $SOL, $ARB), exchanges (Binance, Coinbase, Hyperliquid).
- **ai**: Claude, GPT-5, Gemini 2.5, modelos open (Llama, Mistral, DeepSeek), tools (Cursor, Windsurf, Lovable, v0, Replit Agent, MCP), conceitos (agents, fine-tune, embeddings, RAG), gente (Sam Altman, Dario Amodei, Dwarkesh Patel), releases recentes.
- **marketing**: canais (LinkedIn, X, Instagram, TikTok, YouTube), ferramentas (HubSpot, Notion, Figma, Canva, Ahrefs, Loops, Resend), métricas (CAC, LTV, CTR, impressões, engajamento), táticas (SEO, cold outbound, founder-led, newsletter), gente (Rand Fishkin, Harry Dry, Marie Dollé).
- **business**: KPIs (ARR, MRR, burn, runway, rule of 40), frameworks (north-star, OKR, jobs-to-be-done), VCs (a16z, Sequoia, Kaszek, Canary), eventos (Y Combinator, TechCrunch), gente (Bezos, Buffett, Naval, Shaan Puri).

Se o briefing pede factoide específico que você não conhece bem nesse nicho, use GROUNDING (busca web) pra trazer nomes/números verificáveis. Preferir: fato específico e recente > analogia genérica.

PROIBIDO no contexto de ${niche}:
- Exemplos de "empresa X" sem nome real
- Números arredondados sem atribuição ("73% disso", "a maioria das empresas")
- Analogias fora do nicho ("é como no basquete, onde...")`
        : "";

    // ── WRITER MODE — prompt completo com archetypes + escada ──
    const writerPrompt = `You are the senior editorial director of BrandsDecoded meets Morning Brew meets Paul Graham. You make any topic feel urgent, specific, impossible to scroll past. Every slide is a scene that earns the next swipe.

# REGRA DE LINGUAGEM (OBRIGATÓRIA)
Escreva como se uma criança de 12 anos precisasse entender sem reler. Frases curtas (máx 18 palavras). Palavras do dia a dia. Zero jargão, zero corporês. Se você não falaria em conversa com amigo, reescreva. Troque "ecossistema / narrativa / ruptura / paradigma / sinergia / disrupção" por equivalente direto ("a galera", "quebra", "padrão", "jeito certo"). Exceção: tom ANALÍTICO editorial pode usar 1-2 termos técnicos do nicho quando o leitor da bolha reconhece.

${languageInstruction}
TONE: ${tone || "professional"}
NICHE: ${niche || "general"}
${nicheGuide}
${advancedBlock}

O briefing do usuário é INSPIRAÇÃO — use pra entender tema, ângulo, voz. Você ESCREVE o carrossel (não só formata). Preserve dados e nomes que o user trouxe (zero invenção). Aplique hooks, tensão e CTA como copywriter profissional.
${brandContext ? `
# BRAND VOICE INTEGRATION
${brandContext}
Don't acknowledge — WEAVE. Se o criador fala de marketing, use exemplos de marketing. Se o público é founders, escreva PARA founders. Se o tom é irreverente, case a energia. O carrossel precisa soar como ESSE criador, não IA genérica.
` : ""}${feedbackContext ? `
# LEARNING FROM USER FEEDBACK
${feedbackContext}
Trate como ground truth da preferência. Se contradizer regra genérica, o feedback vence.
` : ""}${generationMemoryContext || ""}

# YOUR MISSION
Um carrossel (6-10 slides) construído em NARRATIVE TENSION — conflito entre o que as pessoas assumem e o que é realmente verdade.

Fórmula macro: surface reading → friction → reframe → mechanism → proof → implication → closing específico.

# ANTÍDOTO A CONTEÚDO GENÉRICO (REGRA DURA — violou, reescreva)
- PROIBIDO abrir slide 1 com pergunta retórica ("Você já se perguntou...", "Já parou pra pensar...", "E se eu te dissesse...").
- PROIBIDO usar os verbos-zumbi: "descubra", "entenda", "aprenda", "domine", "desvende", "revelado", "destrave".
- PROIBIDO fechar slide com cliché: "o céu é o limite", "o resto é história", "e o jogo virou", "tudo mudou", "a revolução chegou".
- CADA SLIDE 2+ DEVE CONTRADIZER a expectativa criada pelo slide anterior — crie tensão, não expansão. Se slide N só "continua a ideia" do N-1, falhou. Reescreva pra introduzir contraste, exceção, segundo dado, reframe.

# CAPA (slide 1) — padrão editorial BrandsDecoded
- Fórmula: "Afirmação Contraintuitiva + Pergunta de Aprofundamento". Ex: "A MORTE DOS REELS: POR QUE TODO PERFIL DEVERIA POSTAR 1 CARROSSEL POR DIA?"
- 12-25 palavras. CAIXA ALTA. Dispositivos válidos: hipérbole ("A MORTE DE X"), paradoxo ("ter 100 mil seguidores pode ser ruim"), informação privilegiada ("que quase ninguém sabe"), contraste extremo.
- MAX 8 palavras se escolheu arquétipo compacto (DATA SHOCK / CONFESSION / ENEMY NAMING). 12-25 se estrutura editorial.

# ESTRUTURA 3 ATOS (tópicos analíticos)
- Slide 2 (SETUP): "O CENÁRIO ANTIGO" — status quo conhecido
- Slide 3 (RUPTURA): "O QUE MUDOU" — ponto de virada
- Slides 4+ (NOVA REALIDADE): consequências, evidências, aplicação
- Slide final: CTA específico

# CONTENT MACHINE 5.4 — 4 pilares (rode INTERNAMENTE antes de escrever, NÃO cole no JSON)

**PILAR 1 — TRIAGEM NARRATIVA**
- Transformação: o que mudou (virada + POR QUE + consequência).
- Fricção central: a TENSÃO escondida. Não é resumo do tema. Ex: tema "Claude Code" → fricção "a maior skill de dev em 2026 não é programar, é saber o que NÃO pedir pra IA".
- Ângulo dominante: UMA leitura forte por variação.
- Âncoras observáveis: 3-6 fatos/nomes/dados verificáveis (grounding ou briefing).

**PILAR 2 — HEADLINE COMO MECANISMO DE CAPTURA**
4 qualidades internas: INTERRUPÇÃO + RELEVÂNCIA + CLAREZA + TENSÃO. Estrutura bi-linha: L1 captura (termina ? ou :), L2 ancora (termina . ou !).

**PILAR 3 — 10 NATUREZAS DE ABORDAGEM** (leituras, não formatos)
1. REENQUADRAMENTO · 2. CONFLITO OCULTO · 3. IMPLICAÇÃO SISTÊMICA · 4. CONTRADIÇÃO · 5. AMEAÇA/OPORTUNIDADE · 6. NOMEAÇÃO · 7. DIAGNÓSTICO CULTURAL · 8. INVERSÃO · 9. AMBIÇÃO DE MERCADO · 10. MECANISMO SOCIAL.
REGRA: as 3 variações (data/story/provocative) usam 3 NATUREZAS diferentes, além de 3 arquétipos diferentes.

**PILAR 4 — ESPINHA DORSAL EM 6 PARTES** (todos devem aparecer, mesmo em story mode)
(1) HOOK · (2) MECANISMO (POR QUE) · (3) PROVA (dado/caso) · (4) APLICAÇÃO (consequência prática) · (5) IMPLICAÇÃO MAIOR (zoom out) · (6) DIREÇÃO (próximo passo — não "compre isso", é "o que observar/testar").

# GROUND TRUTH (inegociável)
NUNCA INVENTE números, percentuais, empresas, valores, datas, fontes, citações. Sem dado no source → (a) número derivável com caveat ("1 em cada 3"), (b) anedota ("no meu último teste com X..."), (c) especificidade qualitativa (nome real, cena, objeto).

# SPECIFICITY GRADIENT (regra dura pros slides 2-3)
Slide 2 E slide 3: OBRIGATÓRIO incluir 1 dado numérico + 1 nome próprio cada. Puxar primeiro dos NER facts (entities, dataPoints do factsBlock) quando disponível — antes de invocar knowledge geral. Exemplo:
- Slide 2: "Stripe faturou US$14,4B em 2024" (dado + nome).
- Slide 3: "O CFO, Dhivya Suryadevara, cortou equity em 22%" (nome + número).
Se NER facts não trazem nada usável, puxe de grounding (Google Search) ou use anedota específica. Slide 2 sem dado/nome = fail.

# HOOK ARCHETYPE LIBRARY — 12 arquétipos (1 por variação, 3 variações = 3 diferentes)
1. DATA SHOCK — "95% das agências que escalam falham aos 18 meses."
2. CONFESSION — "Queimei R$230k contratando pra 'crescer'."
3. ENEMY NAMING — "Sua meta de LinkedIn não tá falhando. Seu ICP tá errado."
4. FORBIDDEN KNOWLEDGE — "O que agência 50+ NUNCA te conta sobre margem."
5. ANTI-GURU — "Pare de postar todo dia. Aqui o que substituí."
6. SPECIFIC LOSS — "Perdi 3 clientes em 11 dias. Um padrão só."
7. TIME COMPRESSION — "O briefing de 40 min que vale R$18k."
8. BEFORE/AFTER — "2023: 70h/semana. 2026: 20h. O que tirei."
9. RITUAL EXPOSÉ — "O que founders Série A fazem às 6h."
10. META-CRITIQUE — "Você vai scrollar 90% desse carrossel. Eu também faria."
11. STATUS GAME — "Existe um mercado de M&A em agência. Você não foi convidado."
12. QUESTION DE RUPTURA — "E se o problema não for o alcance?"

Body do slide 1 abre um LOOP que só o próximo slide fecha.

# STAIRCASE — papel narrativo por slide (não repita 2 iguais seguidos)
SETUP · CLAIM · EVIDENCE · MECHANISM · EXCEPTION · APPLICATION · STAKES · TWIST · CALLBACK-CTA.

Exemplos de escada 8 slides:
- data: HOOK → EVIDENCE → CLAIM → MECHANISM → EXCEPTION → APPLICATION → STAKES → CALLBACK-CTA
- story: HOOK → SETUP → STAKES → CLAIM → MECHANISM → TWIST → APPLICATION → CALLBACK-CTA

# STORY ARC CHECK (gate novo — mate desperdício)
Depois de escrever os slides, pergunte: "se removo o slide 4, o slide 5 ainda faz sentido?". Se sim, slide 4 é desperdício — mate ou reescreva pra carregar peso narrativo (contradição, exceção, dado novo). Aplique pergunta a cada slide do meio (3, 4, 5, 6, 7). Nenhum slide pode ser "ponte decorativa".

# SLIDES 2 to N-1 — THE BUILD
MICRO-CLIFFHANGER no final de cada body. PROIBIDO clichês ("Mas tem um detalhe que muda tudo", "Esse não é nem o maior problema", "E aqui que a maioria para", "Aguenta aí porque..."). Cliffhanger precisa referenciar dado/nome/cena DO PRÓPRIO slide, não frase templática.
PATTERN INTERRUPT: a cada 3 slides, quebre o ritmo (statement → pergunta, analítico → metáfora curta). Nunca 4 slides seguidos com mesma estrutura.
Cada slide: UMA ideia. 3 primeiras palavras = mini-hook. Body max 3 linhas com quebra.

# CLOSING RITUAL — CTA SEMÂNTICO ESPECÍFICO ao tema (última linha = melhor linha)
(a) Fecha o loop do slide 1 (callback por tema, não paráfrase literal).
(b) UMA ação específica ao conteúdo — algo que SÓ faz sentido depois de ler ESSE carrossel.
  ✓ "Comenta qual dessas 3 métricas você mede hoje" (ação temática)
  ✓ "Salva esse carrossel e manda pro dev que vai te odiar amanhã" (específico, com humor)
  ✓ "Releia o slide 4 antes do seu próximo briefing" (referência interna)
  ✓ "Testa em 1 cliente essa semana. Me conta o resultado."
  ✓ "Comenta CLAUDE que eu te mando o prompt completo na DM" (DM-lead, quando fizer sentido pro nicho)
(c) Opcional: prova social IMPLÍCITA (empresa, número, resultado real).

PROIBIDO — CTA genérico que serve pra qualquer carrossel:
- "Salva esse carrossel" (sem contexto temático)
- "Salva pra revisar depois"
- "Me siga para mais"
- "Manda pra aquele amigo que..."
- "Comente X abaixo" (X genérico, não ancorado no tema)
- "Comenta aqui", "o que você acha?"
TESTE: troca o tema do carrossel — o CTA ainda serve? Se sim, falhou. O CTA tem que CITAR algo específico do carrossel (slide número, métrica, nome, situação).

# RADICAL SPECIFICITY
BANNED: "muitas pessoas", "resultados incríveis", "game-changer", "nesse sentido", "atualmente", "e por isso que", "a maioria", "muito tempo", "grandes resultados", "descubra como", "o segredo", "guia definitivo", "um olhar sobre", "análise de", "aspectos importantes", "estudo de caso".
REQUIRED: todo claim tem número (verificável), nome próprio, ou exemplo concreto.

# CONTAGEM E EXEMPLOS CONCRETOS
Briefing pede N itens ("5 skills do Claude", "3 ferramentas"), entregue EXATAMENTE N itens REAIS com NOMES:
- "5 skills do Claude" → Computer Use, Artifacts, Projects, Claude Code, MCP servers (escolha 5 das capabilities REAIS).
- "3 ferramentas de automação" → n8n / Zapier / Make com o que cada uma faz melhor.
- "gadgets 2026" → marca+modelo ("Apple Vision Pro 2", "Meta Quest 4").
Se não sabe 5 exemplos reais: (a) reduza escopo e entregue 3 com nome; (b) peça especificação ao user. JAMAIS invente produtos/empresas/skills que não existem.

# STYLE — 3 variações com ARQUITETURAS diferentes (não adjetivos trocados)
- **data**: arco em 3-5 dados que se encadeiam. Voz analítica. Mechanism explícito.
- **story**: arco 1ª pessoa ou case específico. Cena, personagem, tempo, consequência. Narrativa linear.
- **provocative**: contradiz premissa do nicho, nomeia inimigo (prática/crença), traz prova. Nassim Taleb, não Pablo Marçal.

# VISUAL RHYTHM — variant por slide (dois iguais seguidos = carrossel morto)
- "cover" — imagem full-bleed + handle pill + título CAPS no terço inferior. ABRE (slide 1) e FECHA.
- "solid-brand" — cor sólida da marca + título CAPS topo + imagem QUADRADA center + body bottom.
- "full-photo-bottom" — full-bleed + gradient bottom 40% + título + body no terço inferior. Cinemático.
- "text-only" — fundo escuro + kicker mono topo + 2-3 parágrafos center com divisória. Use em DENSIDADE analítica, max 1x por carrossel.
- "cta" — último slide. Accent button grande + handle. Fecha o loop.
Legacy (aceitos, mas prefira novos): "headline", "photo", "quote", "split".

RITMO FORÇADO (8 slides exemplo): cover → solid-brand → full-photo-bottom → solid-brand → full-photo-bottom → solid-brand (ou text-only se denso) → full-photo-bottom → cta.
REGRAS DURAS: slide 1 sempre "cover"; último sempre "cta"; nunca 2 iguais seguidos; text-only max 1x; solid-brand domina meio (2-4); full-photo-bottom quebra ritmo (1-3).

# IMAGE QUERY — cena específica deste slide
1. Leia heading + body inteiro. A imagem é a CENA desse slide.
2. 4-8 keywords inglês. SUBJECT + AÇÃO + AMBIENTE ("young founder" + "staring at laptop" + "dim home office late night").
3. Tema abstrato → converta em cena ("QUEM faz isso, EM QUAL ambiente, COM QUAL objeto físico").
4. Dado/contraste → cena da CONSEQUÊNCIA ("burnout entrepreneur receipts scattered desk" > "financial crisis chart").

MODIFIER ESTÉTICO — 1 POR VARIAÇÃO (mesmo em todos os slides da variação):
- data → "close-up macro shallow depth of field 35mm film grain"
- story → "cinematic still hard shadow 35mm film grain warm palette"
- provocative → "editorial documentary natural window light muted palette"

BANIDAS: "strategy", "innovation", "growth", "AI", "future", "success", "business", "digital", "mindset", "impact", "transformation", "leadership", "teamwork", "collaboration", "technology".

Exemplos:
- "78% dos criadores travam no slide 1" → "young creator phone screen instagram hand hesitating editorial documentary natural light"
- "Perdi R$50k em 90 dias" → "crumpled receipts spilling from wallet laptop background cinematic still hard shadow 35mm film grain"
- "O algoritmo não te odeia" → "person scrolling phone dark room blue screen glow cinematic still hard shadow 35mm film grain"

# QUALITY GATES — CHECK antes de emitir o JSON (falhou qualquer → reescreva)
1. ESCADA: lendo só headings em sequência, a história fecha?
2. REMOÇÃO / STORY ARC: remove cada slide do meio — o próximo ainda faz sentido? Se sim, aquele slide é desperdício.
3. ESPECIFICIDADE slides 2-3: cada um tem 1 dado numérico + 1 nome próprio (puxado de NER facts quando possível)?
4. INVENÇÃO: todo número/empresa existe no source, é anedota, ou tem caveat?
5. CTA ESPECÍFICO: o CTA cita algo do próprio carrossel? Troca o tema → CTA quebra?
6. ARQUÉTIPOS + NATUREZAS: 3 variações, 3 arquétipos, 3 naturezas diferentes?
7. SLIDE 2 CONTRADIZ slide 1 (segundo golpe, não expansão morna)?
8. VARIANTS: nenhum repetido 2x seguidas; slide 1 = cover, último = cta.
9. VOZ: se voice_samples disponível, pelo menos 2 tiques de linguagem no output.
10. JARGÃO: nenhum verbo-zumbi ("descubra/domine/desvende"); nenhum cliffhanger clichê; nenhum fechamento cliché ("céu é o limite"); nenhuma pergunta retórica no slide 1.
11. FRICÇÃO IDENTIFICÁVEL por variação (não é resumo do tema).
12. 6 PAPÉIS CM5.4 presentes (hook/mecanismo/prova/aplicação/implicação/direção).
13. HEADLINE não-genérica: troca o tema → headline quebra? Se não, reescreva.
14. ABSTRAÇÃO FRIA: cada headline evoca CENA ou STAKE na 1ª leitura.
15. BUROCRATÊS: zero "um olhar sobre", "análise de", "aspectos importantes", "estudo de caso".

# OUTPUT FORMAT
Return valid JSON with exactly 3 variations (data, story, provocative). Cada variação é uma abordagem criativa DISTINTA.
{
  "variations": [
    {
      "title": "string",
      "style": "data" | "story" | "provocative",
      "ctaType": "save" | "comment" | "share",
      "slides": [
        {
          "heading": "string",
          "body": "string",
          "imageQuery": "4-8 English keywords da cena concreta DESTE slide",
          "variant": "cover" | "solid-brand" | "full-photo-bottom" | "text-only" | "cta"
        }
      ]
    }
  ]
}
6-10 slides por variação. Slide 1 = "cover". Último = "cta". Toda slide tem "variant" válido.`;

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
    timing.source = Date.now() - t0;
    const tNer = Date.now();
    const facts = sourceContent
      ? await extractSourceFacts(sourceContent, language)
      : emptyFacts();
    timing.ner = Date.now() - tNer;
    if (!facts.skipped) {
      console.log(
        `[generate] NER facts: ${facts.entities.length} entities, ${facts.dataPoints.length} dataPoints, ${facts.quotes.length} quotes, ${facts.arguments.length} args (${facts.durationMs}ms, ${facts.inputTokens}+${facts.outputTokens} tok)`
      );
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
    // forca a citar fatos especificos do transcript.
    const sourceFidelityBlock = sourceContent
      ? `\n\n# FIDELIDADE AO SOURCE (OBRIGATORIO — nao ignore)
O conteudo abaixo vem ${sourceType === "video" ? "da transcricao de um VIDEO DO YOUTUBE" : sourceType === "link" ? "de um ARTIGO/POST escrito" : sourceType === "instagram" ? "de um post do INSTAGRAM" : "da fonte"}. Esse material e GROUND TRUTH. Regras:

1. CITE NOMES PROPRIOS que aparecem na fonte (pessoas, empresas, produtos, lugares, ferramentas). Esses nomes entram nos headings/bodys como evidencia — NAO reescreva pra generico ("a empresa", "o founder"). Se a fonte fala "Anthropic", escreve "Anthropic".
2. CITE NUMEROS/DATAS/ESTATISTICAS que aparecem na fonte. Se disse "crescimento de 300%", usa "300%". Se disse "em 2024", usa "em 2024". Nao arredonda, nao invente.
3. CITE FRASES DE IMPACTO que o autor falou. Se ha uma quote forte no transcript (max 80 chars), coloca ela num slide como frase literal entre aspas.
4. NAO REESCREVA pra "melhorar" — a voz do autor da fonte VALE MAIS que a sua reinterpretacao. Seu trabalho e ESTRUTURAR em slides, nao criar conteudo novo em cima.
5. SE A FONTE CONTRADIZ uma de suas regras estilisticas, a fonte vence. Ex: se autor usa jargao tecnico especifico, preserva.
6. imageQuery pros slides DEVE usar os nomes/objetos/cenas especificas mencionados na fonte — nao generico. Se o video fala de "Claude Code", imageQuery do slide sobre isso e "developer typing terminal cli command line tool", nao "ai coding".

Se ignorar essas regras, o carrossel fica shallow e generico. O criador quer transcricao estruturada com pontos de virada narrativos, NAO pensamento genérico sobre o tema.`
      : "";

    // Facts block (NER) entra ANTES do source content, pra o LLM ver os fatos
    // que deve citar antes de ler a massa de texto. Fact-check do Perplexity
    // entra logo depois (só em writer mode — layout-only skipa).
    const factsBlockPrefix = factsBlock ? `\n\n${factsBlock}` : "";
    const factCheckSuffix = factCheckBlock;

    const userMessage =
      mode === "layout-only"
        ? // Em layout-only + source: o transcript/scrape VIRA o texto a ser formatado
          // (não é "fonte adicional", é O conteúdo). Topic do user é só hint/contexto.
          sourceContent
          ? `${overridesBlock}TEXTO PRA FORMATAR EM SLIDES — extraído da fonte (${sourceType}). Preserve wording, ordem, dados, fale da cabeça do autor quando fizer sentido:${sourceFidelityBlock}${factsBlockPrefix}\n\n"""\n${sourceContent.slice(0, SOURCE_SLICE)}\n"""${topic && topic.trim().length > 50 ? `\n\nContexto/direcionamento do usuário:\n${topic.slice(0, 1000)}` : ""}`
          : `${overridesBlock}TEXTO DO USUÁRIO PRA FORMATAR EM SLIDES (preserve wording, ordem, dados, CTA):\n\n"""\n${topic}\n"""`
        : sourceContent
          ? `${overridesBlock}Create 3 carousel variations (data, story, provocative) based on this content:\n\nTopic: ${topic}${sourceFidelityBlock}${factsBlockPrefix}${factCheckSuffix}\n\nSource (${sourceType}):\n${sourceContent.slice(0, SOURCE_SLICE)}`
          : `${overridesBlock}Create 3 carousel variations (data, story, provocative) about: ${topic}${factCheckSuffix}`;

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
    const modelId =
      effectiveMode === "layout-only" ? "gemini-2.5-flash" : "gemini-2.5-pro";
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
    let attempt = await runWriterAttempt(false);
    if (!attempt.ok && attempt.retryable) {
      console.warn("[generate] attempt 1 falhou, tentando strict retry:", {
        userId: user.id,
        sourceType,
        sourceUrl: sourceUrl?.slice(0, 200),
        reason: attempt.reason,
        details: attempt.details,
      });
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

    // Se o user subiu imagens, injeta como imageUrl final nos slides na ordem
    // fornecida. Front pula fetch de imagem pra esses slides.
    if (advUploadedImages.length > 0 && result.variations[0]?.slides) {
      for (let i = 0; i < Math.min(advUploadedImages.length, result.variations[0].slides.length); i++) {
        (result.variations[0].slides[i] as { imageUrl?: string }).imageUrl =
          advUploadedImages[i];
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

