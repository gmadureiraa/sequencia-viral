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

function Spinner({ tone = "ink" }: { tone?: "ink" | "green" }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        border: `1.5px solid ${tone === "green" ? "var(--sv-green)" : "var(--sv-ink)"}`,
        borderRightColor: "transparent",
        borderTopColor: "transparent",
        animation: "sv-spin-slow 0.85s linear infinite",
      }}
    />
  );
}

function ProgressRow({
  label,
  pct,
  showPct = false,
}: {
  label: string;
  pct: number;
  showPct?: boolean;
}) {
  return (
    <div>
      <div
        className="flex items-center justify-between"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span className="inline-flex items-center gap-[7px]">
          <Spinner />
          {label}
        </span>
        <span style={{ color: "var(--sv-ink)" }}>
          {showPct ? `${pct}%` : ""}
        </span>
      </div>
      <div className="sv-progress-bar mt-[5px] relative overflow-hidden">
        <i style={{ width: `${pct}%` }} />
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 block w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, transparent 42%, rgba(255,255,255,.55) 50%, transparent 58%, transparent 100%)",
            animation: "sv-progress-shimmer 1.4s linear infinite",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

export interface DemoSectionProps {
  sub?: string;
  tag?: string;
  heading?: React.ReactNode;
}

export function DemoSection(props: DemoSectionProps = {}) {
  const { sub = "Cola → lê → entrega", tag = "~15 segundos", heading } = props;
  const targetText = "https://youtube.com/watch?v=carrossel-viral";
  const [typedLen, setTypedLen] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    function step() {
      if (i <= targetText.length) {
        setTypedLen(i);
        i++;
        timer = setTimeout(step, 55);
      } else {
        timer = setTimeout(() => {
          i = 0;
          step();
        }, 4000);
      }
    }
    step();
    return () => clearTimeout(timer);
  }, []);

  // Tick global: cada row usa fase deslocada pra nunca ficar parado todo mundo junto.
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => (t + 1) % 1000), 140);
    return () => clearInterval(iv);
  }, []);

  const osc = (phase: number) =>
    Math.round(55 + Math.abs(Math.sin((tick + phase) / 14)) * 45);
  const pctA = osc(0);
  const pctB = osc(22);
  const pctC = osc(44);

  return (
    <section id="demo" style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="04" sub={sub} tag={tag}>
          {heading ?? (
            <>
              Cola um <em>link</em>.{" "}
              <span style={{ color: "var(--sv-muted)" }}>
                Sai um carrossel com a sua voz.
              </span>
            </>
          )}
        </SectionHead>

        <div
          className="sv-demo-grid mx-auto"
          style={{ maxWidth: 720 }}
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
                <ProgressRow label="Transcrevendo" pct={pctA} showPct />
                <ProgressRow label="Identificando ângulos" pct={pctB} showPct />
                <ProgressRow label="Aplicando sua voz" pct={pctC} showPct />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
