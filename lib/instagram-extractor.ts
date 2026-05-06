/**
 * Extractor de post/reel/carrossel do Instagram.
 *
 * Fluxo:
 *   1. Apify (`apify~instagram-scraper`) → caption + metadados (likes, hashtags, owner).
 *   2. Supadata (`/v1/transcript`) → ASR do áudio do reel/vídeo.
 *   3. Compõe um contexto rico combinando caption + transcript + metadados.
 *
 * Se o post é puramente imagem sem caption, retorna erro instruindo o usuário
 * a colar a ideia manualmente.
 */

import { fetchSupadataTranscript, isSupadataConfigured } from "./supadata";
import { GoogleGenAI } from "@google/genai";

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_TIMEOUT_SECS = 45;
// Actor ID: apify~instagram-scraper (público, gratuito com limites)
const ACTOR_ID = "apify~instagram-scraper";
// Max imagens do carrossel que passamos pra Gemini Vision (custo x benefício)
const MAX_CAROUSEL_IMAGES = 10;

/**
 * Usa Gemini 2.5 Flash multimodal pra extrair o texto ESCRITO NAS IMAGENS
 * de um carrossel do Instagram. Pattern pra capturar o conteúdo real que
 * a pessoa postou (não só a caption) — essencial pra ângulos de remixagem.
 */
