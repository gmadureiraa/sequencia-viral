"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

type Props = {
  open: boolean;
  onClose: () => void;
  carouselId?: string | null;
  session: Session | null;
};

/**
 * Modal que aparece depois que o user exporta o carrossel (zip/pdf).
 * Pede feedback livre sobre o que melhorar, manda pro classificador Gemini
 * Flash, e a resposta vira regras acionáveis que entram na memória da IA
 * (profile.brand_analysis.__generation_memory). Ver /api/feedback/carousel.
 *
 * UX:
 *  - Delay 800ms antes de abrir (dá tempo do browser processar o download).
 *  - Botão "Agora não" fecha e não reabre até próximo download.
 *  - Feedback muito curto (<5) ou muito longo (>2000) → toast amigável.
 *  - Rate limit atingido → toast específico sobre respirar 1 min.
 *  - Após sucesso, mensagem curta "Valeu, a IA já guardou" e fecha em 2.5s.
 */
export default function FeedbackModal({
  open,
  onClose,
  carouselId,
  session,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Reset quando modal fecha (pra próximo download começar limpo).
  useEffect(() => {
    if (!open) {
      setText("");
      setSending(false);
      setSent(false);
    }
  }, [open]);

  // Auto-fechar 2.5s depois de "sent".
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [sent, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onClose]);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (trimmed.length < 5) {
      toast.error("Me conta um pouquinho mais (mínimo 5 caracteres).");
      return;
    }
    if (trimmed.length > 2000) {
      toast.error("Muito longo. Resume em até 2000 caracteres.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback/carousel", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          carouselId: carouselId ?? null,
          rawText: trimmed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        toast.error(
          data?.error ||
            "Muito feedback rapidinho — respira 1 minuto e tenta de novo."
        );
        return;
      }
      if (!res.ok) {
        toast.error(data?.error || "Falha ao enviar feedback.");
        return;
      }
      setSent(true);
    } catch (err) {
      console.error("[feedback modal] envio falhou:", err);
      toast.error("Rede caiu. Tenta de novo.");
    } finally {
      setSending(false);
    }
  }

  function handleDismiss() {
    if (sending) return;
    try {
      window.localStorage.setItem("sv_feedback_dismissed_once", "1");
    } catch {
      /* storage bloqueado — ok */
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sv-feedback-title"
      onMouseDown={(e) => {
        // Fecha se clicou FORA do card (backdrop). Evita fechar quando user
        // arrasta de dentro pra fora selecionando texto.
        if (e.target === e.currentTarget && !sending) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "sv-fb-fade 0.18s ease-out",
      }}
    >
      <style jsx>{`
        @keyframes sv-fb-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sv-fb-pop {
          from { transform: translateY(8px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--sv-white, #fff)",
          border: "1.5px solid var(--sv-ink, #0a0a0a)",
          boxShadow: "6px 6px 0 0 var(--sv-ink, #0a0a0a)",
          padding: 28,
          animation: "sv-fb-pop 0.22s ease-out",
        }}
      >
        {sent ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--sv-green, #6a9e3e)",
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              ✓ Recebido
            </div>
            <h3
              className="sv-display"
              style={{
                fontSize: 24,
                letterSpacing: "-0.01em",
                marginBottom: 8,
              }}
            >
              Valeu — a IA já <em>guardou</em>.
            </h3>
            <p
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 14,
                color: "var(--sv-muted)",
                lineHeight: 1.5,
              }}
            >
              Próximo carrossel vai sair mais do seu jeito.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Feedback · Pós-download
            </div>
            <h3
              id="sv-feedback-title"
              className="sv-display"
              style={{
                fontSize: 26,
                letterSpacing: "-0.015em",
                lineHeight: 1.08,
                marginBottom: 6,
              }}
            >
              Como posso <em>melhorar</em> o próximo?
            </h3>
            <p
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 13.5,
                color: "var(--sv-muted)",
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              Pode falar do texto, das imagens, dos dois. Tudo vai direto
              pra IA aprender seu gosto.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 2000))}
              disabled={sending}
              autoFocus
              placeholder="Ex: imagens mais minimalistas, texto em primeira pessoa, não usar emoji no título..."
              style={{
                width: "100%",
                minHeight: 130,
                border: "1.5px solid var(--sv-ink)",
                padding: 14,
                fontFamily: "var(--sv-sans)",
                fontSize: 14,
                lineHeight: 1.5,
                outline: 0,
                resize: "vertical",
                background: "var(--sv-paper, #f7f5ef)",
                color: "var(--sv-ink)",
              }}
            />
            <div
              className="mt-2 flex items-center justify-between"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                color: "var(--sv-muted)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              <span>{text.length} / 2000</span>
              <span>Min. 5 caracteres</span>
            </div>
            <div
              className="mt-4 flex gap-2"
              style={{ marginTop: 18, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={handleDismiss}
                disabled={sending}
                className="sv-btn sv-btn-outline"
                style={{
                  padding: "10px 16px",
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  opacity: sending ? 0.5 : 1,
                  cursor: sending ? "wait" : "pointer",
                }}
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={sending || text.trim().length < 5}
                className="sv-btn sv-btn-ink"
                style={{
                  padding: "10px 20px",
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  opacity:
                    sending || text.trim().length < 5 ? 0.5 : 1,
                  cursor:
                    sending || text.trim().length < 5
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {sending ? "Enviando..." : "Enviar feedback →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
