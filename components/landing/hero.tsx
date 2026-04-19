"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLandingSession } from "@/lib/use-landing-session";
import { BASE_ASSET, REVEAL } from "./shared";

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

export function Hero() {
  const { isLoggedIn } = useLandingSession();
  const primaryHref = isLoggedIn ? "/app" : "/app/login";
  const primaryLabel = isLoggedIn ? "Ir pro app →" : "Criar primeiro grátis";

  return (
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
            A IA lê sua fonte e devolve um carrossel editorial{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>com a sua voz</b>
            , com imagens contextuais na sua estética. Não é template.
            Não é ChatGPT cheiroso. É uma ferramenta que entende que{" "}
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
              href="#exemplos"
              className="sv-btn sv-btn-outline"
              style={{ padding: "14px 22px", fontSize: 11.5 }}
            >
              Ver exemplos reais
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
          <img
            src={`${BASE_ASSET}/hero-mandala.png`}
            alt=""
            aria-hidden
            className="sv-anim-spin-slow pointer-events-none absolute"
            style={{ top: "8%", left: "8%", width: "28%", opacity: 0.12, zIndex: 1 }}
          />

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
