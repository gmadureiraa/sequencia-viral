/**
 * GET    /api/zernio/mass-generate/[jobId]
 *   Retorna estado do job + items pra UI fazer polling.
 *
 * DELETE /api/zernio/mass-generate/[jobId]
 *   Cancela um job (status='cancelled'). Items pending viram cancelled,
 *   items em generating não são interrompidos (deixa terminar pra não
 *   desperdiçar a chamada Gemini que já rolou).
 */

import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import type { JobProgressResponse } from "@/lib/server/mass-generation/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { jobId } = await params;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return NextResponse.json({ error: "DB indisponível." }, { status: 503 });

  const { data: job, error: jobErr } = await sb
    .from("mass_generation_jobs_with_progress")
    .select(
      "id, user_id, status, total_count, completed_count, failed_count, progress_pct, config, error, created_at, started_at, finished_at"
    )
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  }
  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { data: items } = await sb
    .from("mass_generation_items")
    .select(
      "id, item_index, theme, status, carousel_id, scheduled_at, error"
    )
    .eq("job_id", jobId)
    .order("item_index", { ascending: true });

  const config = (job.config ?? {}) as Record<string, unknown>;
  const response: JobProgressResponse = {
    job: {
      id: job.id,
      status: job.status,
      totalCount: job.total_count,
      completedCount: job.completed_count,
      failedCount: job.failed_count,
      progressPct: job.progress_pct ?? 0,
      error: job.error,
      createdAt: job.created_at,
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      config: {
        themesMode: (config.themesMode as "explicit" | "auto-suggest") ?? "explicit",
        autoSchedule: Boolean(config.autoSchedule),
        cadence:
          (config.cadence as "daily" | "alternating" | "weekly" | "custom") ??
          "daily",
        designTemplate:
          (config.designTemplate as "twitter" | "manifesto") ?? "twitter",
      },
    },
    items: (items ?? []).map((it) => ({
      id: it.id as string,
      index: it.item_index as number,
      theme: it.theme as string,
      status: it.status as JobProgressResponse["items"][number]["status"],
      carouselId: (it.carousel_id as string) ?? null,
      scheduledAt: (it.scheduled_at as string) ?? null,
      error: (it.error as string) ?? null,
    })),
  };

  return NextResponse.json(response);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { jobId } = await params;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return NextResponse.json({ error: "DB indisponível." }, { status: 503 });

  // Verifica ownership
  const { data: job } = await sb
    .from("mass_generation_jobs")
    .select("user_id, status")
    .eq("id", jobId)
    .single();

  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  }
  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json(
      { error: "Job já terminou — não pode cancelar." },
      { status: 409 }
    );
  }

  await sb
    .from("mass_generation_jobs")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  // Cancela items pending (em generating deixa terminar)
  await sb
    .from("mass_generation_items")
    .update({
      status: "failed",
      error: "Cancelled by user",
      finished_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("status", "pending");

  return NextResponse.json({ ok: true });
}
