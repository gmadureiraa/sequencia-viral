/**
 * POST /api/post-transcripts
 *
 * Recebe posts do Instagram com image URLs, baixa a imagem (SSRF-safe) e
 * roda Gemini 2.5 Flash com inline image pra transcrever o texto visível
 * e descrever a cena. Usado no onboarding pra enriquecer a brand-analysis:
 * legendas nao contam a historia toda em carrosseis — o texto dos slides sim.
 *
 * Body: { posts: Array<{ id: string, imageUrl: string }> }
 *   - Processa ate 8 posts (cap conservador de custo).
 *
 * Retorna: { transcripts: Array<{ id, visible_text, scene }> }
 */

export const maxDuration = 60;

import { requireAuthenticatedUser } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { GoogleGenAI } from "@google/genai";
import {
  costForTokens,
  recordGeneration,
} from "@/lib/server/generation-log";
import {
  assertSafeUrl,
  assertResolvedIpIsSafe,
} from "@/lib/server/ssrf-guard";

const MAX_POSTS = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type PostInput = { id: string; imageUrl: string };
type Transcript = { id: string; visible_text: string; scene: string };

async function fetchImageSafe(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    assertSafeUrl(url);
    const u = new URL(url);
    await assertResolvedIpIsSafe(u.hostname);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SequenciaViral/1.0; onboarding-vision)",
        Accept: "image/*,*/*;q=0.5",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\//i.test(contentType)) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    // Base64 encode (Node/browser safe via btoa for small-medium)
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return { base64: btoa(binary), mime: contentType.split(";")[0] };
  } catch {
    return null;
  }
}

async function describeImage(
  ai: GoogleGenAI,
  base64: string,
  mime: string
): Promise<{ text: string; promptTokens: number; outputTokens: number } | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: { data: base64, mimeType: mime },
            },
            {
              text: `Extraia o texto visivel na imagem (OCR) e descreva a cena.
Responda EXATAMENTE este JSON, sem markdown:
{
  "visible_text": "todo texto que aparece na imagem, linha a linha. Vazio se nao houver.",
  "scene": "descricao curta da cena visual em portugues BR (1-2 frases, max 180 chars)."
}`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 600,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const text = response.text ?? "";
    const usage = response.usageMetadata;
    return {
      text,
      promptTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = checkRateLimit({
    key: getRateLimitKey(request, "post-transcripts", user.id),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit. Tenta em alguns minutos." },
      { status: 429 }
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return Response.json({ transcripts: [], reason: "no-key" });
  }

  let body: { posts?: PostInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON invalido" }, { status: 400 });
  }
  const posts = Array.isArray(body.posts) ? body.posts.slice(0, MAX_POSTS) : [];
  if (posts.length === 0) {
    return Response.json({ transcripts: [] });
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const transcripts: Transcript[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const p of posts) {
    if (!p?.id || !p?.imageUrl) continue;
    const img = await fetchImageSafe(p.imageUrl);
    if (!img) continue;
    const described = await describeImage(ai, img.base64, img.mime);
    if (!described) continue;
    totalInputTokens += described.promptTokens;
    totalOutputTokens += described.outputTokens;
    try {
      const parsed = JSON.parse(described.text.replace(/^```json\s*/i, "").replace(/```$/, ""));
      transcripts.push({
        id: p.id,
        visible_text: typeof parsed.visible_text === "string" ? parsed.visible_text.slice(0, 1200) : "",
        scene: typeof parsed.scene === "string" ? parsed.scene.slice(0, 300) : "",
      });
    } catch {
      // best effort
      transcripts.push({ id: p.id, visible_text: "", scene: "" });
    }
  }

  if (totalInputTokens + totalOutputTokens > 0) {
    await recordGeneration({
      userId: user.id,
      model: "gemini-2.5-flash",
      provider: "google",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUsd: costForTokens(
        "gemini-2.5-flash",
        totalInputTokens,
        totalOutputTokens
      ),
      promptType: "post-vision-transcripts",
    });
  }

  return Response.json({ transcripts });
}
