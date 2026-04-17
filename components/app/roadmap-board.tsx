"use client";

import {
  ROADMAP_ITEMS,
  ROADMAP_STATUS_LABEL,
  type RoadmapItem,
} from "@/lib/roadmap-data";

/**
 * Board reaproveitável do roadmap em formato sticky-notes.
 * Usado tanto na página pública /roadmap quanto dentro do app /app/roadmap.
 */
export default function RoadmapBoard() {
  return (
    <div
      className="relative rounded-[36px] border border-[color:var(--border)] p-8 md:p-16"
      style={{
        background:
          "repeating-linear-gradient(-45deg, rgba(236,96,0,0.02) 0 2px, transparent 2px 14px), #FFFDF9",
        boxShadow:
          "0 40px 120px rgba(10,10,10,0.06), inset 0 0 0 1px rgba(236,96,0,0.04)",
      }}
    >
      <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
        {ROADMAP_ITEMS.map((item) => (
          <StickyCard key={item.n} item={item} />
        ))}
      </div>
    </div>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)]">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}80` }}
      />
      {label}
    </span>
  );
}

function StickyCard({ item }: { item: RoadmapItem }) {
  return (
    <article
      className={`group relative ${item.rotate} transition-transform duration-500 hover:rotate-0 hover:-translate-y-1`}
    >
      {/* Push pin */}
      <span
        className="absolute left-1/2 top-0 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, #fff 0%, ${item.pin} 60%, rgba(0,0,0,0.4) 100%)`,
          boxShadow:
            "0 4px 10px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.6)",
        }}
      />
      <span
        className="absolute left-1/2 top-[6px] z-0 h-1.5 w-6 -translate-x-1/2 rounded-full opacity-40 blur-[2px]"
        style={{ background: "rgba(0,0,0,0.25)" }}
      />

      <div
        className="relative rounded-[22px] p-7"
        style={{
          background: item.color,
          boxShadow:
            "0 14px 40px rgba(10,10,10,0.08), 0 2px 6px rgba(10,10,10,0.05), inset 0 0 0 1px rgba(255,255,255,0.4)",
        }}
      >
        <div className="flex items-start justify-between">
          <span
            className="font-display text-5xl leading-none text-[color:var(--accent-dark)]"
            style={{ letterSpacing: "-0.03em" }}
          >
            {item.n}
          </span>
          <span
            className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: "rgba(10,10,10,0.08)",
              color: "#0A0A0A",
            }}
          >
            {ROADMAP_STATUS_LABEL[item.status]}
          </span>
        </div>

        <h3 className="font-display mt-5 text-2xl leading-tight text-[#0A0A0A]">
          {item.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#0A0A0A]/75">
          {item.body}
        </p>

        <ul className="mt-5 space-y-2">
          {item.bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-[13px] text-[#0A0A0A]/85"
            >
              <span
                className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full"
                style={{ background: "#EC6000" }}
              />
              {b}
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-[#0A0A0A]/10 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]/60">
            {item.tag}
          </span>
        </div>
      </div>
    </article>
  );
}
