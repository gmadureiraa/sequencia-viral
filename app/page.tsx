"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { useLandingSession } from "@/lib/use-landing-session";

/* ─────────────────────────────────────────────────────────────────
   Sequência Viral — Landing brutalist editorial (Kaleidos Digital)
   Baseado no handoff de Abril/26. Design tokens em globals.css (.sv-*).
   ───────────────────────────────────────────────────────────────── */

const BASE_ASSET = "/brand/landing";

const NAV_ITEMS = [
  { label: "Como funciona", href: "#como" },
  { label: "Features", href: "#features" },
  { label: "Compare", href: "#compare" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const REVEAL = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] as const },
};

/* ───────────────────────────── NAV ───────────────────────────── */

function TopNav() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn } = useLandingSession();
  const primaryHref = isLoggedIn ? "/app" : "/app/login";
  const primaryLabel = isLoggedIn ? "Ir pro app →" : "Criar grátis →";

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
          {/* Brand mark em círculo verde flutuante */}
          <span
            className="sv-anim-float-slow inline-flex h-[30px] w-[30px] items-center justify-center rounded-full"
            style={{
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-green)",
            }}
            aria-hidden
          >
            <span
              style={{
                fontFamily: "var(--sv-display)",
                fontStyle: "italic",
                fontSize: 14,
                color: "var(--sv-ink)",
                lineHeight: 1,
              }}
            >
              SV
            </span>
          </span>
          <span className="flex flex-col leading-none">
            <span
              className="sv-display"
              style={{ fontSize: 16, letterSpacing: "-0.01em" }}
            >
              Sequência <em>Viral</em>
            </span>
            <span
              className="mt-[2px] hidden md:inline-block"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 8.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              by Kaleidos
            </span>
          </span>
        </Link>

        <ul className="hidden items-center md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                className="block px-3 py-[7px] transition-colors hover:bg-[var(--sv-green)]"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--sv-ink)",
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          {!isLoggedIn && (
            <Link
              href="/app/login"
              className="sv-btn sv-btn-ghost"
              style={{ padding: "8px 14px", fontSize: 9.5 }}
            >
              Entrar
            </Link>
          )}
          <Link
            href={primaryHref}
            className="sv-btn sv-btn-primary"
            style={{ padding: "8px 14px", fontSize: 9.5 }}
          >
            {primaryLabel}
          </Link>
        </div>

        <button
          aria-label="Abrir menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden"
          style={{
            border: "1.5px solid var(--sv-ink)",
            padding: 8,
            background: "var(--sv-white)",
            boxShadow: "2px 2px 0 0 var(--sv-ink)",
          }}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden"
            style={{
              borderTop: "1px solid var(--sv-ink)",
              background: "var(--sv-paper)",
              overflow: "hidden",
            }}
          >
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-6 py-3"
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      borderBottom: "1px solid rgba(10,10,10,0.1)",
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="flex gap-2 px-6 py-4">
                {!isLoggedIn && (
                  <Link
                    href="/app/login"
                    className="sv-btn sv-btn-outline"
                    style={{ padding: "10px 16px", fontSize: 10 }}
                  >
                    Entrar
                  </Link>
                )}
                <Link
                  href={primaryHref}
                  className="sv-btn sv-btn-primary"
                  style={{ padding: "10px 16px", fontSize: 10 }}
                >
                  {primaryLabel}
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ───────────────────────────── HERO ───────────────────────────── */

const PHONE_SLIDES: {
  tag: string;
  bg: "ink" | "green" | "dots" | "pink";
  body: React.ReactNode;
  foot: string;
}[] = [
  {
    tag: "01 / 04 · YouTube",
    bg: "ink",
    body: (
      <>
        O algoritmo premia{" "}
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
      </>
    ),
    foot: "Deslize →",
  },
  {
    tag: "02 / 04 · Insight",
    bg: "green",
    body: (
      <>
        Escolha <em>um</em> recorte.
        <br />
        Repita em <em>100</em> formatos.
      </>
    ),
    foot: "Deslize →",
  },
  {
    tag: "03 / 04 · Prática",
    bg: "dots",
    body: (
      <>
        Não é <em>falta</em>
        <br />
        de ideia. É falta de <em>método</em>.
      </>
    ),
    foot: "Deslize →",
  },
  {
    tag: "04 / 04 · CTA",
    bg: "pink",
    body: (
      <>
        Comece <em>hoje</em>.
        <br />
        Poste <em>amanhã</em>.
      </>
    ),
    foot: "Salvar ✱",
  },
];

