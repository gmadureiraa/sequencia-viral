"use client";

/**
 * Lista de Mass Generation Jobs do user.
 *
 * - Jobs em andamento: poll a cada 5s mostrando barra de progresso + linha
 *   por carrossel com status (pending / generating / completed / failed).
 * - Jobs concluídos das últimas 24h: lista compacta com count + link pra
 *   biblioteca de carrosseis.
 *
 * Reload-safe: ao montar, busca da API. User pode fechar tab e voltar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  XCircle,
  Calendar,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import Link from "next/link";

interface JobSummary {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  total_count: number;
  completed_count: number;
  failed_count: number;
  progress_pct: number;
  config: { autoSchedule?: boolean; themesMode?: string };
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

const POLL_INTERVAL_MS = 5_000;

export function MassGenerateJobs({ session }: { session: Session }) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/zernio/mass-generate", {
        headers: jsonWithAuth(session),
      });
      if (!res.ok) return;
      const data = await res.json();
      setJobs((data.jobs as JobSummary[]) ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Polling enquanto algum job estiver em andamento
  const hasActive = useMemo(
    () => jobs.some((j) => j.status === "pending" || j.status === "running"),
    [jobs]
  );

  useEffect(() => {
    if (!hasActive) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    pollingRef.current = setInterval(() => {
      fetchJobs();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [hasActive, fetchJobs]);

  if (loading || jobs.length === 0) return null;

  // Mostra: jobs em andamento + concluídos nas últimas 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const visible = jobs.filter((j) => {
    if (j.status === "running" || j.status === "pending") return true;
    return new Date(j.created_at).getTime() > cutoff;
  });
  if (visible.length === 0) return null;

  return (
    <section style={{ marginBottom: 18 }}>
      <h3
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          marginBottom: 8,
          color: "var(--sv-ink)",
          opacity: 0.7,
        }}
      >
        Geração em massa · {visible.length}
      </h3>
      <div style={{ display: "grid", gap: 10 }}>
        {visible.map((j) => (
          <JobRow key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  const isActive = job.status === "running" || job.status === "pending";
  const isFailed = job.status === "failed";
  const isCancelled = job.status === "cancelled";

  const accent = isFailed
    ? "#dc2626"
    : isCancelled
      ? "#6b7280"
      : isActive
        ? "var(--sv-orange, #ec6000)"
        : "var(--sv-green, #84cc16)";

  return (
    <div
      className="sv-card"
      style={{
        padding: 14,
        background: "var(--sv-white)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isActive ? (
            <Loader2 size={14} className="animate-spin" style={{ color: accent }} />
          ) : isFailed ? (
            <XCircle size={14} style={{ color: accent }} />
          ) : isCancelled ? (
            <Clock size={14} style={{ color: accent }} />
          ) : (
            <CheckCircle2 size={14} style={{ color: accent }} />
          )}
          <span
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            {isActive
              ? `Gerando ${job.completed_count + job.failed_count + 1}/${job.total_count}`
              : isFailed
                ? `Falhou ${job.failed_count}/${job.total_count}`
                : isCancelled
                  ? `Cancelado`
                  : `Concluído ${job.completed_count}/${job.total_count}`}
          </span>
          {job.config.autoSchedule && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                padding: "1px 5px",
                background: "var(--sv-pink, #D262B2)",
                color: "var(--sv-ink)",
                border: "1px solid var(--sv-ink)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}
            >
              <Calendar size={9} />
              Calendário
            </span>
          )}
          {job.config.themesMode === "auto-suggest" && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                padding: "1px 5px",
                background: "var(--sv-paper, #faf7f2)",
                color: "var(--sv-ink)",
                border: "1px solid var(--sv-ink)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}
            >
              <Sparkles size={9} />
              IA escolheu
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href={`/app/zernio/autopilot/jobs/${job.id}`}
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              textDecoration: "underline",
              color: "var(--sv-ink)",
            }}
          >
            Ver detalhes
          </Link>
        </div>
      </div>

      {/* Barra de progresso */}
      <div
        style={{
          width: "100%",
          height: 5,
          background: "var(--sv-paper, #faf7f2)",
          border: "1px solid var(--sv-ink)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${job.progress_pct}%`,
            height: "100%",
            background: accent,
            transition: "width 0.6s ease",
          }}
        />
      </div>

      {isActive && (
        <p
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            marginTop: 6,
            color: "var(--sv-ink)",
            opacity: 0.6,
          }}
        >
          ~{Math.max(1, Math.ceil((job.total_count - job.completed_count) * 2.5))}min restantes
        </p>
      )}
      {isFailed && job.error && (
        <p
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            marginTop: 6,
            color: "#dc2626",
          }}
        >
          {job.error.slice(0, 200)}
        </p>
      )}
    </div>
  );
}
