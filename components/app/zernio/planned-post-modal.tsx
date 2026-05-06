"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Instagram,
  Linkedin,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * Modal "Novo no calendário" — cria entrada planejada manual.
 *
 * 2 modos visíveis pra user:
 *   1. PLANEJADO (default) — só marca data, NÃO publica. Disponível pra
 *      Pro + Max. Status DB = 'planned'.
 *   2. AGENDAR PUBLICAÇÃO AUTO — só Max + conta IG/LinkedIn conectada via
 *      Zernio. Status DB = 'scheduled'. Cria post real na Zernio API.
 *
 * O bug histórico era confundir os dois: o modal pedia conta conectada
 * pra simplesmente adicionar entrada manual. Agora o modo "planejado"
 * NÃO precisa de conta — basta plataforma. A "conta" só é exigida no
 * modo "agendar auto".
 */

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "var(--sv-pink, #D262B2)",
  linkedin: "var(--sv-yellow, #F5C518)",
};

interface AccountLite {
  id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  status: string;
}

export interface PlannedPostModalProps {
  open: boolean;
  onClose: () => void;
  session: Session;
  onCreated?: () => void;
  /** Pré-fill: data inicial (YYYY-MM-DD ou YYYY-MM-DDTHH:MM). */
  initialDate?: string;
  /** Pré-fill: link com carrossel existente do SV. */
  carouselId?: string;
  initialContent?: string;
  /**
   * Modo edição: passa o ID da entry pra atualizar via PATCH em vez
   * de criar nova via POST. Pré-preenche tudo.
   */
  editing?: {
    id: string;
    content: string;
    scheduledFor: string;
    platforms: string[];
  };
  /**
   * Plano do user. Default 'pro' — habilita planejamento. 'business'
   * habilita também o modo "agendar auto" (Zernio real).
   */
  userPlan?: "free" | "pro" | "business";
}

