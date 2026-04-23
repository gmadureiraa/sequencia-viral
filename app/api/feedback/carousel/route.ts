import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import {
  classifyFeedback,
  mergeRules,
} from "@/lib/server/feedback-classify";
import {
  costForTokens,
  recordGeneration,
} from "@/lib/server/generation-log";

export const maxDuration = 30;

/**
 * POST /api/feedback/carousel
 *
 * Body: { carouselId?: string, rawText: string }
 *
 * 1. Rate limit 5/hora por user (evita spam de classificação).
 * 2. Chama classifyFeedback → buckets + regras acionáveis.
 * 3. Insere em `carousel_feedback` (audit trail + admin view).
 * 4. Merge as regras no profile.brand_analysis.__generation_memory
 *    (cap 20, dedup case-insensitive, FIFO).
 *
 * Não bloqueia o fluxo em nenhum erro — sempre retorna algo.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "feedback-carousel", user.id),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        {
          error:
            "Muito feedback rapidinho — respira 1 minuto e tenta de novo.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(limiter.retryAfterSec) },
        }
      );
    }

    let body: {
      carouselId?: unknown;
      rawText?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }

    const rawText =
      typeof body.rawText === "string" ? body.rawText.trim() : "";
    const carouselId =
      typeof body.carouselId === "string" && body.carouselId.length > 0
        ? body.carouselId
        : null;

    if (rawText.length < 5) {
      return Response.json(
        { error: "Me conta um pouquinho mais (mínimo 5 caracteres)." },
        { status: 400 }
      );
    }
    if (rawText.length > 2000) {
      return Response.json(
        { error: "Feedback grande demais (máximo 2000 caracteres)." },
        { status: 400 }
      );
    }

    const classification = await classifyFeedback(rawText);

    const cost = costForTokens(
      classification.model,
      classification.inputTokens,
      classification.outputTokens
    );

    // Log custo do classifier. Falha silenciosa.
    void recordGeneration({
      userId: user.id,
      carouselId,
      model: classification.model,
      provider: "google",
      inputTokens: classification.inputTokens,
      outputTokens: classification.outputTokens,
      costUsd: cost,
      promptType: "feedback-classify",
    });

    const sb = createServiceRoleSupabaseClient();
    let savedId: string | null = null;

    if (sb) {
      // 1) Insert audit row. Se falhar, segue em frente — não quebra o fluxo.
      try {
        const { data: inserted, error: insertErr } = await sb
          .from("carousel_feedback")
          .insert({
            user_id: user.id,
            carousel_id: carouselId,
            raw_text: rawText,
            classified_buckets: classification.buckets,
            text_rules: classification.textRules,
            image_rules: classification.imageRules,
            classifier_model: classification.model,
            classifier_cost_usd: cost,
          })
          .select("id")
          .single();
        if (insertErr) {
          console.warn(
            "[feedback] insert falhou:",
            insertErr.message
          );
        } else if (inserted?.id) {
          savedId = inserted.id as string;
        }
      } catch (err) {
        console.warn(
          "[feedback] exception no insert:",
          err instanceof Error ? err.message : err
        );
      }

      // 2) Merge regras no profile.brand_analysis.__generation_memory.
      // Só vale a pena atualizar se tem pelo menos 1 regra nova.
      const hasNewRules =
        classification.textRules.length > 0 ||
        classification.imageRules.length > 0;
      if (hasNewRules) {
        try {
          const { data: prof } = await sb
            .from("profiles")
            .select("brand_analysis")
            .eq("id", user.id)
            .single();

          const ba =
            prof && prof.brand_analysis && typeof prof.brand_analysis === "object"
              ? ({ ...(prof.brand_analysis as Record<string, unknown>) })
              : {};
          const currentMemory =
            ba.__generation_memory && typeof ba.__generation_memory === "object"
              ? (ba.__generation_memory as Record<string, unknown>)
              : {};
          const existingText = Array.isArray(currentMemory.text_rules)
            ? (currentMemory.text_rules as unknown[]).filter(
                (v): v is string => typeof v === "string"
              )
            : [];
          const existingImage = Array.isArray(currentMemory.image_rules)
            ? (currentMemory.image_rules as unknown[]).filter(
                (v): v is string => typeof v === "string"
              )
            : [];

          ba.__generation_memory = {
            text_rules: mergeRules(classification.textRules, existingText),
            image_rules: mergeRules(classification.imageRules, existingImage),
            updated_at: new Date().toISOString(),
          };

          const { error: updateErr } = await sb
            .from("profiles")
            .update({ brand_analysis: ba })
            .eq("id", user.id);
          if (updateErr) {
            console.warn(
              "[feedback] update profile falhou:",
              updateErr.message
            );
          }
        } catch (err) {
          console.warn(
            "[feedback] exception no update profile:",
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    return Response.json({
      ok: true,
      savedId,
      classification: {
        buckets: classification.buckets,
        textRules: classification.textRules,
        imageRules: classification.imageRules,
      },
    });
  } catch (err) {
    console.error("[feedback/carousel] erro:", err);
    return Response.json(
      { error: "Falha ao processar feedback. Tenta de novo em instantes." },
      { status: 500 }
    );
  }
}
