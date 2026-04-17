"use client";

/**
 * Hero flow — cena integrada com AnimatedBeam para conexões.
 * Ícones espalhados organicamente + hub central + output cards.
 * Beams de luz animados conectam tudo automaticamente.
 */

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, forwardRef } from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

/* ─── Rotating words ─── */
export const ROTATING_WORDS = [
  "ideias",
  "vídeos",
  "links",
  "PDFs",
  "áudios",
  "artigos",
  "transcrições",
  "notas soltas",
];

/* ─── Invisible anchor point (for beam connections) ─── */
const Anchor = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => (
    <div ref={ref} className={cn("absolute h-1 w-1", className)} />
  )
);
Anchor.displayName = "Anchor";

/* ─── Floating icon ─── */
function FloatingIcon({
  src,
  label,
  size,
  delay,
  floatDur,
  className,
  iconRef,
}: {
  src: string;
  label: string;
  size: number;
  delay: number;
  floatDur: number;
  className?: string;
  iconRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <motion.div
      ref={iconRef}
      className={cn("absolute z-10 will-change-transform", className)}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
        y: { duration: floatDur, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 },
      }}
      whileHover={{ scale: 1.12, zIndex: 30 }}
      title={label}
    >
      <Image
        src={src}
        alt={label}
        width={size}
        height={size}
        style={{
          filter: `drop-shadow(0 ${size * 0.15}px ${size * 0.3}px rgba(0,0,0,0.1))`,
        }}
      />
    </motion.div>
  );
}

/* ─── Output card ─── */
function OutputCardEl({
  src,
  title,
  meta,
  accent,
  delay,
  className,
  cardRef,
}: {
  src: string;
  title: string;
  meta: string;
  accent: string;
  delay: number;
  className?: string;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <motion.div
      ref={cardRef}
      className={cn("absolute z-10 will-change-transform", className)}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0, y: [0, -4, 0] }}
      transition={{
        opacity: { duration: 0.6, delay },
        x: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] },
        y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: delay + 1 },
      }}
    >
      <div
        className="flex w-[185px] items-center gap-2 rounded-2xl border bg-white/93 p-2 shadow-[0_14px_40px_-12px_rgba(0,0,0,0.1)] backdrop-blur-sm sm:w-[215px] sm:gap-2.5 sm:p-2.5"
        style={{
          borderColor: `${accent}18`,
          transform: "rotateY(-6deg) rotateX(2deg)",
          transformStyle: "preserve-3d",
        }}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl sm:h-11 sm:w-11">
          <Image src={src} alt={title} fill className="object-cover" sizes="44px" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold text-[#0A0A0A] sm:text-[12px]">{title}</p>
          <p className="text-[9px] text-[#0A0A0A]/35 sm:text-[10px]">{meta}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wider text-white sm:text-[8px]"
          style={{ backgroundColor: accent }}
        >
          pronto
        </span>
      </div>
    </motion.div>
  );
}

