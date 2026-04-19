"use client";

import Link from "next/link";
import { useLandingSession } from "@/lib/use-landing-session";
import { BASE_ASSET } from "./shared";

export function FinalCTA() {
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
