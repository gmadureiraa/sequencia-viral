export const maxDuration = 120;

import { GoogleGenAI } from "@google/genai";
import {
  createServiceRoleSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { costForTokens, recordGeneration } from "@/lib/server/generation-log";
import { extractInstagramContent } from "@/lib/instagram-extractor";
import { geminiWithRetry } from "@/lib/server/gemini-retry";

const MAX_URLS = 6;

interface IngestRequest {
  urls: string[];
  kind?: "self" | "reference";
}

interface VoiceDna {
  summary: string;
  tone: string[];
  hook_patterns: string[];
  cta_style: string;
  structure_signature: string;
  vocabulary_markers: string[];
  dos: string[];
  donts: string[];
  sample_captions: string[];
}

interface IngestResponse {
  voice_dna: VoiceDna;
  samples: Array<{
    url: string;
    ok: boolean;
    text?: string;
    error?: string;
  }>;
}

function validIgUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    if (!parsed.hostname.includes("instagram.com")) return false;
    return /^\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/.test(parsed.pathname);
  } catch {
    return false;
  }
}

const VOICE_PROMPT = `Você é um analista de voz editorial. Recebe trechos de carrosséis do Instagram (caption + OCR dos slides) e precisa extrair o DNA de voz do criador.

Retorne APENAS JSON no formato:
{
  "summary": "2-3 frases descrevendo a voz em português",
  "tone": ["adjetivo", "adjetivo", "adjetivo"],
  "hook_patterns": ["descrição do padrão 1", "padrão 2", "padrão 3"],
  "cta_style": "descrição do CTA recorrente",
  "structure_signature": "padrão narrativo que se repete (ex: problema → ruptura → nova realidade)",
  "vocabulary_markers": ["palavra/expressão", "palavra/expressão"],
  "dos": ["o que replicar na próxima geração", "..."],
  "donts": ["o que a voz evita", "..."],
  "sample_captions": ["trecho de legenda real encontrado", "outro trecho"]
}

Regras:
- Seja ESPECÍFICO. Nada genérico.
- Tudo em português (pt-BR), exceto os campos-chave do JSON.
- Baseie-se APENAS nos trechos enviados. Não invente.
- sample_captions: 2-3 trechos curtos reais (<120 chars cada).
- hook_patterns: descreva a fórmula, não cite literal.`;

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "voice-ingest", user.id),
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const body = (await request.json()) as IngestRequest;
    const urls = Array.isArray(body.urls) ? body.urls.slice(0, MAX_URLS) : [];
    const cleaned = urls
      .map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter((u) => u && validIgUrl(u));

    if (cleaned.length === 0) {
      return Response.json(
        { error: "Envie pelo menos uma URL de post/reel do Instagram." },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return Response.json(
        { error: "Gemini não configurado no servidor." },
        { status: 500 }
      );
    }

    const samples = await Promise.all(
      cleaned.map(async (url) => {
        try {
          const text = await extractInstagramContent(url);
          return { url, ok: true, text };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { url, ok: false, error: msg };
        }
      })
    );

    const okSamples = samples.filter((s) => s.ok && s.text);
    if (okSamples.length === 0) {
      return Response.json(
        {
          error:
            "Não consegui ler nenhum dos links. Confere se os posts estão públicos e tente de novo.",
          samples,
        },
        { status: 422 }
      );
    }

    const bundled = okSamples
      .map(
        (s, i) =>
          `--- Post ${i + 1} (${body.kind === "reference" ? "referência" : "próprio"}) ---\n${s.text}`
      )
      .join("\n\n");

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await geminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: VOICE_PROMPT },
              { text: "\n\nTRECHOS:\n\n" + bundled },
            ],
          },
        ],
        config: {
          temperature: 0.3,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    );

    const usageMeta = (
      result as unknown as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
    ).usageMetadata;
    const inputTokens = usageMeta?.promptTokenCount ?? 0;
    const outputTokens = usageMeta?.candidatesTokenCount ?? 0;
    await recordGeneration({
      userId: user.id,
      model: "gemini-2.5-flash",
      provider: "google",
      inputTokens,
      outputTokens,
      costUsd: costForTokens("gemini-2.5-flash", inputTokens, outputTokens),
      promptType: "voice-ingest",
    });

    const rawText = result.text || "";
    let voiceDna: VoiceDna;
    try {
      voiceDna = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) {
        return Response.json(
          { error: "Resposta inválida da IA. Tenta de novo." },
          { status: 502 }
        );
      }
      voiceDna = JSON.parse(match[0]);
    }

    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      try {
        const { data: profile } = await sb
          .from("profiles")
          .select("brand_analysis")
          .eq("id", user.id)
          .maybeSingle();

        const existing =
          (profile?.brand_analysis as Record<string, unknown> | null) ?? {};
        const updated = {
          ...existing,
          __voice_dna: voiceDna,
          __voice_samples: okSamples.map((s) => ({
            url: s.url,
            text:
              typeof s.text === "string" && s.text.length > 4000
                ? s.text.slice(0, 4000) + "…"
                : s.text,
          })),
          __voice_updated_at: new Date().toISOString(),
          __voice_kind: body.kind === "reference" ? "reference" : "self",
        };

        await sb
          .from("profiles")
          .update({ brand_analysis: updated })
          .eq("id", user.id);
      } catch (err) {
        console.warn(
          "[voice-ingest] falha ao salvar brand_analysis:",
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    const response: IngestResponse = {
      voice_dna: voiceDna,
      samples,
    };
    return Response.json(response);
  } catch (error) {
    console.error("[voice-ingest] Unexpected error:", error);
    return Response.json(
      { error: "Erro interno ao analisar os links." },
      { status: 500 }
    );
  }
}
