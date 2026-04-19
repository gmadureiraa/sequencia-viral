"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Menu, X, ArrowRight, Check } from "lucide-react";
import { LANDING_FAQ } from "@/lib/landing-faq";
import { useLandingSession } from "@/lib/use-landing-session";

/* ---------------------------------------------------------------- */
/*  Primitivas brutalistas reutilizadas                              */
/* ---------------------------------------------------------------- */

const NAV_ITEMS = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "Templates", href: "#templates" },
  { label: "Preço", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const REVEAL = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] as const },
};

function Kicker({ children }: { children: React.ReactNode }) {
  return <span className="sv-kicker-sm">{children}</span>;
}

/* ---------------------------------------------------------------- */
/*  NAV                                                              */
/* ---------------------------------------------------------------- */

function TopNav() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn } = useLandingSession();

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: "color-mix(in srgb, var(--sv-paper) 90%, transparent)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--sv-ink)",
      }}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-[10px]">
          <span
            className="sv-display text-[16px] leading-none"
            style={{ letterSpacing: "-0.01em" }}
          >
            Sequência <em>Viral</em>
          </span>
          <span
            className="hidden md:inline-block pl-[10px]"
            style={{
              borderLeft: "1px solid rgba(10,10,10,.15)",
              fontFamily: "var(--sv-mono)",
              fontSize: 8.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
            }}
          >
            by Kaleidos Digital
          </span>
        </Link>

        <ul className="hidden items-center md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                className="block px-3 py-[7px] transition-colors"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--sv-ink)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "var(--sv-green)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "transparent";
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          {isLoggedIn ? (
            <Link href="/app" className="sv-btn sv-btn-primary">
              Ir pro app →
            </Link>
          ) : (
            <>
              <Link href="/app/login" className="sv-btn sv-btn-ghost">
                Entrar
              </Link>
              <Link href="/app/login" className="sv-btn sv-btn-primary">
                Criar conta
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
          className="md:hidden"
          style={{
            border: "1.5px solid var(--sv-ink)",
            background: "var(--sv-white)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
            padding: 8,
          }}
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden md:hidden"
            style={{
              borderTop: "1.5px solid var(--sv-ink)",
              background: "var(--sv-paper)",
            }}
          >
            <div className="flex flex-col gap-2 px-6 py-4">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  {item.label}
                </a>
              ))}
              {isLoggedIn ? (
                <Link
                  href="/app"
                  onClick={() => setOpen(false)}
                  className="sv-btn sv-btn-primary mt-1 w-fit"
                >
                  Ir pro app →
                </Link>
              ) : (
                <div className="mt-1 flex gap-2">
                  <Link
                    href="/app/login"
                    onClick={() => setOpen(false)}
                    className="sv-btn sv-btn-outline"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/app/login"
                    onClick={() => setOpen(false)}
                    className="sv-btn sv-btn-primary"
                  >
                    Criar conta
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ---------------------------------------------------------------- */
/*  HERO — Caleidoscópio cônico + chips flutuantes                   */
/* ---------------------------------------------------------------- */

function Kaleidoscope() {
  return (
    <div className="relative mx-auto" style={{ width: "100%", maxWidth: 520, aspectRatio: "1 / 1" }}>
      {/* Disco cônico principal */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          borderRadius: "50%",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "8px 8px 0 0 var(--sv-ink)",
          background: `conic-gradient(
            from 0deg,
            var(--sv-green) 0deg 30deg,
            var(--sv-ink) 30deg 60deg,
            var(--sv-pink) 60deg 90deg,
            var(--sv-paper) 90deg 120deg,
            var(--sv-green) 120deg 150deg,
            var(--sv-ink) 150deg 180deg,
            var(--sv-pink) 180deg 210deg,
            var(--sv-paper) 210deg 240deg,
            var(--sv-green) 240deg 270deg,
            var(--sv-ink) 270deg 300deg,
            var(--sv-pink) 300deg 330deg,
            var(--sv-paper) 330deg 360deg
          )`,
          animation: "sv-spin-slow 80s linear infinite",
        }}
      />
      {/* Anel interno creme com título editorial */}
      <div
        aria-hidden
        className="absolute"
        style={{
          inset: "18%",
          borderRadius: "50%",
          background: "var(--sv-paper)",
          border: "1.5px solid var(--sv-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 0 0 8px var(--sv-paper), inset 0 0 0 9px var(--sv-ink)",
        }}
      >
        <div className="text-center px-8">
          <div className="sv-kicker-sm mb-3">Sequência</div>
          <div
            className="sv-display"
            style={{ fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1 }}
          >
            <em>Viral</em>
          </div>
          <div
            className="mt-3"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
            }}
          >
            Nº 04 · MMXXVI
          </div>
        </div>
      </div>

      {/* Centro — núcleo verde pulsante */}
      <div
        aria-hidden
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--sv-green)",
          border: "1.5px solid var(--sv-ink)",
          animation: "sv-pulse 1.8s ease-in-out infinite",
          zIndex: 3,
        }}
      />

      {/* Chip 1 - BrandsDecoded */}
      <motion.div
        initial={{ opacity: 0, rotate: 0, y: -10 }}
        animate={{ opacity: 1, rotate: 6, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="absolute"
        style={{
          top: "4%",
          right: "2%",
          zIndex: 5,
          padding: "6px 11px",
          background: "var(--sv-green)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        ● BrandsDecoded
      </motion.div>

      {/* Chip 2 - Ed. 04 */}
      <motion.div
        initial={{ opacity: 0, rotate: 0, y: 10 }}
        animate={{ opacity: 1, rotate: -5, y: 0 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        className="absolute"
        style={{
          bottom: "6%",
          left: "0%",
          zIndex: 5,
          padding: "6px 11px",
          background: "var(--sv-pink)",
          color: "var(--sv-ink)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        ◆ Ed. 04 · Brasil
      </motion.div>

      {/* Estrelinha girando */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: "10%",
          left: "12%",
          width: 30,
          height: 30,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: "var(--sv-ink)",
          color: "var(--sv-green)",
          fontFamily: "var(--sv-mono)",
          fontSize: 14,
          zIndex: 4,
          animation: "sv-spin-slow 12s linear infinite",
        }}
      >
        ✦
      </div>
    </div>
  );
}

function Hero() {
  return (
    <header
      className="relative overflow-hidden"
      style={{ padding: "72px 0 48px", background: "var(--sv-paper)" }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <div className="grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="sv-eyebrow"
            >
              <span className="sv-dot" />
              Manifesto · Edição Nº 04 · Brasil · MMXXVI
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease: [0.2, 0.7, 0.2, 1] }}
              className="sv-display mt-5"
              style={{
                fontSize: "clamp(44px, 6vw, 96px)",
                lineHeight: 1.02,
              }}
            >
              <span className="block">Carrosséis</span>
              <span className="block">
                que{" "}
                <span
                  style={{
                    background: "var(--sv-green)",
                    padding: "0 6px",
                    fontStyle: "italic",
                  }}
                >
                  <em>engajam</em>
                </span>{" "}
                —
              </span>
              <span className="block">
                escritos <em>por você</em>,
              </span>
              <span className="block">
                diagramados pela{" "}
                <span style={{ position: "relative", display: "inline-block" }}>
                  Sequência.
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "-2%",
                      right: "-2%",
                      bottom: 6,
                      height: 10,
                      background: "var(--sv-pink)",
                      opacity: 0.35,
                      zIndex: -1,
                      transform: "skewX(-6deg)",
                    }}
                  />
                </span>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="sv-sans mt-6 max-w-[480px]"
              style={{ fontSize: 16, lineHeight: 1.55, color: "var(--sv-muted)" }}
            >
              Cole um link. A IA lê a sua fonte e devolve um carrossel editorial{" "}
              <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>com a sua voz</b>,
              pronto pra postar. Não é template. Não é ChatGPT cheiroso. É ferramenta
              que entende que{" "}
              <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
                você já tem algo a dizer
              </b>
              .
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-7 flex flex-wrap gap-3"
            >
              <Link
                href="/app/login"
                className="sv-btn sv-btn-primary"
                style={{ padding: "14px 22px", fontSize: 11.5 }}
              >
                Criar primeiro grátis
                <ArrowRight size={12} />
              </Link>
              <a
                href="#manifesto"
                className="sv-btn sv-btn-outline"
                style={{ padding: "14px 22px", fontSize: 11.5 }}
              >
                Ler manifesto
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-6 flex flex-wrap gap-x-6 gap-y-3"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              <span>
                <span style={{ color: "var(--sv-pink)", marginRight: 4 }}>✦</span>
                Sem cartão
              </span>
              <span>
                <span style={{ color: "var(--sv-pink)", marginRight: 4 }}>✦</span>
                5 carrosséis grátis
              </span>
              <span>
                <span style={{ color: "var(--sv-pink)", marginRight: 4 }}>✦</span>
                Export PNG 1080×1350
              </span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Kaleidoscope />
          </motion.div>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- */
/*  LOGO MARQUEE                                                     */
/* ---------------------------------------------------------------- */

const MARQUEE_ITEMS = [
  "Cointelegraph",
  "The Defiant",
  "Bankless",
  "Kaleidos Digital",
  "BrandsDecoded",
  "Defiverso",
  "Jornal Cripto",
  "4.20 Lucas",
  "D-Sec Labs",
  "Madureira",
];

function LogoMarquee() {
  const track = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div
      style={{
        background: "var(--sv-paper)",
        borderTop: "1.5px solid var(--sv-ink)",
        borderBottom: "1.5px solid var(--sv-ink)",
        overflow: "hidden",
        padding: "18px 0",
      }}
    >
      <div
        className="flex whitespace-nowrap"
        style={{
          gap: 48,
          animation: "sv-marquee 40s linear infinite",
          willChange: "transform",
        }}
      >
        {track.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="sv-display"
            style={{
              fontSize: 26,
              fontStyle: i % 2 === 0 ? "italic" : "normal",
              letterSpacing: "-0.01em",
              color: "var(--sv-ink)",
              opacity: i % 3 === 0 ? 1 : 0.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            {name}
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                width: 22,
                height: 22,
                background: "var(--sv-green)",
                border: "1px solid var(--sv-ink)",
                color: "var(--sv-ink)",
                borderRadius: "50%",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                animation: "sv-spin-slow 8s linear infinite",
              }}
            >
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  MANIFESTO                                                        */
/* ---------------------------------------------------------------- */

function Manifesto() {
  return (
    <section
      id="manifesto"
      className="relative overflow-hidden"
      style={{
        background: "var(--sv-ink)",
        color: "var(--sv-paper)",
        padding: "96px 0",
        borderTop: "1px solid var(--sv-ink)",
        borderBottom: "1px solid var(--sv-ink)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-50%",
          background:
            "repeating-conic-gradient(from 0deg at 50% 50%, transparent 0 8deg, rgba(124,240,103,.07) 8deg 9deg)",
          pointerEvents: "none",
          animation: "sv-spin-slow 120s linear infinite",
        }}
      />
      <div className="relative mx-auto max-w-[1240px] px-6">
        <div className="grid items-start gap-10 md:grid-cols-[auto_1fr]">
          <motion.div
            {...REVEAL}
            className="sv-display"
            style={{
              fontSize: "clamp(80px, 12vw, 180px)",
              lineHeight: 0.85,
              color: "var(--sv-green)",
              fontStyle: "italic",
            }}
          >
            Nº 01
            <div
              className="sv-kicker-sm mt-3"
              style={{ color: "var(--sv-paper)", opacity: 0.5, fontStyle: "normal" }}
            >
              Manifesto
            </div>
          </motion.div>

          <motion.div {...REVEAL}>
            <div
              className="mb-7 inline-flex items-center gap-2"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--sv-green)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 34,
                  height: 1,
                  background: "var(--sv-green)",
                  display: "inline-block",
                }}
              />
              Um braço da Kaleidos Digital
            </div>
            <h2
              className="sv-display"
              style={{
                fontSize: "clamp(32px, 4.5vw, 60px)",
                lineHeight: 1.08,
                letterSpacing: "-0.018em",
                maxWidth: 900,
              }}
            >
              Toda semana você grava, escreve, pensa. E toda semana{" "}
              <s
                style={{
                  textDecorationColor: "var(--sv-pink)",
                  textDecorationThickness: 3,
                  color: "rgba(245,243,236,.42)",
                }}
              >
                perde horas no Canva
              </s>{" "}
              tentando virar aquilo em post. A Sequência Viral resolve a parte
              chata: <em style={{ color: "var(--sv-green)" }}>transforma</em> o que
              você já produziu em carrossel editorial, com a sua voz{" "}
              <em style={{ color: "var(--sv-green)" }}>e pronto pra postar</em>.
            </h2>

            <div
              className="mt-10 flex items-center gap-3"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(245,243,236,.65)",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 34,
                  height: 1,
                  background: "rgba(245,243,236,.4)",
                }}
              />
              — Leonardo Varricchio, criador Kaleidos
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/*  GALERIA DE TEMPLATES                                             */
/* ---------------------------------------------------------------- */

type Template = {
  id: string;
  name: string;
  num: string;
  preview: React.ReactNode;
  tag: string;
};

function TemplatePreviewManifesto() {
  return (
    <div
      className="relative h-full w-full p-5 flex flex-col justify-between"
      style={{
        background: "var(--sv-ink)",
        color: "var(--sv-paper)",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,.1) 1px, transparent 1.5px)",
        backgroundSize: "10px 10px",
      }}
    >
      <span
        className="sv-kicker-sm"
        style={{ color: "var(--sv-green)", fontStyle: "normal" }}
      >
        01 / 04 · Manifesto
      </span>
      <div
        className="sv-display"
        style={{ fontSize: 22, lineHeight: 1.06 }}
      >
        Algoritmo premia{" "}
        <span
          style={{
            background: "var(--sv-green)",
            color: "var(--sv-ink)",
            padding: "0 4px",
            fontStyle: "italic",
          }}
        >
          consistência
        </span>
        , não genialidade.
      </div>
      <div
        className="sv-kicker-sm"
        style={{ opacity: 0.5, fontStyle: "normal" }}
      >
        @sequencia-viral
      </div>
    </div>
  );
}

function TemplatePreviewFuturista() {
  return (
    <div
      className="relative h-full w-full p-5 flex flex-col justify-between"
      style={{
        background: "var(--sv-navy)",
        color: "var(--sv-paper)",
      }}
    >
      <span
        className="sv-kicker-sm"
        style={{ color: "#5DF2FF", fontStyle: "normal" }}
      >
        02 / 04 · Futurista
      </span>
      <div>
        <div
          className="sv-display"
          style={{ fontSize: 22, lineHeight: 1.06 }}
        >
          O jogo é <em style={{ color: "#5DF2FF" }}>publicar</em>
          <br />
          todo dia.
        </div>
        <div
          aria-hidden
          className="mt-3 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, #5DF2FF 0%, transparent 100%)",
          }}
        />
      </div>
      <div
        className="sv-kicker-sm"
        style={{ opacity: 0.5, fontStyle: "normal" }}
      >
        ● 04 / LIVE
      </div>
    </div>
  );
}

