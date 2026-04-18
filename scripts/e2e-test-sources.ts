/**
 * E2E teste: gera 1 carrossel para cada uma das 4 origens
 *   1. YouTube (com transcrição real)
 *   2. Blog/artigo (link)
 *   3. Instagram reel
 *   4. Sugestão de IA (idea)
 *
 * Persiste cada carrossel na tabela `carousels` do Supabase, atribuído
 * ao user cuja conta é passada via env `TEST_USER_EMAIL`.
 *
 * Rodar:
 *   bun run scripts/e2e-test-sources.ts
 *
 * Requer .env.local com:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 *   APIFY_API_KEY (para Instagram)
 *   TEST_USER_EMAIL (e-mail do usuário no Supabase Auth)
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { extractContentFromUrl } from "../lib/url-extractor";
import { getYouTubeTranscript } from "../lib/youtube-transcript";
import { extractInstagramContent } from "../lib/instagram-extractor";

const ENV_PATH = process.env.DOTENV_PATH || ".env.local";
// bun --env-file carrega automaticamente; isso garante Node+tsx também.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const text = await Bun.file(ENV_PATH).text();
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      let value = m[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {
    /* ignore */
  }
}

const SUPABASE_URL = must("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = must("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = must("GEMINI_API_KEY");
const TEST_USER_EMAIL = must("TEST_USER_EMAIL");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type SourceType = "video" | "link" | "instagram" | "idea";

const SOURCES: {
  sourceType: SourceType;
  sourceUrl?: string;
  topic: string;
  label: string;
}[] = [
  {
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    topic:
      "Transformar a ideia desse vídeo seminal em 7 princípios sobre como conteúdo simples vira icônico.",
    label: "Teste E2E — YouTube (ASR)",
  },
  {
    sourceType: "link",
    sourceUrl: "https://www.paulgraham.com/growth.html",
    topic:
      "Como aplicar as lições desse ensaio sobre crescimento pra creators de conteúdo em 2026.",
    label: "Teste E2E — Blog",
  },
  {
    sourceType: "instagram",
    sourceUrl: "https://www.instagram.com/reel/DKdD9qgv9qk/",
    topic: "Extrair o insight principal desse reel e transformar em carrossel de 7 slides.",
    label: "Teste E2E — Instagram reel",
  },
  {
    sourceType: "idea",
    topic:
      "3 frameworks de copywriting que a maioria dos creators brasileiros ignora (e por que isso custa alcance).",
    label: "Teste E2E — Ideia IA",
  },
];

async function main() {
  const onlyFilter = process.argv[2]?.toLowerCase();
  const userId = await resolveUserId(TEST_USER_EMAIL);
  console.log(`\n📌 User: ${TEST_USER_EMAIL} (${userId})\n`);

  const report: Array<{
    label: string;
    sourceType: SourceType;
    carouselId?: string;
    sourceBytes?: number;
    sourcePreview?: string;
    slides?: number;
    title?: string;
    error?: string;
  }> = [];

  const list = onlyFilter
    ? SOURCES.filter((s) => s.sourceType === onlyFilter)
    : SOURCES;

  for (const src of list) {
    const line = "─".repeat(60);
    console.log(`\n${line}\n▶️  ${src.label}  [${src.sourceType}]\n${line}`);
    try {
      const sourceContent = await resolveSource(src.sourceType, src.sourceUrl);
      const preview = (sourceContent || "").slice(0, 200).replace(/\s+/g, " ");
      console.log(
        `📥 Fonte (${sourceContent.length.toLocaleString()} chars): ${preview}…`
      );

      const carousel = await generateCarousel({
        topic: src.topic,
        sourceContent,
        label: src.label,
      });
      console.log(
        `🧠 Variação escolhida: "${carousel.title}" (${carousel.slides.length} slides)`
      );

      const carouselId = await saveCarousel(userId, {
        title: `${src.label}: ${carousel.title}`,
        slides: carousel.slides,
        style: carousel.style,
        sourceType: src.sourceType,
        sourceUrl: src.sourceUrl,
      });
      console.log(`💾 Salvo: carousels/${carouselId}`);

      report.push({
        label: src.label,
        sourceType: src.sourceType,
        carouselId,
        sourceBytes: sourceContent.length,
        sourcePreview: preview,
        slides: carousel.slides.length,
        title: carousel.title,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ Falhou: ${msg}`);
      report.push({
        label: src.label,
        sourceType: src.sourceType,
        error: msg,
      });
    }
  }

  console.log("\n\n╔════════════════════════════════════════════════════════╗");
  console.log("║                     RESUMO FINAL                       ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");
  for (const r of report) {
    const status = r.carouselId ? "✅" : "❌";
    console.log(`${status} ${r.label}`);
    if (r.carouselId) {
      console.log(`   title:   ${r.title}`);
      console.log(`   slides:  ${r.slides}`);
      console.log(`   src len: ${r.sourceBytes} chars`);
      console.log(`   id:      ${r.carouselId}`);
    } else {
      console.log(`   error:   ${r.error}`);
    }
  }
  console.log();
}

/**
 * Reparo heurístico: se Gemini truncar o JSON no meio de um slide,
 * fechamos os arrays/objetos em aberto para reaproveitar o que veio.
 */
function repairVariationsJson(text: string): {
  variations: Array<{
    title: string;
    style: "data" | "story" | "provocative";
    slides: Array<{ heading: string; body: string; imageQuery: string }>;
  }>;
} {
  const start = text.indexOf("{");
  if (start < 0) throw new Error(`AI response sem JSON:\n${text.slice(0, 200)}`);
  let buf = text.slice(start);
  // corta no último slide completo (body/heading/imageQuery) + fecha estruturas
  const lastSlideEnd = buf.lastIndexOf('"imageQuery"');
  if (lastSlideEnd >= 0) {
    const tail = buf.slice(lastSlideEnd);
    const closeIdx = tail.search(/"[^"]*"\s*}/);
    if (closeIdx >= 0) {
      buf = buf.slice(0, lastSlideEnd + closeIdx + tail.slice(closeIdx).indexOf("}") + 1);
    }
  }
  // fecha arrays/objetos em aberto
  const open = { "{": 0, "[": 0 };
  for (const ch of buf) {
    if (ch === "{") open["{"]++;
    else if (ch === "}") open["{"]--;
    else if (ch === "[") open["["]++;
    else if (ch === "]") open["["]--;
  }
  while (open["["]-- > 0) buf += "]";
  while (open["{"]-- > 0) buf += "}";
  try {
    return JSON.parse(buf);
  } catch (e) {
    throw new Error(
      `AI JSON irrecuperável: ${e instanceof Error ? e.message : e}\nTrecho:\n${buf.slice(-200)}`
    );
  }
}

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
  return v;
}

async function resolveUserId(email: string): Promise<string> {
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
    const hit = data.users.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase()
    );
    if (hit) return hit.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  throw new Error(`Usuário com email ${email} não encontrado no Supabase Auth.`);
}

async function resolveSource(
  type: SourceType,
  url?: string
): Promise<string> {
  if (type === "idea") return "";
  if (!url) throw new Error("URL ausente");
  if (type === "video") return await getYouTubeTranscript(url);
  if (type === "link") return await extractContentFromUrl(url);
  if (type === "instagram") return await extractInstagramContent(url);
  throw new Error("sourceType inválido");
}

async function generateCarousel(args: {
  topic: string;
  sourceContent: string;
  label: string;
}): Promise<{
  title: string;
  slides: Array<{ heading: string; body: string; imageQuery: string }>;
  style: "data" | "story" | "provocative";
}> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const systemPrompt = `You are a narrative architect for Instagram carousels. Write in pt-BR coloquial.
Each carousel is 7 slides. Each slide has heading (max 8 words) and body (max 3 short lines).
Return JSON: {"variations":[{"title":"string","style":"data"|"story"|"provocative","slides":[{"heading":"string","body":"string","imageQuery":"english stock keywords"}]}]}
Produce exactly 1 variation.`;

  const userMessage = args.sourceContent
    ? `Topic: ${args.topic}\n\nFonte:\n${args.sourceContent.slice(0, 3000)}`
    : `Topic: ${args.topic}`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${userMessage}\n\n[seed: ${Date.now()}]`,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.85,
      maxOutputTokens: 10000,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = result.text || "";
  let parsed: {
    variations: Array<{
      title: string;
      style: "data" | "story" | "provocative";
      slides: Array<{ heading: string; body: string; imageQuery: string }>;
    }>;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    // 1) tenta o maior bloco { ... } inteiro
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = repairVariationsJson(text);
      }
    } else {
      parsed = repairVariationsJson(text);
    }
  }
  const v = parsed.variations?.[0];
  if (!v) throw new Error("AI retornou 0 variations");
  return v;
}

async function saveCarousel(
  userId: string,
  payload: {
    title: string;
    slides: Array<{ heading: string; body: string; imageQuery: string }>;
    style: string;
    sourceType: SourceType;
    sourceUrl?: string;
  }
): Promise<string> {
  const { data, error } = await sb
    .from("carousels")
    .insert({
      user_id: userId,
      title: payload.title,
      slides: payload.slides,
      style: {
        slideStyle: "white",
        variation: { title: payload.title, style: payload.style },
        creation_mode: "quick",
        test_source_type: payload.sourceType,
        test_source_url: payload.sourceUrl,
      },
      status: "draft",
      source_url: payload.sourceUrl ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`save: ${error.message}`);
  return data.id as string;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
