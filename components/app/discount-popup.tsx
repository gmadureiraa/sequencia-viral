"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/**
 * Popup de 30% off (cupom BEMVINDO30) pra users em plano free dentro do app.
 *
 * Gatilhos suportados:
 *  - "post-onboarding": primeira entrada no dashboard após completar onboarding
 *  - "post-first-carousel": logo depois que user gerou o primeiro carrossel
 *  - "limit-reached": quando bateu no cap do plano free (5 carrosséis/mês)
 *
 * Regras pra não spammar:
 *  - Só aparece se `profile.plan === "free" | null` (users pagos ficam isentos)
 *  - Cada trigger tem sua chave em localStorage — só mostra 1x por trigger
 *  - Cooldown global de 7 dias entre QUALQUER aparição (sv_discount_last_shown)
 *  - Se storage bloqueado, não mostra (fail-safe)
 *
 * Uso:
 *   <DiscountPopup trigger="post-first-carousel" />
 *
 * Montar no client component que representa o momento do gatilho. Fire-and-forget.
 */
const COUPON = "BEMVINDO30";
const COOLDOWN_DAYS = 7;
const COOLDOWN_KEY = "sv_discount_last_shown_v1";
const DELAY_MS = 1200; // espera um pouco após o trigger pra não colar no toast

type Trigger = "post-onboarding" | "post-first-carousel" | "limit-reached";

const TRIGGER_KEY: Record<Trigger, string> = {
  "post-onboarding": "sv_popup_postonboarding_v1",
  "post-first-carousel": "sv_popup_postcarousel_v1",
  "limit-reached": "sv_popup_limit_v1",
};

const HEADLINE: Record<Trigger, React.ReactNode> = {
  "post-onboarding": (
    <>
      Bem-vindo. <em>30% off</em> no seu primeiro mês.
    </>
  ),
  "post-first-carousel": (
    <>
      Primeiro carrossel pronto. <em>30% off</em> no Pro.
    </>
  ),
  "limit-reached": (
    <>
      Bateu o limite grátis. <em>30% off</em> pra seguir postando.
    </>
  ),
};

const SUBLINE: Record<Trigger, string> = {
  "post-onboarding":
    "Agora que você configurou voz e marca, o plano Pro libera 30 carrosséis por mês e destrava todas as features.",
  "post-first-carousel":
    "Gostou? Pro te dá 30 carrosséis/mês + voz da IA configurável. Cupom só válido agora.",
  "limit-reached":
    "Você usou seus 5 grátis do mês. Upgrade agora com desconto e libera 30 carrosséis/mês.",
};

export function DiscountPopup({ trigger }: { trigger: Trigger }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const isFree = !profile?.plan || profile.plan === "free";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isFree) return;
    if (!profile) return; // aguarda profile carregar

    let alreadyShown = false;
    let cooldown = false;
    try {
      alreadyShown = Boolean(window.localStorage.getItem(TRIGGER_KEY[trigger]));
      const last = window.localStorage.getItem(COOLDOWN_KEY);
      if (last) {
        const ts = Number(last);
        if (Number.isFinite(ts)) {
          const daysSince = (Date.now() - ts) / (1000 * 60 * 60 * 24);
          if (daysSince < COOLDOWN_DAYS) cooldown = true;
        }
      }
    } catch {
      return; // storage bloqueado — fail-safe, não mostra
    }
    if (alreadyShown || cooldown) return;

    const t = window.setTimeout(() => setOpen(true), DELAY_MS);
    return () => window.clearTimeout(t);
  }, [isFree, profile, trigger]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(TRIGGER_KEY[trigger], new Date().toISOString());
      window.localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function copyCoupon() {
    try {
      void navigator.clipboard.writeText(COUPON);
    } catch {
      /* ignore */
    }
  }

  if (!isFree || !open) return null;

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

            <span
              className="inline-flex items-center gap-2"
              style={{
                padding: "4px 10px",
                background: "var(--sv-green)",
                border: "1.5px solid var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "var(--sv-ink)",
                boxShadow: "2px 2px 0 0 var(--sv-ink)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--sv-ink)",
                  animation: "sv-pulse 1.5s infinite",
                }}
              />
              Oferta limitada
            </span>

            <h2
              className="sv-display mt-4"
              style={{
                fontSize: 30,
                lineHeight: 1.06,
                letterSpacing: "-0.02em",
                fontWeight: 400,
              }}
            >
              {HEADLINE[trigger]}
            </h2>

            <p
              className="mt-3"
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--sv-muted)",
              }}
            >
              {SUBLINE[trigger]}
            </p>

            <div
              className="mt-5 flex items-center justify-between gap-2"
              style={{
                padding: "14px 16px",
                background: "var(--sv-white)",
                border: "1.5px dashed var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--sv-muted)",
                  }}
                >
                  Seu cupom
                </div>
                <div
                  style={{
                    fontSize: 18,
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    color: "var(--sv-ink)",
                  }}
                >
                  {COUPON}
                </div>
              </div>
              <button
                type="button"
                onClick={copyCoupon}
                className="sv-btn sv-btn-outline"
                style={{ padding: "8px 12px", fontSize: 10 }}
              >
                Copiar
              </button>
            </div>

            <Link
              href={`/app/plans?coupon=${COUPON}&trigger=${trigger}`}
              onClick={dismiss}
              className="sv-btn sv-btn-primary mt-5"
              style={{
                padding: "14px 22px",
                fontSize: 11.5,
                width: "100%",
                justifyContent: "center",
              }}
            >
              Aplicar 30% agora →
            </Link>

            <p
              className="mt-3 text-center"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Cancele quando quiser · só no 1º mês
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
