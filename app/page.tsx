"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  Sparkles,
  X,
  Zap,
  Workflow,
  Wand2,
  FileText,
  LayoutTemplate,
  Download,
  Youtube,
  Instagram,
  Link2,
  Lightbulb,
  Palette,
  Film,
  Type,
  Grid3x3,
  MousePointerClick,
  Clock,
} from "lucide-react";
import { TweetCard } from "@/components/kokonutui/tweet-card";
import { LANDING_FAQ } from "@/lib/landing-faq";
import { PLANS, FREE_PLAN_USAGE_LIMIT } from "@/lib/pricing";
import { useLandingSession } from "@/lib/use-landing-session";

/* ------------------------------------------------------------------ */
/*  Tokens reutilizados — alinhados ao neo-brutal warm                 */
/* ------------------------------------------------------------------ */

const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0_0_#0A0A0A] transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#0A0A0A] active:translate-x-0 active:translate-y-0 active:shadow-[4px_4px_0_0_#0A0A0A]";

const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-[#FFFDF9] px-5 py-2.5 text-sm font-bold text-[#0A0A0A] shadow-[4px_4px_0_0_#0A0A0A] transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white hover:shadow-[6px_6px_0_0_#0A0A0A]";

const BTN_OUTLINE_DARK =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white bg-transparent px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white/10";

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

/* ------------------------------------------------------------------ */
/*  Logo                                                               */
/* ------------------------------------------------------------------ */

function LogoMark() {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#0A0A0A] bg-[var(--accent)]"
      style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn } = useLandingSession();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[#0A0A0A] bg-[#FFFDF9]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark />
          <span className="editorial-serif text-xl text-[#0A0A0A]">
            Sequência Viral<span className="text-[var(--accent)]">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#0A0A0A]/70 transition-colors hover:bg-white hover:text-[#0A0A0A]"
            >
              {item.label}
            </a>
          ))}
          {isLoggedIn ? (
            <Link href="/app" className={`${BTN_PRIMARY} ml-2`}>
              Ir pro app →
            </Link>
          ) : (
            <>
              <Link
                href="/app/login"
                className="ml-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#0A0A0A]/80 transition-colors hover:bg-white hover:text-[#0A0A0A]"
              >
                Entrar
              </Link>
              <Link href="/app/login" className={`${BTN_PRIMARY} ml-2`}>
                Criar conta grátis
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border-2 border-[#0A0A0A] bg-white p-2 shadow-[3px_3px_0_0_#0A0A0A] md:hidden"
          aria-label="Abrir menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t-2 border-[#0A0A0A] bg-[#FFFDF9] md:hidden"
          >
            <div className="flex flex-col gap-2 px-5 py-4">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-[#0A0A0A]/80 hover:bg-white"
                >
                  {item.label}
                </a>
              ))}
              {isLoggedIn ? (
                <Link
                  href="/app"
                  onClick={() => setOpen(false)}
                  className={`${BTN_PRIMARY} mt-1 w-fit`}
                >
                  Ir pro app →
                </Link>
              ) : (
                <>
                  <Link
                    href="/app/login"
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-[#0A0A0A]/80 hover:bg-white"
                  >
                    Entrar
                  </Link>
                  <Link href="/app/login" className={`${BTN_PRIMARY} mt-1 w-fit`}>
                    Criar conta grátis
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero — headline + CTA + preview animado                            */
/* ------------------------------------------------------------------ */

const HERO_SLIDES = [
  {
    tag: "Slide 01",
    title: "O segredo é a repetição.",
    body: "Nenhum post viraliza sozinho. O jogo é publicar todo dia — e o carrossel faz o trabalho pesado.",
    accent: "#EC6000",
  },
  {
    tag: "Slide 02",
    title: "Cole o link. Espere 15s.",
    body: "YouTube, artigo, Reel ou só uma ideia solta. A IA transforma em carrossel pronto pra postar.",
    accent: "#0A0A0A",
  },
  {
    tag: "Slide 03",
    title: "Com a sua voz, não a do ChatGPT.",
    body: "O brand analyzer aprende seu tom a partir do seu perfil e dos seus últimos posts.",
    accent: "#1D4ED8",
  },
  {
    tag: "Slide 04",
    title: "Exporta e bora postar.",
    body: "PNG 1080×1350 pixel-perfect, pronto pro Instagram e LinkedIn. Sem travar, sem treta.",
    accent: "#059669",
  },
];

function HeroPreview() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const slide = HERO_SLIDES[index];

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      {/* Chip flutuante topo */}
      <motion.div
        initial={{ opacity: 0, y: -10, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: 6 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -right-2 -top-3 z-30"
      >
        <div className="rounded-full border-2 border-[#0A0A0A] bg-[#FFFDF9] px-3 py-1.5 shadow-[3px_3px_0_0_#0A0A0A]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0A0A0A]">
            <Sparkles size={11} className="text-[var(--accent)]" />
            Gerado em 15s
          </div>
        </div>
      </motion.div>

      {/* Frame do carrossel */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[32px] border-2 border-[#0A0A0A] bg-[#FFFDF9] p-4 shadow-[10px_10px_0_0_#0A0A0A]"
      >
        {/* Barra tipo Twitter */}
        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#0A0A0A]/10 bg-gradient-to-br from-[#FF8534] to-[#EC6000] text-xs font-bold text-white">
              SV
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-bold text-[#0A0A0A]">Sequência Viral</span>
              <span className="text-[11px] text-[#0A0A0A]/50">@sequencia-viral</span>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#0A0A0A" aria-hidden>
            <path d="M22.46 6c-.77.35-1.6.58-2.46.67.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
          </svg>
        </div>

        {/* Slide animado */}
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border-2 border-[#0A0A0A]">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.tag}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex flex-col justify-between bg-[#FFFDF9] p-6"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.05) 1px, transparent 0)",
                backgroundSize: "18px 18px",
              }}
            >
              <div>
                <span
                  className="inline-flex items-center rounded-full border-2 border-[#0A0A0A] bg-white px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#0A0A0A]"
                  style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
                >
                  {slide.tag}
                </span>
              </div>
              <div>
                <h3
                  className="editorial-serif text-[26px] leading-[1.02] text-[#0A0A0A]"
                  style={{ color: slide.accent }}
                >
                  {slide.title}
                </h3>
                <p className="mt-3 text-[13px] leading-snug text-[#0A0A0A]/75">
                  {slide.body}
                </p>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-[#0A0A0A]/50">
                <span>sequencia-viral</span>
                <span>
                  {index + 1} / {HERO_SLIDES.length}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {HERO_SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === index ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-[#0A0A0A]/15"
              }`}
            />
          ))}
        </div>
      </motion.div>

      {/* Chip flutuante baixo */}
      <motion.div
        initial={{ opacity: 0, y: 10, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: -5 }}
        transition={{ delay: 0.55, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -bottom-3 -left-2 z-30"
      >
        <div className="rounded-full border-2 border-[#0A0A0A] bg-[#FFFDF9] px-3 py-1.5 shadow-[3px_3px_0_0_#0A0A0A]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0A0A0A]">
            <span>Feito no Brasil</span>
            <span aria-hidden>🇧🇷</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAF8] px-5 pt-16 pb-20 sm:pt-24">
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.07) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Glow acento */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 55%, rgba(236,96,0,0.08) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_minmax(0,0.9fr)] lg:gap-12">
        {/* Coluna texto */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#0A0A0A] bg-white px-3 py-1.5 shadow-[3px_3px_0_0_#0A0A0A]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white">
              <Sparkles size={11} />
            </span>
            <span className="text-[12px] font-bold text-[#0A0A0A]">
              Novo: transcrição automática de YouTube e Reels
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="editorial-serif mt-6 text-[2.6rem] leading-[0.95] text-[#0A0A0A] sm:text-[3.6rem] lg:text-[4.2rem]"
          >
            Cole um link.
            <br />
            Publique um carrossel.{" "}
            <span className="italic text-[var(--accent)]">
              Em minutos, não em horas.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.6 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]"
          >
            A IA lê a sua fonte (YouTube, blog, Instagram ou uma ideia solta) e devolve um
            carrossel editorial, com a sua voz, pronto pra postar no Instagram e LinkedIn.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.55 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link href="/app/login" className={BTN_PRIMARY}>
              Criar grátis
              <ArrowRight size={16} />
            </Link>
            <a href="#demo" className={BTN_SECONDARY}>
              Ver demo
              <MousePointerClick size={16} />
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-[var(--muted)]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-[var(--accent)]" strokeWidth={2.5} />
              Sem cartão
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-[var(--accent)]" strokeWidth={2.5} />
              {FREE_PLAN_USAGE_LIMIT} carrosséis grátis
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-[var(--accent)]" strokeWidth={2.5} />
              Export PNG em alta
            </span>
          </motion.p>
        </div>

        {/* Coluna preview */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex justify-center lg:justify-end"
        >
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Trust strip — 3 stats                                              */
/* ------------------------------------------------------------------ */

const TRUST_STATS = [
  {
    icon: LayoutTemplate,
    label: "+2.000",
    suffix: "carrosséis gerados",
    accent: "#EC6000",
  },
  {
    icon: Clock,
    label: "~15s",
    suffix: "por carrossel",
    accent: "#1D4ED8",
  },
  {
    icon: Workflow,
    label: "4 origens",
    suffix: "YouTube · blog · Instagram · ideia livre",
    accent: "#059669",
  },
];

function TrustStrip() {
  return (
    <section className="border-y-2 border-[#0A0A0A] bg-[#FFFDF9] px-5 py-10">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
        {TRUST_STATS.map(({ icon: Icon, label, suffix, accent }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="flex items-center gap-4 rounded-2xl border-2 border-[#0A0A0A] bg-white p-5 shadow-[4px_4px_0_0_#0A0A0A]"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#0A0A0A] text-white"
              style={{ background: accent, boxShadow: "2px 2px 0 0 #0A0A0A" }}
            >
              <Icon size={20} strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="editorial-serif text-[1.8rem] leading-none text-[#0A0A0A]">
                {label}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--muted)]">
                {suffix}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Como funciona — 3 steps com reveal                                 */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    icon: Link2,
    title: "Cole a fonte.",
    desc: "Link de YouTube, artigo de blog, post do Instagram, PDF ou só uma ideia em uma frase. A IA entende o que tiver.",
    accent: "#EC6000",
  },
  {
    n: "02",
    icon: Wand2,
    title: "A IA gera 3 variações.",
    desc: "Cinco conceitos primeiro pra você escolher o ângulo. Depois, três carrosséis completos: dados, narrativa, provocação.",
    accent: "#0A0A0A",
  },
  {
    n: "03",
    icon: Download,
    title: "Edite, exporte e poste.",
    desc: "Ajuste texto e imagem inline. Exporta PNG 1080×1350 (ou PDF). Abre no celular, posta. Acabou.",
    accent: "#1D4ED8",
  },
];

function ComoFunciona() {
  return (
    <section id="como-funciona" className="relative mx-auto max-w-6xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-14 max-w-2xl"
      >
        <span className="tag-pill">
          <Workflow size={13} className="text-[var(--accent)]" />
          Como funciona
        </span>
        <h2 className="editorial-serif mt-6 text-[2.6rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Três passos.{" "}
          <span className="text-[var(--muted)]">Nenhum deles é editar no Canva.</span>
        </h2>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.article
              key={step.n}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col rounded-3xl border-2 border-[#0A0A0A] bg-[#FFFDF9] p-7 shadow-[6px_6px_0_0_#0A0A0A]"
            >
              <div className="flex items-start justify-between">
                <span
                  className="editorial-serif text-[3.6rem] leading-none"
                  style={{ color: step.accent }}
                >
                  {step.n}
                </span>
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#0A0A0A] text-white"
                  style={{ background: step.accent, boxShadow: "2px 2px 0 0 #0A0A0A" }}
                >
                  <Icon size={20} strokeWidth={2.4} />
                </span>
              </div>
              <h3 className="mt-6 text-[22px] font-bold leading-tight text-[#0A0A0A]">
                {step.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
                {step.desc}
              </p>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Bento grid de features                                             */
/* ------------------------------------------------------------------ */

type BentoCell = {
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  accent: string;
  badge?: string;
  className: string; // grid placement + bg
  children?: React.ReactNode;
};

function BentoVisualPreview() {
  return (
    <div className="relative mt-5 h-36 w-full overflow-hidden rounded-xl border-2 border-[#0A0A0A] bg-[#FFFDF9] p-3">
      <div className="flex items-center gap-2 pb-2">
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#FF8534] to-[#EC6000]" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-bold text-[#0A0A0A]">Sequência Viral</span>
          <span className="text-[9px] text-[#0A0A0A]/50">@sequencia-viral</span>
        </div>
      </div>
      <p className="editorial-serif text-[16px] leading-[1.05] text-[#0A0A0A]">
        O algoritmo premia consistência,{" "}
        <span className="italic text-[var(--accent)]">não genialidade.</span>
      </p>
      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full border border-[#0A0A0A]/10 bg-white px-2 py-0.5 text-[9px] font-bold text-[#0A0A0A]/70">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        preview real
      </div>
    </div>
  );
}

function BentoTemplates() {
  const templates = [
    { name: "Twitter", color: "#0A0A0A" },
    { name: "Principal", color: "#EC6000" },
    { name: "Futurista", color: "#1D4ED8" },
    { name: "Autoral", color: "#059669" },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      {templates.map((t) => (
        <div
          key={t.name}
          className="flex flex-col gap-2 rounded-xl border-2 border-[#0A0A0A] bg-white p-2.5 shadow-[2px_2px_0_0_#0A0A0A]"
        >
          <span
            className="h-10 w-full rounded-md"
            style={{ background: t.color }}
          />
          <span className="text-[11px] font-bold text-[#0A0A0A]">{t.name}</span>
        </div>
      ))}
    </div>
  );
}

function BentoTranscription() {
  return (
    <div className="mt-5 space-y-2">
      <div className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-white p-2.5 shadow-[2px_2px_0_0_#0A0A0A]">
        <Youtube size={16} className="text-[#FF0000]" />
        <span className="font-mono text-[10px] text-[#0A0A0A]/70 truncate">
          youtube.com/watch?v=...
        </span>
        <motion.span
          className="ml-auto h-2 w-2 rounded-full bg-emerald-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      </div>
      <div className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-white p-2.5 shadow-[2px_2px_0_0_#0A0A0A]">
        <Instagram size={16} className="text-[#E1306C]" />
        <span className="font-mono text-[10px] text-[#0A0A0A]/70 truncate">
          instagram.com/reel/...
        </span>
        <motion.span
          className="ml-auto h-2 w-2 rounded-full bg-emerald-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: 0.3 }}
        />
      </div>
    </div>
  );
}

function BentoExport() {
  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="flex flex-1 items-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-white p-2.5 shadow-[2px_2px_0_0_#0A0A0A]">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EC6000] text-[10px] font-bold text-white">
          PNG
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-bold text-[#0A0A0A]">1080×1350</span>
          <span className="text-[9px] text-[#0A0A0A]/60">pixel-perfect</span>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-white p-2.5 shadow-[2px_2px_0_0_#0A0A0A]">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0A0A0A] text-[10px] font-bold text-white">
          PDF
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-bold text-[#0A0A0A]">Slide deck</span>
          <span className="text-[9px] text-[#0A0A0A]/60">pronto pra enviar</span>
        </div>
      </div>
    </div>
  );
}

function BentoBrandVoice() {
  return (
    <div className="mt-5 space-y-2">
      <div className="rounded-xl border-2 border-[#0A0A0A] bg-white p-3 shadow-[2px_2px_0_0_#0A0A0A]">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#0A0A0A]/50">
          Entrada
        </span>
        <p className="mt-1 text-[12px] leading-tight text-[#0A0A0A]/80">
          @meuperfil · últimos 30 posts
        </p>
      </div>
      <div className="flex items-center justify-center">
        <ArrowRight size={16} className="text-[var(--accent)]" />
      </div>
      <div
        className="rounded-xl border-2 border-[#0A0A0A] p-3"
        style={{ background: "#FFE4CC", boxShadow: "2px 2px 0 0 #0A0A0A" }}
      >
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#0A0A0A]/60">
          Saída
        </span>
        <p className="mt-1 text-[12px] font-semibold leading-tight text-[#0A0A0A]">
          Carrossel com o seu tom
        </p>
      </div>
    </div>
  );
}

function BentoContentMachine() {
  const steps = ["Triagem", "Headlines", "Espinha", "Copy"];
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <div
          key={s}
          className="flex items-center gap-2 rounded-full border-2 border-[#0A0A0A] bg-white px-3 py-1 text-[11px] font-bold text-[#0A0A0A] shadow-[2px_2px_0_0_#0A0A0A]"
        >
          <span className="font-mono text-[#EC6000]">0{i + 1}</span>
          {s}
        </div>
      ))}
    </div>
  );
}

const BENTO: BentoCell[] = [
  {
    title: "Preview real no template Twitter",
    desc: "Nada de mockup. O slide que você vê é o slide que sai. Tipografia, cores e formato exatos.",
    icon: LayoutTemplate,
    accent: "#EC6000",
    className: "md:col-span-2 md:row-span-2 bg-[#FFFDF9]",
    children: <BentoVisualPreview />,
  },
  {
    title: "Transcreve YouTube e Reels",
    desc: "Cola o link, a IA baixa o áudio, transcreve e vira carrossel.",
    icon: Film,
    accent: "#E1306C",
    badge: "Novo",
    className: "md:col-span-2 bg-[#FFFDF9]",
    children: <BentoTranscription />,
  },
  {
    title: "4 templates editoriais",
    desc: "Twitter, Principal, Futurista e Autoral. Cada um com sua pegada.",
    icon: Palette,
    accent: "#1D4ED8",
    className: "md:col-span-2 bg-[#FFFDF9]",
    children: <BentoTemplates />,
  },
  {
    title: "Modo avançado",
    desc: "Fluxo guiado em etapas: triagem do tema → 3 headlines → espinha dorsal → copy final.",
    icon: Grid3x3,
    accent: "#0A0A0A",
    className: "md:col-span-2 bg-[#FFFDF9]",
    children: <BentoContentMachine />,
  },
  {
    title: "Exporta PNG + PDF",
    desc: "1080×1350 pixel-perfect. PDF pra deck, PNG pra postar.",
    icon: Download,
    accent: "#059669",
    className: "md:col-span-2 bg-[#FFFDF9]",
    children: <BentoExport />,
  },
  {
    title: "Tom da sua marca",
    desc: "Brand analyzer aprende sua voz dos seus próprios posts. Saída sem cheiro de ChatGPT.",
    icon: Type,
    accent: "#EC6000",
    className: "md:col-span-2 bg-[#FFFDF9]",
    children: <BentoBrandVoice />,
  },
];

function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-14 max-w-2xl"
      >
        <span className="tag-pill">
          <Zap size={13} className="text-[var(--accent)]" />
          Features
        </span>
        <h2 className="editorial-serif mt-6 text-[2.6rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Tudo que você precisa.
          <br />
          <span className="text-[var(--muted)]">Nada que você não precisa.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4 md:auto-rows-[minmax(220px,auto)]">
        {BENTO.map((cell, i) => {
          const Icon = cell.icon;
          return (
            <motion.article
              key={cell.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: i * 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className={`relative flex flex-col rounded-3xl border-2 border-[#0A0A0A] p-6 shadow-[6px_6px_0_0_#0A0A0A] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_#0A0A0A] ${cell.className}`}
            >
              <div className="flex items-start justify-between">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#0A0A0A] text-white"
                  style={{ background: cell.accent, boxShadow: "2px 2px 0 0 #0A0A0A" }}
                >
                  <Icon size={18} strokeWidth={2.4} />
                </span>
                {cell.badge && (
                  <span
                    className="rounded-full border-2 border-[#0A0A0A] bg-[#B8F5C8] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#0A0A0A]"
                    style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
                  >
                    {cell.badge}
                  </span>
                )}
              </div>
              <h3 className="mt-5 text-[19px] font-bold leading-tight text-[#0A0A0A]">
                {cell.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
                {cell.desc}
              </p>
              {cell.children}
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Demo — simulação de digitação + slides gerados                     */
/* ------------------------------------------------------------------ */

const DEMO_URL = "https://youtube.com/watch?v=seu-video";
const DEMO_SLIDES_PREVIEW = [
  {
    tag: "Slide 01",
    heading: "A IA leu o seu vídeo.",
    body: "Transcreveu, resumiu, encontrou o gancho. Pronto pra virar post.",
    accent: "#EC6000",
  },
  {
    tag: "Slide 02",
    heading: "E escolheu o ângulo certo.",
    body: "Três variações: dados, narrativa, provocação. Você decide qual publica.",
    accent: "#0A0A0A",
  },
  {
    tag: "Slide 03",
    heading: "Com a sua voz.",
    body: "Nada de frase genérica. O tom vem dos seus últimos 30 posts.",
    accent: "#1D4ED8",
  },
];

function DemoTypingInput() {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "generating" | "done">("typing");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let i = 0;
    let cancelled = false;

    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(t);
    };

    const type = () => {
      if (cancelled) return;
      if (i <= DEMO_URL.length) {
        setTyped(DEMO_URL.slice(0, i));
        i += 1;
        schedule(type, 55 + Math.random() * 50);
      } else {
        setPhase("generating");
        schedule(() => setPhase("done"), 1600);
        schedule(() => {
          i = 0;
          setTyped("");
          setPhase("typing");
          type();
        }, 6000);
      }
    };

    type();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="rounded-3xl border-2 border-[#0A0A0A] bg-[#FFFDF9] p-5 shadow-[6px_6px_0_0_#0A0A0A]">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A]/50">
        Entrada
      </span>
      <div className="mt-2 flex items-center gap-3 rounded-xl border-2 border-[#0A0A0A] bg-white px-3 py-3 shadow-[2px_2px_0_0_#0A0A0A]">
        <Link2 size={16} className="shrink-0 text-[var(--accent)]" />
        <span className="flex-1 truncate font-mono text-[12px] text-[#0A0A0A]">
          {typed}
          {phase === "typing" && (
            <motion.span
              className="ml-0.5 inline-block h-3.5 w-[2px] bg-[#0A0A0A] align-middle"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border-2 border-[#0A0A0A] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
            phase === "typing"
              ? "bg-white text-[#0A0A0A]/50"
              : phase === "generating"
              ? "bg-[#FFE4CC] text-[#0A0A0A]"
              : "bg-[#B8F5C8] text-[#0A0A0A]"
          }`}
          style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
        >
          <motion.span
            className={`h-1.5 w-1.5 rounded-full ${
              phase === "typing"
                ? "bg-[#0A0A0A]/30"
                : phase === "generating"
                ? "bg-[var(--accent)]"
                : "bg-emerald-500"
            }`}
            animate={phase === "generating" ? { opacity: [0.3, 1, 0.3] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          {phase === "typing"
            ? "Colando link"
            : phase === "generating"
            ? "Gerando"
            : "Pronto"}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-[var(--muted)]">
        <Youtube size={14} className="text-[#FF0000]" />
        <span>Detectei YouTube · transcrevendo áudio</span>
      </div>
    </div>
  );
}

function DemoOutputSlides() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {DEMO_SLIDES_PREVIEW.map((slide, i) => (
        <motion.div
          key={slide.tag}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ delay: 0.2 + i * 0.18, duration: 0.5 }}
          className="relative flex aspect-[4/5] flex-col justify-between rounded-2xl border-2 border-[#0A0A0A] bg-[#FFFDF9] p-3 shadow-[4px_4px_0_0_#0A0A0A]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.05) 1px, transparent 0)",
            backgroundSize: "14px 14px",
          }}
        >
          <span
            className="inline-flex w-fit items-center rounded-full border-2 border-[#0A0A0A] bg-white px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[#0A0A0A]"
            style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
          >
            {slide.tag}
          </span>
          <h4
            className="editorial-serif text-[14px] leading-[1] sm:text-[16px]"
            style={{ color: slide.accent }}
          >
            {slide.heading}
          </h4>
          <p className="text-[9.5px] leading-tight text-[#0A0A0A]/70 sm:text-[10.5px]">
            {slide.body}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

function Demo() {
  return (
    <section id="demo" className="relative mx-auto max-w-5xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-2xl"
      >
        <span className="tag-pill">
          <Wand2 size={13} className="text-[var(--accent)]" />
          Demo
        </span>
        <h2 className="editorial-serif mt-6 text-[2.6rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Parece mágica.{" "}
          <span className="text-[var(--muted)]">É só engenharia boa.</span>
        </h2>
      </motion.div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <DemoTypingInput />
        <DemoOutputSlides />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

type Plan = {
  id: "free" | "pro" | "business";
  name: string;
  price: string;
  anchor?: string;
  discount?: string;
  period: string;
  tagline: string;
  bullets: string[];
  cta: string;
  href: string;
  highlighted: boolean;
};

const PRICING_PLANS: Plan[] = [
  {
    id: "free",
    name: "Grátis",
    price: "US$ 0",
    period: "",
    tagline: "Pra experimentar",
    bullets: [
      `${FREE_PLAN_USAGE_LIMIT} carrosséis/mês`,
      "Export PNG em alta",
      "Modo rápido + modo avançado",
      "4 templates editoriais",
      "1 perfil de marca",
    ],
    cta: "Começar agora",
    href: "/app/login",
    highlighted: false,
  },
  {
    id: "pro",
    name: PLANS.pro.name,
    price: `US$ ${(PLANS.pro.priceMonthly / 100).toFixed(2).replace(".", ",")}`,
    anchor: `US$ ${(PLANS.pro.priceAnchor / 100).toFixed(2).replace(".", ",")}`,
    discount: "−50% no lançamento",
    period: "/mês",
    tagline: "Pra quem posta todo dia",
    bullets: PLANS.pro.features.slice(),
    cta: "Assinar Pro",
    href: "/app/checkout?plan=pro",
    highlighted: true,
  },
  {
    id: "business",
    name: PLANS.business.name,
    price: `US$ ${(PLANS.business.priceMonthly / 100).toFixed(2).replace(".", ",")}`,
    anchor: `US$ ${(PLANS.business.priceAnchor / 100).toFixed(2).replace(".", ",")}`,
    discount: "−40% no lançamento",
    period: "/mês",
    tagline: "Pra times e agências",
    bullets: PLANS.business.features.slice(),
    cta: "Assinar Business",
    href: "/app/checkout?plan=business",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="relative mx-auto max-w-6xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-14 max-w-2xl"
      >
        <span className="tag-pill">
          <Sparkles size={13} className="text-[var(--accent)]" />
          Pricing
        </span>
        <h2 className="editorial-serif mt-6 text-[2.6rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Preço honesto.{" "}
          <span className="text-[var(--muted)]">Cancele quando quiser.</span>
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          Sem cartão pra começar. Planos pagos com desconto de lançamento até o fim do mês.
        </p>
      </motion.div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {PRICING_PLANS.map((plan, i) => {
          if (plan.highlighted) {
            return (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.55 }}
                className="relative flex flex-col overflow-hidden rounded-[28px] border-2 border-[#0A0A0A] shadow-[8px_8px_0_0_#0A0A0A] lg:-translate-y-2"
              >
                <span
                  className="absolute right-4 top-4 z-10 rounded-full border-2 border-[#0A0A0A] bg-[#0A0A0A] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-white"
                  style={{ boxShadow: "2px 2px 0 0 #EC6000" }}
                >
                  Mais popular
                </span>

                <div className="bg-[#FFFDF9] p-8 pb-6">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                      • {plan.tagline}
                    </p>
                    {plan.discount && (
                      <span
                        className="rounded-full border-2 border-[#0A0A0A] bg-[#B8F5C8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0A0A0A]"
                        style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
                      >
                        {plan.discount}
                      </span>
                    )}
                  </div>
                  <h3 className="editorial-serif mt-4 text-[1.85rem] leading-[1.05] text-[#0A0A0A]">
                    Perfeito pra quem
                    <br />
                    <span className="italic text-[var(--accent)]">publica todo dia</span>
                  </h3>
                  <div className="mt-5">
                    {plan.anchor && (
                      <span className="text-xs font-semibold text-[var(--muted)] line-through">
                        {plan.anchor}
                      </span>
                    )}
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-5xl font-bold leading-none tracking-tight text-[#0A0A0A]">
                        {plan.price}
                      </span>
                      <span className="text-sm font-semibold text-[var(--muted)]">
                        {plan.period}
                      </span>
                    </div>
                  </div>
                  <Link href={plan.href} className={`${BTN_PRIMARY} mt-5 w-full`}>
                    {plan.cta}
                    <ArrowRight size={15} />
                  </Link>
                </div>

                <div
                  className="flex-1 p-8"
                  style={{
                    background:
                      "linear-gradient(135deg, #FF8534 0%, #EC6000 55%, #C94E00 100%)",
                  }}
                >
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {plan.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-[13px] font-semibold text-white"
                      >
                        <Check
                          size={15}
                          className="mt-0.5 shrink-0 text-white/95"
                          strokeWidth={3}
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.article>
            );
          }

          return (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.55 }}
              className="card-offset flex flex-col p-8"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                • {plan.tagline}
              </p>
              <h3 className="editorial-serif mt-3 text-[1.65rem] leading-tight text-[#0A0A0A]">
                {plan.name}
              </h3>
              {plan.anchor && (
                <span className="mt-3 text-xs font-semibold text-[var(--muted)] line-through">
                  {plan.anchor}
                </span>
              )}
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-5xl font-bold leading-none tracking-tight text-[#0A0A0A]">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm font-semibold text-[var(--muted)]">
                    {plan.period}
                  </span>
                )}
              </div>
              {plan.discount && (
                <span
                  className="mt-3 w-fit rounded-full border-2 border-[#0A0A0A] bg-[#FFE4CC] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0A0A0A]"
                  style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
                >
                  {plan.discount}
                </span>
              )}
              <ul className="mt-7 flex-1 space-y-3">
                {plan.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2.5 text-sm text-[#0A0A0A]/85"
                  >
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0 text-[var(--accent)]"
                      strokeWidth={2.5}
                    />
                    {b}
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className={`${BTN_SECONDARY} mt-8 w-full`}>
                {plan.cta}
                <ArrowRight size={15} />
              </Link>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Social proof — 3 tweet cards                                       */
/* ------------------------------------------------------------------ */

const TESTIMONIALS = [
  {
    name: "Ana Luiza",
    handle: "analuizamkt",
    content: [
      "Testei 6 ferramentas de carrossel com IA.",
      "Sequência Viral é a única que não devolve aquela copy cheirando a ChatGPT.",
      "Finalmente saio do feed sem parecer template.",
    ],
    reply: {
      name: "Sequência Viral",
      handle: "sequencia-viral",
      content: "Obrigado, Ana. Missão é exatamente essa.",
    },
  },
  {
    name: "Pedro Augusto",
    handle: "pedroaugustotech",
    content: [
      "Cola o link do YouTube, recebe 3 variações de carrossel em 20 segundos.",
      "Eu ainda levo mais tempo abrindo o Canva que publicando daqui.",
    ],
  },
  {
    name: "Carol Finanças",
    handle: "carolfinancas",
    content: [
      "Uso pra virar episódio de podcast em carrossel.",
      "Antes era um roteiro manual de 2h. Agora dá 5 minutos.",
      "Passei de 3 pra 12 posts por mês sem contratar ninguém.",
    ],
    reply: {
      name: "Sequência Viral",
      handle: "sequencia-viral",
      content: "Isso é o ROI que a gente gosta de ver.",
    },
  },
];

function SocialProof() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-14 max-w-2xl"
      >
        <span className="tag-pill">
          <Sparkles size={13} className="text-[var(--accent)]" />
          Quem usa
        </span>
        <h2 className="editorial-serif mt-6 text-[2.6rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Creators e agências BR.{" "}
          <span className="text-[var(--muted)]">Gente que posta pra caramba.</span>
        </h2>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <TweetCard
            key={t.handle}
            authorName={t.name}
            authorHandle={t.handle}
            content={t.content}
            className="rounded-[24px] border-2 border-[#0A0A0A] bg-[#FFFDF9] shadow-[6px_6px_0_0_#0A0A0A]"
            reply={
              t.reply
                ? {
                    authorName: t.reply.name,
                    authorHandle: t.reply.handle,
                    content: t.reply.content,
                  }
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ                                                                */
/* ------------------------------------------------------------------ */

function Faq() {
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <section id="faq" className="relative mx-auto max-w-4xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-10 max-w-xl"
      >
        <span className="tag-pill">
          <Lightbulb size={13} className="text-[var(--accent)]" />
          FAQ
        </span>
        <h2 className="editorial-serif mt-6 text-[2.6rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Perguntas antes de pagar.
        </h2>
      </motion.div>

      <div className="space-y-3">
        {LANDING_FAQ.map((item, index) => {
          const isOpen = openIdx === index;
          return (
            <motion.article
              key={item.q}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-5%" }}
              transition={{ delay: index * 0.04, duration: 0.4 }}
              className="rounded-2xl border-2 border-[#0A0A0A] bg-[#FFFDF9] p-5 shadow-[4px_4px_0_0_#0A0A0A]"
            >
              <button
                type="button"
                onClick={() => setOpenIdx((p) => (p === index ? -1 : index))}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
              >
                <span className="text-base font-bold text-[#0A0A0A]">{item.q}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="shrink-0"
                >
                  <ChevronDown size={18} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p
                      id={`faq-answer-${index}`}
                      className="pt-3 text-sm leading-relaxed text-[var(--muted)]"
                    >
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Final CTA                                                          */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t-4 border-[var(--accent)] bg-[#0A0A0A] px-5 py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-12deg, transparent, transparent 18px, rgba(255,133,52,0.4) 18px, rgba(255,133,52,0.4) 20px)",
        }}
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 bg-[#0A0A0A] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white/90"
        >
          <Sparkles size={13} className="text-[var(--accent-light)]" />
          Pronto pro primeiro post?
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="editorial-serif mt-8 text-[3rem] leading-[0.92] text-white sm:text-[4.5rem] lg:text-[5.2rem]"
        >
          Seu primeiro carrossel
          <br />
          <span className="italic text-[var(--accent-light)]">em 30 segundos.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70"
        >
          Cole um link, um texto ou uma ideia. A IA faz o resto — com a sua voz.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/app/login" className={`${BTN_PRIMARY} px-8 py-4 text-base`}>
            Criar carrossel grátis
            <ArrowRight size={18} />
          </Link>
          <Link href="/roadmap" className={`${BTN_OUTLINE_DARK} px-6 py-3.5`}>
            Ver roadmap
          </Link>
        </motion.div>
        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent-light)]" strokeWidth={2.5} />
            Sem cartão
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent-light)]" strokeWidth={2.5} />
            {FREE_PLAN_USAGE_LIMIT} carrosséis grátis
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent-light)]" strokeWidth={2.5} />
            Cancele quando quiser
          </span>
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer className="border-t-2 border-[#0A0A0A] bg-[#FFFDF9] px-5 pt-16 pb-10 text-sm">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <LogoMark />
              <span className="editorial-serif text-lg text-[#0A0A0A]">
                Sequência Viral<span className="text-[var(--accent)]">.</span>
              </span>
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed text-[#0A0A0A]/60">
              Cole um link. Publique um carrossel. Em minutos, não em horas.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A]/40">
              Produto
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/app/login"
                  className="text-[13px] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
                >
                  Criar carrossel
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  className="text-[13px] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/roadmap"
                  className="text-[13px] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
                >
                  Roadmap
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-[13px] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A]/40">
              Legal
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/privacy"
                  className="text-[13px] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
                >
                  Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-[13px] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
                >
                  Termos de uso
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A]/40">
              Contato
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="mailto:madureira@kaleidosdigital.com"
                  className="text-[13px] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
                >
                  madureira@kaleidosdigital.com
                </a>
              </li>
              <li>
                <a
                  href="https://kaleidos.ag"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
                >
                  Feito por Kaleidos
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#0A0A0A]/10 pt-6 sm:flex-row">
          <p className="text-[12px] text-[#0A0A0A]/40">
            &copy; {year} Sequência Viral. Todos os direitos reservados.
          </p>
          <p className="text-[12px] text-[#0A0A0A]/40">
            Feito por{" "}
            <a
              href="https://kaleidos.ag"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]"
            >
              Kaleidos
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile sticky CTA                                                  */
/* ------------------------------------------------------------------ */

function MobileStickyCtA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#0A0A0A] bg-[#FFFDF9] p-3 md:hidden">
      <Link
        href="/app/login"
        className={`${BTN_PRIMARY} w-full justify-center py-3 text-base`}
      >
        Criar carrossel grátis
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-20 text-[#0A0A0A] md:pb-0">
      <Header />
      <Hero />
      <TrustStrip />
      <ComoFunciona />
      <Features />
      <Demo />
      <Pricing />
      <SocialProof />
      <Faq />
      <FinalCta />
      <Footer />
      <MobileStickyCtA />
    </div>
  );
}