function PhoneMockup() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setIdx((v) => (v + 1) % PHONE_SLIDES.length), 3200);
    return () => clearInterval(iv);
  }, []);

  const slide = PHONE_SLIDES[idx];
  const bgStyle = (() => {
    switch (slide.bg) {
      case "ink":
        return {
          background: "var(--sv-ink)",
          color: "var(--sv-paper)",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,.1) 1px, transparent 1.5px)",
          backgroundSize: "10px 10px",
        };
      case "green":
        return { background: "var(--sv-green)", color: "var(--sv-ink)" };
      case "dots":
        return {
          background: "var(--sv-white)",
          color: "var(--sv-ink)",
          backgroundImage:
            "radial-gradient(circle at 2px 2px, var(--sv-ink) 1px, transparent 1.5px)",
          backgroundSize: "8px 8px",
        };
      case "pink":
        return { background: "var(--sv-pink)", color: "var(--sv-ink)" };
    }
  })();

  return (
    <div
      className="absolute left-1/2 top-1/2 z-[4] overflow-hidden"
      style={{
        transform: "translate(-50%, -50%) rotate(-4deg)",
        width: "54%",
        aspectRatio: "9 / 16",
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        borderRadius: 22,
        boxShadow: "6px 6px 0 0 var(--sv-ink)",
        padding: 8,
      }}
    >
      {/* notch */}
      <span
        aria-hidden
        className="absolute z-[5]"
        style={{
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          width: 60,
          height: 5,
          background: "var(--sv-ink)",
          borderRadius: 10,
        }}
      />
      <div
        className="h-full w-full overflow-hidden"
        style={{
          borderRadius: 16,
          position: "relative",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] as const }}
            className="absolute inset-0 flex flex-col justify-between"
            style={{
              padding: "20px 18px 14px",
              borderRadius: 14,
              ...bgStyle,
            }}
          >
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 8.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:
                  slide.bg === "ink" ? "var(--sv-green)" : "rgba(10,10,10,0.65)",
              }}
            >
              {slide.tag}
            </span>
            <h2
              style={{
                fontFamily: "var(--sv-display)",
                fontSize: 26,
                lineHeight: 1.06,
                fontWeight: 400,
                letterSpacing: "-0.012em",
              }}
            >
              {slide.body}
            </h2>
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "var(--sv-mono)",
                fontSize: 7.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                opacity: 0.7,
              }}
            >
              <span>@sequencia-viral</span>
              <span>{slide.foot}</span>
            </span>
          </motion.div>
        </AnimatePresence>

        {/* progress bars */}
        <div
          className="absolute z-[5] flex gap-[3px]"
          style={{ left: 20, right: 20, bottom: 30 }}
        >
          {PHONE_SLIDES.map((_, i) => {
            const isDone = i < idx;
            const isActive = i === idx;
            const barBg =
              slide.bg === "ink" || slide.bg === "dots"
                ? slide.bg === "ink"
                  ? "rgba(255,255,255,.22)"
                  : "rgba(0,0,0,.18)"
                : "rgba(0,0,0,.18)";
            return (
              <i
                key={i}
                className="relative block"
                style={{
                  flex: 1,
                  height: 2,
                  background: barBg,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <span
                  className="absolute inset-0 block"
                  style={{
                    background: "var(--sv-green)",
                    transformOrigin: "left",
                    transform: isDone ? "scaleX(1)" : "scaleX(0)",
                    animation: isActive ? "sv-fill-bar 3.2s linear forwards" : undefined,
                  }}
                />
              </i>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const { isLoggedIn } = useLandingSession();
  const primaryHref = isLoggedIn ? "/app" : "/app/login";
  const primaryLabel = isLoggedIn ? "Ir pro app →" : "Criar primeiro grátis";

  return (
    // ATF 1366×768: padding e headline dimensionados para o CTA ficar visível
    // sem scroll em laptops comuns (altura útil ≈ 704px descontando nav 64px).
    <header
      className="relative overflow-hidden"
      style={{ padding: "clamp(28px, 4.2vw, 56px) 0 clamp(16px, 3vw, 40px)" }}
    >
      <div
        className="mx-auto grid max-w-[1240px] items-center gap-10 px-6"
        style={{
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
        }}
      >
        <style>{`@media (max-width: 960px){ header.sv-hero-grid-fix > div > div:first-child, header.sv-hero-grid-fix > div { } }`}</style>
        <motion.div {...REVEAL}>
          <span className="sv-eyebrow">
            <span className="sv-dot" />
            YouTube · Reels · Blog · Ideia
          </span>

          <h1
            className="sv-display mt-4"
            style={{
              fontSize: "clamp(36px, 4.8vw, 64px)",
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              fontWeight: 400,
            }}
          >
            <span className="block">Cole um link.</span>
            <span className="block">
              Publique um <span className="sv-splash">carrossel</span>
            </span>
            <span className="block">
              em <span className="sv-under">minutos</span>.
            </span>
          </h1>

          <p
            className="mt-[22px]"
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--sv-muted)",
              maxWidth: 480,
            }}
          >
            A IA lê a sua fonte e devolve um carrossel editorial{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>com a sua voz</b>,
            pronto pra postar. Não é template. Não é ChatGPT cheiroso. É uma
            ferramenta que entende que{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
              você já tem algo a dizer
            </b>
            .
          </p>

          <div className="mt-6 flex flex-wrap gap-[10px]">
            <Link
              href={primaryHref}
              className="sv-btn sv-btn-primary"
              style={{ padding: "14px 22px", fontSize: 11.5 }}
            >
              {primaryLabel}
              <ArrowRight size={12} strokeWidth={2.5} />
            </Link>
            <a
              href="#demo"
              className="sv-btn sv-btn-outline"
              style={{ padding: "14px 22px", fontSize: 11.5 }}
            >
              Ver demo de 15s
            </a>
          </div>

          <div
            className="mt-[22px] flex flex-wrap gap-x-6 gap-y-[18px]"
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
          </div>
        </motion.div>

        <motion.div
          {...REVEAL}
          className="relative mx-auto w-full"
          style={{
            maxWidth: 520,
            aspectRatio: "1 / 1.02",
          }}
        >
          {/* Mandala decorativa atrás */}
          <img
            src={`${BASE_ASSET}/hero-mandala.png`}
            alt=""
            aria-hidden
            className="sv-anim-spin-slow pointer-events-none absolute"
            style={{ top: "8%", left: "8%", width: "28%", opacity: 0.12, zIndex: 1 }}
          />

          {/* Mouth top-left */}
          <img
            src={`${BASE_ASSET}/hero-mouth.png`}
            alt=""
            aria-hidden
            className="sv-anim-float-slow absolute"
            style={
              {
                top: "-4%",
                left: "-6%",
                width: "36%",
                ["--sv-r" as string]: "-8deg",
                filter: "drop-shadow(4px 6px 0 rgba(10,10,10,.15))",
                zIndex: 3,
              } as React.CSSProperties
            }
          />

          {/* Brain / cat halftone top-right */}
          <img
            src={`${BASE_ASSET}/hero-brain.png`}
            alt=""
            aria-hidden
            className="sv-anim-float absolute"
            style={
              {
                top: "8%",
                right: "-8%",
                width: "28%",
                ["--sv-r" as string]: "12deg",
                filter: "drop-shadow(4px 6px 0 rgba(10,10,10,.15))",
                zIndex: 3,
              } as React.CSSProperties
            }
          />

          {/* Ear bottom-left */}
          <img
            src={`${BASE_ASSET}/hero-ear.png`}
            alt=""
            aria-hidden
            className="sv-anim-drift absolute"
            style={
              {
                bottom: "2%",
                left: "-6%",
                width: "22%",
                ["--sv-r" as string]: "-10deg",
                filter: "drop-shadow(4px 6px 0 rgba(10,10,10,.15))",
                zIndex: 3,
              } as React.CSSProperties
            }
          />

          {/* Hand bottom-right */}
          <img
            src={`${BASE_ASSET}/hero-hand.png`}
            alt=""
            aria-hidden
            className="sv-anim-float absolute"
            style={
              {
                bottom: "-4%",
                right: "-4%",
                width: "24%",
                ["--sv-r" as string]: "6deg",
                filter: "drop-shadow(4px 6px 0 rgba(10,10,10,.15))",
                zIndex: 5,
              } as React.CSSProperties
            }
          />

          {/* Megaphone mid-right */}
          <img
            src={`${BASE_ASSET}/hero-megaphone.png`}
            alt=""
            aria-hidden
            className="sv-anim-float-slow absolute"
            style={
              {
                top: "42%",
                right: "-18%",
                width: "32%",
                ["--sv-r" as string]: "14deg",
                filter: "drop-shadow(4px 6px 0 rgba(10,10,10,.15))",
                zIndex: 3,
              } as React.CSSProperties
            }
          />

          {/* Stars */}
          <img
            src={`${BASE_ASSET}/star-lg.png`}
            alt=""
            aria-hidden
            className="sv-anim-spin-med pointer-events-none absolute"
            style={{ top: "10%", left: "42%", width: 40, zIndex: 7 }}
          />
          <img
            src={`${BASE_ASSET}/star-sm.png`}
            alt=""
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              bottom: "6%",
              left: "38%",
              width: 28,
              zIndex: 7,
              animation: "sv-spin-slow 16s linear reverse infinite",
            }}
          />

          <PhoneMockup />

          {/* Chips flutuantes */}
          <span
            className="sv-anim-float-slow absolute"
            style={
              {
                top: "2%",
                right: "8%",
                transform: "rotate(6deg)",
                padding: "6px 11px",
                background: "var(--sv-green)",
                border: "1.5px solid var(--sv-ink)",
                boxShadow: "3px 3px 0 0 var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                zIndex: 6,
                ["--sv-r" as string]: "6deg",
              } as React.CSSProperties
            }
          >
            ✦ Em 15 seg
          </span>
          <span
            className="sv-anim-float absolute"
            style={
              {
                bottom: "14%",
                left: "4%",
                transform: "rotate(-5deg)",
                padding: "6px 11px",
                background: "var(--sv-pink)",
                color: "var(--sv-ink)",
                border: "1.5px solid var(--sv-ink)",
                boxShadow: "3px 3px 0 0 var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                zIndex: 6,
                ["--sv-r" as string]: "-5deg",
              } as React.CSSProperties
            }
          >
            Sua voz · não template
          </span>
        </motion.div>
      </div>

      {/* Corner seal */}
      <div
        className="absolute"
        style={{
          top: 88,
          right: 24,
          fontFamily: "var(--sv-mono)",
          fontSize: 8.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          textAlign: "right",
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            display: "block",
            fontFamily: "var(--sv-display)",
            fontStyle: "italic",
            fontSize: 20,
            color: "var(--sv-ink)",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          MMXXVI
        </span>
        Ed. 01 · Brasil
      </div>
    </header>
  );
}

/* ───────────────────────────── TICKER ───────────────────────────── */

function Ticker() {
  const items = [
    { k: "2.143", v: "carrosséis gerados" },
    { k: "~15s", v: "por carrossel" },
    { k: "4 origens", v: "· YouTube · Blog · Reel · Ideia" },
    { k: "30 posts", v: "/mês no Pro" },
  ];
  const doubled = [...items, ...items];
  return (
    <div className="sv-ticker">
      <div className="sv-ticker-track">
        {doubled.map((it, i) => (
          <span key={i} className="flex items-center gap-10">
            <span>
              <span className="sv-hl">{it.k}</span> {it.v}
            </span>
            <span className="sv-star">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── SECTION HEAD ─────────────────────────── */

function SectionHead({
  num,
  sub,
  children,
  tag,
}: {
  num: string;
  sub: string;
  children: React.ReactNode;
  tag?: string;
}) {
  return (
    <div
      className="mb-12 grid items-end gap-x-9 gap-y-6"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
    >
      <div
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 64,
          lineHeight: 0.85,
          color: "var(--sv-pink)",
          fontStyle: "italic",
          fontWeight: 400,
        }}
      >
        {num}
        <span
          style={{
            display: "block",
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
            fontStyle: "normal",
            marginTop: 6,
            lineHeight: 1,
          }}
        >
          {sub}
        </span>
      </div>
      <motion.h2
        {...REVEAL}
        className="sv-display"
        style={{
          fontSize: "clamp(28px, 3.8vw, 48px)",
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          fontWeight: 400,
          maxWidth: 820,
        }}
      >
        {children}
      </motion.h2>
      {tag && (
        <span
          className="justify-self-end self-start whitespace-nowrap"
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
          {tag}
        </span>
      )}
    </div>
  );
}

/* ───────────────────────────── HOW (3 steps) ───────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      img: "hero-ear.png",
      title: (
        <>
          <em>Cole</em> a fonte.
        </>
      ),
      body: "Link de YouTube, artigo de blog, post do Instagram, PDF ou só uma ideia em uma frase. A IA escuta e entende.",
    },
    {
      n: "02",
      img: "step-typewriter.png",
      title: (
        <>
          A IA <em>pensa</em>.
        </>
      ),
      body: "Cinco conceitos primeiro pra você escolher o ângulo. Depois, três carrosséis completos: dados, narrativa e provocação.",
    },
    {
      n: "03",
      img: "hero-megaphone.png",
      title: (
        <>
          Edite. Exporte. <em>Poste</em>.
        </>
      ),
      body: "Ajuste texto e imagem inline. Exporta PNG 1080×1350 pixel-perfect. Abre no celular, posta. Acabou.",
    },
  ];

  return (
    <section id="como" style={{ padding: "96px 0" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="01" sub="Como funciona" tag="Manual">
          Três passos.{" "}
          <span style={{ color: "var(--sv-muted)" }}>Nenhum deles envolve</span>{" "}
          <em>editar no Canva</em>.
        </SectionHead>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            borderTop: "1.5px solid var(--sv-ink)",
            borderBottom: "1.5px solid var(--sv-ink)",
          }}
        >
          {steps.map((s, i) => (
            <motion.article
              key={s.n}
              {...REVEAL}
              className="group relative overflow-hidden transition-colors hover:bg-[var(--sv-green)]"
              style={{
                padding: "32px 28px 28px",
                borderRight:
                  i < steps.length - 1 ? "1px solid var(--sv-ink)" : "none",
              }}
            >
              <div className="mb-14 flex items-start justify-between gap-4">
                <div
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 64,
                    lineHeight: 0.82,
                    fontStyle: "italic",
                    color: "var(--sv-ink)",
                  }}
                >
                  {s.n}
                </div>
                <div
                  className="relative flex-shrink-0 transition-transform duration-300 group-hover:rotate-[4deg] group-hover:scale-105"
                  style={{
                    width: 78,
                    height: 78,
                    transform: "rotate(-6deg)",
                  }}
                >
                  <img
                    src={`${BASE_ASSET}/${s.img}`}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-contain"
                    style={{
                      filter: "drop-shadow(3px 3px 0 rgba(0,0,0,.15))",
                    }}
                  />
                </div>
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
                {s.title}
              </h3>
              <p
                style={{
                  color: "var(--sv-muted)",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  maxWidth: 280,
                }}
              >
                {s.body}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          #como .grid { grid-template-columns: 1fr !important; }
          #como .grid > article { border-right: none !important; border-bottom: 1px solid var(--sv-ink); }
          #como .grid > article:last-child { border-bottom: none; }
        }
      `}</style>
    </section>
  );
}

/* ───────────────────────────── MANIFESTO ───────────────────────────── */

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
        className="pointer-events-none absolute"
        style={{
          inset: "-50%",
          background:
            "repeating-conic-gradient(from 0deg at 50% 50%, transparent 0 8deg, rgba(124,240,103,.07) 8deg 9deg)",
          animation: "sv-spin-slow 120s linear infinite",
        }}
      />
      <div className="relative mx-auto max-w-[1240px] px-6">
        <div
          className="grid items-end gap-14"
          style={{ gridTemplateColumns: "1fr auto" }}
        >
          <div>
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
                style={{
                  display: "inline-block",
                  width: 34,
                  height: 1,
                  background: "var(--sv-green)",
                }}
              />
              Manifesto · um braço da Kaleidos Digital
            </div>
            <motion.h2
              {...REVEAL}
              className="sv-display"
              style={{
                fontSize: "clamp(32px, 4.3vw, 56px)",
                lineHeight: 1.08,
                letterSpacing: "-0.018em",
                maxWidth: 900,
                fontWeight: 400,
              }}
            >
              Toda semana você grava, escreve, pensa. E toda semana{" "}
              <span className="sv-st">perde horas no Canva</span> tentando virar
              aquilo em post. A Sequência Viral resolve a parte chata:{" "}
              <em style={{ color: "var(--sv-green)" }}>
                transforma o que você já produziu
              </em>{" "}
              em carrossel editorial, com a sua voz{" "}
              <em style={{ color: "var(--sv-green)" }}>e pronto pra postar</em>.
            </motion.h2>
          </div>
          <motion.div
            {...REVEAL}
            className="sv-anim-float-slow"
            style={{
              width: 140,
              aspectRatio: "1/1",
              position: "relative",
              ["--sv-r" as string]: "-4deg",
            } as React.CSSProperties}
          >
            <img
              src={`${BASE_ASSET}/manifest-cutout.png`}
              alt=""
              aria-hidden
              className="h-full w-full object-contain"
              style={{ filter: "invert(1) brightness(1.1) contrast(1.1)" }}
            />
          </motion.div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          #manifesto > div > div { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </section>
  );
}

/* ───────────────────────────── FEATURES (BENTO) ───────────────────────────── */

function Features() {
  return (
    <section id="features" style={{ padding: "96px 0" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="02" sub="Features" tag="Produto">
          Tudo que você precisa.{" "}
          <span style={{ color: "var(--sv-muted)" }}>Nada que não precisa.</span>
        </SectionHead>

        <div
          className="sv-bento grid gap-4"
          style={{
            gridTemplateColumns: "repeat(12, 1fr)",
            gridAutoRows: "minmax(140px, auto)",
          }}
        >
          {/* Big preview card c-7 */}
          <motion.div
            {...REVEAL}
            className="sv-feat sv-card"
            style={{
              gridColumn: "span 7",
              padding: 0,
              background: "var(--sv-green)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <div
              className="relative flex flex-col justify-between"
              style={{ padding: 28 }}
            >
              <div>
                <FeatKicker>Preview real</FeatKicker>
                <FeatTitle>
                  O slide que você vê
                  <br />é o slide que <em>sai</em>.
                </FeatTitle>
                <p style={{ color: "var(--sv-ink)", opacity: 0.75, fontSize: 13.5, lineHeight: 1.55 }}>
                  Tipografia, cores e formato exatos. Sem surpresa no export. Sem
                  "quase igual".
                </p>
              </div>
              <div className="mt-5 flex gap-1">
                {[1, 0.3, 0.3, 0.3].map((o, i) => (
                  <span
                    key={i}
                    style={{
                      width: 14,
                      height: 3,
                      background: "var(--sv-ink)",
                      opacity: o,
                      display: "inline-block",
                    }}
                  />
                ))}
              </div>
              <img
                src={`${BASE_ASSET}/hero-megaphone.png`}
                alt=""
                aria-hidden
                className="sv-anim-float-slow absolute"
                style={
                  {
                    right: -10,
                    bottom: -10,
                    width: 80,
                    opacity: 0.8,
                    ["--sv-r" as string]: "8deg",
                  } as React.CSSProperties
                }
              />
            </div>
            <div
              className="flex flex-col justify-between"
              style={{
                background: "var(--sv-ink)",
                color: "var(--sv-paper)",
                padding: 28,
                borderLeft: "1.5px solid var(--sv-ink)",
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent 0 20px, rgba(124,240,103,.06) 20px 22px)",
              }}
            >
              <FeatMeta>Slide 01 / 04</FeatMeta>
              <h4
                className="sv-display"
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.05,
                }}
              >
                O algoritmo premia consistência,{" "}
                <em style={{ color: "var(--sv-green)" }}>não genialidade.</em>
              </h4>
              <FeatMeta>@sequencia-viral</FeatMeta>
            </div>
          </motion.div>

          {/* Transcrição c-5 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat relative"
            style={{ gridColumn: "span 5" }}
          >
            <span
              className="absolute"
              style={{
                top: 16,
                right: 16,
                padding: "3px 8px",
                background: "var(--sv-pink)",
                border: "1px solid var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                fontSize: 8.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                boxShadow: "2px 2px 0 0 var(--sv-ink)",
              }}
            >
              Novo
            </span>
            <FeatKicker>Transcrição</FeatKicker>
            <FeatTitle>
              <em>Transcreve</em> YouTube e Reels.
            </FeatTitle>
            <FeatBody>
              Cola o link, a IA baixa o áudio, transcreve e transforma em carrossel.
            </FeatBody>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { hue: "#FF0000", label: "youtube.com/watch?v=..." },
                { hue: "#E1306C", label: "instagram.com/reel/..." },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-[10px]"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid var(--sv-ink)",
                    background: "var(--sv-white)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: row.hue,
                    }}
                  />
                  {row.label}
                  <span
                    className="ml-auto"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--sv-green)",
                      border: "1px solid var(--sv-ink)",
                      animation: "sv-pulse 1.6s ease-in-out infinite",
                    }}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Templates c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>Templates</FeatKicker>
            <FeatTitle>
              4 templates <em>editoriais</em>.
            </FeatTitle>
            <FeatBody>
              Twitter, Principal, Futurista, Autoral. Cada um com pegada própria.
            </FeatBody>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { name: "Twitter", bg: "var(--sv-ink)" },
                { name: "Principal", bg: "var(--sv-green)" },
                { name: "Futurista", bg: "var(--sv-pink)" },
                {
                  name: "Autoral",
                  bg: "var(--sv-white)",
                  image:
                    "radial-gradient(circle at 2px 2px, var(--sv-ink) 1px, transparent 1.5px)",
                  size: "8px 8px",
                },
              ].map((tpl) => (
                <div
                  key={tpl.name}
                  style={{
                    border: "1px solid var(--sv-ink)",
                    padding: 8,
                    background: "var(--sv-white)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 8.5,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    boxShadow: "2px 2px 0 0 var(--sv-ink)",
                    transition: "transform 0.2s",
                  }}
                >
                  <div
                    style={{
                      height: 44,
                      border: "1px solid var(--sv-ink)",
                      marginBottom: 6,
                      background: tpl.bg,
                      backgroundImage: tpl.image,
                      backgroundSize: tpl.size,
                    }}
                  />
                  {tpl.name}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Brand voice c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>Brand Voice</FeatKicker>
            <FeatTitle>
              O tom é <em>seu</em>,<br />
              não do ChatGPT.
            </FeatTitle>
            <FeatBody>
              Brand analyzer aprende sua voz dos seus 30 últimos posts.
            </FeatBody>
            <div className="mt-4 flex flex-col gap-2">
              <VoiceBox title="Entrada" body="@meuperfil · 30 posts" />
              <div
                style={{
                  textAlign: "center",
                  fontFamily: "var(--sv-mono)",
                  color: "var(--sv-pink)",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                ↓
              </div>
              <VoiceBox title="Saída" body="Carrossel com o seu tom" highlight />
            </div>
          </motion.div>

          {/* Export c-4 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{ gridColumn: "span 4" }}
          >
            <FeatKicker>Export</FeatKicker>
            <FeatTitle>
              PNG <em>pixel-perfect</em>
              <br />+ PDF deck.
            </FeatTitle>
            <FeatBody>
              1080×1350 pronto pro Instagram. PDF pra enviar pro cliente.
            </FeatBody>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ExportRow fmt="PNG" title="1080×1350" sub="pixel-perfect" />
              <ExportRow fmt="PDF" title="Deck" sub="p/ enviar" ink />
            </div>
          </motion.div>

          {/* Advanced mode c-12 */}
          <motion.div
            {...REVEAL}
            className="sv-card sv-feat"
            style={{
              gridColumn: "span 12",
              display: "grid",
              gridTemplateColumns: "1fr 1.6fr",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div>
              <FeatKicker>Modo avançado</FeatKicker>
              <FeatTitle>
                Quando você quer <em>controle</em> total.
              </FeatTitle>
              <FeatBody>
                Triagem de fontes → 3 headlines → espinha dorsal → copy final. Cada
                etapa editável. Cada palavra sua.
              </FeatBody>
            </div>
            <div className="grid grid-cols-4 gap-[10px]">
              {[
                { n: "01", t: "Triagem", cls: "a1" },
                { n: "02", t: "Headlines", cls: "a2" },
                { n: "03", t: "Espinha", cls: "a3" },
                { n: "04", t: "Copy", cls: "a4" },
              ].map((a) => {
                const style: React.CSSProperties =
                  a.cls === "a1"
                    ? { background: "var(--sv-soft)" }
                    : a.cls === "a2"
                      ? { background: "var(--sv-green)" }
                      : a.cls === "a3"
                        ? {
                            background: "var(--sv-ink)",
                            color: "var(--sv-paper)",
                            boxShadow: "3px 3px 0 0 var(--sv-green)",
                          }
                        : { background: "var(--sv-pink)" };
                const numColor =
                  a.cls === "a1"
                    ? "var(--sv-pink)"
                    : a.cls === "a3"
                      ? "var(--sv-green)"
                      : undefined;
                return (
                  <div
                    key={a.n}
                    style={{
                      border: "1px solid var(--sv-ink)",
                      padding: 14,
                      boxShadow: "3px 3px 0 0 var(--sv-ink)",
                      ...style,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: numColor,
                      }}
                    >
                      {a.n}
                    </span>
                    <div
                      className="sv-display"
                      style={{
                        fontSize: 18,
                        letterSpacing: "-0.015em",
                        marginTop: 4,
                        fontStyle: "italic",
                      }}
                    >
                      {a.t}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          #features .sv-bento { grid-template-columns: 1fr !important; }
          #features .sv-feat { grid-column: auto !important; }
          #features .sv-feat[style*="1fr 1.6fr"] { grid-template-columns: 1fr !important; }
          #features .sv-feat[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function FeatKicker({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-[6px]"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 9.5,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "var(--sv-muted)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          background: "var(--sv-green)",
          border: "1px solid var(--sv-ink)",
          borderRadius: "50%",
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}
function FeatTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="sv-display"
      style={{
        fontSize: 22,
        fontWeight: 400,
        letterSpacing: "-0.015em",
        lineHeight: 1.05,
        margin: "14px 0 8px",
      }}
    >
      {children}
    </h3>
  );
}
function FeatBody({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "var(--sv-muted)",
        fontSize: 13.5,
        lineHeight: 1.55,
      }}
    >
      {children}
    </p>
  );
}
function FeatMeta({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 8.5,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,.4)",
      }}
    >
      {children}
    </span>
  );
}
function VoiceBox({
  title,
  body,
  highlight = false,
}: {
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid var(--sv-ink)",
        background: highlight ? "var(--sv-green)" : "var(--sv-white)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 8.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: highlight ? "var(--sv-ink)" : "var(--sv-muted)",
        }}
      >
        {title}
      </div>
      <p style={{ fontSize: 12, fontWeight: 500, marginTop: 2, color: "var(--sv-ink)" }}>
        {body}
      </p>
    </div>
  );
}
function ExportRow({
  fmt,
  title,
  sub,
  ink = false,
}: {
  fmt: string;
  title: string;
  sub: string;
  ink?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-[10px]"
      style={{
        padding: 10,
        border: "1px solid var(--sv-ink)",
        background: "var(--sv-white)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          border: "1px solid var(--sv-ink)",
          background: ink ? "var(--sv-ink)" : "var(--sv-green)",
          color: ink ? "var(--sv-paper)" : "var(--sv-ink)",
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: "0.06em",
        }}
      >
        {fmt}
      </span>
      <div style={{ lineHeight: 1.2 }}>
        <b
          style={{
            display: "block",
            fontSize: 11.5,
            fontFamily: "var(--sv-mono)",
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </b>
        <span
          style={{
            fontSize: 9,
            color: "var(--sv-muted)",
            fontFamily: "var(--sv-mono)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {sub}
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────── DEMO ───────────────────────────── */

function DemoSection() {
  const targetText = "https://youtube.com/watch?v=carrossel-viral";
  const [typedLen, setTypedLen] = useState(0);
  const [pct, setPct] = useState(92);

  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      if (i <= targetText.length) {
        setTypedLen(i);
        i++;
        timer = setTimeout(tick, 55);
      } else {
        timer = setTimeout(() => {
          i = 0;
          tick();
        }, 4000);
      }
    }
    tick();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setPct((v) => {
        const nv = ((v + 1) % 100);
        return Math.round(60 + Math.abs(Math.sin(nv / 16)) * 40);
      });
    }, 180);
    return () => clearInterval(iv);
  }, []);

  return (
    <section id="demo" style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="03" sub="Demo ao vivo" tag="15 segundos">
          Parece <em>mágica</em>.{" "}
          <span style={{ color: "var(--sv-muted)" }}>É só engenharia boa.</span>
        </SectionHead>

        <div
          className="grid items-start gap-6"
          style={{ gridTemplateColumns: "minmax(0, 0.92fr) minmax(0, 1.08fr)" }}
        >
          <motion.div
            {...REVEAL}
            className="relative overflow-hidden"
            style={{
              background: "var(--sv-white)",
              border: "1.5px solid var(--sv-ink)",
              padding: 22,
              boxShadow: "4px 4px 0 0 var(--sv-ink)",
            }}
          >
            <img
              src={`${BASE_ASSET}/demo-cutout.png`}
              alt=""
              aria-hidden
              className="sv-anim-float absolute"
              style={
                {
                  right: -14,
                  top: -10,
                  width: 86,
                  opacity: 0.7,
                  transform: "rotate(10deg)",
                  ["--sv-r" as string]: "10deg",
                } as React.CSSProperties
              }
            />
            <DemoLabel>01 · Entrada</DemoLabel>
            <div
              className="mt-[10px] flex items-center gap-2"
              style={{
                padding: 11,
                border: "1px solid var(--sv-ink)",
                background: "var(--sv-paper)",
                boxShadow: "2px 2px 0 0 var(--sv-ink)",
              }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--sv-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-2 1.5" />
                <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l2-1.5" />
              </svg>
              <span
                className="flex-1 overflow-hidden whitespace-nowrap"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 11,
                }}
              >
                {targetText.slice(0, typedLen)}
                <span className="sv-cursor" />
              </span>
              <span
                style={{
                  padding: "3px 9px",
                  border: "1px solid var(--sv-ink)",
                  background: "var(--sv-green)",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 8.5,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  boxShadow: "2px 2px 0 0 var(--sv-ink)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--sv-ink)",
                    animation: "sv-pulse 1s infinite",
                  }}
                />
                {typedLen < targetText.length ? "Colando" : "Transcrevendo"}
              </span>
            </div>

            <div
              className="mt-6 pt-5"
              style={{ borderTop: "1px solid var(--sv-ink)" }}
            >
              <DemoLabel className="mb-[14px] block">02 · Processando</DemoLabel>
              <div className="flex flex-col gap-3">
                <ProgressRow label="Transcrevendo" ok pct={100} />
                <ProgressRow label="Identificando ângulos" ok pct={100} />
                <ProgressRow label="Aplicando sua voz" pct={pct} showPct />
              </div>
            </div>
          </motion.div>

          <motion.div {...REVEAL}>
            <DemoLabel className="mb-3 block">03 · Saída</DemoLabel>
            <div className="grid grid-cols-3 gap-3">
              <DemoSlide variant="white" meta="01 · 03" body={<>A IA leu o seu <em>vídeo.</em></>} sub="Transcreveu, resumiu, achou o gancho." />
              <DemoSlide variant="ink" meta="02 · 03" body={<>E achou o <em style={{ color: "var(--sv-green)" }}>ângulo</em> certo.</>} sub="Dados · Narrativa · Provocação." />
              <DemoSlide variant="green" meta="03 · 03" body={<>Com a <em>sua</em> voz.</>} sub="Tom vem dos seus 30 posts." />
            </div>
          </motion.div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          #demo .grid[style*="0.92fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function DemoLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 9.5,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "var(--sv-muted)",
      }}
    >
      {children}
    </span>
  );
}

function ProgressRow({
  label,
  ok = false,
  pct,
  showPct = false,
}: {
  label: string;
  ok?: boolean;
  pct: number;
  showPct?: boolean;
}) {
  return (
    <div>
      <div
        className="flex justify-between"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--sv-ink)" }}>
          {ok ? "✓" : showPct ? `${pct}%` : ""}
        </span>
      </div>
      <div className="sv-progress-bar mt-[5px]">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DemoSlide({
  variant,
  meta,
  body,
  sub,
}: {
  variant: "white" | "ink" | "green";
  meta: string;
  body: React.ReactNode;
  sub: string;
}) {
  const style: React.CSSProperties = (() => {
    switch (variant) {
      case "white":
        return { background: "var(--sv-white)", color: "var(--sv-ink)" };
      case "ink":
        return {
          background: "var(--sv-ink)",
          color: "var(--sv-paper)",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,.09) 1px, transparent 1.5px)",
          backgroundSize: "10px 10px",
        };
      case "green":
        return { background: "var(--sv-green)", color: "var(--sv-ink)" };
    }
  })();
  const metaColor =
    variant === "ink"
      ? "var(--sv-green)"
      : variant === "white"
        ? "var(--sv-muted)"
        : "var(--sv-ink)";
  const subColor =
    variant === "ink" ? "rgba(255,255,255,.7)" : variant === "white" ? "var(--sv-muted)" : "var(--sv-ink)";

  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden"
      style={{
        aspectRatio: "4/5",
        border: "1.5px solid var(--sv-ink)",
        padding: 16,
        boxShadow: "4px 4px 0 0 var(--sv-ink)",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 8.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: metaColor,
        }}
      >
        {meta}
      </span>
      <h4
        className="sv-display"
        style={{
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "-0.015em",
          lineHeight: 1.05,
        }}
      >
        {body}
      </h4>
      <p style={{ fontSize: 10.5, lineHeight: 1.45, color: subColor }}>{sub}</p>
    </div>
  );
}

