import type { DesignTemplateId } from "@/lib/carousel-templates";
import { extractContentFromUrl } from "@/lib/url-extractor";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

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
}

type SlideVariant = "cover" | "headline" | "photo" | "quote" | "split" | "cta";

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
] as const;

/**
 * Distribuição narrativa default quando o modelo esquece de preencher variant
 * ou devolve um valor inválido. A lógica é: primeiro slide sempre cover,
 * último sempre cta, e no meio alterna entre formatos pra evitar monotonia
 * visual (headline domina, com photo/split/quote como quebras de ritmo).
 */
function fallbackVariant(index: number, total: number): SlideVariant {
  // Edge: 1 slide → só cover; 2 slides → cover + cta.
  if (total <= 1) return "cover";
  if (index === 0) return "cover";
  if (index === total - 1) return "cta";
  const middle = index - 1;
  const rotation: SlideVariant[] = [
    "headline",
    "split",
    "headline",
    "photo",
    "headline",
    "quote",
    "headline",
    "photo",
  ];
  return rotation[middle % rotation.length];
}

function normalizeVariant(raw: unknown, index: number, total: number): SlideVariant {
  if (typeof raw === "string") {
    const v = raw.toLowerCase().trim() as SlideVariant;
    if (VALID_VARIANTS.includes(v)) return v;
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

    // Single query: plan check + brand context
    const sb = createServiceRoleSupabaseClient();
    let brandContext = "";
    let feedbackContext = "";
    if (sb) {
      const { data: prof } = await sb
        .from("profiles")
        .select("usage_count, usage_limit, plan, brand_analysis")
        .eq("id", user.id)
        .single();
      if (prof) {
        const limit = prof.usage_limit ?? 5;
        const count = prof.usage_count ?? 0;
        if (count >= limit) {
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
    const advancedActive =
      !!(advCustomCta || advHookDirection || advExtraContext || advNumSlides || advPreferredStyle);

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
    let sourceContent = "";

    if (sourceType === "link" && sourceUrl) {
      try {
        sourceContent = await extractContentFromUrl(sourceUrl);
      } catch (err) {
        console.error("[generate] URL extraction failed:", err);
        return Response.json(
          {
            error: `Não foi possível extrair conteúdo da URL: ${err instanceof Error ? err.message : "erro desconhecido"}. Dica: cole o texto manualmente no campo "Minha ideia".`,
          },
          { status: 400 }
        );
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

    // Bloco de direcionamento do MODO AVANÇADO (sobrescreve defaults quando presente).
    const advancedBlock = advancedActive
      ? `
# MODO AVANÇADO — DIRECIONAMENTOS EXPLÍCITOS DO USUÁRIO (prioridade alta)
Esses direcionamentos VENCEM as defaults do prompt. Respeite literalmente.
${advHookDirection ? `- Gancho (slide 1) deve: ${advHookDirection}\n` : ""}${advCustomCta ? `- CTA final EXATO a usar (não reescreva, mantenha a intenção): "${advCustomCta}"\n` : ""}${advNumSlides ? `- Número de slides desejado: EXATAMENTE ${advNumSlides} (incluindo hook e CTA).\n` : ""}${advPreferredStyle ? `- Estilo forçado: ENTREGUE APENAS A VARIAÇÃO "${advPreferredStyle}" (ignore as outras 2 — array variations terá 1 item só).\n` : ""}${advExtraContext ? `- Contexto adicional a considerar (dados, provas, quotes, exemplos do usuário):\n"""\n${advExtraContext}\n"""\n` : ""}
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
- APLICA variant visual pra ritmo: primeiro slide pode ser "cover", últimos CTA é "cta", meio alterna entre "headline", "photo", "split", "quote" (só variar ritmo visual, não muda conteúdo).
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
        { "heading": "string literal do user", "body": "resto do trecho preservado", "imageQuery": "english keywords", "variant": "cover|headline|photo|quote|split|cta" }
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
    const writerPrompt = `You are a narrative architect for Instagram carousels and LinkedIn document posts. You think like a screenwriter — every slide is a scene that earns the next swipe.

${languageInstruction}
TONE: ${tone || "professional"}
NICHE: ${niche || "general"}
${nicheGuide}
${advancedBlock}

O briefing do usuário é sua INSPIRAÇÃO — use pra entender tema, ângulo e voz. Você VAI escrever o carrossel (não apenas formatar). Preserve dados e nomes específicos que o usuário trouxe (zero invenção), mas aplique hooks, tensão narrativa, cliffhangers e CTA como um copywriter profissional.
${brandContext ? `
# BRAND VOICE INTEGRATION
${brandContext}
IMPORTANT: Don't just acknowledge these brand signals — WEAVE them into the content. If the creator talks about marketing, use marketing examples. If their audience is founders, write FOR founders. If their tone is irreverent, match that energy. The carousel must sound like THIS creator wrote it, not a generic AI.
` : ""}${feedbackContext ? `
# LEARNING FROM USER FEEDBACK
${feedbackContext}
Trate esse sinal como ground truth da preferência do criador. Se contradizer outra instrução genérica, o feedback vence.
` : ""}

# YOUR MISSION
Create 1 carousel (6-10 slides) built on NARRATIVE TENSION — a conflict between what people assume and what's actually true.

Formula: surface reading → friction → reframe → mechanism → proof → implication → expanded closing

# REFERÊNCIA EDITORIAL PREMIUM (BrandsDecoded pattern)
Carrosséis de análise (marketing, negócios, tecnologia, cultura) seguem um padrão editorial específico que performa MUITO bem em Instagram/LinkedIn. Aplique quando o tema permitir:

**CAPA (slide 1) — padrão BrandsDecoded**:
- **Fórmula dominante**: "Afirmação Contraintuitiva + Pergunta de Aprofundamento".
  Exemplo: "A MORTE DOS REELS: POR QUE TODO PERFIL DEVERIA POSTAR 1 CARROSSEL POR DIA?"
- Tamanho: 12-25 palavras (NÃO max 8 como arquétipos padrão — capa editorial é mais longa).
- Tudo em CAIXA ALTA (uppercase).
- Pode usar destaque colorido em palavras-chave finais (accent).
- Dispositivos retóricos que funcionam: hipérbole ("A MORTE DE X"), contraste extremo (jornada do herói), informação privilegiada ("que você provavelmente não sabe"), paradoxo ("ter 100 mil seguidores pode ser ruim").

**ESTRUTURA 3 ATOS — para tópicos analíticos**:
- Slide 2 (SETUP): "O CENÁRIO ANTIGO" — apresenta status quo que todos conhecem
- Slide 3 (RUPTURA): "O QUE MUDOU" — introduz a inversão, o ponto de virada
- Slides 4+ (NOVA REALIDADE): consequências, evidências, exemplos, como aplicar
- Slide final (CTA): fecha com comando específico

**Desenvolvimento (slides 2-N) — densidade**:
- UMA ideia central por slide.
- Título curto CAPS (3-6 palavras) + parágrafo de apoio de até 40 palavras.
- Legibilidade alta: parágrafos curtos, linhas com espaço, palavras-chave destacadas.

**TOM ANALÍTICO** — voz de analista que decodifica o mercado, não gurú. Termos como "ecossistema", "narrativa", "ruptura", "cenário atual", "pattern reconhecido". Faça afirmações ousadas e definitivas com segurança — não hedge.

**CTA estilo DM-lead** (quando fizer sentido): "Comenta [PALAVRA-CHAVE] que eu te mando [RECOMPENSA] na DM." Ex: "Comenta CLAUDE que eu te mando o prompt completo na DM." Essa estrutura captura leads diretamente, é o CTA dominante em carrosséis virais de 2026.

# GROUND TRUTH (regra inegociável — leia antes de tudo)
NUNCA INVENTE: números, percentuais, nomes de empresas, valores em R$/US$, datas, fontes, citações atribuídas. Se o source content do usuário não traz um dado, você tem 3 opções:
1. Usar número DERIVÁVEL de lógica (ex: "1 em cada 3") com caveat.
2. Frame como anedota ("no meu último teste com X clientes...").
3. Remover a métrica e ir pela especificidade qualitativa (nome de empresa, cena, objeto).
Se em dúvida entre "R$47k em 23 dias" inventado vs "meu último ciclo de contratação" real, prefira o segundo. A sensação de especificidade vem de NOMES CONCRETOS, não de números fabricados.

# HOOK ARCHETYPE LIBRARY — 12 arquétipos
Escolha 1 arquétipo por variação. As 3 variações DEVEM usar 3 arquétipos DIFERENTES — nunca repita.

1. DATA SHOCK — estatística específica que flipa crença comum. "95% das agências que escalam falham aos 18 meses."
2. CONFESSION — erro admitido em primeira pessoa com custo. "Queimei R$230k contratando pra 'crescer'."
3. ENEMY NAMING — nomear o vilão que o público já suspeita. "Sua meta de LinkedIn não tá falhando. Seu ICP tá errado."
4. FORBIDDEN KNOWLEDGE — reveal de insider. "O que agência 50+ NUNCA te conta sobre margem."
5. ANTI-GURU — contradiz conselho popular com aposta. "Pare de postar todo dia. Aqui o que substituí."
6. SPECIFIC LOSS — número exato + janela curta. "Perdi 3 clientes em 11 dias. Um padrão só."
7. TIME COMPRESSION — promessa absurda com plausibilidade. "O briefing de 40 min que vale R$18k."
8. BEFORE/AFTER — declaração de mudança radical. "2023: 70h/semana. 2026: 20h. O que tirei."
9. RITUAL EXPOSÉ — descrever comportamento escondido da elite. "O que founders Série A fazem às 6h e ninguém posta."
10. META-CRITIQUE — virar o formato contra si. "Você vai scrollar 90% desse carrossel. Eu também faria."
11. STATUS GAME — enquadrar insider vs outsider. "Existe um mercado de M&A em agência. Você não foi convidado."
12. QUESTION DE RUPTURA — pergunta que contém a provocação. "E se o problema não for o alcance?"

Regra: o hook do slide 1 tem max 8 palavras. Body do slide 1 abre um LOOP que só o próximo slide fecha.

# STAIRCASE RULE — estrutura narrativa obrigatória
Cada slide tem um PAPEL NARRATIVO explícito. Planeje a escada ANTES de escrever. Slide N deve RESPONDER a pergunta levantada pelo slide N-1 — se o leitor ler só o slide N-1 e perguntar "e daí?" ou "por quê?", o slide N responde.

Papéis disponíveis (não repita 2 seguidos):
- SETUP: apresenta a dor/cenário em cena concreta
- CLAIM: afirma a tese central (1 frase cortante)
- EVIDENCE: traz o dado / caso / print
- MECHANISM: explica POR QUE o fenômeno acontece
- EXCEPTION: traz o "menos em X situação" que refina a tese
- APPLICATION: mostra como aplicar
- STAKES: eleva a consequência de ignorar
- TWIST: reverte expectativa do leitor
- CALLBACK-CTA: último slide, referencia hook + ação

Exemplo de escada para 8 slides (data): HOOK → EVIDENCE → CLAIM → MECHANISM → EXCEPTION → APPLICATION → STAKES → CALLBACK-CTA
Exemplo (story): HOOK → SETUP → STAKES → CLAIM → MECHANISM → TWIST → APPLICATION → CALLBACK-CTA

TESTE DA ESCADA: lendo só os headings em sequência, a história fecha? Se não, reescreva.

# SLIDES 2 to N-1 — THE BUILD

MICRO-CLIFFHANGER: cada body termina com linha que puxa pro próximo slide. MAS proibido usar estas frases clichê (viraram meme):
- "Mas tem um detalhe que muda tudo"
- "Esse não é nem o maior problema"
- "E aqui que a maioria para"
- "Aguenta aí, porque..."
Substitua por cliffhangers que SÓ funcionam nesse slide específico (referenciam dado, nome, cena do próprio slide).

PATTERN INTERRUPT: a cada 3 slides, quebre o ritmo. 3 statements → 1 pergunta. 3 analíticos → 1 metáfora curta. Nunca 4 slides em sequência com mesma estrutura.

Cada slide: UMA ideia. Não duas. Primeiros 3 palavras = mini-hook. Body max 3 linhas com quebra de linha pra leitura rápida.

# LAST SLIDE — CTA SEMÂNTICO (não templático)

O CTA é a melhor linha do carrossel. Trate como tal.

Regras semânticas — em qualquer ordem:
(a) FECHAR o loop aberto no slide 1 (callback por TEMA, não por paráfrase literal)
(b) Dar UMA ação específica ao conteúdo. NÃO peça "save / share / comment" genérico — peça algo que SÓ FAZ SENTIDO depois de ler ESSE carrossel. Ex: "Releia o slide 4 antes de mandar seu próximo briefing." ou "Testa isso em 1 cliente essa semana. Me conta o que aconteceu."
(c) Opcional: prova social IMPLÍCITA (nome de empresa, número, resultado) — nunca "manda pra aquele amigo que...".

PROIBIDO no CTA (viraram assinatura genérica de produto — detectáveis):
- "Salva esse carrossel"
- "Salva pra revisar depois"
- "Me siga para mais"
- "Manda pra aquele amigo que..."
- "Comente X abaixo"
- Qualquer frase que funcione em QUALQUER carrossel. Teste: troca o tema e o CTA ainda serve? Falhou — reescreva.

# RADICAL SPECIFICITY (mandatory)
BANNED forever: "muitas pessoas", "resultados incríveis", "game-changer", "nesse sentido", "atualmente", "e por isso que", "a maioria", "muito tempo", "grandes resultados", "descubra como", "o segredo", "guia definitivo"
REQUIRED: todo claim tem um número (verificável!), um nome próprio, ou um exemplo concreto. Zero exceção.

# REGRA DA CONTAGEM E EXEMPLOS CONCRETOS (crítica)
Se o briefing pede N itens específicos ("5 skills do Claude", "3 ferramentas de automação", "10 hacks de LinkedIn"), você ENTREGA EXATAMENTE N itens REAIS com NOMES PRÓPRIOS.

- "5 skills do Claude" → entregue 5 capabilities REAIS do Claude com nome: Computer Use, Artifacts, Projects, Custom Instructions, Claude Code, MCP servers, Extended Thinking, Vision, Tool Use, Code Execution, File API, Batches. Escolha as 5 mais relevantes pro contexto, NÃO "5 coisas incríveis que o Claude faz" (genérico = falha).
- "3 ferramentas de automação" → nomeie 3 ferramentas reais (n8n, Zapier, Make, Pipedream, etc) com o que cada uma faz melhor.
- "melhores gadgets de 2026" → produtos com marca+modelo (ex: "Apple Vision Pro 2", "Meta Quest 4", "Rabbit R2").

Se você NÃO SABE 5 exemplos reais do tema, é melhor:
(a) reduzir o escopo ("3 skills principais do Claude que mudam workflow de dev") e entregar 3 com nome, OU
(b) pedir que o usuário especifique no briefing.

JAMAIS invente nomes de produtos, empresas, skills, que não existem. PREFIRA ser específico sobre poucos itens do que genérico sobre muitos.

# FATOS VERIFICÁVEIS
Quando o briefing exige conhecimento factual (features de um produto, preços, datas, specs, nomes de fundadores, etc), traga apenas informações que você conhece com confiança. Se tem dúvida, use hedge ("uma das principais features é...", "o fundador é...") em vez de afirmar algo incerto. SEMPRE prefira: um fato específico e verdadeiro > vários fatos abstratos e vagos > um fato inventado (pior opção).

# STYLE — as 3 variações DEVEM ser radicalmente diferentes
Escolha: data / story / provocative. Cada variação NÃO é só o mesmo carrossel com adjetivos trocados — é uma arquitetura narrativa diferente:

- **data**: arco construído sobre 3-5 dados que se encadeiam. Voz analítica. Paleta de números. Mechanism explícito.
- **story**: arco em primeira pessoa ou case específico. Cena, personagem, tempo, consequência. Sem lista — narrativa linear.
- **provocative**: contradiz uma premissa do nicho, nomeia um inimigo (prática/crença/pessoa), traz prova. NÃO é "data com ponto de exclamação" — é Nassim Taleb, não Pablo Marçal.

Se as 3 variações têm estruturas parecidas trocando só adjetivos, VOCÊ FALHOU. Reescreva.

# VISUAL RHYTHM — per-slide VARIANT (MANDATORY)
Cada slide DECLARA seu layout. O carrossel só "funciona visualmente" se você variar. Dois slides seguidos iguais = carrossel morto.

Variants disponíveis:
- "cover" — abre o carrossel. Headline ENORME em background bold. Body é subtítulo curto.
- "headline" — workhorse. Statement grande + body de apoio.
- "photo" — imagem domina, body é caption curto. Use quando a cena visual é a mensagem.
- "quote" — pull-quote screenshottable. 1 frase forte isolada.
- "split" — 2 colunas / antes-depois / contraste. Use pra comparações ou reveals.
- "cta" — último slide. Chamada de ação fechando o loop do hook.

REGRAS DE ABERTURA (slide 1) — ESCOLHA DELIBERADA, NÃO AUTOMÁTICA:
- Na variação "data": slide 1 pode ser "cover" (com dado gigante) OU "headline" (declaração forte que já soca um número).
- Na variação "story": slide 1 pode ser "quote" (1 frase pessoal) OU "cover" (título evocativo).
- Na variação "provocative": slide 1 pode ser "headline" direto (afirmação chocante, sem cover) OU "cover" tipo headline de manifesto.
- Cada uma das 3 variações DEVE começar com um variant DIFERENTE das outras 2. NUNCA entregue 3 variações todas começando em "cover".

REGRAS DO SLIDE 2:
- Slide 2 NUNCA repete o variant do slide 1. Se slide 1 é "cover", slide 2 é "split" ou "headline" ou "photo" (nunca cover de novo).
- Slide 2 tem que SOCAR — é o "segundo golpe" depois do hook. Entregue um dado, um contraste (split), uma cena (photo) ou uma provocação (headline). Jamais "headline" genérico repetindo o hook.

DEMAIS REGRAS:
1. Último slide MUST ser "cta".
2. Meio: NUNCA o mesmo variant 3 slides em sequência.
3. "quote" no máximo 2 vezes, em picos de tensão.
4. "photo" quando imageQuery é cena concreta (pessoa, objeto, cenário).
5. "split" quando o slide contém contraste explícito ("antes X, agora Y" / "todo mundo acha A, realidade é B").
6. Arrange narrativa exemplo (8 slides): "cover → split → headline → photo → quote → headline → split → cta" OU "headline → photo → headline → split → quote → photo → headline → cta" (variar é chave).

# IMAGE QUERY — cinematográfica, específica, ligada a ESTE slide
O campo "imageQuery" alimenta geração/busca de imagem. Regras:

1. ESPECIFICIDADE TOTAL pra o slide: leia heading E body inteiro antes de escrever. A imagem deve ser a CENA que esse slide conta.
2. 4-8 keywords em inglês (não 3-6). Mais específico = melhor.
3. Sempre inclua SUBJECT + AÇÃO/ESTADO + AMBIENTE. Ex: "young founder" (subject) + "staring at laptop" (ação) + "dim home office late night" (ambiente).
4. Se o slide é sobre algo abstrato (estratégia, IA, futuro), CONVERTA EM CENA: pergunte "QUEM faz isso, EM QUAL ambiente, COM QUAL objeto físico?" e descreva.
5. Se o slide é sobre dado/contraste: descreva a CENA da consequência (não o gráfico abstrato). "burnout entrepreneur receipts scattered desk" é melhor que "financial crisis chart".

MODIFIER ESTÉTICO — 1 POR VARIAÇÃO (coerência inter-slide):
Escolha UM modifier abaixo e aplique em TODOS os slides da MESMA variação (não troque slide-a-slide — isso é que faz o carrossel parecer "de fotógrafos diferentes"):
- Variação **data** → SEMPRE "close-up macro shallow depth of field 35mm film grain"
- Variação **story** → SEMPRE "cinematic still hard shadow 35mm film grain warm palette"
- Variação **provocative** → SEMPRE "editorial documentary natural window light muted palette"

BANIDAS (nunca use — puxam stock genérico): "strategy", "innovation", "growth", "AI", "future", "success", "business", "digital", "mindset", "impact", "transformation", "leadership", "teamwork", "collaboration", "technology" (sim, esse também).

Exemplos bons (heading/body → imageQuery):
- "78% dos criadores travam no slide 1" / "O hook é a maior queda de visualização"
  → "young creator phone screen instagram hand hesitating editorial photography documentary style natural light"
- "Perdi R$50k em 90 dias" / "Aprendi tarde o que todo anúncio exige"
  → "crumpled receipts spilling from wallet laptop background cinematic still hard shadow 35mm film grain"
- "A mecânica é simples" / "Toda venda depende de 3 pontos invisíveis"
  → "three gears turning metal machinery close-up macro shallow depth of field"
- "O algoritmo não te odeia" / "Seu post médio odeia"
  → "person scrolling phone in dark room blue screen glow cinematic still hard shadow 35mm film grain"

# QUALITY GATES — antes de emitir o JSON, FAÇA ESSE CHECK MENTAL
Cada item abaixo deve passar. Se qualquer um falhar, REESCREVA — não retorne carrossel fraco.

[ ] 1. TESTE DA ESCADA: lendo só os headings em sequência, a história fecha?
[ ] 2. TESTE DA REMOÇÃO: removendo qualquer slide do meio, o carrossel PERDE algo real? Se não, mate e reescreva.
[ ] 3. TESTE DA ESPECIFICIDADE: cada claim tem número, nome próprio, ou cena concreta — nenhum "muitas empresas"?
[ ] 4. TESTE DA INVENÇÃO: todo número/empresa/dado citado existe no source ou está formulado como anedota/estimativa?
[ ] 5. TESTE DO CTA: o CTA funcionaria SÓ para esse carrossel? Se serve pra qualquer, falhou.
[ ] 6. TESTE DO ARQUÉTIPO: as 3 variações usaram 3 arquétipos DIFERENTES de hook (dos 12)?
[ ] 7. TESTE DO SLIDE 2: o slide 2 entrega um segundo golpe (dado, contraste, cena) — não é expansão morna do slide 1?
[ ] 8. TESTE DA VARIANT: nenhum variant visual se repete 2x seguidas; slide 1 e 2 são diferentes.
[ ] 9. TESTE DA VOZ: se o usuário forneceu voice_samples, pelo menos 2 tiques de linguagem das amostras aparecem no output.
[ ] 10. TESTE DO JARGÃO: nenhuma banida aparece; nenhum "você precisa / você deve" guru; cliffhanger não-clichê.

Só depois, retorne o JSON.

# OUTPUT FORMAT
Return valid JSON with exactly 3 variations — one in each style (data, story, provocative).
Each variation is a DISTINCT creative approach to the same topic.
Shape:
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
          "imageQuery": "3-6 English keywords of a concrete visual scene for THIS slide",
          "variant": "cover" | "headline" | "photo" | "quote" | "split" | "cta"
        }
      ]
    }
  ]
}
Each slides array must have 6-10 items. Every slide MUST include a valid "variant".`;

    // Escolhe o prompt baseado no modo explícito do usuário (UI toggle).
    const systemPrompt =
      mode === "layout-only" ? layoutOnlyPrompt : writerPrompt;

    // Source content (transcrição YouTube, scrape de link, legenda de Instagram):
    // antes fatiava em 3000 chars — transcript de vídeo longo perdia metade.
    // Raise pra 6000 (custa ~1.5k tokens extras, vale a pena pra fidelidade).
    const SOURCE_SLICE = 6000;
    if (sourceContent) {
      console.log(
        `[generate] sourceType=${sourceType} sourceContent=${sourceContent.length}chars (sliced to ${Math.min(
          sourceContent.length,
          SOURCE_SLICE
        )})`
      );
    }

    const userMessage =
      mode === "layout-only"
        ? // Em layout-only + source: o transcript/scrape VIRA o texto a ser formatado
          // (não é "fonte adicional", é O conteúdo). Topic do user é só hint/contexto.
          sourceContent
          ? `TEXTO PRA FORMATAR EM SLIDES — extraído da fonte (${sourceType}). Preserve wording, ordem, dados, fale da cabeça do autor quando fizer sentido:\n\n"""\n${sourceContent.slice(0, SOURCE_SLICE)}\n"""${topic && topic.trim().length > 50 ? `\n\nContexto/direcionamento do usuário:\n${topic.slice(0, 1000)}` : ""}`
          : `TEXTO DO USUÁRIO PRA FORMATAR EM SLIDES (preserve wording, ordem, dados, CTA):\n\n"""\n${topic}\n"""`
        : sourceContent
          ? `Create 3 carousel variations (data, story, provocative) based on this content:\n\nTopic: ${topic}\n\nSource (${sourceType}):\n${sourceContent.slice(0, SOURCE_SLICE)}`
          : `Create 3 carousel variations (data, story, provocative) about: ${topic}`;

    // 3. Increment usage BEFORE calling AI — ensures quota is always counted
    //    even if the response fails or user closes the tab.
    if (sb) {
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
      mode === "layout-only" ? "gemini-2.5-flash" : "gemini-2.5-pro";
    // Thinking budget aumentado no writer mode (10k → 16k) pra Pro
    // raciocinar a estrutura 3-atos e escolher dados específicos.
    // Gabriel pediu qualidade máxima, aceita custo extra.
    const thinkingBudget = mode === "layout-only" ? 2000 : 16000;
    const maxOutputTokens = mode === "layout-only" ? 10000 : 14000;
    const useGrounding = mode !== "layout-only";

    let textResponse: string;
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const genResult = await geminiWithRetry(() =>
        ai.models.generateContent({
          model: modelId,
          contents: `${userMessage}\n\n[variation-seed: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}]`,
          config: {
            systemInstruction: useGrounding
              ? `${systemPrompt}\n\n# OUTPUT ONLY VALID JSON\nYour response must be ONLY the JSON object specified in OUTPUT FORMAT — no markdown code fences, no prose before or after. Parser expects valid JSON from character 0.`
              : systemPrompt,
            temperature: 0.95,
            topP: 0.95,
            maxOutputTokens,
            // Grounding não aceita responseMimeType=application/json.
            ...(useGrounding
              ? { tools: [{ googleSearch: {} }] }
              : { responseMimeType: "application/json" }),
            thinkingConfig: { thinkingBudget },
          },
        })
      );
      textResponse = genResult.text || "";
      // Capture real token usage for cost auditing
      const usage = genResult.usageMetadata;
      if (usage) {
        inputTokens = usage.promptTokenCount ?? 0;
        outputTokens = usage.candidatesTokenCount ?? 0;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("[generate] Gemini API error (after retries):", {
        message: msg,
        stack,
        userId: user.id,
        sourceType,
        hasSourceContent: Boolean(sourceContent),
      });
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

    if (!textResponse) {
      return Response.json(
        { error: "No response from AI" },
        { status: 502 }
      );
    }

    // 4. Parse the JSON response (Gemini with responseMimeType=json should return clean JSON)
    let result: GenerateResponse;
    try {
      result = JSON.parse(textResponse);
    } catch {
      // Try extracting JSON from potential wrapper
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        console.error("[generate] Failed to parse Gemini response:", textResponse.slice(0, 500));
        return Response.json(
          { error: "Failed to parse AI response" },
          { status: 502 }
        );
      }
    }

    // 5. Validate structure
    if (!result.variations || !Array.isArray(result.variations)) {
      return Response.json(
        { error: "Invalid AI response structure" },
        { status: 502 }
      );
    }

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
        const imageQuery =
          typeof raw.imageQuery === "string" ? raw.imageQuery : "";
        const imageUrl =
          typeof raw.imageUrl === "string" && raw.imageUrl.trim()
            ? raw.imageUrl
            : undefined;
        // Só força CTA no último (closing sempre precisa fechar o loop).
        // Slide 1 fica como o Gemini decidiu (cover, headline, quote, etc.).
        // Se veio lixo, cai na distribuição de fallback (cover pra o primeiro).
        let variant: SlideVariant;
        if (total <= 1) {
          variant = "cover";
        } else if (i === total - 1) {
          variant = "cta";
        } else {
          variant = normalizeVariant(raw.variant, i, total);
        }
        return { heading, body, imageQuery, variant, ...(imageUrl ? { imageUrl } : {}) };
      });

      // Anti-monotonia: se os 2 primeiros slides saíram com o mesmo variant
      // (Gemini às vezes ignora regra), troca o segundo pelo mais contrastante.
      if (variation.slides.length >= 2) {
        const v1 = variation.slides[0].variant;
        const v2 = variation.slides[1].variant;
        if (v1 === v2) {
          const contrast: Record<SlideVariant, SlideVariant> = {
            cover: "split",
            headline: "photo",
            photo: "headline",
            quote: "split",
            split: "photo",
            cta: "headline",
          };
          variation.slides[1] = {
            ...variation.slides[1],
            variant: contrast[v1] ?? "photo",
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

    // Record generation with real token counts (usage already incremented above)
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
          cost_usd: Math.round(costUsd * 1_000_000) / 1_000_000, // 6 decimal places
          prompt_type: sourceType,
        });
      } catch (e) {
        console.warn("[generate] Failed to record generation:", e);
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

    return Response.json(result);
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

