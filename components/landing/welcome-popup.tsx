"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * Popup de boas-vindas oferecendo 30% off no primeiro pagamento. Estratégia:
 *  - Não mostra em /app/* (já autenticado)
 *  - Aparece depois de 12s na primeira visita OU quando user tenta sair
 *    (exit-intent no desktop via mousemove pra topo)
 *  - localStorage guarda `sv_welcome_seen` pra não aparecer de novo
 *  - Botão "Resgatar 30%" leva pra /app/login?coupon=BEMVINDO30
 *    (o param é lido depois no checkout)
 */
const COUPON_CODE = "BEMVINDO30";
const SEEN_KEY = "sv_welcome_popup_seen_v1";
const FIRST_DELAY_MS = 12_000;

export function WelcomePopup() {
  const [open, setOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(true); // default true pra não piscar

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Só roda em /landing e /
    const path = window.location.pathname;
    if (path.startsWith("/app") || path.startsWith("/admin")) return;

    try {
      const seen = window.localStorage.getItem(SEEN_KEY);
      setHasSeen(Boolean(seen));
      if (seen) return;
    } catch {
      /* storage bloqueado — segue sem popup */
      setHasSeen(true);
      return;
    }

    // Timer: 12s na primeira visita
    const timer = window.setTimeout(() => setOpen(true), FIRST_DELAY_MS);

    // Exit-intent: mouse saindo pela borda superior (só desktop)
    function onMouseOut(e: MouseEvent) {
      if (e.clientY <= 0 && !open) {
        setOpen(true);
        window.removeEventListener("mouseout", onMouseOut);
        window.clearTimeout(timer);
      }
    }
    if (window.matchMedia("(min-width: 768px)").matches) {
      window.addEventListener("mouseout", onMouseOut);
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mouseout", onMouseOut);
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setHasSeen(true);
  }

  function copyCoupon() {
    try {
      void navigator.clipboard.writeText(COUPON_CODE);
    } catch {
      /* ignore */
    }
  }

  if (hasSeen && !open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{
            background: "rgba(10, 10, 10, 0.55)",
            backdropFilter: "blur(4px)",
          }}
          onClick={dismiss}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 460,
              background: "var(--sv-paper)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "8px 8px 0 0 var(--sv-ink)",
              padding: 32,
            }}
          >
            {/* Fechar */}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Fechar"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid var(--sv-ink)",
                background: "var(--sv-white)",
                cursor: "pointer",
              }}
            >
              <X size={14} strokeWidth={2} />
            </button>

            {/* Eyebrow */}
            <span
              className="inline-flex items-center gap-2"
              style={{
                padding: "5px 12px",
                background: "var(--sv-green)",
                border: "1.5px solid var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "var(--sv-ink)",
              }}
            >
              ✦ Oferta de boas-vindas
            </span>

            {/* Headline */}
            <h2
              className="mt-5"
              style={{
                fontFamily: "var(--sv-display)",
                fontSize: "clamp(32px, 4.5vw, 44px)",
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                color: "var(--sv-ink)",
                fontWeight: 400,
              }}
            >
              <em>30% off</em> no seu primeiro mês.
            </h2>

            <p
              className="mt-3"
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: "var(--sv-muted)",
              }}
            >
              Cria conta grátis agora. Quando decidir ir pro Pro ou Agência,
              usa o código abaixo no checkout e tira{" "}
              <b style={{ color: "var(--sv-ink)" }}>30% do primeiro pagamento</b>.
              Sem pegadinha, sem fidelidade.
            </p>

            {/* Cupom */}
            <div className="mt-5">
              <span
                className="uppercase block mb-1.5"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--sv-muted)",
                  fontWeight: 700,
                }}
              >
                Seu código
              </span>
              <button
                type="button"
                onClick={copyCoupon}
                className="w-full flex items-center justify-between"
                style={{
                  padding: "14px 18px",
                  background: "var(--sv-white)",
                  border: "1.5px dashed var(--sv-ink)",
                  cursor: "pointer",
                }}
                title="Clique pra copiar"
              >
                <span
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 20,
                    letterSpacing: "0.18em",
                    fontWeight: 700,
                    color: "var(--sv-ink)",
                  }}
                >
                  {COUPON_CODE}
                </span>
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    color: "var(--sv-muted)",
                    fontWeight: 700,
                  }}
                >
                  Copiar
                </span>
              </button>
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Link
                href={`/app/login?coupon=${COUPON_CODE}`}
                onClick={dismiss}
                className="sv-btn sv-btn-primary"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: "13px 18px",
                  fontSize: 11.5,
                }}
              >
                Resgatar 30% →
              </Link>
              <button
                type="button"
                onClick={dismiss}
                className="sv-btn"
                style={{
                  flex: "0 0 auto",
                  padding: "13px 18px",
                  fontSize: 11.5,
                  background: "transparent",
                }}
              >
                Depois
              </button>
            </div>

            <p
              className="mt-4"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Por tempo limitado
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
