"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLandingSession } from "@/lib/use-landing-session";
import { BASE_ASSET, REVEAL } from "./shared";

/**
 * Briefs simulados — a IA "escuta" o usuário digitando um pedido direto.
 * Passa a sensação de algo recente e vivo (não preenchimento de template).
 */
const TYPE_BRIEFS: string[] = [
  "faz um post sobre o novo algoritmo do Instagram...",
  "carrossel sobre por que ninguém salva meus posts...",
  "3 hooks pro meu reel sobre produtividade real...",
  "quebra esse artigo do Bloomberg em 8 slides...",
];

function PhoneMockup() {
  // Typewriter state: qual brief, quantos chars, e fase (digitando / pausa / apagando).
  const [briefIdx, setBriefIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "hold" | "deleting">("typing");

  useEffect(() => {
    const current = TYPE_BRIEFS[briefIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (typed.length < current.length) {
        timeout = setTimeout(() => setTyped(current.slice(0, typed.length + 1)), 42);
      } else {
        timeout = setTimeout(() => setPhase("hold"), 1400);
      }
    } else if (phase === "hold") {
      timeout = setTimeout(() => setPhase("deleting"), 1100);
    } else if (phase === "deleting") {
      if (typed.length > 0) {
        timeout = setTimeout(() => setTyped(current.slice(0, typed.length - 1)), 18);
      } else {
        setBriefIdx((v) => (v + 1) % TYPE_BRIEFS.length);
        setPhase("typing");
      }
    }

    return () => clearTimeout(timeout);
  }, [typed, phase, briefIdx]);

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
          background: "var(--sv-paper)",
          color: "var(--sv-ink)",
          padding: "28px 16px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Header mock do app */}
        <div
          className="flex items-center justify-between"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 7.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--sv-pink)",
                marginRight: 5,
                verticalAlign: "middle",
                animation: "sv-pulse 1.4s ease-in-out infinite",
              }}
            />
            Sequência Viral
          </span>
          <span>Novo</span>
        </div>

        {/* Label "Brief" */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 7.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
              marginBottom: 8,
            }}
          >
            Seu brief
          </span>

          {/* Textarea mock com typewriter */}
          <div
            style={{
              minHeight: 90,
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-white)",
              padding: "10px 11px",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
              fontFamily: "var(--sv-sans)",
              fontSize: 11.5,
              lineHeight: 1.42,
              color: "var(--sv-ink)",
              position: "relative",
            }}
          >
            {typed}
            <span
              className="sv-cursor"
              style={{ marginLeft: 1, verticalAlign: "-1px" }}
            />
          </div>

          {/* Tag platform + CTA mock */}
          <div
            className="mt-2 flex items-center justify-between gap-2"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 7.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                padding: "3px 7px",
                border: "1px solid var(--sv-ink)",
                background: "var(--sv-green)",
                boxShadow: "1.5px 1.5px 0 0 var(--sv-ink)",
              }}
            >
              Instagram
            </span>
            <span
              style={{
                padding: "3px 7px",
                border: "1px solid var(--sv-ink)",
                background: "var(--sv-ink)",
                color: "var(--sv-paper)",
                boxShadow: "1.5px 1.5px 0 0 var(--sv-ink)",
              }}
            >
              Gerar →
            </span>
          </div>
        </div>

        {/* Status barra inferior */}
        <div
          className="flex items-center justify-between"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 7,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
            paddingTop: 6,
            borderTop: "1px solid rgba(10,10,10,.12)",
          }}
        >
          <span>
            {phase === "typing" ? "Digitando" : phase === "hold" ? "Pronto" : "Limpando"}
          </span>
          <span>~60s</span>
        </div>
      </div>
    </div>
  );
}