function TemplatePreviewAutoral() {
  return (
    <div
      className="relative h-full w-full p-5 flex flex-col justify-between"
      style={{
        background: "var(--sv-paper)",
        color: "var(--sv-ink)",
      }}
    >
      <span
        className="sv-kicker-sm"
        style={{ fontStyle: "normal", color: "var(--sv-pink)" }}
      >
        03 / 04 · Autoral
      </span>
      <div
        className="sv-display"
        style={{ fontSize: 22, lineHeight: 1.06, fontStyle: "italic" }}
      >
        Não é falta
        <br />
        de ideia. É falta
        <br />
        de <em style={{ color: "var(--sv-pink)" }}>método</em>.
      </div>
      <div
        className="sv-kicker-sm"
        style={{ opacity: 0.6, fontStyle: "normal" }}
      >
        @sequencia-viral
      </div>
    </div>
  );
}

function TemplatePreviewTwitter() {
  return (
    <div
      className="relative h-full w-full p-5 flex flex-col justify-between"
      style={{
        background: "var(--sv-white)",
        color: "var(--sv-ink)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--sv-green)",
            border: "1px solid var(--sv-ink)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--sv-display)",
            fontStyle: "italic",
            fontSize: 13,
          }}
        >
          S
        </span>
        <div className="flex flex-col leading-tight">
          <span
            className="sv-sans"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            Sequência Viral
          </span>
          <span
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              color: "var(--sv-muted)",
            }}
          >
            @sequencia-viral
          </span>
        </div>
      </div>
      <div
        className="sv-display"
        style={{ fontSize: 20, lineHeight: 1.08 }}
      >
        Escolha <em>um</em> recorte.
        <br />
        Repita em <em>100</em> formatos.
      </div>
      <div
        className="sv-kicker-sm"
        style={{ opacity: 0.6, fontStyle: "normal" }}
      >
        ♡ 4.2k · ↻ 812
      </div>
    </div>
  );
}

