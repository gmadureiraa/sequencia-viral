/**
 * scripts/analyze-brandsdecoded.ts
 *
 * Roda Apify pra scrapear últimos ~50 posts do @brandsdecoded, depois
 * Gemini Vision extrai texto dos slides. Agrupa tudo em `docs/research/
 * brandsdecoded-corpus.json`. Depois Gemini Pro analisa padrão e escreve
 * `docs/research/brandsdecoded-analysis.md`.
 *
 * Uso:
 *   bun scripts/analyze-brandsdecoded.ts [--posts=50]
 *
 * Pré-requisitos:
 *   - APIFY_API_KEY + GEMINI_API_KEY no .env.local
 *   - Custo estimado: ~$2 pro OCR dos slides + ~$0.20 análise final.
 */

import fs from "fs/promises";
import path from "path";

// Bun carrega .env.local automaticamente. Sem dotenv.

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_ACTOR = "apify~instagram-scraper";
const TARGET_USERNAME = "brandsdecoded";
const DEFAULT_POSTS = 50;

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs/research");
const CORPUS_FILE = path.join(OUT_DIR, "brandsdecoded-corpus.json");
const ANALYSIS_FILE = path.join(OUT_DIR, "brandsdecoded-analysis.md");

interface ApifyPost {
  shortCode: string;
  caption?: string;
  url?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  type?: string;
  images?: Array<{ displayUrl?: string }>;
  childPosts?: Array<{ displayUrl?: string; images?: Array<{ displayUrl?: string }> }>;
  displayUrl?: string;
}

interface SlideOcr {
  url: string;
  text: string;
}

interface CorpusEntry {
  shortCode: string;
  caption: string;
  url: string;
  timestamp: string | null;
  likes: number;
  comments: number;
  type: string;
  slides: SlideOcr[];
}

function parseFlag(flag: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (!arg) return fallback;
  const v = Number(arg.split("=")[1]);
  return Number.isFinite(v) && v > 0 ? Math.min(v, 200) : fallback;
}

async function apifyScrapeUrls(urls: string[]): Promise<ApifyPost[]> {
  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error("APIFY_API_KEY ausente");

  // Profile scraping grátis tá bloqueado pelo Instagram sem login.
  // Funciona com URLs diretas de posts — passa lista de shortcodes.
  const runInput = {
    directUrls: urls,
    resultsType: "details",
    resultsLimit: urls.length,
    addParentData: false,
  };

  console.log(`\n[1/3] Apify scrape — ${urls.length} URLs diretas...`);
  const res = await fetch(
    `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${apifyKey}&timeout=300`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runInput),
      signal: AbortSignal.timeout(360_000),
    }
  );
  if (!res.ok) {
    throw new Error(`Apify ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("Resposta inesperada do Apify");
  console.log(`  ✓ ${data.length} posts recebidos`);
  return data as ApifyPost[];
}

/**
 * Lê URLs de posts em `docs/research/brandsdecoded-urls.txt` — 1 por linha.
 * Aceita URL completa OU só shortcode. Profile scraping não funciona sem
 * login cookies, então o user precisa passar shortcodes dos posts que
 * quer analisar.
 */
async function loadUrls(): Promise<string[]> {
  const file = path.join(OUT_DIR, "brandsdecoded-urls.txt");
  try {
    const raw = await fs.readFile(file, "utf8");
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#"))
      .map((s) =>
        s.startsWith("http") ? s : `https://www.instagram.com/p/${s}/`
      );
  } catch {
    throw new Error(
      `Arquivo de URLs não encontrado: ${file}\n\n` +
        `Crie esse arquivo com 1 URL de post (ou só o shortcode) por linha:\n\n` +
        `  # Comentários começam com #\n` +
        `  https://www.instagram.com/p/C1abc.../\n` +
        `  C2xyz...\n` +
        `  C3def\n\n` +
        `Vai pegar esses posts específicos, fazer OCR dos slides e rodar análise.`
    );
  }
}

function extractSlideUrls(post: ApifyPost): string[] {
  const urls: string[] = [];
  if (Array.isArray(post.childPosts) && post.childPosts.length > 0) {
    for (const child of post.childPosts) {
      if (child.displayUrl) urls.push(child.displayUrl);
      else if (Array.isArray(child.images)) {
        for (const img of child.images) {
          if (img.displayUrl) urls.push(img.displayUrl);
        }
      }
    }
  }
  if (urls.length === 0 && Array.isArray(post.images)) {
    for (const img of post.images) {
      if (img.displayUrl) urls.push(img.displayUrl);
    }
  }
  if (urls.length === 0 && post.displayUrl) urls.push(post.displayUrl);
  return urls;
}

async function ocrSlide(url: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");

  // Baixa a imagem
  const imgRes = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!imgRes.ok) return "";
  const buf = await imgRes.arrayBuffer();
  const base64 = Buffer.from(buf).toString("base64");
  const mime = imgRes.headers.get("content-type") || "image/jpeg";

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Extract ALL text visible in this image, EXACTLY as written (including punctuation, accents, line breaks). If no text is visible, return an empty string. Return ONLY the extracted text, no commentary, no quotes.",
          },
          { inline_data: { mime_type: mime, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1000,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!res.ok) return "";
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.trim();
}

