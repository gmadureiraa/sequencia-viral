"use client";

import { useState, useEffect } from "react";
import { CalendarPlus, Instagram, Linkedin, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * Modal "Novo no calendário" — cria entrada planejada manual.
 *
 * Plano Pro pode usar pra organizar conteúdo sem conectar Zernio.
 * Plano Max também pode (status 'planned' depois pode ser promovido pra
 * 'scheduled' no Zernio quando user decidir publicar de verdade).
 *
 * Não envolve Zernio API — é só um marker no DB. Se carouselId está
 * presente, vincula com um carrossel existente do SV.
 */

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "var(--sv-pink, #D262B2)",
  linkedin: "var(--sv-yellow, #F5C518)",
};

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
}

export function PlannedPostModal({
  open,
  onClose,
  session,
  onCreated,
  initialDate,
  carouselId,
  initialContent = "",
}: PlannedPostModalProps) {
  const [content, setContent] = useState(initialContent);
  const [scheduled, setScheduled] = useState(() => {
    if (initialDate) {
      // Se veio só YYYY-MM-DD, adiciona horário default 09:00
      if (/^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return `${initialDate}T09:00`;
      return initialDate;
    }
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [platforms, setPlatforms] = useState<Set<string>>(
    new Set(["instagram"])
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setContent(initialContent);
  }, [open, initialContent]);

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
      toast.error("Escolha pelo menos 1 plataforma.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/zernio/planned-posts", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          content: content.trim(),
          scheduledFor: `${scheduled}:00`,
          timezone: "America/Sao_Paulo",
          platforms: Array.from(platforms),
          carouselId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      toast.success("Adicionado ao calendário.");
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
              Novo no <em>calendário</em>
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={closeBtnStyle}>
            <X size={16} />
          </button>
        </header>

        <p style={helperStyle}>
          Adicione uma entrada planejada. <strong>Não publica</strong>{" "}
          automaticamente — é só pra organizar seu conteúdo. Pra publicação
          automática, conecte IG/LinkedIn (plano Max).
        </p>

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
                    {p === "instagram" ? "Instagram" : "LinkedIn"}
                  </button>
                );
              })}
            </div>
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
            ) : (
              <CalendarPlus size={13} />
            )}
            Adicionar
          </button>
        </footer>
      </div>
    </div>
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
  maxWidth: 480,
  padding: 24,
  background: "var(--sv-white)",
  maxHeight: "90vh",
  overflowY: "auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
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

const helperStyle: React.CSSProperties = {
  fontFamily: "var(--sv-sans)",
  fontSize: 12.5,
  color: "var(--sv-muted, #555)",
  marginBottom: 18,
  lineHeight: 1.45,
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
  letterSpacing: "0.12em",
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
