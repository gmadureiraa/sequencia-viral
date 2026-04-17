"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BentoItems {
  main: { title: string; eyebrow: string; items: string[] };
  typing: { title: string; eyebrow: string; code: string };
  partners: { title: string; eyebrow: string; chips: string[] };
  timeline: {
    title: string;
    eyebrow: string;
    events: { year: string; event: string }[];
  };
}

export function BentoGrid({ items }: { items: BentoItems }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
      {/* Main — spans 4 cols */}
      <div className="md:col-span-4 md:row-span-1">
        <MainCard {...items.main} />
      </div>

      {/* Partners — spans 2 cols */}
      <div className="md:col-span-2 md:row-span-1">
        <PartnersCard {...items.partners} />
      </div>

      {/* Typing — spans 3 cols */}
      <div className="md:col-span-3 md:row-span-1">
        <TypingCard {...items.typing} />
      </div>

      {/* Timeline — spans 3 cols */}
      <div className="md:col-span-3 md:row-span-1">
        <TimelineCard {...items.timeline} />
      </div>
    </div>
  );
}

function CardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.5 }}
      className={cn(
        "group relative h-full overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04),0_12px_30px_-8px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
      {children}
    </div>
  );
}

function MainCard({
  title,
  eyebrow,
  items,
}: {
  title: string;
  eyebrow: string;
  items: string[];
}) {
  return (
    <CardShell className="min-h-[280px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="mb-4 text-2xl font-bold tracking-tight text-neutral-900">
        {title}
      </h3>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
            className="flex items-start gap-2.5 text-[14px] text-neutral-700"
          >
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#EC6000]/10 text-[#EC6000]">
              <Check className="h-3 w-3" strokeWidth={3} />
            </div>
            {it}
          </motion.li>
        ))}
      </ul>
      <Sparkles className="absolute right-5 top-5 h-5 w-5 text-[#EC6000]/30" />
    </CardShell>
  );
}

function PartnersCard({
  title,
  eyebrow,
  chips,
}: {
  title: string;
  eyebrow: string;
  chips: string[];
}) {
  return (
    <CardShell className="min-h-[280px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="mb-4 text-xl font-bold tracking-tight text-neutral-900">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <span
            key={i}
            className="rounded-full border border-black/[0.08] bg-neutral-50 px-3 py-1.5 text-[12px] font-medium text-neutral-700"
          >
            {c}
          </span>
        ))}
      </div>
    </CardShell>
  );
}

function TypingCard({
  title,
  eyebrow,
  code,
}: {
  title: string;
  eyebrow: string;
  code: string;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let i = 0;
    let cancelled = false;
    function tick() {
      if (cancelled) return;
      if (i <= code.length) {
        setTyped(code.slice(0, i));
        i++;
        setTimeout(tick, 22);
      }
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <CardShell className="min-h-[220px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="mb-4 text-xl font-bold tracking-tight text-neutral-900">
        {title}
      </h3>
      <pre className="overflow-x-auto rounded-xl bg-neutral-950 p-4 font-mono text-[12px] leading-relaxed text-neutral-100">
        <code>
          {typed}
          <span className="inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-[#FF8534]" />
        </code>
      </pre>
    </CardShell>
  );
}

function TimelineCard({
  title,
  eyebrow,
  events,
}: {
  title: string;
  eyebrow: string;
  events: { year: string; event: string }[];
}) {
  return (
    <CardShell className="min-h-[220px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="mb-4 text-xl font-bold tracking-tight text-neutral-900">
        {title}
      </h3>
      <div className="space-y-3">
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="rounded-lg bg-[#EC6000]/10 px-2 py-1 font-mono text-[11px] font-bold text-[#EC6000]">
              {e.year}
            </span>
            <span className="text-[13px] text-neutral-700">{e.event}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}