const TEMPLATES: Template[] = [
  {
    id: "manifesto",
    name: "Manifesto",
    num: "01",
    preview: <TemplatePreviewManifesto />,
    tag: "Preto · Verde",
  },
  {
    id: "futurista",
    name: "Futurista",
    num: "02",
    preview: <TemplatePreviewFuturista />,
    tag: "Navy · Cyan",
  },
  {
    id: "autoral",
    name: "Autoral",
    num: "03",
    preview: <TemplatePreviewAutoral />,
    tag: "Creme · Pink",
  },
  {
    id: "twitter",
    name: "Twitter v2",
    num: "04",
    preview: <TemplatePreviewTwitter />,
    tag: "Branco · Thread",
  },
];

function TemplatesGallery() {
  return (
    <section
      id="templates"
      style={{ padding: "96px 0", background: "var(--sv-paper)" }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <div className="mb-12 grid items-end gap-6 md:grid-cols-[auto_1fr_auto]">
          <div
            className="sv-display"
            style={{
              fontSize: 64,
              lineHeight: 0.85,
              color: "var(--sv-pink)",
              fontStyle: "italic",
            }}
          >
            02
            <div
              className="sv-kicker-sm mt-2"
              style={{ fontStyle: "normal" }}
            >
              Templates
            </div>
          </div>
          <motion.h2
            {...REVEAL}
            className="sv-display"
            style={{
              fontSize: "clamp(28px, 3.8vw, 48px)",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              maxWidth: 820,
            }}
          >
            Quatro <em>templates</em> editoriais.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Cada um com pegada própria.
            </span>
          </motion.h2>
          <span
            className="hidden justify-self-end md:inline-flex"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              padding: "4px 10px",
              border: "1px solid var(--sv-ink)",
              background: "var(--sv-white)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
            }}
          >
            Produto
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {TEMPLATES.map((tpl, i) => (
            <motion.article
              key={tpl.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.6,
                delay: i * 0.08,
                ease: [0.2, 0.7, 0.2, 1],
              }}
              className="sv-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <div
                style={{
                  aspectRatio: "4 / 5",
                  borderBottom: "1.5px solid var(--sv-ink)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {tpl.preview}
              </div>
              <div className="flex items-center justify-between p-5">
                <div>
                  <div
                    className="sv-kicker-sm"
                    style={{ fontStyle: "normal" }}
                  >
                    Template · Nº {tpl.num}/04
                  </div>
                  <div
                    className="sv-display mt-1"
                    style={{ fontSize: 22, fontStyle: "italic" }}
                  >
                    {tpl.name}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--sv-muted)",
                  }}
                >
                  {tpl.tag}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/*  COMO FUNCIONA                                                    */
/* ---------------------------------------------------------------- */

const STEPS = [
  {
    num: "01",
    title: (
      <>
        <em>Cole</em> a fonte.
      </>
    ),
    body:
      "Link de YouTube, artigo de blog, post do Instagram, PDF ou só uma ideia em uma frase. A IA escuta e entende.",
  },
  {
    num: "02",
    title: (
      <>
        A IA <em>pensa</em>.
      </>
    ),
    body:
      "Cinco conceitos primeiro pra você escolher o ângulo. Depois, três carrosséis completos: dados, narrativa e provocação.",
  },
  {
    num: "03",
    title: (
      <>
        Edite. Exporte. <em>Poste</em>.
      </>
    ),
    body:
      "Ajuste texto e imagem inline. Exporta PNG 1080×1350 pixel-perfect. Abre no celular, posta. Acabou.",
  },
];

function HowItWorks() {
  return (
    <section
      id="como-funciona"
      style={{ padding: "96px 0", background: "var(--sv-paper)" }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <div className="mb-12 grid items-end gap-6 md:grid-cols-[auto_1fr_auto]">
          <div
            className="sv-display"
            style={{
              fontSize: 64,
              lineHeight: 0.85,
              color: "var(--sv-pink)",
              fontStyle: "italic",
            }}
          >
            03
            <div
              className="sv-kicker-sm mt-2"
              style={{ fontStyle: "normal" }}
            >
              Como funciona
            </div>
          </div>
          <motion.h2
            {...REVEAL}
            className="sv-display"
            style={{
              fontSize: "clamp(28px, 3.8vw, 48px)",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              maxWidth: 820,
            }}
          >
            Três passos.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Nenhum deles envolve
            </span>{" "}
            <em>editar no Canva</em>.
          </motion.h2>
          <span
            className="hidden justify-self-end md:inline-flex"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              padding: "4px 10px",
              border: "1px solid var(--sv-ink)",
              background: "var(--sv-white)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
            }}
          >
            Manual
          </span>
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            borderTop: "1.5px solid var(--sv-ink)",
            borderBottom: "1.5px solid var(--sv-ink)",
          }}
        >
          {STEPS.map((step, i) => (
            <StepItem key={step.num} step={step} index={i} />
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          section :global(.steps-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function StepItem({
  step,
  index,
}: {
  step: (typeof STEPS)[number];
  index: number;
}) {
  const [hover, setHover] = useState(false);
  const isLast = index === STEPS.length - 1;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.2, 0.7, 0.2, 1],
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "32px 28px 28px",
        borderRight: isLast ? "none" : "1px solid var(--sv-ink)",
        position: "relative",
        overflow: "hidden",
        background: hover ? "var(--sv-green)" : "transparent",
        transition: "background .25s ease",
      }}
    >
      <div
        className="sv-display mb-14"
        style={{
          fontSize: 64,
          lineHeight: 0.82,
          color: "var(--sv-ink)",
          fontStyle: "italic",
        }}
      >
        {step.num}
      </div>
      <h3
        className="sv-display"
        style={{
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: "-0.015em",
          lineHeight: 1.05,
          marginBottom: 8,
        }}
      >
        {step.title}
      </h3>
      <p
        className="sv-sans"
        style={{
          color: hover ? "var(--sv-ink)" : "var(--sv-muted)",
          fontSize: 13.5,
          lineHeight: 1.55,
          maxWidth: 280,
          transition: "color .25s ease",
        }}
      >
        {step.body}
      </p>
    </motion.article>
  );
}

/* ---------------------------------------------------------------- */
/*  PRICING                                                          */
/* ---------------------------------------------------------------- */

const PRICING_PLANS = [
  {
    id: "starter" as const,
    ribbon: "Pra experimentar",
    ribbonStyle: "free" as const,
    name: "Starter",
    price: "R$0",
    priceSuffix: "",
    anchor: null,
    features: [
      "5 carrosséis/mês",
      "Export PNG em alta",
      "Modo rápido + avançado",
      "4 templates editoriais",
      "1 perfil de marca",
    ],
    ctaLabel: "Começar grátis",
    ctaHref: "/app/login",
    highlight: false,
  },
  {
    id: "pro" as const,
    ribbon: "✦ Mais escolhido",
    ribbonStyle: "pro" as const,
    name: "Pro",
    price: "R$89",
    priceSuffix: "/mês",
    anchor: "R$179",
    features: [
      "30 carrosséis/mês",
      "Brand voice analyzer",
      "Export PNG + PDF",
      "3 perfis de marca",
      "Transcrição de vídeos",
      "Histórico completo",
    ],
    ctaLabel: "Assinar Pro →",
    ctaHref: "/app/checkout?plan=pro",
    highlight: true,
  },
  {
    id: "business" as const,
    ribbon: "Pra agências",
    ribbonStyle: "biz" as const,
    name: "Agência",
    price: "R$249",
    priceSuffix: "/mês",
    anchor: null,
    features: [
      "Carrosséis ilimitados",
      "10 perfis de marca",
      "Workspace compartilhado",
      "Templates customizados",
      "Suporte prioritário",
      "API (em breve)",
    ],
    ctaLabel: "Assinar Agência",
    ctaHref: "/app/checkout?plan=business",
    highlight: false,
  },
];

function PricingSection() {
  return (
    <section
      id="pricing"
      style={{ padding: "96px 0", background: "var(--sv-paper)" }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <div className="mb-12 grid items-end gap-6 md:grid-cols-[auto_1fr_auto]">
          <div
            className="sv-display"
            style={{
              fontSize: 64,
              lineHeight: 0.85,
              color: "var(--sv-pink)",
              fontStyle: "italic",
            }}
          >
            04
            <div
              className="sv-kicker-sm mt-2"
              style={{ fontStyle: "normal" }}
            >
              Pricing
            </div>
          </div>
          <motion.h2
            {...REVEAL}
            className="sv-display"
            style={{
              fontSize: "clamp(28px, 3.8vw, 48px)",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              maxWidth: 820,
            }}
          >
            Preço <em>honesto</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Cancele quando quiser.
            </span>
          </motion.h2>
          <span
            className="hidden justify-self-end md:inline-flex"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              padding: "4px 10px",
              border: "1px solid var(--sv-ink)",
              background: "var(--sv-green)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
            }}
          >
            −50% no lançamento
          </span>
        </div>

        <div className="grid items-start gap-5 md:grid-cols-3">
          {PRICING_PLANS.map((plan, i) => (
            <PricingCard key={plan.id} plan={plan} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  plan,
  index,
}: {
  plan: (typeof PRICING_PLANS)[number];
  index: number;
}) {
  const isHighlight = plan.highlight;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: isHighlight ? -8 : 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      style={{
        background: isHighlight ? "var(--sv-ink)" : "var(--sv-white)",
        color: isHighlight ? "var(--sv-paper)" : "var(--sv-ink)",
        border: "1.5px solid var(--sv-ink)",
        padding: 28,
        boxShadow: isHighlight
          ? "5px 5px 0 0 var(--sv-green)"
          : "5px 5px 0 0 var(--sv-ink)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
      }}
    >
      <span
        style={{
          alignSelf: "flex-start",
          padding: "4px 10px",
          border: `1px solid ${
            isHighlight ? "var(--sv-green)" : "var(--sv-ink)"
          }`,
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: isHighlight
            ? "var(--sv-green)"
            : plan.ribbonStyle === "biz"
              ? "var(--sv-ink)"
              : "var(--sv-muted)",
          background:
            isHighlight
              ? "transparent"
              : plan.ribbonStyle === "biz"
                ? "var(--sv-pink)"
                : "transparent",
        }}
      >
        {plan.ribbon}
      </span>

      <h3
        className="sv-display"
        style={{
          fontSize: 32,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 0.95,
          fontStyle: "italic",
          color: isHighlight ? "var(--sv-paper)" : "var(--sv-ink)",
        }}
      >
        {plan.name}
      </h3>

      <div>
        {plan.anchor && (
          <span
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              textDecoration: "line-through",
              color: isHighlight ? "rgba(245,243,236,.5)" : "var(--sv-muted)",
            }}
          >
            {plan.anchor}
          </span>
        )}
        <div className="flex items-baseline gap-1.5">
          <span
            className="sv-display"
            style={{
              fontSize: 44,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              color: isHighlight ? "var(--sv-paper)" : "var(--sv-ink)",
            }}
          >
            {plan.price}
          </span>
          {plan.priceSuffix && (
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: isHighlight
                  ? "rgba(245,243,236,.6)"
                  : "var(--sv-muted)",
              }}
            >
              {plan.priceSuffix}
            </span>
          )}
        </div>
      </div>

      <ul
        className="flex flex-col gap-2"
        style={{ listStyle: "none", fontSize: 13 }}
      >
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check
              size={14}
              style={{
                color: isHighlight ? "var(--sv-green)" : "var(--sv-pink)",
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={plan.ctaHref}
        className={`sv-btn ${
          isHighlight ? "sv-btn-primary" : "sv-btn-outline"
        } mt-auto`}
      >
        {plan.ctaLabel}
      </Link>
    </motion.article>
  );
}

