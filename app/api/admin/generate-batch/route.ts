/**
 * Admin batch generation — roda N testes de geração em sequência pra Gabriel
 * validar qualidade em diferentes nichos/formatos.
 *
 * Input:
 *   {
 *     userId: "uuid",       // conta onde os carrosseis vão ser salvos
 *     tests: [
 *       { niche, tone, sourceType?, sourceUrl?, topic?, language? },
 *       ...
 *     ]
 *   }
 *
 * Output:
 *   { results: [{ index, status, carouselId?, title?, error?, durationMs, tokens }] }
 *
 * Acesso: requireAdmin. Rate limit generoso (200/hr).
 * Custo estimado: ~$0.02 por teste × 15 = $0.30 total.
 */

import {
  requireAdmin,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import {
  runGeneration,
  type GenerationArgs,
} from "@/lib/server/generate-carousel";
import { upsertUserCarousel } from "@/lib/carousel-storage";

export const maxDuration = 300; // 5 min pra batch grande

interface TestSpec {
  niche: string;
  tone: string;
  sourceType?: "idea" | "link" | "video" | "instagram";
  sourceUrl?: string;
  topic?: string;
  language?: string;
  label?: string; // nome opcional do teste, pro título do carrossel
}

interface TestResult {
  index: number;
  label: string;
  status: "ok" | "failed";
  carouselId?: string;
  title?: string;
  error?: string;
  durationMs: number;
  writerTokens?: { input: number; output: number; model: string };
  nerTokens?: { input: number; output: number };
  sourceChars?: number;
  factsPreview?: {
    entities: string[];
    dataPoints: string[];
    quotes: string[];
  };
}

function sanitizeTest(t: unknown, i: number): TestSpec | null {
  if (!t || typeof t !== "object") return null;
  const obj = t as Record<string, unknown>;
  const niche =
    typeof obj.niche === "string" && obj.niche.length < 80
      ? obj.niche
      : "general";
  const tone =
    typeof obj.tone === "string" && obj.tone.length < 80
      ? obj.tone
      : "professional";
  const sourceType =
    obj.sourceType === "link" ||
    obj.sourceType === "video" ||
    obj.sourceType === "instagram" ||
    obj.sourceType === "idea"
      ? obj.sourceType
      : "idea";
  const sourceUrl =
    typeof obj.sourceUrl === "string" && obj.sourceUrl.length < 2000
      ? obj.sourceUrl
      : undefined;
  const topic =
    typeof obj.topic === "string" && obj.topic.length < 5000 ? obj.topic : "";
  const language =
    typeof obj.language === "string" && obj.language.length < 16
      ? obj.language
      : "pt-br";
  const label =
    typeof obj.label === "string" && obj.label.length < 200
      ? obj.label
      : `Teste ${i + 1} · ${niche}`;

  if (sourceType !== "idea" && !sourceUrl) return null;
  if (sourceType === "idea" && !topic) return null;

  return { niche, tone, sourceType, sourceUrl, topic, language, label };
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;
    const { user } = admin;

    const limiter = await rateLimit({
      key: getRateLimitKey(request, "admin-generate-batch", user.id),
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
    const targetUserId =
      typeof body?.userId === "string" && body.userId.length > 10
        ? body.userId
        : user.id;

    const rawTests = Array.isArray(body?.tests) ? body.tests : [];
    if (rawTests.length === 0 || rawTests.length > 30) {
      return Response.json(
        {
          error:
            "Passe um array `tests` com 1 a 30 configurações. Ex: [{niche, tone, sourceType, sourceUrl, topic}].",
        },
        { status: 400 }
      );
    }

    const tests: TestSpec[] = [];
    for (let i = 0; i < rawTests.length; i++) {
      const t = sanitizeTest(rawTests[i], i);
      if (t) tests.push(t);
    }
    if (tests.length === 0) {
      return Response.json({ error: "Nenhum teste válido." }, { status: 400 });
    }

    const sb = createServiceRoleSupabaseClient();
    if (!sb) {
      return Response.json(
        { error: "Supabase service role indisponível." },
        { status: 503 }
      );
    }

    const results: TestResult[] = [];
    let i = 0;
    for (const t of tests) {
      const start = Date.now();
      try {
        const genArgs: GenerationArgs = {
          topic: t.topic ?? "",
          sourceType: t.sourceType ?? "idea",
          sourceUrl: t.sourceUrl,
          niche: t.niche,
          tone: t.tone,
          language: t.language ?? "pt-br",
          mode: "writer",
        };

        const gen = await runGeneration(genArgs);

        // Pega a primeira variação como carrossel salvo
        const v = gen.variations[0];
        if (!v || !v.slides || v.slides.length === 0) {
          throw new Error("Geração retornou vazio");
        }

        const title =
          t.label ||
          v.title ||
          `${t.niche} · ${t.sourceType}`.slice(0, 120);

        const { row } = await upsertUserCarousel(sb, targetUserId, {
          title,
          slides: v.slides.map((s) => ({
            heading: s.heading,
            body: s.body,
            imageQuery: s.imageQuery,
            imageUrl: s.imageUrl,
            variant: s.variant,
          })),
          slideStyle: "white",
          status: "draft",
          variation: { title: v.title, style: v.style },
          promptUsed: gen.promptUsed,
        });

        results.push({
          index: i,
          label: t.label ?? `Teste ${i + 1}`,
          status: "ok",
          carouselId: row.id,
          title,
          durationMs: Date.now() - start,
          writerTokens: {
            input: gen.writerInputTokens,
            output: gen.writerOutputTokens,
            model: gen.writerModel,
          },
          nerTokens: {
            input: gen.facts.inputTokens,
            output: gen.facts.outputTokens,
          },
          sourceChars: gen.sourceContentChars,
          factsPreview: {
            entities: gen.facts.entities.slice(0, 5),
            dataPoints: gen.facts.dataPoints.slice(0, 5),
            quotes: gen.facts.quotes.slice(0, 3),
          },
        });

        // Log no generations pra Gabriel ver na aba Gerações
        const pricingInput =
          gen.writerModel === "gemini-2.5-pro" ? 0.00000125 : 0.00000015;
        const pricingOutput =
          gen.writerModel === "gemini-2.5-pro" ? 0.0000050 : 0.00000060;
        const writerCost =
          gen.writerInputTokens * pricingInput +
          gen.writerOutputTokens * pricingOutput;
        const nerCost =
          gen.facts.inputTokens * 0.00000015 +
          gen.facts.outputTokens * 0.00000060;
        await sb.from("generations").insert({
          user_id: targetUserId,
          model: gen.writerModel,
          provider: "google",
          input_tokens: gen.writerInputTokens + gen.facts.inputTokens,
          output_tokens: gen.writerOutputTokens + gen.facts.outputTokens,
          cost_usd:
            Math.round((writerCost + nerCost) * 1_000_000) / 1_000_000,
          prompt_type: `batch-${t.sourceType}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[admin/batch] test ${i} falhou:`, msg);
        results.push({
          index: i,
          label: t.label ?? `Teste ${i + 1}`,
          status: "failed",
          error: msg.slice(0, 300),
          durationMs: Date.now() - start,
        });
      }
      i += 1;
    }

    const okCount = results.filter((r) => r.status === "ok").length;
    const failedCount = results.length - okCount;

    return Response.json({
      results,
      summary: {
        total: results.length,
        ok: okCount,
        failed: failedCount,
        targetUserId,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/batch] error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