/* ================================================================ */
/*  Main scene                                                       */
/* ================================================================ */
export default function HeroFlowAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Input icon refs
  const i1 = useRef<HTMLDivElement>(null);
  const i2 = useRef<HTMLDivElement>(null);
  const i3 = useRef<HTMLDivElement>(null);
  const i4 = useRef<HTMLDivElement>(null);
  const i5 = useRef<HTMLDivElement>(null);
  const i6 = useRef<HTMLDivElement>(null);

  // Hub ref
  const hub = useRef<HTMLDivElement>(null);

  // Output refs
  const o1 = useRef<HTMLDivElement>(null);
  const o2 = useRef<HTMLDivElement>(null);
  const o3 = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto h-[420px] w-full max-w-[1000px] sm:h-[480px]"
    >
      {/* ─── Dot grid ─── */}
      <div
        className="pointer-events-none absolute inset-0 -inset-x-12 opacity-[0.2]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ─── INPUT ICONS (scattered left side) ─── */}
      <FloatingIcon iconRef={i1} src="/hero/input-link.png" label="Link" size={66} delay={0.6} floatDur={4.2} className="left-[3%] top-[15%]" />
      <FloatingIcon iconRef={i2} src="/hero/input-pdf.png" label="PDF" size={58} delay={0.8} floatDur={4.8} className="left-[16%] top-[50%]" />
      <FloatingIcon iconRef={i3} src="/hero/input-video.png" label="Vídeo" size={52} delay={1.0} floatDur={5.0} className="left-[2%] top-[70%]" />
      <FloatingIcon iconRef={i4} src="/hero/input-idea.png" label="Ideia" size={60} delay={0.7} floatDur={4.5} className="left-[22%] top-[12%]" />
      <FloatingIcon iconRef={i5} src="/hero/input-text.png" label="Texto" size={48} delay={0.9} floatDur={4.6} className="left-[8%] top-[42%]" />
      <FloatingIcon iconRef={i6} src="/hero/input-image.png" label="Imagem" size={46} delay={1.1} floatDur={5.2} className="left-[26%] top-[72%]" />

      {/* ─── CENTRAL HUB ─── */}
      <motion.div
        ref={hub}
        className="absolute z-10"
        style={{ left: "50%", top: "40%", transform: "translate(-50%, -50%)" }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
        transition={{
          opacity: { duration: 0.5, delay: 0.2 },
          scale: { duration: 0.9, delay: 0.2, type: "spring", bounce: 0.2 },
          y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 },
        }}
      >
        <Image
          src="/hero/hub-central.png"
          alt="Sequência Viral Hub"
          width={200}
          height={200}
          priority
          className="sm:h-[240px] sm:w-[240px]"
          style={{
            filter: "drop-shadow(0 28px 56px rgba(236,96,0,0.18)) drop-shadow(0 8px 16px rgba(0,0,0,0.05))",
          }}
        />
        <motion.div
          className="mt-2 flex items-center justify-center gap-2 rounded-full border border-[#EC6000]/10 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-[9px] font-semibold text-[#0A0A0A]/45">
            IA processando
          </span>
        </motion.div>
      </motion.div>

      {/* ─── OUTPUT CARDS (right side) ─── */}
      <OutputCardEl cardRef={o1} src="/hero/output-carousel.png" title="Carrossel pronto" meta="8 slides · 4:5" accent="#EC6000" delay={1.3} className="right-[2%] top-[10%]" />
      <OutputCardEl cardRef={o2} src="/hero/output-post.png" title="Post Instagram" meta="1080×1350" accent="#E11D48" delay={1.5} className="right-[0%] top-[40%]" />
      <OutputCardEl cardRef={o3} src="/hero/output-thread.png" title="Thread viral" meta="5 tweets" accent="#1DA1F2" delay={1.7} className="right-[4%] top-[68%]" />

      {/* ─── ANIMATED BEAMS: inputs → hub ─── */}
      <AnimatedBeam containerRef={containerRef} fromRef={i1} toRef={hub} curvature={-55} endYOffset={-8} gradientStartColor="#3B82F6" gradientStopColor="#EC6000" duration={4} delay={0} pathColor="#e2e8f0" pathOpacity={0.25} />
      <AnimatedBeam containerRef={containerRef} fromRef={i4} toRef={hub} curvature={-30} endYOffset={-5} gradientStartColor="#D97706" gradientStopColor="#EC6000" duration={4.5} delay={0.6} pathColor="#e2e8f0" pathOpacity={0.25} />
      <AnimatedBeam containerRef={containerRef} fromRef={i5} toRef={hub} curvature={-10} gradientStartColor="#7C3AED" gradientStopColor="#EC6000" duration={3.8} delay={1.2} pathColor="#e2e8f0" pathOpacity={0.25} />
      <AnimatedBeam containerRef={containerRef} fromRef={i2} toRef={hub} curvature={15} gradientStartColor="#EC6000" gradientStopColor="#EC6000" duration={4.2} delay={1.8} pathColor="#e2e8f0" pathOpacity={0.25} />
      <AnimatedBeam containerRef={containerRef} fromRef={i3} toRef={hub} curvature={45} endYOffset={8} gradientStartColor="#DC2626" gradientStopColor="#EC6000" duration={4} delay={2.4} pathColor="#e2e8f0" pathOpacity={0.25} />
      <AnimatedBeam containerRef={containerRef} fromRef={i6} toRef={hub} curvature={55} endYOffset={10} gradientStartColor="#059669" gradientStopColor="#EC6000" duration={4.5} delay={3} pathColor="#e2e8f0" pathOpacity={0.25} />

      {/* ─── ANIMATED BEAMS: hub → outputs ─── */}
      <AnimatedBeam containerRef={containerRef} fromRef={hub} toRef={o1} curvature={-45} startYOffset={-8} gradientStartColor="#EC6000" gradientStopColor="#EC6000" duration={3.5} delay={1} pathColor="#fed7aa" pathOpacity={0.2} />
      <AnimatedBeam containerRef={containerRef} fromRef={hub} toRef={o2} curvature={0} gradientStartColor="#EC6000" gradientStopColor="#E11D48" duration={4} delay={1.8} pathColor="#fed7aa" pathOpacity={0.2} />
      <AnimatedBeam containerRef={containerRef} fromRef={hub} toRef={o3} curvature={45} startYOffset={8} gradientStartColor="#EC6000" gradientStopColor="#1DA1F2" duration={3.8} delay={2.6} pathColor="#fed7aa" pathOpacity={0.2} />

      {/* ─── Speed badge ─── */}
      <motion.div
        className="absolute right-[3%] top-[3%] z-20 flex items-center gap-1.5 rounded-xl border border-[#EC6000]/10 bg-white/85 px-3 py-1.5 shadow-md backdrop-blur-sm"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.2, type: "spring", bounce: 0.3 }}
      >
        <span className="text-sm leading-none">⚡</span>
        <span className="font-mono text-[11px] font-bold text-[#0A0A0A]">~28s</span>
      </motion.div>
    </div>
  );
}

/* ================================================================ */
/*  Rotating word                                                    */
/* ================================================================ */
export function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative inline-block min-w-[7ch] text-left align-bottom sm:min-w-[9ch]">
      <AnimatePresence mode="wait">
        <motion.span
          key={ROTATING_WORDS[index]}
          className="inline-block italic text-[var(--accent)]"
          initial={{ y: 18, opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -18, opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        >
          {ROTATING_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
