"use client";

import { useRef, useState, type MouseEvent } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpotlightCardItem {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

interface SpotlightCardsProps {
  items: SpotlightCardItem[];
  className?: string;
}

export function SpotlightCards({ items, className }: SpotlightCardsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item, i) => (
        <SpotlightCard key={i} item={item} index={i} />
      ))}
    </div>
  );
}

function SpotlightCard({
  item,
  index,
}: {
  item: SpotlightCardItem;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const Icon = item.icon;

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04),0_12px_30px_-8px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_1px_3px_rgba(10,10,10,0.05),0_24px_50px_-12px_rgba(0,0,0,0.12)]"
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(360px circle at ${pos.x}px ${pos.y}px, ${item.color}22, transparent 60%)`,
          opacity: hover ? 1 : 0,
        }}
      />
      <div
        className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{
          background: `linear-gradient(180deg, ${item.color}33 0%, ${item.color}1a 100%)`,
          border: `1px solid ${item.color}55`,
          color: item.color,
        }}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <h3 className="mb-2 text-[17px] font-semibold tracking-tight text-neutral-900">
        {item.title}
      </h3>
      <p className="text-[14px] leading-relaxed text-neutral-600">
        {item.description}
      </p>
    </motion.div>
  );
}