export function PlannedPostModal({
  open,
  onClose,
  session,
  onCreated,
  initialDate,
  carouselId,
  initialContent = "",
  editing,
  userPlan = "pro",
}: PlannedPostModalProps) {
  const isEditing = !!editing;
  const canScheduleAuto = userPlan === "business";

  const [content, setContent] = useState(editing?.content ?? initialContent);
  const [scheduled, setScheduled] = useState(() => {
    if (editing) {
      const d = new Date(editing.scheduledFor);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    if (initialDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return `${initialDate}T09:00`;
      return initialDate;
    }
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [platforms, setPlatforms] = useState<Set<string>>(
    new Set(editing?.platforms ?? ["instagram"])
  );
  // Modo: 'planned' (sem Zernio) | 'auto' (Zernio real). Default 'planned'.
  // Edição não troca de modo.
  const [mode, setMode] = useState<"planned" | "auto">("planned");
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<AccountLite[] | null>(null);

  useEffect(() => {
    if (open && !editing) setContent(initialContent);
  }, [open, initialContent, editing]);

  // Carrega contas conectadas pra mostrar quem vai receber. Só serve pra
  // exibição (modo 'planned' ignora; modo 'auto' valida no backend).
  useEffect(() => {
    if (!open || !session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/zernio/accounts", {
          headers: jsonWithAuth(session),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAccounts(data.accounts ?? []);
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, session]);

  // Contas active por plataforma — mostra quem vai postar.
  const activeAccountsByPlatform = useMemo(() => {
    const map: Record<string, AccountLite[]> = {};
    for (const a of accounts ?? []) {
      if (a.status !== "active") continue;
      (map[a.platform] ??= []).push(a);
    }
    return map;
  }, [accounts]);

  function togglePlatform(p: string) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function onSubmit() {
    if (content.trim().length === 0) {
      toast.error("Texto vazio.");
      return;
    }
    if (platforms.size === 0) {
      toast.error("Escolha pelo menos 1 plataforma (Instagram ou LinkedIn).");
      return;
    }

    // Validação extra do modo 'auto': precisa de conta active na plataforma.
    if (!isEditing && mode === "auto") {
      const missing = Array.from(platforms).filter(
        (p) => !(activeAccountsByPlatform[p]?.length > 0)
      );
      if (missing.length > 0) {
        toast.error(
          `Pra publicar automaticamente, conecte ${missing.join(" + ")} em Ajustes → Zernio. Por enquanto, salve como Planejado.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/zernio/posts/${editing.id}`
        : mode === "auto"
          ? "/api/zernio/planned-posts/promote-direct"
          : "/api/zernio/planned-posts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          content: content.trim(),
          scheduledFor: `${scheduled}:00`,
          timezone: "America/Sao_Paulo",
          platforms: Array.from(platforms),
          ...(carouselId && !isEditing ? { carouselId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      toast.success(
        isEditing
          ? "Atualizado."
          : mode === "auto"
            ? "Agendado pra publicar automaticamente."
            : "Adicionado ao calendário."
      );
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sv-card" style={modalStyle}>
        <header style={headerStyle}>
          <div className="flex items-center gap-2">
            <CalendarPlus size={18} />
            <h2 className="sv-display" style={{ fontSize: 22, margin: 0 }}>
              {isEditing ? (
                <>Editar <em>entrada</em></>
              ) : (
                <>Novo no <em>calendário</em></>
              )}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={closeBtnStyle}>
            <X size={16} />
          </button>
        </header>

        {/* Modo: 'planned' (default) vs 'auto'. Edição esconde o toggle. */}
        {!isEditing && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Como você quer salvar?</label>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <button
                type="button"
                onClick={() => setMode("planned")}
                style={modeCardStyle(mode === "planned")}
              >
                <div style={modeBadgeStyle("planned")}>Planejado</div>
                <strong style={{ fontSize: 12, lineHeight: 1.2 }}>
                  Só marcar data
                </strong>
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--sv-muted, #555)",
                    lineHeight: 1.4,
                  }}
                >
                  Não publica. Você posta manualmente quando quiser.
                </span>
              </button>
              <button
                type="button"
                onClick={() => canScheduleAuto && setMode("auto")}
                disabled={!canScheduleAuto}
                style={{
                  ...modeCardStyle(mode === "auto"),
                  opacity: canScheduleAuto ? 1 : 0.5,
                  cursor: canScheduleAuto ? "pointer" : "not-allowed",
                }}
                title={
                  canScheduleAuto
                    ? "Posta sozinho na data marcada"
                    : "Disponível só no plano Pro"
                }
              >
                <div style={modeBadgeStyle("auto")}>
                  <Sparkles size={9} /> Publica auto
                </div>
                <strong style={{ fontSize: 12, lineHeight: 1.2 }}>
                  Agendar publicação
                </strong>
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--sv-muted, #555)",
                    lineHeight: 1.4,
                  }}
                >
                  {canScheduleAuto
                    ? "Posta sozinho na data marcada via Zernio."
                    : "Plano Pro — upgrade pra liberar."}
                </span>
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Texto / legenda">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="O que você vai postar..."
              style={{ ...inputStyle, fontFamily: "var(--sv-sans)", resize: "vertical" }}
            />
          </Field>

          <Field label="Data e hora (America/Sao_Paulo)">
            <input
              type="datetime-local"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Plataformas">
            <div className="flex gap-2">
              {(["instagram", "linkedin"] as const).map((p) => {
                const on = platforms.has(p);
                const Icon = p === "instagram" ? Instagram : Linkedin;
                const accent = PLATFORM_COLORS[p];
                const accountsForPlatform = activeAccountsByPlatform[p] ?? [];
                const handle = accountsForPlatform[0]?.handle;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    style={{
                      ...platformBtnStyle,
                      background: on ? accent : "var(--sv-white)",
                      boxShadow: on ? "2px 2px 0 0 var(--sv-ink)" : "none",
                    }}
                  >
                    <Icon size={12} />
                    <span>{p === "instagram" ? "Instagram" : "LinkedIn"}</span>
                    {on && handle && (
                      <span
                        style={{
                          fontSize: 9,
                          opacity: 0.85,
                          marginLeft: 4,
                          fontWeight: 500,
                          letterSpacing: "0.04em",
                        }}
                      >
                        @{handle}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Hint: explica o que vai acontecer com a plataforma escolhida */}
            <PlatformHint
              mode={mode}
              isEditing={isEditing}
              platforms={platforms}
              activeAccountsByPlatform={activeAccountsByPlatform}
              accountsLoaded={accounts !== null}
            />
          </Field>
        </div>

        <footer style={footerStyle}>
          <button
            onClick={onClose}
            className="sv-btn sv-btn-outline"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            className="sv-btn sv-btn-primary"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : mode === "auto" && !isEditing ? (
              <Sparkles size={13} />
            ) : (
              <CalendarPlus size={13} />
            )}
            {isEditing
              ? "Salvar"
              : mode === "auto"
                ? "Agendar publicação"
                : "Adicionar"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PlatformHint({
  mode,
  isEditing,
  platforms,
  activeAccountsByPlatform,
  accountsLoaded,
}: {
  mode: "planned" | "auto";
  isEditing: boolean;
  platforms: Set<string>;
  activeAccountsByPlatform: Record<string, AccountLite[]>;
  accountsLoaded: boolean;
}) {
  if (isEditing) return null;
  if (platforms.size === 0) return null;

  if (mode === "planned") {
    return (
      <p style={hintStyle}>
        <Check size={11} style={{ flexShrink: 0 }} />
        <span>
          Vai aparecer no calendário como <strong>Planejado</strong>. Não
          publica sozinho — é só pra você se organizar.
        </span>
      </p>
    );
  }

  // mode === 'auto'
  if (!accountsLoaded) {
    return (
      <p style={hintStyle}>
        <Loader2 size={11} className="animate-spin" style={{ flexShrink: 0 }} />
        <span>Verificando contas conectadas...</span>
      </p>
    );
  }

  const missing = Array.from(platforms).filter(
    (p) => !(activeAccountsByPlatform[p]?.length > 0)
  );
  if (missing.length > 0) {
    return (
      <p style={{ ...hintStyle, color: "#92400e", borderColor: "#f59e0b" }}>
        <span>
          ⚠ {missing.map((m) => (m === "instagram" ? "Instagram" : "LinkedIn")).join(" + ")}{" "}
          sem conta conectada. <a href="/app/zernio" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Conecte em Ajustes → Zernio</a> ou volte pra modo Planejado.
        </span>
      </p>
    );
  }

  return (
    <p style={hintStyle}>
      <Sparkles size={11} style={{ flexShrink: 0 }} />
      <span>
        Vai postar automaticamente em:{" "}
        {Array.from(platforms)
          .map((p) => {
            const acc = activeAccountsByPlatform[p]?.[0];
            return acc?.handle
              ? `@${acc.handle}`
              : p === "instagram"
                ? "Instagram"
                : "LinkedIn";
          })
          .join(" + ")}
      </span>
    </p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 500,
  padding: 24,
  background: "var(--sv-white)",
  maxHeight: "90vh",
  overflowY: "auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const closeBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  background: "transparent",
  border: "1.5px solid var(--sv-ink)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--sv-mono)",
  fontSize: 9.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  marginBottom: 6,
  color: "var(--sv-ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  border: "1.5px solid var(--sv-ink)",
  fontFamily: "var(--sv-sans)",
  fontSize: 13,
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
};

const platformBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "8px 14px",
  border: "1.5px solid var(--sv-ink)",
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 700,
  cursor: "pointer",
  flex: 1,
  justifyContent: "center",
  color: "var(--sv-ink)",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 18,
};

function modeCardStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: "10px 12px",
    border: "1.5px solid var(--sv-ink)",
    background: active ? "var(--sv-paper, #faf7f2)" : "var(--sv-white)",
    boxShadow: active ? "2px 2px 0 0 var(--sv-ink)" : "none",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "var(--sv-sans)",
    color: "var(--sv-ink)",
    transition: "transform 0.12s, box-shadow 0.12s",
  };
}

function modeBadgeStyle(kind: "planned" | "auto"): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontFamily: "var(--sv-mono)",
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    padding: "2px 6px",
    background: kind === "planned" ? "var(--sv-pink, #D262B2)" : "var(--sv-ink)",
    color: kind === "planned" ? "var(--sv-ink)" : "var(--sv-paper)",
    border: "1px solid var(--sv-ink)",
    marginBottom: 4,
  };
}

const hintStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
  marginTop: 6,
  padding: "6px 8px",
  fontSize: 10.5,
  fontFamily: "var(--sv-sans)",
  color: "var(--sv-muted, #555)",
  border: "1px solid var(--sv-soft, #ddd)",
  background: "var(--sv-paper, #faf7f2)",
  lineHeight: 1.4,
};