/* ---------------------------------------------------------------- */
/*  FAQ                                                              */
/* ---------------------------------------------------------------- */

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      style={{ padding: "96px 0", background: "var(--sv-paper)" }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <div className="mb-12 grid items-end gap-6 md:grid-cols-[auto_1fr_auto]">
          <div
            className="sv-display"
            style={{
              fontSize: 64,
              lineHeight: 0.85,
              color: "var(--sv-pink)",
              fontStyle: "italic",
            }}
          >
            05
            <div
              className="sv-kicker-sm mt-2"
              style={{ fontStyle: "normal" }}
            >
              FAQ
            </div>
          </div>
          <motion.h2
            {...REVEAL}
            className="sv-display"
            style={{
              fontSize: "clamp(28px, 3.8vw, 48px)",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              maxWidth: 820,
            }}
          >
            Perguntas <em>antes</em> de pagar.
          </motion.h2>
          <span
            className="hidden justify-self-end md:inline-flex"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              padding: "4px 10px",
              border: "1px solid var(--sv-ink)",
              background: "var(--sv-white)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
            }}
          >
            Respostas rápidas
          </span>
        </div>

        <div
          style={{
            maxWidth: 880,
            borderTop: "1.5px solid var(--sv-ink)",
            borderBottom: "1.5px solid var(--sv-ink)",
          }}
        >
          {LANDING_FAQ.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={item.q}
                style={{
                  borderBottom:
                    i === LANDING_FAQ.length - 1
                      ? "none"
                      : "1px solid var(--sv-ink)",
                  padding: "22px 0",
                  cursor: "pointer",
                }}
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                <div className="flex items-start justify-between gap-5">
                  <h3
                    className="sv-display"
                    style={{
                      fontSize: 22,
                      fontWeight: 400,
                      letterSpacing: "-0.012em",
                      lineHeight: 1.25,
                      flex: 1,
                    }}
                  >
                    {item.q}
                  </h3>
                  <span
                    aria-hidden
                    style={{
                      width: 28,
                      height: 28,
                      border: "1px solid var(--sv-ink)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--sv-mono)",
                      fontSize: 16,
                      lineHeight: 1,
                      background: isOpen ? "var(--sv-green)" : "transparent",
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                      transition: "transform .3s, background .2s",
                      flexShrink: 0,
                    }}
                  >
                    +
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <p
                        className="sv-sans"
                        style={{
                          color: "var(--sv-muted)",
                          fontSize: 14,
                          lineHeight: 1.6,
                          paddingRight: 48,
                          marginTop: 12,
                        }}
                      >
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/*  CTA FINAL                                                        */
/* ---------------------------------------------------------------- */

function FinalCta() {
  return (
    <section
      style={{
        background: "var(--sv-paper)",
        padding: "108px 0",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        borderTop: "1.5px solid var(--sv-ink)",
        borderBottom: "1.5px solid var(--sv-ink)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-20%",
          background:
            "repeating-conic-gradient(from 45deg at 50% 50%, transparent 0 6deg, rgba(210,98,178,.08) 6deg 7deg)",
          pointerEvents: "none",
          animation: "sv-spin-slow 180s linear infinite",
        }}
      />
      <div className="relative mx-auto max-w-[1240px] px-6">
        <motion.div {...REVEAL} className="mx-auto">
          <span
            className="sv-eyebrow"
            style={{ display: "inline-flex" }}
          >
            <span className="sv-dot" />
            Pronto pro primeiro post?
          </span>
          <h2
            className="sv-display mx-auto mt-6"
            style={{
              fontSize: "clamp(40px, 5.6vw, 80px)",
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
            }}
          >
            Seu primeiro carrossel
            <br />
            <em>em 30 segundos.</em>
          </h2>
          <p
            className="sv-sans mx-auto mt-5 max-w-[500px]"
            style={{
              fontSize: 15,
              color: "var(--sv-muted)",
              lineHeight: 1.55,
            }}
          >
            Cole um link, um texto ou uma ideia. A IA faz o resto, com a sua voz.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/app/login"
              className="sv-btn sv-btn-primary"
              style={{ padding: "14px 22px", fontSize: 11.5 }}
            >
              Criar carrossel grátis →
            </Link>
            <Link
              href="/roadmap"
              className="sv-btn sv-btn-outline"
              style={{ padding: "14px 22px", fontSize: 11.5 }}
            >
              Ver roadmap
            </Link>
          </div>
          <div
            className="mt-7 flex flex-wrap justify-center gap-6"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
            }}
          >
            <span>✦ Sem cartão</span>
            <span>✦ 5 carrosséis grátis</span>
            <span>✦ Cancele quando quiser</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/*  FOOTER                                                           */
/* ---------------------------------------------------------------- */

function Footer() {
  return (
    <footer
      style={{
        background: "var(--sv-paper)",
        borderTop: "1.5px solid var(--sv-ink)",
        padding: "56px 0 24px",
        fontSize: 12.5,
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <span
                className="sv-display"
                style={{
                  fontSize: 22,
                  letterSpacing: "-0.01em",
                }}
              >
                Sequência <em>Viral</em>
              </span>
            </Link>
            <p
              className="sv-sans mt-3"
              style={{
                color: "var(--sv-muted)",
                fontSize: 12.5,
                maxWidth: 320,
                lineHeight: 1.55,
              }}
            >
              Cole um link. Publique um carrossel. Em minutos, não em horas.
              Um braço da Kaleidos Digital.
            </p>
          </div>

          <FooterColumn
            title="Produto"
            items={[
              { label: "Criar carrossel", href: "/app/login" },
              { label: "Preço", href: "#pricing" },
              { label: "Roadmap", href: "/roadmap" },
              { label: "Blog", href: "/blog" },
            ]}
          />

          <FooterColumn
            title="Marca"
            items={[
              { label: "Kaleidos Digital", href: "https://kaleidos.ag" },
              { label: "Manifesto", href: "#manifesto" },
              { label: "Templates", href: "#templates" },
              { label: "Contato", href: "mailto:madureira@kaleidosdigital.com" },
            ]}
          />

          <FooterColumn
            title="Legal"
            items={[
              { label: "Privacidade", href: "/privacy" },
              { label: "Termos", href: "/terms" },
              { label: "App", href: "/app" },
            ]}
          />
        </div>

        <div
          className="mt-12 flex flex-wrap items-center justify-between gap-3 pt-5"
          style={{
            borderTop: "1px solid var(--sv-ink)",
            color: "var(--sv-muted)",
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          <span>© MMXXVI · Sequência Viral · Todos os direitos reservados</span>
          <span className="inline-flex items-center gap-2">
            <span>Feito por</span>
            <a
              href="https://kaleidos.ag"
              target="_blank"
              rel="noreferrer"
              className="sv-display"
              style={{
                textTransform: "none",
                letterSpacing: "-0.01em",
                fontSize: 15,
                fontStyle: "italic",
                color: "var(--sv-ink)",
              }}
            >
              Kaleidos Digital
            </a>
            <span
              aria-hidden
              style={{ color: "var(--sv-pink)", fontSize: 14 }}
            >
              ✦
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          marginBottom: 14,
        }}
      >
        {title}
      </h4>
      <ul className="flex flex-col gap-2" style={{ listStyle: "none" }}>
        {items.map((it) => {
          const isExternal = it.href.startsWith("http");
          const isHash = it.href.startsWith("#");
          const isMail = it.href.startsWith("mailto:");
          if (isExternal || isHash || isMail) {
            return (
              <li key={it.label}>
                <a
                  href={it.href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noreferrer" : undefined}
                  style={{
                    transition: "background .15s",
                    padding: "2px 4px",
                    display: "inline-block",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background =
                      "var(--sv-green)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background =
                      "transparent";
                  }}
                >
                  {it.label}
                </a>
              </li>
            );
          }
          return (
            <li key={it.label}>
              <Link
                href={it.href}
                style={{
                  transition: "background .15s",
                  padding: "2px 4px",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "var(--sv-green)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "transparent";
                }}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  PAGE                                                             */
/* ---------------------------------------------------------------- */

export default function Page() {
  // Usa kicker helper em algum lugar pra não ficar como import morto caso futuro
  void Kicker;
  return (
    <main
      className="sv-sans"
      style={{
        background: "var(--sv-paper)",
        color: "var(--sv-ink)",
        overflowX: "hidden",
      }}
    >
      {/* keyframes globais usados só na landing */}
      <style jsx global>{`
        @keyframes sv-spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes sv-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-33.3333%);
          }
        }
      `}</style>

      <TopNav />
      <Hero />
      <LogoMarquee />
      <Manifesto />
      <TemplatesGallery />
      <HowItWorks />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </main>
  );
}