async function transcribeCarouselSlides(
  displayUrls: string[]
): Promise<string[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || displayUrls.length === 0) return [];

  const urls = displayUrls.slice(0, MAX_CAROUSEL_IMAGES);

  // Baixa cada imagem → converte pra base64. Gemini SDK aceita inlineData.
  const imageParts = await Promise.all(
    urls.map(async (url, i) => {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const mimeType = res.headers.get("content-type") || "image/jpeg";
        const base64 = Buffer.from(buf).toString("base64");
        return {
          idx: i,
          inlineData: { data: base64, mimeType: mimeType.split(";")[0] },
        };
      } catch {
        return null;
      }
    })
  );

  const valid = imageParts.filter(
    (p): p is { idx: number; inlineData: { data: string; mimeType: string } } =>
      p !== null
  );

  if (valid.length === 0) return [];

  const prompt = `Você é um OCR especialista em carrosséis de Instagram.
Transcreva o texto VISÍVEL em cada imagem de carrossel enviada. Ignore logos,
marcas d'água, handles e elementos decorativos. Foco só no texto de conteúdo
(frases, bullets, números, dados).

${valid.map((p) => `Imagem ${p.idx + 1}:`).join("\n")}

Retorne APENAS JSON no formato:
{"slides":[{"index":1,"text":"texto transcrito, preservando quebras com \\n"}]}

Se uma imagem não tem texto significativo (só ilustração), retorne
"text":"" pra ela. Nunca invente texto.`;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            ...valid.map((p) => ({ inlineData: p.inlineData })),
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const text = result.text || "";
    const parsed = JSON.parse(text) as {
      slides?: Array<{ index?: number; text?: string }>;
    };
    if (!Array.isArray(parsed.slides)) return [];
    const byIndex = new Map<number, string>();
    for (const s of parsed.slides) {
      if (typeof s.index === "number" && typeof s.text === "string") {
        byIndex.set(s.index, s.text.trim());
      }
    }
    return urls.map((_, i) => byIndex.get(i + 1) || "");
  } catch (err) {
    console.warn(
      "[ig] Gemini Vision OCR falhou:",
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}

type InstagramKind = "post" | "reel" | "profile";

function parseInstagramUrl(input: string): { kind: InstagramKind; id: string } | null {
  // Normaliza: trim, remove zero-width chars, prepend https:// se faltar
  let url = (input || "").trim();
  if (!url) return null;
  url = url.replace(/[​-‍﻿]/g, "");
  if (!/^https?:\/\//i.test(url)) {
    if (/^(www\.)?(instagram\.com|instagr\.am|m\.instagram\.com)\//i.test(url)) {
      url = `https://${url}`;
    } else {
      return null;
    }
  }
  try {
    const u = new URL(url);
    // Aceita instagram.com, m.instagram.com, www.instagram.com, instagr.am
    const host = u.hostname.toLowerCase();
    if (
      !host.endsWith("instagram.com") &&
      !host.endsWith("instagr.am")
    ) {
      return null;
    }

    // Path pode ter locale prefix tipo /pt-br/p/... (raro mas existe)
    let path = u.pathname;
    const localeMatch = path.match(/^\/[a-z]{2}(-[a-z]{2})?\/(.+)$/i);
    if (localeMatch) {
      path = `/${localeMatch[2]}`;
    }

    // /p/<shortcode>/, /reel/<shortcode>/, /reels/<shortcode>/, /tv/, /share/
    const m = path.match(/^\/(p|reel|reels|tv|share)\/([A-Za-z0-9_-]+)/);
    if (m) {
      const t = m[1];
      const kind: InstagramKind =
        t === "p" || t === "share" ? "post" : "reel";
      return { kind, id: m[2] };
    }
    // /username/
    const profileMatch = path.match(/^\/([A-Za-z0-9._]+)\/?$/);
    if (profileMatch) {
      return { kind: "profile", id: profileMatch[1] };
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractInstagramContent(url: string): Promise<string> {
  // 2026-05-06: aceita até 2 tokens Apify pra resiliência. Se a key
  // primária estourar quota (402 / 429), tenta a fallback. Setar
  // APIFY_API_KEY_FALLBACK no Vercel ativa.
  const apifyKey = process.env.APIFY_API_KEY;
  const apifyKeyFallback = process.env.APIFY_API_KEY_FALLBACK;
  if (!apifyKey && !apifyKeyFallback) {
    throw new Error(
      "APIFY_API_KEY não configurado no servidor. Contate o suporte."
    );
  }

  const parsed = parseInstagramUrl(url);
  if (!parsed) {
    // Log da URL exata que falhou — antes a mensagem era genérica e
    // não dava pra entender o formato que o user colou.
    console.warn(
      `[ig-extract] URL inválida (não bateu regex): "${(url || "").slice(0, 200)}"`,
    );
    throw new Error(
      "URL do Instagram inválida. Cole um link completo de post (instagram.com/p/...), reel (/reel/...) ou compartilhamento (/share/...)."
    );
  }

  // Apify actor input — usa `directUrls` pra ir direto no shortcode.
  const runInput = {
    directUrls: [url],
    resultsType: "details",
    resultsLimit: 1,
    addParentData: false,
  };

  async function runApify(token: string): Promise<Response> {
    return fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=${APIFY_TIMEOUT_SECS}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runInput),
        signal: AbortSignal.timeout((APIFY_TIMEOUT_SECS + 10) * 1000),
      }
    );
  }

  const tokens = [apifyKey, apifyKeyFallback].filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );
  let runRes: Response | null = null;
  let lastErr = "";
  for (let i = 0; i < tokens.length; i++) {
    runRes = await runApify(tokens[i]);
    if (runRes.ok) break;
    // 402 (quota) / 429 (rate-limit) / 401 (auth) → tenta fallback
    if ([401, 402, 429].includes(runRes.status) && i < tokens.length - 1) {
      lastErr = await runRes.text().catch(() => "");
      console.warn(
        `[ig-extract] Apify token ${i + 1} status=${runRes.status}, tentando fallback`,
      );
      continue;
    }
    lastErr = await runRes.text().catch(() => "");
    break;
  }

  if (!runRes || !runRes.ok) {
    throw new Error(
      `Apify ${runRes?.status ?? "no-response"}: ${
        lastErr.slice(0, 200) || "falha no scraping"
      }`
    );
  }

  const data = (await runRes.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "Instagram não retornou nada. Post pode ser privado, deletado ou a URL está errada."
    );
  }

  const first = data[0] as {
    caption?: string;
    text?: string;
    ownerUsername?: string;
    videoViewCount?: number;
    videoPlayCount?: number;
    videoDuration?: number;
    likesCount?: number;
    commentsCount?: number;
    type?: string;
    hashtags?: string[];
    mentions?: string[];
    images?: Array<{ displayUrl?: string }>;
    childPosts?: Array<{ caption?: string; displayUrl?: string }>;
    videoUrl?: string;
  };

  const caption = (first.caption || first.text || "").trim();
  const isVideo =
    first.type === "Video" ||
    parsed.kind === "reel" ||
    Boolean(first.videoUrl) ||
    typeof first.videoDuration === "number";

  // Se não tem caption E é vídeo → tenta Supadata (áudio → texto).
  let supadataTranscript: string | null = null;
  if (isVideo && isSupadataConfigured()) {
    try {
      const sup = await fetchSupadataTranscript(url, { mode: "auto" });
      supadataTranscript = sup?.content || null;
    } catch (err) {
      console.warn(
        "[ig] Supadata fallback falhou:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  if (!caption && !supadataTranscript) {
    throw new Error(
      "Post sem legenda e sem áudio transcrevível. Cole a ideia no modo 'Minha ideia'."
    );
  }

  // Monta um bloco de contexto rico que vai direto no prompt do Claude
  const lines: string[] = [];
  lines.push(`Fonte: Instagram ${parsed.kind} (@${first.ownerUsername || "desconhecido"})`);
  if (first.type) lines.push(`Tipo: ${first.type}`);
  if (first.likesCount) lines.push(`Curtidas: ${first.likesCount}`);
  if (first.commentsCount) lines.push(`Comentários: ${first.commentsCount}`);
  const views = first.videoViewCount ?? first.videoPlayCount;
  if (views) lines.push(`Views: ${views}`);
  if (first.videoDuration) lines.push(`Duração: ${Math.round(first.videoDuration)}s`);
  if (first.hashtags && first.hashtags.length > 0) {
    lines.push(`Hashtags: ${first.hashtags.slice(0, 10).join(", ")}`);
  }

  if (caption) {
    lines.push("");
    lines.push("Legenda original:");
    lines.push(caption);
  }

  if (supadataTranscript) {
    lines.push("");
    lines.push("Transcrição do áudio:");
    lines.push(
      supadataTranscript.length > 4000
        ? supadataTranscript.slice(0, 4000) + "…"
        : supadataTranscript
    );
  }

  // Se for carrossel, OCR via Gemini Vision em cada slide. Isso captura o
  // TEXTO IMPRESSO NA IMAGEM (o que a pessoa realmente escreveu em cima
  // da arte), não só a caption do post. Sem isso, remixar carrossel IG
  // vira um chute baseado apenas na legenda de rodapé.
  const slideImageUrls: string[] = [];
  if (first.childPosts && first.childPosts.length > 0) {
    for (const c of first.childPosts) {
      if (c.displayUrl) slideImageUrls.push(c.displayUrl);
    }
  } else if (first.images && first.images.length > 0) {
    for (const im of first.images) {
      if (im.displayUrl) slideImageUrls.push(im.displayUrl);
    }
  }

  if (slideImageUrls.length > 0) {
    const transcripts = await transcribeCarouselSlides(slideImageUrls);
    const renderedSlides: string[] = [];
    for (let i = 0; i < transcripts.length; i++) {
      const t = transcripts[i];
      if (t && t.trim()) {
        renderedSlides.push(`Slide ${i + 1}: ${t}`);
      }
    }
    // Também inclui caption dos childPosts se houver (carrosséis podem ter
    // caption por child, embora raro).
    if (first.childPosts) {
      const extra = first.childPosts
        .map((c, i) => (c.caption ? `Slide ${i + 1} (legenda): ${c.caption}` : null))
        .filter((x): x is string => Boolean(x));
      renderedSlides.push(...extra);
    }
    if (renderedSlides.length > 0) {
      lines.push("");
      lines.push("Conteúdo dos slides (OCR Gemini Vision):");
      lines.push(...renderedSlides);
    }
  }

  return lines.join("\n");
}
