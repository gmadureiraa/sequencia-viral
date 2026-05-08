/**
 * GET /api/cron/process-mass-jobs
 *
 * Worker que puxa items pendentes de mass_generation_jobs e processa
 * em paralelo limitado (DEFAULT_CONCURRENCY=2 por user).
 *
 * Roda a cada 1min em produção (Vercel cron config). Cada execução
 * pega até maxItems=4 pendentes. Em ~5min de wall-clock processa
 * carrossel completo (geração + render + upload + opcional Zernio).
 *
 * Idempotente: items em 'generating' não são repuxados; falhas isoladas.
 *
 * Auth: cron-auth padrão (Vercel header / shared secret).
 */

import { NextResponse } from "next/server";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import { processPendingItems } from "@/lib/server/mass-generation/job-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("process-mass-jobs")) return cronSkipped("process-mass-jobs");

  const t0 = Date.now();
  try {
    const result = await processPendingItems({ maxItems: 4, concurrency: 2 });
    return NextResponse.json({
      ok: true,
      processed: result.processed,
      failed: result.failed,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron.process-mass-jobs] erro:", msg);
    return NextResponse.json(
      { ok: false, error: msg, durationMs: Date.now() - t0 },
      { status: 500 }
    );
  }
}