async function buildCorpus(posts: ApifyPost[]): Promise<CorpusEntry[]> {
  console.log(`\n[2/3] OCR ${posts.length} posts (Gemini Vision)...`);
  const corpus: CorpusEntry[] = [];
  let idx = 0;
  for (const post of posts) {
    idx += 1;
    const slideUrls = extractSlideUrls(post);
    console.log(`  ${idx}/${posts.length} — ${slideUrls.length} slides (@${post.shortCode})...`);
    const slides: SlideOcr[] = [];
    for (const url of slideUrls.slice(0, 12)) {
      try {
        const text = await ocrSlide(url);
        slides.push({ url, text });
      } catch (err) {
        console.warn(`    ! OCR falhou pra um slide: ${err instanceof Error ? err.message : err}`);
        slides.push({ url, text: "" });
      }
    }
    corpus.push({
      shortCode: post.shortCode,
      caption: (post.caption || "").trim(),
      url: post.url || `https://instagram.com/p/${post.shortCode}`,
      timestamp: post.timestamp || null,
      likes: post.likesCount ?? 0,
      comments: post.commentsCount ?? 0,
      type: post.type || "unknown",
      slides,
    });
  }
  return corpus;
}

async function analyzeCorpus(corpus: CorpusEntry[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");

  console.log(`\n[3/3] Analisando padrão (Gemini 2.5 Pro)...`);

  // Compacta o corpus pro prompt: título + 2-3 primeiros slides text
  const condensed = corpus
    .filter((e) => e.slides.length > 0)
    .map((e, i) => {
      const cover = e.slides[0]?.text || "(sem texto na capa)";
      const next = e.slides
        .slice(1, 4)
        .map((s, si) => `  Slide ${si + 2}: ${s.text.slice(0, 400)}`)
        .join("\n");
      return `### Post ${i + 1} (${e.likes} likes, ${e.comments} comments)\n**Capa:** ${cover}\n${next}\n**Legenda:** ${e.caption.slice(0, 500)}`;
    })
    .join("\n\n---\n\n");

  const analysisPrompt = `Você é um copywriter sênior especializado em carrosséis virais de Instagram. Vou te passar ~50 posts reais do @brandsdecoded — referência editorial brasileira sobre marcas, marketing, cultura pop. Extraia o PADRÃO EDITORIAL deles.

Sua análise precisa gerar um guia ACIONÁVEL que possamos usar pra treinar IA a escrever carrosséis no mesmo padrão. Sem vaguidade.

## Estrutura do relatório (em português, markdown):

### 1. Padrão da capa (gancho/título do slide 1)
- **Fórmula dominante** (com 3-5 variações): ex "PRODUTO X faz MOVIMENTO + pergunta retórica?"
- **Tamanho** (palavras)
- **Uso de acento/destaque** (vermelho, caps, underline) — quando aplicam
- **Dispositivos retóricos** mais usados (pergunta, afirmação contrariada, dado chocante, etc)

### 2. Padrão do desenvolvimento (slides 2-N)
- **Estrutura narrativa** dominante (SETUP → CLAIM → EVIDENCE → etc)
- **Densidade por slide** (quantas palavras em média, quantas ideias)
- **Uso de imagem vs só texto** (proporção)
- **Transições entre slides** — como fazem o reader ir pro próximo

### 3. Padrão da legenda
- **Estrutura** (hook, parágrafos, CTA, hashtags)
- **Tamanho médio**
- **CTA mais comum**

### 4. Tópicos/nichos cobertos
- Lista de temas mais recorrentes (ex: "fim de parceria marca X", "nova campanha Y", "flop de lançamento Z")

### 5. 5 REGRAS CONCRETAS pra nosso prompt IA
Coisas específicas, não genéricas. Ex: "Título sempre em ALL CAPS com 8-14 palavras, palavras-chave em vermelho no final", não "Use linguagem direta".

### 6. 3 EXEMPLOS de hooks que funcionam (dos posts) + por que funcionam

## CORPUS

${condensed.slice(0, 60000)}

Retorne APENAS o markdown do relatório, sem blocos de código, sem preâmbulo.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8000,
          thinkingConfig: { thinkingBudget: 8000 },
        },
      }),
      signal: AbortSignal.timeout(180_000),
    }
  );
  if (!res.ok) throw new Error(`Gemini análise ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return analysis;
}

async function main() {
  const postsLimit = parseFlag("posts", DEFAULT_POSTS);
  console.log(`════════════════════════════════════════════`);
  console.log(`  BrandsDecoded corpus analysis`);
  console.log(`  Target: @${TARGET_USERNAME} · ${postsLimit} posts`);
  console.log(`════════════════════════════════════════════`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  // Phase 1: Apify via URLs diretas (profile scraping free bloqueado)
  const urls = await loadUrls();
  const posts = await apifyScrapeUrls(urls.slice(0, postsLimit));

  // Phase 2: OCR slides
  const corpus = await buildCorpus(posts);
  await fs.writeFile(CORPUS_FILE, JSON.stringify(corpus, null, 2), "utf8");
  console.log(`\n  ✓ Corpus salvo em ${CORPUS_FILE}`);

  // Phase 3: analysis
  const analysis = await analyzeCorpus(corpus);
  await fs.writeFile(
    ANALYSIS_FILE,
    `# BrandsDecoded — padrão editorial\n\n_Gerado por \`scripts/analyze-brandsdecoded.ts\` em ${new Date().toISOString()} · ${corpus.length} posts analisados._\n\n${analysis}\n`,
    "utf8"
  );
  console.log(`  ✓ Análise salva em ${ANALYSIS_FILE}`);
  console.log(`\n════════════════════════════════════════════`);
  console.log(`  Concluído.`);
  console.log(`════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