export interface HeroProps {
  /** Texto do eyebrow (topo). Default: "YouTube · Reels · Blog · Ideia". */
  eyebrow?: string;
  /** H1 custom — se passado, sobrescreve o 3-linhas default. Aceita ReactNode. */
  h1?: React.ReactNode;
  /** Parágrafo de descrição. Aceita ReactNode. */
  subtitle?: React.ReactNode;
  /** Label do CTA principal quando user não logado. Default: "Criar primeiro grátis". */
  primaryCtaLabel?: string;
  /** Badge decorativo topo-direito. Default: "✦ Em 60 seg". */
  topBadge?: string;
  /** Badge decorativo canto-esquerdo-baixo. Default: "Seu conteúdo · seu ritmo". */
  bottomBadge?: string;
  /** 3 itens de trust pills (abaixo dos CTAs). */
  trustPills?: [string, string, string];
}

export function Hero(props: HeroProps = {}) {
  const {
    eyebrow = "De ideia a post em 1 minuto",
    h1,
    subtitle,
    primaryCtaLabel,
    topBadge = "✦ Em 60 seg",
    bottomBadge = "Seu conteúdo · seu ritmo",
    trustPills,
  } = props;
  const { isLoggedIn } = useLandingSession();
  const primaryHref = isLoggedIn ? "/app" : "/app/login";
  const primaryLabel = isLoggedIn
    ? "Ir pro app →"
    : primaryCtaLabel || "Criar primeiro grátis";

  return (
    <header
      className="sv-hero relative overflow-hidden"
      style={{ padding: "clamp(28px, 4.2vw, 56px) 0 clamp(16px, 3vw, 40px)" }}
    >
      <style>{`
        @media (max-width: 860px) {
          .sv-hero .sv-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          .sv-hero .sv-hero-visual {
            max-width: 420px !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
      <div
        className="sv-hero-grid mx-auto grid max-w-[1240px] items-center gap-10 px-6"
        style={{
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
        }}
      >
        <motion.div {...REVEAL}>
          <span className="sv-eyebrow">
            <span className="sv-dot" />
            {eyebrow}
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
            {h1 ?? (
              <>
                <span className="block">
                  <em><span className="sv-splash">Carrossel pronto</span></em>
                </span>
                <span className="block">
                  antes do <span className="sv-under">café</span> esfriar.
                </span>
              </>
            )}
          </h1>

          <p
            className="mt-[22px]"
            style={{
              fontSize: 14.5,
              lineHeight: 1.55,
              color: "var(--sv-muted)",
              maxWidth: 460,
            }}
          >
            {subtitle ?? (
              <>
                Cola o link, escolhe o template, gera. A IA escreve{" "}
                <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>no seu tom</b>,
                monta os slides e deixa tudo pronto pra postar — em{" "}
                <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
                  menos tempo do que você levaria pra abrir o Canva
                </b>
                .
              </>
            )}
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
            {(trustPills ?? ["Sem cartão", "5 carrosséis grátis", "Pronto pra postar"]).map(
              (pill, i) => (
                <span key={i}>
                  <span style={{ color: "var(--sv-pink)", marginRight: 4 }}>✦</span>
                  {pill}
                </span>
              )
            )}
          </div>
        </motion.div>

        <motion.div
          {...REVEAL}
          className="sv-hero-visual relative mx-auto w-full"
          style={{
            maxWidth: 520,
            aspectRatio: "1 / 1.02",
          }}
        >
          <img
            src={`${BASE_ASSET}/hero-mandala.png`}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="sv-anim-spin-slow pointer-events-none absolute"
            style={{ top: "8%", left: "8%", width: "28%", opacity: 0.12, zIndex: 1 }}
          />

          <img
            src={`${BASE_ASSET}/hero-mouth.png`}
            alt=""
            aria-hidden
            decoding="async"
            fetchPriority="high"
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
            loading="lazy"
            decoding="async"
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
            loading="lazy"
            decoding="async"
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
            loading="lazy"
            decoding="async"
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
            loading="lazy"
            decoding="async"
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
            loading="lazy"
            decoding="async"
            className="sv-anim-spin-med pointer-events-none absolute"
            style={{ top: "10%", left: "42%", width: 40, zIndex: 7 }}
          />
          <img
            src={`${BASE_ASSET}/star-sm.png`}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
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
            {topBadge}
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
            {bottomBadge}
          </span>
        </motion.div>
      </div>

    </header>
  );
}
