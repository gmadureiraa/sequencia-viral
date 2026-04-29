/**
 * Admin debug tool — testa o pipeline de extração + NER sem gerar carrossel.
 *
 * Input: { sourceType, sourceUrl }
 * Output: { extracted, ner, finalPromptPreview }
 *
 * Não persiste nada. Não gasta quota do user. Só custa o NER call (~$0.0005).
 *
 * Acesso: requireAdmin (gf.madureiraa@gmail.com, gf.madureira@hotmail.com).
 */

import { requireAdmin } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import {
  extractSourceWithMeta,
  type DebugSourceType,
} from "@/lib/server/source-extraction";
import {
  extractSourceFacts,
  formatFactsBlock,
} from "@/lib/server/source-ner";

export const maxDuration = 60;

function isValidSourceType(s: unknown): s is DebugSourceType {
  return s === "video" || s === "link" || s === "instagram";
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;
    const { user } = admin;

    const limiter = await rateLimit({
      key: getRateLimitKey(request, "admin-source-debug", user.id),
      limit: 200,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded." },
        {
          status: 429,
          headers: { "Retry-After": String(limiter.retryAfterSec) },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sourceType = body?.sourceType;
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl : "";

    if (!isValidSourceType(sourceType)) {
      return Response.json(
        { error: "sourceType inválido. Use video, link ou instagram." },
        { status: 400 }
      );
    }
    if (!sourceUrl || sourceUrl.length < 4 || sourceUrl.length > 2000) {
      return Response.json(
        { error: "sourceUrl ausente ou fora do range." },
        { status: 400 }
      );
    }

    // 1. Extração do source
    const extracted = await extractSourceWithMeta(sourceType, sourceUrl);

    // 2. NER (só se tem conteúdo)
    const facts = extracted.content
      ? await extractSourceFacts(extracted.content)
      : null;

    // 3. Prompt preview (o bloco final que iria pro writer)
    const factsBlock = facts && !facts.skipped ? formatFactsBlock(facts) : "";
    const sourceSlice = sourceType === "video" ? 18000 : 10000;
    const sourcePreview = extracted.content.slice(0, sourceSlice);
    const finalPromptPreview = [
      "# SOURCE TYPE: " + sourceType,
      "# URL: " + sourceUrl,
      "",
      "# FIDELIDADE AO SOURCE (OBRIGATORIO)",
      "Cite NOMES PROPRIOS, NUMEROS/DATAS, FRASES DE IMPACTO literais do source.",
      "",
      factsBlock || "(NER não rodou ou retornou vazio)",
      "",
      "========== SOURCE CONTENT (sliced) ==========",
      "",
      sourcePreview,
    ].join("\n");

    return Response.json({
      extracted: {
        method: extracted.method,
        chars: extracted.chars,
        firstChars: extracted.firstChars,
        lastChars: extracted.lastChars,
        durationMs: extracted.durationMs,
        error: extracted.error ?? null,
      },
      ner: facts
        ? {
            summary: facts.summary,
            keyPoints: facts.keyPoints,
            entities: facts.entities,
            dataPoints: facts.dataPoints,
            quotes: facts.quotes,
            arguments: facts.arguments,
            durationMs: facts.durationMs,
            inputTokens: facts.inputTokens,
            outputTokens: facts.outputTokens,
            skipped: facts.skipped,
          }
        : {
            summary: [],
            keyPoints: [],
            entities: [],
            dataPoints: [],
            quotes: [],
            arguments: [],
            skipped: true,
          },
      finalPromptPreview,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/source-debug] error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
