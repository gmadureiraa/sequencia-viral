"use client";

/**
 * Modal "Gerar em massa" — Piloto Automático SV.
 *
 * User configura:
 *   1. Quantidade (1-30, respeita usage_limit do plano)
 *   2. Temas (textarea OR toggle "IA escolhe baseado no meu perfil")
 *   3. Refs opcionais (URLs IG/Twitter como contexto compartilhado)
 *   4. Auto-agendar no calendário (toggle)
 *      Se on: cadência (daily/alternating/weekly/custom) + hora local
 *
 * Submit POST /api/zernio/mass-generate → fecha modal e onCreated dispara reload.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X, Wand2, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

interface MassGenerateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (jobId: string) => void;
  session: Session;
  /** Pra mostrar quantos restam no plano. */
  remainingCarousels?: number;
}

type Cadence = "daily" | "alternating" | "weekly" | "custom";

export function MassGenerateModal({
  open,
  onClose,
  onCreated,
  session,
  remainingCarousels,
}: MassGenerateModalProps) {
  const [count, setCount] = useState(5);
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [themesText, setThemesText] = useState("");
  const [refsText, setRefsText] = useState("");
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [intervalDays, setIntervalDays] = useState(3);
  const [publishHour, setPublishHour] = useState(9);
  const [publishMinute, setPublishMinute] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) return;
    setCount(5);
    setAutoSuggest(true);
    setThemesText("");
    setRefsText("");
    setAutoSchedule(true);
    setCadence("daily");
    setIntervalDays(3);
    setPublishHour(9);
    setPublishMinute(0);
  }, [open]);

  const themesList = useMemo(
    () =>
      themesText
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.length >= 3),
    [themesText]
  );

  const refsList = useMemo(
    () =>
      refsText
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => /^https?:\/\//i.test(r)),
    [refsText]
  );

  const exceedsCap =
    typeof remainingCarousels === "number" && count > remainingCarousels;

  const canSubmit =
    count >= 1 &&
    count <= 30 &&
    !exceedsCap &&
    (autoSuggest || themesList.length > 0) &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body = {
        totalCount: count,
        themesMode: autoSuggest ? "auto-suggest" : "explicit",
        themes: autoSuggest ? [] : themesList,
        refs: refsList,
        autoSchedule,
        cadence,
        intervalDays: cadence === "custom" ? intervalDays : undefined,
        publishHour,
        publishMinute,
        timezone: "America/Sao_Paulo",
        designTemplate: "twitter",
      };
      const res = await fetch("/api/zernio/mass-generate", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar job");
      toast.success(
        `${count} carrosseis em geração. Volte em ~${Math.ceil(count * 2.5)}min pra ver tudo pronto.`
      );
      onCreated?.(data.jobId);
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
            <Wand2 size={18} />
            <h2 className="sv-display" style={{ fontSize: 22, margin: 0 }}>
              Gerar em <em>massa</em>
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={closeBtnStyle}>
            <X size={16} />
          </button>
        </header>

        <p style={paragraphStyle}>
          A IA gera vários carrosseis no fundo. Você pode fechar essa aba e
          voltar depois — fica tudo salvo na sua biblioteca, e se ligar o
          agendamento, já distribuídos no calendário.
        </p>

        {/* Quantidade */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Quantos carrosseis?</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
              }
              style={{ ...inputStyle, width: 90, textAlign: "center" }}
            />
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 11,
                color: exceedsCap ? "#dc2626" : "var(--sv-ink)",
                opacity: exceedsCap ? 1 : 0.7,
              }}
            >
              {typeof remainingCarousels === "number"
                ? exceedsCap
                  ? `Você tem ${remainingCarousels} restantes no plano`
                  : `${remainingCarousels} restantes no plano`
                : `máx 30`}
            </span>
          </div>
        </div>

        {/* Temas */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Temas</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setAutoSuggest(true)}
              style={toggleStyle(autoSuggest)}
            >
              <Sparkles size={11} />
              IA escolhe pelo perfil
            </button>
            <button
              type="button"
              onClick={() => setAutoSuggest(false)}
              style={toggleStyle(!autoSuggest)}
            >
              Eu vou colocar
            </button>
          </div>
          {!autoSuggest && (
            <>
              <textarea
                value={themesText}
                onChange={(e) => setThemesText(e.target.value)}
                placeholder={`Um tema por linha. Ex:\n5 erros que arruínam carrosseis no IG\nO que mudou no growth em 2026\nFrameworks práticos pra hooks`}
                style={{
                  ...inputStyle,
                  fontFamily: "var(--sv-sans)",
                  resize: "vertical",
                  minHeight: 100,
                }}
              />
              <p style={hintTextStyle}>
                {themesList.length} temas válidos
                {themesList.length < count && themesList.length > 0
                  ? ` (vai repetir até ${count})`
                  : ""}
              </p>
            </>
          )}
          {autoSuggest && (
            <p style={hintTextStyle}>
              Vou olhar seu nicho, pilares de conteúdo, top topics e os últimos
              carrosseis pra sugerir {count} temas únicos.
            </p>
          )}
        </div>

        {/* Refs */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Refs (opcional)</label>
          <textarea
            value={refsText}
            onChange={(e) => setRefsText(e.target.value)}
            placeholder={`Cole URLs IG/Twitter de inspiração — uma por linha. Compartilhadas com todos os carrosseis do batch.`}
            style={{
              ...inputStyle,
              fontFamily: "var(--sv-sans)",
              resize: "vertical",
              minHeight: 60,
            }}
          />
          <p style={hintTextStyle}>
            {refsList.length} URLs válidas (precisa ser https://)
          </p>
        </div>

        {/* Auto-schedule */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Agendar no calendário?</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setAutoSchedule(true)}
              style={toggleStyle(autoSchedule)}
            >
              <Calendar size={11} />
              Sim, distribuir
            </button>
            <button
              type="button"
              onClick={() => setAutoSchedule(false)}
              style={toggleStyle(!autoSchedule)}
            >
              Não, só salvar
            </button>
          </div>
          {autoSchedule && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                border: "1.5px dashed var(--sv-ink)",
                background: "var(--sv-paper, #faf7f2)",
                display: "grid",
                gap: 8,
              }}
            >
              <div>
                <label style={miniLabelStyle}>Cadência</label>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as Cadence)}
                  style={inputStyle}
                >
                  <option value="daily">1 carrossel por dia</option>
                  <option value="alternating">Dia sim, dia não</option>
                  <option value="weekly">1 por semana</option>
                  <option value="custom">A cada N dias</option>
                </select>
              </div>
              {cadence === "custom" && (
                <div>
                  <label style={miniLabelStyle}>Intervalo (dias)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={intervalDays}
                    onChange={(e) =>
                      setIntervalDays(
                        Math.max(1, Math.min(30, Number(e.target.value) || 1))
                      )
                    }
                    style={{ ...inputStyle, width: 90 }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={miniLabelStyle}>Hora</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={publishHour}
                    onChange={(e) =>
                      setPublishHour(
                        Math.max(0, Math.min(23, Number(e.target.value) || 0))
                      )
                    }
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={miniLabelStyle}>Minuto</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={publishMinute}
                    onChange={(e) =>
                      setPublishMinute(
                        Math.max(0, Math.min(59, Number(e.target.value) || 0))
                      )
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
              <p style={hintTextStyle}>
                Começa amanhã, {publishHour.toString().padStart(2, "0")}:
                {publishMinute.toString().padStart(2, "0")} BRT.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={footerStyle}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="sv-btn sv-btn--ghost"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="sv-btn sv-btn--primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            <Wand2 size={14} />
            Gerar {count} carrosseis
          </button>
        </footer>
      </div>
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
  maxWidth: 540,
  padding: 24,
  background: "var(--sv-white)",
  maxHeight: "92vh",
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

const fieldStyle: React.CSSProperties = {
  marginBottom: 14,
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

const miniLabelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--sv-mono)",
  fontSize: 8.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  marginBottom: 4,
  color: "var(--sv-ink)",
  opacity: 0.7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 8,
  border: "1.5px solid var(--sv-ink)",
  fontFamily: "var(--sv-sans)",
  fontSize: 13,
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
};

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: "8px 10px",
    border: "1.5px solid var(--sv-ink)",
    fontFamily: "var(--sv-mono)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 700,
    cursor: "pointer",
    color: active ? "var(--sv-paper)" : "var(--sv-ink)",
    background: active ? "var(--sv-ink)" : "var(--sv-white)",
    boxShadow: active ? "2px 2px 0 0 var(--sv-ink)" : "none",
  };
}

const paragraphStyle: React.CSSProperties = {
  fontFamily: "var(--sv-sans)",
  fontSize: 13,
  lineHeight: 1.5,
  marginBottom: 16,
  color: "var(--sv-ink)",
  opacity: 0.8,
};

const hintTextStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 10,
  marginTop: 4,
  color: "var(--sv-ink)",
  opacity: 0.6,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 18,
  paddingTop: 14,
  borderTop: "1px solid var(--sv-ink)",
};
