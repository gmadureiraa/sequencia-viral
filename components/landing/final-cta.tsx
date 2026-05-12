"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLandingSession } from "@/lib/use-landing-session";
import { BASE_ASSET } from "./shared";

export interface FinalCTAProps {
  eyebrow?: string;
  heading?: React.ReactNode;
  subtitle?: React.ReactNode;
  primaryCtaLabel?: string;
}

export function FinalCTA(props: FinalCTAProps = {}) {
  const {
    eyebrow = "Pronto pro primeiro post?",
    heading,
    subtitle,
    primaryCtaLabel,
  } = props;
  const { isLoggedIn } = useLandingSession();
  const primaryHref = isLoggedIn ? "/app" : "/app/login?mode=signup";
  const primaryLabel = isLoggedIn
    ? "Ir pro app →"
    : primaryCtaLabel || "Criar carrossel grátis →";

  return (
    <section
      className="relative overflow-hidden text-center"
      style={{
        background: "var(--sv-ink)",
        color: "var(--sv-paper)",
        padding: "clamp(64px, 12vw, 108px) 0",
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
        src={`${BASE_ASSET}/hero-megaphone.webp`}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="sv-anim-float-slow absolute hidden sm:block"
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
        src={`${BASE_ASSET}/step-typewriter.webp`}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="sv-anim-float absolute hidden sm:block"
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
        src={`${BASE_ASSET}/star-lg.webp`}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="sv-anim-spin-med pointer-events-none absolute hidden md:block"
        style={{ top: "18%", left: "12%", width: 48 }}
      />

      <motion.div
        className="relative mx-auto max-w-[1240px] px-4 sm:px-6"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <motion.span
          className="inline-flex items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
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
          {eyebrow}
        </motion.span>
        <motion.h2
          className="relative mt-5"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: "clamp(32px, 8vw, 80px)",
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
            fontWeight: 400,
          }}
        >
          {heading ?? (
            <>
              Seu primeiro carrossel
              <br />
              <em style={{ color: "var(--sv-green)" }}>em 60 segundos.</em>
            </>
          )}
        </motion.h2>
        <motion.p
          className="relative"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
          style={{
            margin: "20px auto 0",
            maxWidth: 500,
            fontSize: 15,
            color: "rgba(245,243,236,.7)",
          }}
        >
          {subtitle ?? "Cole um link, um texto ou uma ideia. A IA faz o resto, com a sua voz."}
        </motion.p>
        <motion.div
          className="relative mt-7 flex flex-col flex-wrap items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-[10px]"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <Link
            href={primaryHref}
            className="sv-btn sv-btn-primary w-full sm:w-auto"
            style={{ padding: "16px 24px", fontSize: 12, minHeight: 48 }}
          >
            {primaryLabel}
          </Link>
          <Link
            href="/roadmap"
            className="sv-btn w-full sm:w-auto"
            style={{
              padding: "16px 24px",
              fontSize: 12,
              minHeight: 48,
              background: "transparent",
              color: "var(--sv-paper)",
              borderColor: "var(--sv-paper)",
            }}
          >
            Ver roadmap
          </Link>
        </motion.div>
        <motion.div
          className="relative mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 sm:gap-[22px]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: "clamp(8.5px, 2.2vw, 9.5px)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(245,243,236,.45)",
          }}
        >
          <span>✦ Sem cartão</span>
          <span>✦ 5 carrosséis grátis</span>
          <span>✦ Cancele quando quiser</span>
        </motion.div>
      </motion.div>
    </section>
  );
}
