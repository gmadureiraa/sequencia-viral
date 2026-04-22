"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Loader2, PlayCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * Admin Source Test — UI que roda extração + NER num source específico
 * sem gerar carrossel. Gabriel usa pra debugar por que certas fontes geram
 * carrosseis shallow (ex: transcript truncado, NER vazio, sem entities).
 */

const ADMIN_EMAILS = ["gf.madureiraa@gmail.com", "gf.madureira@hotmail.com"];

type SourceType = "video" | "link" | "instagram";

interface DebugResponse {
  extracted: {
    method: string;
    chars: number;
    firstChars: string;
    lastChars: string;
    durationMs: number;
    error: string | null;
  };
  ner: {
    entities: string[];
    dataPoints: string[];
    quotes: string[];
    arguments: string[];
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    skipped: boolean;
  };
  finalPromptPreview: string;
}

export default function SourceTestPage() {
  const { user, session, loading } = useAuth();
  const [sourceType, setSourceType] = useState<SourceType>("video");
  const [sourceUrl, setSourceUrl] = useState<string>(
    "https://www.youtube.com/watch?v=obSImkBppFQ"
  );
  const [data, setData] = useState<DebugResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase().trim();
    return email ? ADMIN_EMAILS.includes(email) : false;
  }, [user]);

  async function run() {
    if (!session) return;
    setFetching(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/admin/source-debug", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({ sourceType, sourceUrl }),
      });
      const txt = await res.text();
      let parsed: DebugResponse & { error?: string } = {} as DebugResponse;
      try {
        parsed = txt ? JSON.parse(txt) : ({} as DebugResponse);
      } catch {
        throw new Error(`Resposta inválida HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(
          (parsed as { error?: string }).error || `HTTP ${res.status}`
        );
      }
      setData(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setFetching(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // noop
    }
  }

  if (loading) {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1100 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/app/admin"
          className="inline-flex items-center gap-1.5"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            color: "var(--sv-muted)",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          <ArrowLeft size={12} /> Admin
        </Link>
      </div>

      <span className="sv-eyebrow">
        <span className="sv-dot" /> Source Debug · Admin
      </span>
      <h1
        className="sv-display mt-3"
        style={{
          fontSize: "clamp(24px, 4vw, 38px)",
          lineHeight: 1.04,
          letterSpacing: "-0.02em",
        }}
      >
        Testar <em>extração + NER</em>.
      </h1>
      <p className="mt-2" style={{ color: "var(--sv-muted)", fontSize: 13.5 }}>
        Roda o pipeline de extração e análise de entities/dados/quotes sem
        gerar carrossel. Use pra validar que o source chega completo na IA.
      </p>

      {/* Form */}
      <div
        className="mt-6 flex flex-col gap-3 p-4"
        style={{
          background: "var(--sv-white)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.16em",
              fontWeight: 700,
              color: "var(--sv-ink)",
            }}
          >
            Tipo
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="sv-input"
            style={{ padding: "7px 10px", fontSize: 12 }}
          >
            <option value="video">YouTube vídeo</option>
            <option value="link">Link / Artigo</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
        <input
          type="text"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="URL do vídeo, artigo ou post"
          className="sv-input"
          style={{ padding: "10px 12px", fontSize: 13, width: "100%" }}
        />
        <button
          type="button"
          onClick={run}
          disabled={fetching || !sourceUrl}
          className="sv-btn sv-btn-primary"
          style={{
            padding: "12px 16px",
            fontSize: 11.5,
            opacity: fetching ? 0.5 : 1,
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {fetching ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <PlayCircle size={13} />
          )}
          Extrair e analisar
        </button>
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

      {data && (
        <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Card: transcript */}
          <Card
            title="Transcript / Conteúdo"
            subtitle={`${data.extracted.method} · ${data.extracted.chars.toLocaleString()} chars · ${data.extracted.durationMs}ms`}
          >
            {data.extracted.error ? (
              <p style={{ color: "#7a2a1a", fontSize: 12 }}>
                Erro: {data.extracted.error}
              </p>
            ) : (
              <>
                <Label>Primeiros 500 chars</Label>
                <pre style={codeBlock}>{data.extracted.firstChars || "—"}</pre>
                {data.extracted.lastChars && (
                  <>
                    <Label>Últimos 500 chars</Label>
                    <pre style={codeBlock}>{data.extracted.lastChars}</pre>
                  </>
                )}
              </>
            )}
          </Card>

          {/* Card: entities */}
          <Card
            title="Entities"
            subtitle={`${data.ner.entities.length} extraídas${data.ner.skipped ? " (NER skipado)" : ""}`}
          >
            {data.ner.entities.length === 0 ? (
              <p style={{ color: "var(--sv-muted)", fontSize: 12 }}>Nenhuma.</p>
            ) : (
              <ul style={listStyle}>
                {data.ner.entities.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </Card>

          {/* Card: data points */}
          <Card
            title="Data Points"
            subtitle={`${data.ner.dataPoints.length} extraídos`}
          >
            {data.ner.dataPoints.length === 0 ? (
              <p style={{ color: "var(--sv-muted)", fontSize: 12 }}>Nenhum.</p>
            ) : (
              <ul style={listStyle}>
                {data.ner.dataPoints.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </Card>

          {/* Card: quotes */}
          <Card
            title="Quotes literais"
            subtitle={`${data.ner.quotes.length} extraídos`}
          >
            {data.ner.quotes.length === 0 ? (
              <p style={{ color: "var(--sv-muted)", fontSize: 12 }}>Nenhuma.</p>
            ) : (
              <ul style={listStyle}>
                {data.ner.quotes.map((q, i) => (
                  <li key={i}>&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
            )}
          </Card>

          {/* Card: arguments */}
          <Card
            title="Argumentos centrais"
            subtitle={`${data.ner.arguments.length} extraídos`}
          >
            {data.ner.arguments.length === 0 ? (
              <p style={{ color: "var(--sv-muted)", fontSize: 12 }}>Nenhum.</p>
            ) : (
              <ul style={listStyle}>
                {data.ner.arguments.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </Card>

          {/* Card: prompt preview */}
          <div style={{ gridColumn: "1 / -1" }}>
            <Card
              title="Prompt final (preview)"
              subtitle={`${data.finalPromptPreview.length.toLocaleString()} chars`}
              action={
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      data.finalPromptPreview,
                      "prompt"
                    )
                  }
                  className="sv-btn sv-btn-outline"
                  style={{
                    padding: "6px 10px",
                    fontSize: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Copy size={11} />
                  {copied === "prompt" ? "Copiado!" : "Copiar"}
                </button>
              }
            >
              <pre
                style={{
                  ...codeBlock,
                  maxHeight: 400,
                  overflow: "auto",
                }}
              >
                {data.finalPromptPreview}
              </pre>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "3px 3px 0 0 var(--sv-ink)",
        padding: 14,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 18,
              color: "var(--sv-ink)",
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
          <div
            className="uppercase mt-1"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.14em",
              color: "var(--sv-muted)",
              fontWeight: 700,
            }}
          >
            {subtitle}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase mb-1"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 9,
        letterSpacing: "0.14em",
        color: "var(--sv-muted)",
        fontWeight: 700,
        marginTop: 6,
      }}
    >
      {children}
    </div>
  );
}

const codeBlock: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  lineHeight: 1.55,
  color: "var(--sv-ink)",
  background: "var(--sv-paper)",
  border: "1px solid rgba(10,10,10,0.12)",
  padding: "10px 12px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 220,
  overflow: "auto",
};

const listStyle: React.CSSProperties = {
  fontFamily: "var(--sv-sans)",
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "var(--sv-ink)",
  listStyle: "disc",
  paddingLeft: 18,
  margin: 0,
};
