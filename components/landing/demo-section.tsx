"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BASE_ASSET, REVEAL, SectionHead } from "./shared";

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

export function DemoSection() {
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
        <SectionHead num="04" sub="Demo ao vivo" tag="15 segundos">
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
