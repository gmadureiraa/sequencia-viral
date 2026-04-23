"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, MessageSquareText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * Admin view dos feedbacks pós-download. Lista os últimos 100, com filtro
 * por bucket (text / image / both). Permite expandir o raw_text pra leitura
 * completa. Cada row mostra email do user + título do carrossel + regras
 * extraídas pelo classificador.
 */

type BucketFilter = "all" | "text" | "image" | "both";

interface FeedbackItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  carouselId: string | null;
  carouselTitle: string | null;
  rawText: string;
  buckets: string[];
  textRules: string[];
  imageRules: string[];
  classifierModel: string | null;
  classifierCostUsd: number | null;
  createdAt: string | null;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

export default function AdminFeedbackPage() {
  const { user, session, loading } = useAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BucketFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isAdmin = useMemo(() => isAdminEmail(user?.email), [user]);

  const load = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "GET",
        headers: jsonWithAuth(session),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => {
    if (isAdmin && session) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.access_token]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => {
      const buckets = it.buckets.map((b) => b.toLowerCase());
      if (filter === "both") return buckets.includes("both");
      if (filter === "text")
        return (
          buckets.includes("text") ||
          (buckets.includes("both") && it.textRules.length > 0)
        );
      if (filter === "image")
        return (
          buckets.includes("image") ||
          (buckets.includes("both") && it.imageRules.length > 0)
        );
      return true;
    });
  }, [items, filter]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-[600px] py-12 text-center">
        <Loader2
          size={18}
          className="animate-spin inline-block"
          style={{ color: "var(--sv-ink)" }}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[600px] py-12">
        <p style={{ fontFamily: "var(--sv-mono)", color: "var(--sv-muted)" }}>
          Sem acesso.
        </p>
      </div>
    );
  }

  const totalCost = items.reduce(
    (acc, it) =>
      acc + (typeof it.classifierCostUsd === "number" ? it.classifierCostUsd : 0),
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1100 }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="sv-eyebrow">
            <span className="sv-dot" /> Admin · Feedback
          </span>
          <h1
            className="sv-display mt-3"
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
            }}
          >
            Feedback <em>pós-download</em>.
          </h1>
          <p className="mt-2" style={{ color: "var(--sv-muted)", fontSize: 13.5 }}>
            Últimos 100 feedbacks enviados pelos usuários. Cada texto foi
            classificado pelo Gemini Flash em buckets (text/image/both) e
            virou regras acionáveis na memória da IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/admin"
            className="sv-btn sv-btn-outline"
            style={{
              padding: "10px 14px",
              fontSize: 10.5,
              textDecoration: "none",
            }}
          >
            ← Admin
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={fetching}
            className="sv-btn sv-btn-outline"
            style={{
              padding: "10px 14px",
              fontSize: 10.5,
              opacity: fetching ? 0.5 : 1,
            }}
          >
            {fetching ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Atualizar
          </button>
        </div>
      </div>

      <div
        className="mt-6 grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
      >
        <Metric label="Total" value={String(items.length)} />
        <Metric
          label="Com text rules"
          value={String(items.filter((i) => i.textRules.length > 0).length)}
        />
        <Metric
          label="Com image rules"
          value={String(items.filter((i) => i.imageRules.length > 0).length)}
        />
        <Metric label="Custo classifier" value={`$${totalCost.toFixed(4)}`} />
      </div>

      <div
        className="mt-6 flex flex-wrap gap-1.5"
        style={{ borderBottom: "1.5px solid var(--sv-ink)" }}
      >
        {(["all", "text", "image", "both"] as const).map((b) => {
          const on = filter === b;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setFilter(b)}
              className="uppercase"
              style={{
                padding: "9px 14px",
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.16em",
                fontWeight: 700,
                border: "1.5px solid var(--sv-ink)",
                borderBottom: on
                  ? "1.5px solid var(--sv-white)"
                  : "1.5px solid var(--sv-ink)",
                background: on ? "var(--sv-white)" : "var(--sv-paper)",
                color: "var(--sv-ink)",
                marginBottom: -1.5,
                cursor: "pointer",
              }}
            >
              {b === "all" ? "Todos" : b}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="mt-4 p-3"
          style={{
            border: "1.5px solid #c94f3b",
            background: "#fdf0ed",
            color: "#7a2a1a",
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {!items.length && !fetching && !error && (
        <div
          className="mt-8 p-10 text-center"
          style={{
            border: "1.5px dashed var(--sv-muted)",
            color: "var(--sv-muted)",
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
          }}
        >
          Sem feedbacks ainda. Quando alguém enviar, aparece aqui.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {filtered.map((it) => {
          const isOpen = expanded.has(it.id);
          return (
            <div
              key={it.id}
              style={{
                padding: 16,
                background: "var(--sv-white)",
                border: "1.5px solid var(--sv-ink)",
                boxShadow: "2px 2px 0 0 var(--sv-ink)",
              }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <MessageSquareText size={14} style={{ color: "var(--sv-ink)" }} />
                <span
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {it.userEmail || "—"}
                </span>
                {it.carouselId ? (
                  <Link
                    href={`/app/create/${it.carouselId}/preview`}
                    className="truncate"
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontSize: 12,
                      color: "var(--sv-ink)",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    {it.carouselTitle || it.carouselId.slice(0, 8)}
                  </Link>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--sv-muted)" }}>
                    (sem carrossel)
                  </span>
                )}
                <div className="flex gap-1 ml-auto flex-wrap">
                  {it.buckets.map((b) => (
                    <span
                      key={b}
                      className="uppercase"
                      style={{
                        padding: "2px 8px",
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        fontWeight: 700,
                        background: "var(--sv-green)",
                        color: "var(--sv-ink)",
                        border: "1.5px solid var(--sv-ink)",
                      }}
                    >
                      {b}
                    </span>
                  ))}
                  <span
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9.5,
                      color: "var(--sv-muted)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      alignSelf: "center",
                    }}
                  >
                    {fmtDate(it.createdAt)}
                  </span>
                </div>
              </div>

              {/* Raw text — collapsed por default, ~200 chars */}
              <div
                onClick={() => toggleExpanded(it.id)}
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: "var(--sv-ink)",
                  padding: "8px 12px",
                  background: "var(--sv-paper)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  whiteSpace: "pre-wrap",
                }}
              >
                {isOpen
                  ? it.rawText
                  : it.rawText.length > 200
                    ? it.rawText.slice(0, 200) + "…"
                    : it.rawText}
                {it.rawText.length > 200 && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 6,
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9.5,
                      color: "var(--sv-muted)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {isOpen ? "↑ recolher" : "↓ ver completo"}
                  </span>
                )}
              </div>

              {(it.textRules.length > 0 || it.imageRules.length > 0) && (
                <div
                  className="mt-3 grid gap-3"
                  style={{
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  }}
                >
                  {it.textRules.length > 0 && (
                    <RulesBlock title="Text rules" rules={it.textRules} />
                  )}
                  {it.imageRules.length > 0 && (
                    <RulesBlock title="Image rules" rules={it.imageRules} />
                  )}
                </div>
              )}

              <div
                className="mt-2"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  color: "var(--sv-muted)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                {it.classifierModel || "—"} ·{" "}
                {typeof it.classifierCostUsd === "number"
                  ? `$${it.classifierCostUsd.toFixed(6)}`
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 14,
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        className="italic"
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 26,
          lineHeight: 1,
          color: "var(--sv-ink)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RulesBlock({
  title,
  rules,
}: {
  title: string;
  rules: string[];
}) {
  return (
    <div
      style={{
        padding: 10,
        border: "1.5px dashed var(--sv-ink)",
        background: "transparent",
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {rules.map((r, i) => (
          <li
            key={i}
            style={{
              fontFamily: "var(--sv-sans)",
              fontSize: 12.5,
              color: "var(--sv-ink)",
              lineHeight: 1.45,
              marginBottom: 3,
            }}
          >
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
