"use client";

/**
 * Detalhes de um Mass Generation Job — lista linha-por-linha dos N items
 * com status, tema, link pro carrossel quando concluído, hora agendada.
 *
 * Polling 5s enquanto job estiver running. Reload-safe.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";

interface JobProgress {
  job: {
    id: string;
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    totalCount: number;
    completedCount: number;
    failedCount: number;
    progressPct: number;
    error: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    config: {
      themesMode: "explicit" | "auto-suggest";
      autoSchedule: boolean;
      cadence: string;
      designTemplate: string;
    };
  };
  items: Array<{
    id: string;
    index: number;
    theme: string;
    status: "pending" | "generating" | "completed" | "failed";
    carouselId: string | null;
    scheduledAt: string | null;
    error: string | null;
  }>;
}

const POLL_INTERVAL_MS = 5_000;

export default function MassGenJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const { session, loading: authLoading } = useAuth();
  const [data, setData] = useState<JobProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/zernio/mass-generate/${jobId}`, {
        headers: jsonWithAuth(session),
      });
      if (!res.ok) {
        if (res.status === 404) toast.error("Job não encontrado");
        return;
      }
      setData(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [session, jobId]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  const isActive =
    data?.job.status === "running" || data?.job.status === "pending";

  useEffect(() => {
    if (!isActive) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    pollingRef.current = setInterval(() => {
      fetchData();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isActive, fetchData]);

  async function handleCancel() {
    if (!session || !confirm("Cancelar esse job?")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/zernio/mass-generate/${jobId}`, {
        method: "DELETE",
        headers: jsonWithAuth(session),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Falha ao cancelar");
      } else {
        toast.success("Job cancelado");
        fetchData();
      }
    } finally {
      setCancelling(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main style={{ padding: 24 }}>
        <Loader2 size={20} className="animate-spin" />
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ padding: 24 }}>
        <Link
          href="/app/zernio/autopilot"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--sv-mono)",
            fontSize: 11,
            textDecoration: "underline",
            color: "var(--sv-ink)",
          }}
        >
          <ArrowLeft size={12} /> Voltar
        </Link>
        <p style={{ marginTop: 16, fontFamily: "var(--sv-sans)" }}>
          Job não encontrado.
        </p>
      </main>
    );
  }

  const { job, items } = data;
  const accent =
    job.status === "failed"
      ? "#dc2626"
      : job.status === "cancelled"
        ? "#6b7280"
        : isActive
          ? "var(--sv-orange, #ec6000)"
          : "var(--sv-green, #84cc16)";

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <Link
        href="/app/zernio/autopilot"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "var(--sv-mono)",
          fontSize: 11,
          textDecoration: "underline",
          color: "var(--sv-ink)",
          marginBottom: 12,
        }}
      >
        <ArrowLeft size={12} /> Piloto Auto
      </Link>

      <header style={{ marginBottom: 18 }}>
        <h1
          className="sv-display"
          style={{ fontSize: 32, marginBottom: 6 }}
        >
          Geração em <em>massa</em>
        </h1>
        <p
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 11,
            opacity: 0.7,
          }}
        >
          {new Date(job.createdAt).toLocaleString("pt-BR")} ·{" "}
          {job.config.themesMode === "auto-suggest"
            ? "IA escolheu temas"
            : "Temas manuais"}{" "}
          · {job.config.autoSchedule ? `Agendado (${job.config.cadence})` : "Sem agendamento"}
        </p>
      </header>

      {/* Progress */}
      <div
        className="sv-card"
        style={{ padding: 16, marginBottom: 18, background: "var(--sv-white)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isActive ? (
              <Loader2
                size={16}
                className="animate-spin"
                style={{ color: accent }}
              />
            ) : job.status === "failed" ? (
              <XCircle size={16} style={{ color: accent }} />
            ) : job.status === "cancelled" ? (
              <Clock size={16} style={{ color: accent }} />
            ) : (
              <CheckCircle2 size={16} style={{ color: accent }} />
            )}
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {job.completedCount + job.failedCount}/{job.totalCount} ·{" "}
              {job.progressPct}%
            </span>
          </div>
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="sv-btn sv-btn--ghost"
              style={{ fontSize: 11 }}
            >
              {cancelling ? "Cancelando..." : "Cancelar"}
            </button>
          )}
        </div>

        <div
          style={{
            width: "100%",
            height: 8,
            background: "var(--sv-paper, #faf7f2)",
            border: "1.5px solid var(--sv-ink)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${job.progressPct}%`,
              height: "100%",
              background: accent,
              transition: "width 0.6s ease",
            }}
          />
        </div>

        {job.failedCount > 0 && (
          <p
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              marginTop: 8,
              color: "#dc2626",
            }}
          >
            <AlertCircle
              size={11}
              style={{ display: "inline", marginRight: 3 }}
            />
            {job.failedCount} falharam — veja detalhes abaixo
          </p>
        )}
      </div>

      {/* Items */}
      <h2
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          marginBottom: 8,
          opacity: 0.7,
        }}
      >
        Itens
      </h2>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {items.map((it) => (
          <ItemRow key={it.id} item={it} />
        ))}
      </ol>
    </main>
  );
}

function ItemRow({ item }: { item: JobProgress["items"][number] }) {
  const isDone = item.status === "completed";
  const isGen = item.status === "generating";
  const isFail = item.status === "failed";

  return (
    <li
      className="sv-card"
      style={{
        padding: 12,
        background: isDone
          ? "var(--sv-paper, #faf7f2)"
          : "var(--sv-white)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--sv-ink)",
          opacity: 0.5,
          minWidth: 22,
        }}
      >
        {String(item.index + 1).padStart(2, "0")}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
            margin: 0,
            color: "var(--sv-ink)",
          }}
        >
          {item.theme}
        </p>
        {item.scheduledAt && (
          <p
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              marginTop: 2,
              color: "var(--sv-ink)",
              opacity: 0.6,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Calendar size={9} />
            {new Date(item.scheduledAt).toLocaleString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
        {isFail && item.error && (
          <p
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              marginTop: 2,
              color: "#dc2626",
            }}
          >
            {item.error.slice(0, 200)}
          </p>
        )}
      </div>
      <div>
        {isDone && item.carouselId && (
          <Link
            href={`/app/create/${item.carouselId}`}
            className="sv-btn sv-btn--ghost"
            style={{ fontSize: 10 }}
          >
            Abrir
          </Link>
        )}
        {isGen && (
          <Loader2
            size={14}
            className="animate-spin"
            style={{ color: "var(--sv-orange)" }}
          />
        )}
        {isFail && <XCircle size={14} style={{ color: "#dc2626" }} />}
        {item.status === "pending" && (
          <Clock size={14} style={{ color: "#6b7280" }} />
        )}
      </div>
    </li>
  );
}