/* ───────────────────────────── COMPARE ───────────────────────────── */

function Compare() {
  const rows = [
    ["Tempo por carrossel", "~ 15 segundos", "45–60 min", "20 min + edição", "2–3 horas"],
    ["Transcreve YouTube", "✦ Automático", "—", "Copia/cola", "Manual"],
    ["Usa o seu tom", "✦ Brand analyzer", "—", "Com prompt", "✓"],
    ["Export 1080×1350", "✦ 1 clique", "Manual", "—", "Manual"],
    ["Preview real", "✦ WYSIWYG", "✓", "—", "✓"],
    ["Preço (pra postar todo dia)", "US$ 9/mês", "US$ 15/mês", "US$ 20/mês", "Seu tempo"],
  ];

  return (
    <section id="compare" style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="04" sub="Comparativo" tag="Honesto">
          vs Canva. vs ChatGPT. <em>vs fazer na mão.</em>
        </SectionHead>

        <motion.div
          {...REVEAL}
          className="overflow-x-auto"
          style={{
            border: "1.5px solid var(--sv-ink)",
            background: "var(--sv-white)",
            boxShadow: "5px 5px 0 0 var(--sv-ink)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={thStyle()} />
                <th
                  style={{
                    ...thStyle(),
                    background: "var(--sv-green)",
                  }}
                >
                  <em>Sequência Viral</em>
                </th>
                <th style={thStyle()}>Canva</th>
                <th style={thStyle()}>ChatGPT</th>
                <th style={thStyle()}>Manual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => {
                    const isFirst = j === 0;
                    const isSV = j === 1;
                    return (
                      <td
                        key={j}
                        style={{
                          padding: "14px 18px",
                          textAlign: "left",
                          borderBottom:
                            i < rows.length - 1 ? "1px solid var(--sv-ink)" : "none",
                          fontSize: 13,
                          fontFamily: isFirst ? "var(--sv-mono)" : undefined,
                          letterSpacing: isFirst ? "0.16em" : undefined,
                          textTransform: isFirst ? "uppercase" : undefined,
                          color: isFirst ? "var(--sv-muted)" : undefined,
                          fontWeight: isFirst ? 500 : isSV ? 600 : undefined,
                          background: isSV
                            ? "color-mix(in srgb, var(--sv-green) 22%, var(--sv-white))"
                            : undefined,
                        }}
                      >
                        {c}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}

function thStyle(): React.CSSProperties {
  return {
    padding: "14px 18px",
    textAlign: "left",
    borderBottom: "1px solid var(--sv-ink)",
    fontFamily: "var(--sv-display)",
    fontWeight: 400,
    fontSize: 18,
    letterSpacing: "-0.01em",
    background: "var(--sv-soft)",
  };
}

/* ───────────────────────────── GALLERY ───────────────────────────── */

type GSlideVariant = "cream" | "ink" | "green" | "pink" | "dots";

interface GalleryPost {
  av: string;
  avBg: string;
  avColor?: string;
  name: string;
  bio: string;
  niche: string;
  voice: string;
  engagement: { likes: string; saves: string; comments: string };
  main: { variant: GSlideVariant; tag: string; body: React.ReactNode };
  secondaries: { variant: GSlideVariant; tag: string; body: React.ReactNode; dashed?: boolean }[];
}

const GALLERY: GalleryPost[] = [
  {
    av: "A",
    avBg: "var(--sv-green)",
    name: "ana.luizamkt",
    bio: "criadora · marketing",
    niche: "Marketing",
    voice: "Sua voz",
    engagement: { likes: "4.213", saves: "187", comments: "62" },
    main: {
      variant: "cream",
      tag: "01 / 05",
      body: (
        <>
          A repetição é a <em>nova</em> originalidade.
        </>
      ),
    },
    secondaries: [
      { variant: "ink", tag: "02", body: <>Algoritmo premia <em>frequência</em>, não genialidade.</> },
      { variant: "green", tag: "03", body: <>Um recorte. <em>100</em> formatos.</> },
      { variant: "cream", tag: "04", body: <>Insistir é o novo <em>criar</em>.</>, dashed: true },
    ],
  },
  {
    av: "P",
    avBg: "var(--sv-pink)",
    name: "pedroaugusto.tech",
    bio: "dev · ensina IA pra iniciantes",
    niche: "Tech",
    voice: "Vibe dev",
    engagement: { likes: "8.901", saves: "512", comments: "148" },
    main: {
      variant: "ink",
      tag: "01 / 06",
      body: (
        <>
          O código <em>vai</em> quebrar.
          <br />E tá tudo bem.
        </>
      ),
    },
    secondaries: [
      { variant: "cream", tag: "02", body: <>Bugs não são falha. São <em>feedback</em>.</> },
      { variant: "dots", tag: "03", body: <>IA não substitui quem <em>debuga</em>.</> },
      { variant: "pink", tag: "04", body: <>Ship. Quebre. <em>Repita.</em></> },
    ],
  },
  {
    av: "C",
    avBg: "var(--sv-ink)",
    avColor: "var(--sv-paper)",
    name: "carol.financas",
    bio: "finanças pessoais · 15k seguidores",
    niche: "Finanças",
    voice: "Didático",
    engagement: { likes: "12,4k", saves: "2,1k", comments: "304" },
    main: {
      variant: "green",
      tag: "01 / 07",
      body: (
        <>
          Ganhar R$ 10k não é sobre <em>renda</em>.
          <br />É sobre hábito.
        </>
      ),
    },
    secondaries: [
      { variant: "ink", tag: "02", body: <>Gastar pouco é fácil. <em>Gastar bem</em> é raro.</> },
      { variant: "cream", tag: "03", body: <>Seu 13º não é presente. É <em>salário</em>.</> },
      { variant: "green", tag: "04", body: <>Investir começa com <em>R$ 30</em>.</> },
    ],
  },
  {
    av: "K",
    avBg: "var(--sv-pink)",
    name: "atelier.kaleidos",
    bio: "design studio · ensaios visuais",
    niche: "Design",
    voice: "Editorial",
    engagement: { likes: "3.872", saves: "641", comments: "89" },
    main: {
      variant: "pink",
      tag: "01 / 04",
      body: (
        <>
          Design não é decoração.
          <br />É <em>decisão</em>.
        </>
      ),
    },
    secondaries: [
      { variant: "cream", tag: "02", body: <>Cada pixel <em>responde</em> alguém.</> },
      { variant: "ink", tag: "03", body: <>Bonito sem porquê é <em>ruído</em>.</> },
      { variant: "dots", tag: "04", body: <>Forma serve a <em>função</em>.</> },
    ],
  },
];

function Gallery() {
  return (
    <section style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="05" sub="Feed real" tag="Creators reais">
          Carrosséis que já <em>saíram</em>{" "}
          <span style={{ color: "var(--sv-muted)" }}>do app.</span>
        </SectionHead>

        <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
          {GALLERY.map((p) => (
            <motion.article key={p.name} {...REVEAL} className="flex flex-col gap-3">
              <div
                className="flex items-center gap-[10px]"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--sv-ink)",
                }}
              >
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: p.avBg,
                    color: p.avColor ?? "var(--sv-ink)",
                    border: "1px solid var(--sv-ink)",
                    fontFamily: "var(--sv-display)",
                    fontStyle: "italic",
                    fontSize: 14,
                  }}
                >
                  {p.av}
                </span>
                <span className="flex flex-1 flex-col gap-[2px]">
                  <b style={{ fontWeight: 500, letterSpacing: "0.12em" }}>{p.name}</b>
                  <span style={{ opacity: 0.6, fontSize: 8.5 }}>{p.bio}</span>
                </span>
                <span
                  style={{
                    padding: "3px 8px",
                    border: "1px solid var(--sv-ink)",
                    fontSize: 8.5,
                  }}
                >
                  {p.niche}
                </span>
              </div>

              <div
                className="grid items-stretch gap-[6px]"
                style={{
                  gridTemplateColumns: "1.2fr .8fr .8fr .8fr",
                }}
              >
                <GallerySlide main tag={p.main.tag} variant={p.main.variant} user={p.name}>
                  {p.main.body}
                </GallerySlide>
                {p.secondaries.map((s, i) => (
                  <GallerySlide
                    key={i}
                    tag={s.tag}
                    variant={s.variant}
                    dashed={s.dashed}
                  >
                    {s.body}
                  </GallerySlide>
                ))}
              </div>

              <div
                className="flex items-center justify-between pt-1"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                <span>{p.voice}</span>
                <div className="flex items-baseline gap-[14px]">
                  {[
                    { k: "likes", v: p.engagement.likes },
                    { k: "salvos", v: p.engagement.saves },
                    { k: "coment", v: p.engagement.comments },
                  ].map((s) => (
                    <span key={s.k}>
                      <b
                        style={{
                          fontFamily: "var(--sv-display)",
                          fontStyle: "italic",
                          fontWeight: 500,
                          fontSize: 15,
                          letterSpacing: "-0.015em",
                          textTransform: "none",
                        }}
                      >
                        {s.v}
                      </b>{" "}
                      <span style={{ opacity: 0.6 }}>{s.k}</span>
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function GallerySlide({
  variant,
  tag,
  user,
  main = false,
  dashed = false,
  children,
}: {
  variant: GSlideVariant;
  tag: string;
  user?: string;
  main?: boolean;
  dashed?: boolean;
  children: React.ReactNode;
}) {
  const bg: React.CSSProperties = (() => {
    switch (variant) {
      case "cream":
        return { background: "var(--sv-white)", color: "var(--sv-ink)" };
      case "ink":
        return { background: "var(--sv-ink)", color: "var(--sv-paper)" };
      case "green":
        return { background: "var(--sv-green)", color: "var(--sv-ink)" };
      case "pink":
        return { background: "var(--sv-pink)", color: "var(--sv-ink)" };
      case "dots":
        return {
          background: "var(--sv-white)",
          color: "var(--sv-ink)",
          backgroundImage:
            "radial-gradient(circle at 2px 2px, var(--sv-ink) 1px, transparent 1.5px)",
          backgroundSize: "8px 8px",
        };
    }
  })();

  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden"
      style={{
        border: `1.5px ${dashed ? "dashed" : "solid"} var(--sv-ink)`,
        padding: main ? "14px 12px 12px" : "10px 8px 8px",
        aspectRatio: "4/5",
        minHeight: 0,
        ...bg,
      }}
    >
      <span
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: main ? 7.5 : 7,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          opacity: variant === "ink" ? 0.6 : 0.65,
        }}
      >
        {tag}
      </span>
      <h5
        className="sv-display"
        style={{
          fontSize: main ? 17 : 11.5,
          fontWeight: 400,
          lineHeight: 1.08,
          letterSpacing: "-0.015em",
        }}
      >
        {children}
      </h5>
      {main && user && (
        <div
          className="flex justify-between"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 7.5,
            letterSpacing: "0.2em",
            opacity: 0.6,
            textTransform: "uppercase",
          }}
        >
          <span>@{user}</span>
          <span>✱</span>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── PRICING ───────────────────────────── */

function Pricing() {
  return (
    <section id="pricing" style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="06" sub="Pricing" tag="−50% no lançamento">
          Preço <em>honesto</em>.{" "}
          <span style={{ color: "var(--sv-muted)" }}>Cancele quando quiser.</span>
        </SectionHead>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          <PlanCard
            ribbon="Pra experimentar"
            ribbonVariant="free"
            title="Grátis"
            price="US$ 0"
            unit=""
            features={[
              "5 carrosséis/mês",
              "Export PNG em alta",
              "Modo rápido + avançado",
              "4 templates editoriais",
              "1 perfil de marca",
            ]}
            cta="Começar agora"
            ctaHref="/app/login"
            ctaVariant="outline"
          />
          <PlanCard
            featured
            ribbon="Mais popular"
            ribbonVariant="pro"
            tag="−50% no lançamento"
            title="Pro"
            price="US$ 9"
            unit="/mês"
            anchor="US$ 18,00"
            features={[
              "30 carrosséis/mês",
              "Brand voice analyzer",
              "Export PNG + PDF",
              "3 perfis de marca",
              "Transcrição de vídeos",
              "Histórico completo",
            ]}
            cta="Assinar Pro →"
            ctaHref="/app/checkout?plan=pro"
            ctaVariant="primary"
          />
          <PlanCard
            ribbon="Pra times"
            ribbonVariant="biz"
            title="Business"
            price="US$ 23"
            unit="/mês"
            anchor="US$ 39,00"
            features={[
              "100 carrosséis/mês",
              "10 perfis de marca",
              "Workspace compartilhado",
              "Templates customizados",
              "Suporte prioritário",
              "API (em breve)",
            ]}
            cta="Assinar Business"
            ctaHref="/app/checkout?plan=business"
            ctaVariant="outline"
          />
        </div>
      </div>
    </section>
  );
}

function PlanCard({
  ribbon,
  ribbonVariant,
  tag,
  title,
  price,
  unit,
  anchor,
  features,
  cta,
  ctaHref,
  ctaVariant,
  featured = false,
}: {
  ribbon: string;
  ribbonVariant: "free" | "pro" | "biz";
  tag?: string;
  title: string;
  price: string;
  unit: string;
  anchor?: string;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaVariant: "primary" | "outline";
  featured?: boolean;
}) {
  const ribbonBg =
    ribbonVariant === "free"
      ? "transparent"
      : ribbonVariant === "pro"
        ? "var(--sv-green)"
        : "var(--sv-pink)";
  const ribbonBorder =
    ribbonVariant === "free"
      ? "var(--sv-line)"
      : featured
        ? "var(--sv-green)"
        : "var(--sv-ink)";
  const ribbonColor =
    ribbonVariant === "free"
      ? "var(--sv-muted)"
      : featured && ribbonVariant === "pro"
        ? "var(--sv-green)"
        : "var(--sv-ink)";

  return (
    <motion.article
      {...REVEAL}
      className="relative flex flex-col gap-[14px]"
      style={{
        background: featured ? "var(--sv-ink)" : "var(--sv-white)",
        color: featured ? "var(--sv-paper)" : "var(--sv-ink)",
        border: "1.5px solid var(--sv-ink)",
        padding: 28,
        boxShadow: featured ? "5px 5px 0 0 var(--sv-green)" : "5px 5px 0 0 var(--sv-ink)",
        transform: featured ? "translateY(-8px)" : undefined,
        transition: "transform .25s, box-shadow .25s",
      }}
    >
      <span
        className="self-start"
        style={{
          padding: "4px 10px",
          border: `1px solid ${ribbonBorder}`,
          background: featured && ribbonVariant === "pro" ? "transparent" : ribbonBg,
          color: ribbonColor,
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {ribbon}
      </span>
      {tag && (
        <span
          className="self-start"
          style={{
            padding: "3px 9px",
            background: featured ? "var(--sv-green)" : "var(--sv-pink)",
            color: "var(--sv-ink)",
            border: featured ? "1px solid var(--sv-green)" : "1px solid var(--sv-ink)",
            fontFamily: "var(--sv-mono)",
            fontSize: 8.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            boxShadow: featured ? "2px 2px 0 0 var(--sv-paper)" : "2px 2px 0 0 var(--sv-ink)",
          }}
        >
          {tag}
        </span>
      )}
      <h3
        className="sv-display"
        style={{
          fontSize: 32,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 0.95,
          fontStyle: "italic",
        }}
      >
        {title}
      </h3>
      <div>
        {anchor && (
          <span
            className="block"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              textDecoration: "line-through",
              color: "var(--sv-muted)",
            }}
          >
            {anchor}
          </span>
        )}
        <div className="flex items-baseline gap-[6px]">
          <span
            className="sv-display"
            style={{ fontSize: 44, letterSpacing: "-0.025em", lineHeight: 1 }}
          >
            {price}
          </span>
          {unit && (
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: featured ? "rgba(255,255,255,.6)" : "var(--sv-muted)",
              }}
            >
              {unit}
            </span>
          )}
        </div>
      </div>
      <ul className="flex flex-col gap-2" style={{ fontSize: 13 }}>
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span style={{ color: "var(--sv-green)", flexShrink: 0 }}>✦</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`sv-btn sv-btn-${ctaVariant === "primary" ? "primary" : "outline"} mt-auto`}
      >
        {cta}
      </Link>
    </motion.article>
  );
}

/* ───────────────────────────── TESTIMONIALS ───────────────────────────── */

function Testimonials() {
  const tweets = [
    {
      av: "A",
      avClass: "",
      name: "Ana Luiza",
      handle: "@analuizamkt",
      body: (
        <>
          Testei 6 ferramentas de carrossel com IA.{" "}
          <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
            Sequência Viral é a única que não devolve copy cheirando a ChatGPT.
          </b>{" "}
          Finalmente saio do feed sem parecer template.
        </>
      ),
    },
    {
      av: "P",
      avClass: "pink",
      name: "Pedro Augusto",
      handle: "@pedroaugustotech",
      body: (
        <>
          Cola o link do YouTube, recebe 3 variações em 20s. Eu ainda levo mais
          tempo abrindo o Canva{" "}
          <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
            que publicando daqui
          </b>
          .
        </>
      ),
    },
    {
      av: "C",
      avClass: "ink",
      name: "Carol Finanças",
      handle: "@carolfinancas",
      body: (
        <>
          Uso pra virar episódio de podcast em carrossel.{" "}
          <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
            Antes: 2h manual. Agora: 5 minutos.
          </b>{" "}
          Passei de 3 pra 12 posts por mês sem contratar ninguém.
        </>
      ),
    },
  ];

  return (
    <section style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="07" sub="Quem usa" tag="Social proof">
          Creators e agências <em>BR</em>.{" "}
          <span style={{ color: "var(--sv-muted)" }}>
            Gente que posta pra caramba.
          </span>
        </SectionHead>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tweets.map((t) => {
            const avBg =
              t.avClass === "pink"
                ? "var(--sv-pink)"
                : t.avClass === "ink"
                  ? "var(--sv-ink)"
                  : "var(--sv-green)";
            const avColor = t.avClass === "ink" ? "var(--sv-paper)" : "var(--sv-ink)";
            return (
              <motion.article
                key={t.handle}
                {...REVEAL}
                className="flex flex-col gap-3"
                style={{
                  background: "var(--sv-white)",
                  border: "1.5px solid var(--sv-ink)",
                  padding: 22,
                  boxShadow: "4px 4px 0 0 var(--sv-ink)",
                }}
              >
                <div className="flex items-center gap-[10px]">
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "1px solid var(--sv-ink)",
                      background: avBg,
                      color: avColor,
                      fontFamily: "var(--sv-display)",
                      fontSize: 16,
                      fontStyle: "italic",
                      fontWeight: 400,
                    }}
                  >
                    {t.av}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 10,
                        letterSpacing: "0.1em",
                        color: "var(--sv-muted)",
                      }}
                    >
                      {t.handle}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.5 }}>{t.body}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── FAQ ───────────────────────────── */

const FAQ_ITEMS: { q: React.ReactNode; a: React.ReactNode }[] = [
  {
    q: (
      <>
        A IA <em>inventa</em> coisas no carrossel?
      </>
    ),
    a: "Não. A IA trabalha exclusivamente em cima da fonte que você colou: transcrição de vídeo, artigo ou sua nota. Se não estiver na fonte, não entra no carrossel. Nada de alucinação.",
  },
  {
    q: (
      <>
        Como o brand voice aprende <em>meu tom</em>?
      </>
    ),
    a: "Você cola o @ do seu perfil, a gente puxa seus últimos 30 posts e extrai padrões: vocabulário, ritmo, tipo de abertura, uso de emojis e provocações. Cada carrossel é gerado com esse perfil como restrição de estilo.",
  },
  {
    q: (
      <>
        Posso <em>cancelar</em> quando quiser?
      </>
    ),
    a: "Sem fidelidade. Cancela pelo painel em 2 cliques. Se cancelar no mesmo mês que assinou, a gente devolve integral, sem perguntar.",
  },
  {
    q: (
      <>
        Funciona com qualquer <em>canal</em> do YouTube?
      </>
    ),
    a: "Qualquer vídeo público com áudio audível. Transcrevemos em português, inglês e espanhol. Vídeos acima de 2h podem levar alguns minutos extras.",
  },
  {
    q: (
      <>
        Os carrosséis podem ser <em>editados</em> depois?
      </>
    ),
    a: "Sim, tudo é editável inline: texto, tamanho da fonte, cor, template, ordem dos slides. Você pode reutilizar um carrossel antigo como base pra um novo.",
  },
  {
    q: (
      <>
        Quem tá por <em>trás</em> do Sequência Viral?
      </>
    ),
    a: (
      <>
        Sequência Viral é um produto da <b>Kaleidos Digital</b>, agência de
        marketing de conteúdo que nasceu com a missão de provar que comunicação
        autêntica vence template.
      </>
    ),
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section id="faq" style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="08" sub="FAQ" tag="Respostas rápidas">
          Perguntas <em>antes</em> de pagar.
        </SectionHead>

        <div
          className="flex flex-col"
          style={{
            maxWidth: 880,
            borderTop: "1.5px solid var(--sv-ink)",
            borderBottom: "1.5px solid var(--sv-ink)",
          }}
        >
          {FAQ_ITEMS.map((item, i) => {
            const open = openIdx === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpenIdx(open ? -1 : i)}
                className="w-full cursor-pointer text-left"
                style={{
                  padding: "22px 0",
                  borderBottom:
                    i < FAQ_ITEMS.length - 1 ? "1px solid var(--sv-ink)" : "none",
                  background: "transparent",
                }}
              >
                <div
                  className="flex items-center justify-between gap-5"
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 22,
                    fontWeight: 400,
                    letterSpacing: "-0.012em",
                    lineHeight: 1.25,
                  }}
                >
                  <span className="flex-1">{item.q}</span>
                  <span
                    className="inline-flex flex-shrink-0 items-center justify-center"
                    style={{
                      width: 28,
                      height: 28,
                      border: "1px solid var(--sv-ink)",
                      fontFamily: "var(--sv-mono)",
                      fontSize: 16,
                      lineHeight: 1,
                      background: open ? "var(--sv-green)" : "transparent",
                      transform: open ? "rotate(45deg)" : undefined,
                      transition: "background .2s, transform .3s",
                    }}
                  >
                    +
                  </span>
                </div>
                <motion.div
                  initial={false}
                  animate={{ maxHeight: open ? 500 : 0, marginTop: open ? 12 : 0 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    overflow: "hidden",
                    color: "var(--sv-muted)",
                    fontSize: 14,
                    lineHeight: 1.6,
                    paddingRight: 48,
                  }}
                >
                  <div>{item.a}</div>
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── FINAL CTA ───────────────────────────── */

function FinalCTA() {
  const { isLoggedIn } = useLandingSession();
  const primaryHref = isLoggedIn ? "/app" : "/app/login";
  const primaryLabel = isLoggedIn ? "Ir pro app →" : "Criar carrossel grátis →";

  return (
    <section
      className="relative overflow-hidden text-center"
      style={{
        background: "var(--sv-ink)",
        color: "var(--sv-paper)",
        padding: "108px 0",
        borderTop: "1px solid var(--sv-ink)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          inset: "-20%",
          background:
            "repeating-conic-gradient(from 45deg at 50% 50%, transparent 0 6deg, rgba(124,240,103,.09) 6deg 7deg)",
          animation: "sv-spin-slow 180s linear infinite",
        }}
      />
      <img
        src={`${BASE_ASSET}/hero-megaphone.png`}
        alt=""
        aria-hidden
        className="sv-anim-float-slow absolute"
        style={
          {
            top: 40,
            right: "7%",
            width: 120,
            filter: "invert(1) brightness(1.1)",
            opacity: 0.85,
            ["--sv-r" as string]: "-8deg",
          } as React.CSSProperties
        }
      />
      <img
        src={`${BASE_ASSET}/step-typewriter.png`}
        alt=""
        aria-hidden
        className="sv-anim-float absolute"
        style={
          {
            bottom: 30,
            left: "6%",
            width: 100,
            filter: "invert(1) brightness(1.1)",
            opacity: 0.85,
            ["--sv-r" as string]: "14deg",
          } as React.CSSProperties
        }
      />
      <img
        src={`${BASE_ASSET}/star-lg.png`}
        alt=""
        aria-hidden
        className="sv-anim-spin-med pointer-events-none absolute"
        style={{ top: "18%", left: "12%", width: 48 }}
      />

      <div className="relative mx-auto max-w-[1240px] px-6">
        <span
          className="inline-flex items-center gap-2"
          style={{
            padding: "5px 12px",
            border: "1px solid rgba(245,243,236,.25)",
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(245,243,236,.7)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--sv-green)",
              animation: "sv-pulse 1.5s infinite",
            }}
          />
          Pronto pro primeiro post?
        </span>
        <h2
          className="relative mt-5"
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: "clamp(40px, 5.6vw, 80px)",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            fontWeight: 400,
          }}
        >
          Seu primeiro carrossel
          <br />
          <em style={{ color: "var(--sv-green)" }}>em 30 segundos.</em>
        </h2>
        <p
          className="relative"
          style={{
            margin: "20px auto 0",
            maxWidth: 500,
            fontSize: 15,
            color: "rgba(245,243,236,.7)",
          }}
        >
          Cole um link, um texto ou uma ideia. A IA faz o resto, com a sua voz.
        </p>
        <div className="relative mt-7 flex flex-wrap justify-center gap-[10px]">
          <Link
            href={primaryHref}
            className="sv-btn sv-btn-primary"
            style={{ padding: "14px 22px", fontSize: 11.5 }}
          >
            {primaryLabel}
          </Link>
          <Link
            href="/roadmap"
            className="sv-btn"
            style={{
              padding: "14px 22px",
              fontSize: 11.5,
              background: "transparent",
              color: "var(--sv-paper)",
              borderColor: "var(--sv-paper)",
            }}
          >
            Ver roadmap
          </Link>
        </div>
        <div
          className="relative mt-6 flex flex-wrap justify-center gap-[22px]"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(245,243,236,.45)",
          }}
        >
          <span>✦ Sem cartão</span>
          <span>✦ 5 carrosséis grátis</span>
          <span>✦ Cancele quando quiser</span>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── FOOTER ───────────────────────────── */

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
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr" }}
        >
          <div>
            <div className="mb-[14px] flex items-center gap-[10px]">
              <span
                className="sv-anim-float-slow inline-flex h-[36px] w-[36px] items-center justify-center rounded-full"
                style={{
                  border: "1.5px solid var(--sv-ink)",
                  background: "var(--sv-green)",
                }}
                aria-hidden
              >
                <span
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontStyle: "italic",
                    fontSize: 16,
                    color: "var(--sv-ink)",
                    lineHeight: 1,
                  }}
                >
                  SV
                </span>
              </span>
              <span
                className="sv-display"
                style={{ fontSize: 18, letterSpacing: "-0.01em" }}
              >
                Sequência <em>Viral</em>
              </span>
            </div>
            <p
              style={{
                maxWidth: 300,
                color: "var(--sv-muted)",
                fontSize: 12.5,
              }}
            >
              Cole um link. Publique um carrossel. Em minutos, não em horas. Um
              braço da Kaleidos Digital.
            </p>
          </div>
          <FooterCol
            title="Produto"
            links={[
              { label: "Criar carrossel", href: "/app/login" },
              { label: "Pricing", href: "#pricing" },
              { label: "Roadmap", href: "/roadmap" },
              { label: "Blog", href: "/blog" },
            ]}
          />
          <FooterCol
            title="Kaleidos"
            links={[
              { label: "Agência", href: "https://kaleidos.ag" },
              { label: "Cases", href: "https://kaleidos.ag" },
              { label: "Manifesto", href: "#manifesto" },
              {
                label: "Contato",
                href: "mailto:madureira@kaleidosdigital.com",
              },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Privacidade", href: "/privacy" },
              { label: "Termos", href: "/terms" },
              {
                label: "Contato",
                href: "mailto:madureira@kaleidosdigital.com",
              },
            ]}
          />
        </div>

        <div
          className="mt-11 flex flex-wrap justify-between gap-3 pt-5"
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
          <span className="flex items-center gap-[10px]">
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Feito por
            </span>
            <a
              href="https://kaleidos.ag"
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "var(--sv-display)",
                textTransform: "none",
                letterSpacing: "-0.01em",
                fontSize: 13,
                fontStyle: "italic",
                color: "var(--sv-ink)",
              }}
            >
              Kaleidos Digital
            </a>
          </span>
        </div>
      </div>
      <style>{`
        @media (max-width: 700px) {
          footer > div > div:first-of-type { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
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
        {links.map((l) => {
          const external = l.href.startsWith("http") || l.href.startsWith("mailto:");
          const Comp: React.ElementType = external ? "a" : Link;
          const extraProps = external
            ? { href: l.href, target: l.href.startsWith("http") ? "_blank" : undefined, rel: "noreferrer" }
            : { href: l.href };
          return (
            <li key={l.label}>
              <Comp
                {...extraProps}
                className="transition-colors hover:bg-[var(--sv-green)]"
              >
                {l.label}
              </Comp>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────────────────────────── PAGE ───────────────────────────── */

export default function HomePage() {
  return (
    <main
      style={{
        background: "var(--sv-paper)",
        color: "var(--sv-ink)",
        fontFamily: "var(--sv-sans)",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <TopNav />
      <Hero />
      <Ticker />
      <HowItWorks />
      <Manifesto />
      <Features />
      <DemoSection />
      <Compare />
      <Gallery />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
