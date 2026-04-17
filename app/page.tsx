"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  Sparkles,
  X,
  Zap,
  Palette,
  Workflow,
  Rocket,
  FileText,
  Brain,
  LayoutTemplate,
  Share2,
  Layers,
} from "lucide-react";
import { TweetCard } from "@/components/kokonutui/tweet-card";
import LandingHeroCarousel from "@/components/marketing/landing-hero-carousel";
import HeroFlowAnimation, {
  RotatingWord,
} from "@/components/marketing/hero-flow-animation";
import { LANDING_FAQ } from "@/lib/landing-faq";

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Processo", href: "#processo" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

/** Botões alinhados ao neo-brutal (docs/design/neo-brutal-app-shell) */
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0_0_#0A0A0A] transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#0A0A0A] active:translate-x-0 active:translate-y-0 active:shadow-[4px_4px_0_0_#0A0A0A]";
const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-[#FFFDF9] px-5 py-2.5 text-sm font-bold text-[#0A0A0A] shadow-[4px_4px_0_0_#0A0A0A] transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white";

const BTN_OUTLINE_DARK =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white bg-transparent px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0_0_rgba(255,255,255,0.9)] transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white/10";

const FEATURES = [
  {
    icon: Zap,
    tag: "Velocidade",
    title: "Cinco conceitos, três variações",
    description:
      "A IA propõe cinco ângulos; você escolhe um e recebe três versões do carrossel (dados, narrativa, provocação). Compare no mesmo lugar e publique a que converter melhor.",
    accent: "#f59e0b",
  },
  {
    icon: Layers,
    tag: "Visual",
    title: "Dois layouts: Editorial e Spotlight",
    description:
      "Mesmo texto e mesmo fluxo de geração — você escolhe se o slide parece revista editorial (laranja) ou destaque com hero image no topo (azul). Imagens e busca seguem o estilo do layout.",
    accent: "#EC6000",
  },
  {
    icon: Workflow,
    tag: "Fluxo",
    title: "Rápido ou avançado (Content Machine)",
    description:
      "Modo rápido: conceitos → carrossel em minutos. Modo avançado: triagem, headlines e espinha dorsal para quem quer mais controle na copy. O template visual não muda o texto — só o desenho do slide.",
    accent: "#60a5fa",
  },
  {
    icon: Rocket,
    tag: "Export",
    title: "1080×1350, pronto para redes",
    description:
      "Export em PNG (e PDF quando precisar) na proporção certa para Instagram e LinkedIn. Baixe slide a slide ou o pacote inteiro.",
    accent: "#a78bfa",
  },
];

const TESTIMONIALS: Array<{
  name: string;
  handle: string;
  avatar?: string;
  content: string[];
  reply?: { name: string; handle: string; content: string };
}> = [
  {
    name: "Ana Marketing",
    handle: "anamarketing",
    content: [
      "Sequência Viral virou meu copiloto de conteúdo.",
      "Faço carrossel em 3 minutos, não 3 horas.",
      "Testei 6 ferramentas antes. Essa é a primeira que entende tom brasileiro de verdade 🙌",
    ],
    reply: {
      name: "Sequência Viral",
      handle: "sequenciaviral",
      content: "Missão cumprida, Ana 🧡",
    },
  },
  {
    name: "Pedro Tech",
    handle: "pedrotech",
    content: [
      "Testei 8 ferramentas de IA pra conteúdo em 2026.",
      "Sequência Viral é a primeira que NÃO deixa o post cheirando a IA genérica.",
      "Finalmente alguém entendeu o problema.",
    ],
  },
  {
    name: "Lucas Cripto",
    handle: "lucascripto",
    content: [
      "Minha agência usa pro time todo.",
      "Economizamos ~15h/semana só em carrosséis.",
      "ROI absurdo. Bom demais.",
    ],
    reply: {
      name: "Sequência Viral",
      handle: "sequenciaviral",
      content: "Partiu escalar isso 🚀",
    },
  },
  {
    name: "Camila UX",
    handle: "camilaux",
    content: [
      "Sou designer e sempre odiei montar carrossel na mão.",
      "O Sequência Viral gera variações que eu só ajusto o visual e publico.",
      "Meu engajamento subiu 40% em 3 semanas.",
    ],
  },
  {
    name: "Rafa Finanças",
    handle: "rafafinancas",
    content: [
      "Posto conteúdo de educação financeira todos os dias.",
      "O Sequência Viral entende o tom que eu uso — direto, sem enrolação.",
      "Economizo pelo menos 1h por post. Essencial pra mim.",
    ],
    reply: {
      name: "Sequência Viral",
      handle: "sequenciaviral",
      content: "Constância + velocidade = resultado 💪",
    },
  },
  {
    name: "Thiago SaaS",
    handle: "thiagosaas",
    content: [
      "Gerencio 4 contas de clientes na agência.",
      "Cada uma com tom diferente. O Sequência Viral respeita o perfil de cada uma.",
      "Mudou completamente nosso workflow de produção de conteúdo.",
    ],
  },
  {
    name: "Juliana Coach",
    handle: "julianacoach",
    content: [
      "Antes eu travava olhando pra tela em branco por 40 minutos.",
      "Agora colo um insight, gero 3 variações e publico em 5 min.",
      "Meus alunos acham que eu contratei um social media 😂",
    ],
  },
  {
    name: "Felipe Dev",
    handle: "felipedev",
    content: [
      "A exportação em PNG pixel-perfect foi o que me ganhou.",
      "Tentei outras ferramentas e todas saíam borradas ou fora de proporção.",
      "Aqui é 1080×1350, nítido, pronto pra postar.",
    ],
    reply: {
      name: "Sequência Viral",
      handle: "sequenciaviral",
      content: "Pixel por pixel, sempre 🎯",
    },
  },
  {
    name: "Marina Nutrição",
    handle: "marinanutri",
    content: [
      "Uso pra transformar artigos do blog em carrosséis.",
      "Cole o link, gera, edita e publica. Direto ao ponto.",
      "Meu alcance no Instagram triplicou desde que comecei.",
    ],
  },
];


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

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[#0A0A0A] bg-[#FFFDF9]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark />
          <span className="editorial-serif text-xl text-[#0A0A0A]">
            Sequência Viral<span className="text-[var(--accent)]">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#0A0A0A]/70 transition-colors hover:bg-white hover:text-[#0A0A0A] hover:shadow-[inset_0_0_0_1px_rgba(10,10,10,0.12)]"
            >
              {item.label}
            </a>
          ))}
          <Link href="/app/login" className={`${BTN_PRIMARY} ml-2`}>
            Começar grátis
          </Link>
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

      {open && (
        <div className="border-t-2 border-[#0A0A0A] bg-[#FFFDF9] px-5 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-[#0A0A0A]/80 hover:bg-white"
              >
                {item.label}
              </a>
            ))}
            <Link href="/app/login" className={`${BTN_PRIMARY} mt-2 w-fit`}>
              Começar grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAF8] px-5 pb-0 pt-20 sm:pt-28">
      {/* Subtle radial gradient — matches Chatsheet light feel */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 55%, rgba(236,96,0,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Dot grid — extends across entire hero like Chatsheet */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ─── Text content (z-10, sits above animation) ─── */}
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E8E8E5] bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            <Sparkles size={12} />
          </span>
          <span className="text-[13px] font-semibold text-[#0A0A0A]/70">
            Carrosséis com IA · Editorial & Spotlight
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="editorial-serif mx-auto max-w-3xl text-[2.5rem] leading-[0.95] text-[#0A0A0A] sm:text-[3.5rem] lg:text-[4.25rem]"
        >
          Transforme{" "}
          <RotatingWord />
          <br />
          em posts{" "}
          <span className="italic text-[var(--accent)]">virais</span>
          <span className="text-[#0A0A0A]">.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]"
        >
          Cinco conceitos por tema, depois três variações de carrossel. Dois layouts visuais,
          modo rápido ou Content Machine para copy mais profunda — tudo com a voz da sua marca.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/app/login" className={BTN_PRIMARY}>
            Criar grátis
            <ArrowRight size={16} />
          </Link>
          <Link href="#processo" className={BTN_SECONDARY}>
            Como funciona
          </Link>
        </motion.div>

        {/* Trust bullets */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-[var(--muted)]"
        >
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent)]" strokeWidth={2.5} />
            Sem cartão
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent)]" strokeWidth={2.5} />
            5 carrosséis grátis
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent)]" strokeWidth={2.5} />
            2 layouts visuais
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent)]" strokeWidth={2.5} />
            Export PNG
          </span>
        </motion.p>

        {/* Mockup do app — antes só estava importado */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mt-10 flex w-full justify-center px-2"
        >
          <LandingHeroCarousel />
        </motion.div>
      </div>

      {/* ─── Animation scene — overlaps with text, fills entire hero ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 1 }}
        className="relative z-[1] -mt-8 sm:-mt-12"
      >
        <HeroFlowAnimation />
      </motion.div>

      {/* Bottom fade to next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FAFAF8] to-transparent" />
    </section>
  );
}

function TrustStrip() {
  return (
    <div className="border-b border-[#E8E8E5] bg-[#FAFAF8] py-5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 text-center font-mono text-[11px] uppercase tracking-widest text-[#0A0A0A]/50">
        <span className="flex max-w-[220px] items-start gap-2 sm:max-w-none sm:items-center">
          <Zap size={14} className="mt-0.5 shrink-0 text-[var(--accent)] sm:mt-0" />
          Ideia, link ou post viram carrossel
        </span>
        <span className="hidden sm:inline text-[#0A0A0A]/15">|</span>
        <span className="flex items-center gap-2">
          <Palette size={14} className="shrink-0 text-[var(--accent)]" />
          Editorial ou Spotlight
        </span>
        <span className="hidden sm:inline text-[#0A0A0A]/15">|</span>
        <span className="flex items-center gap-2">
          <Sparkles size={14} className="shrink-0 text-[var(--accent)]" />
          Plano Pro a partir de $9,99/mês
        </span>
      </div>
    </div>
  );
}

function MobileStickyCtA() {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t-2 border-[#0A0A0A] bg-[#FFFDF9] p-3 md:hidden">
      <Link href="/app/login" className={`${BTN_PRIMARY} w-full justify-center py-3 text-base`}>
        Criar grátis
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-24">
      <div className="mb-14 max-w-2xl">
        <span className="tag-pill">
          <Zap size={13} className="text-[var(--accent)]" />
          Features
        </span>
        <h2 className="editorial-serif mt-6 text-[2.75rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Tudo que você precisa.
          <br />
          <span className="text-[var(--muted)]">Nada que você não precisa.</span>
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          Conceitos, variações, dois templates visuais e export em alta — sem perder tempo trocando de app.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {FEATURES.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="card-offset p-8">
              <div className="flex items-start justify-between gap-4">
                <span
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#0A0A0A] text-white"
                  style={{
                    background: `linear-gradient(180deg, ${item.accent}, ${item.accent}dd)`,
                    boxShadow: "3px 3px 0 0 #0A0A0A",
                  }}
                >
                  <Icon size={20} strokeWidth={2.3} />
                </span>
                <span className="rounded-full border-2 border-[#0A0A0A] bg-white px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A]">
                  {item.tag}
                </span>
              </div>
              <h3 className="mt-7 text-[22px] font-bold leading-tight tracking-tight text-[#0A0A0A]">
                {item.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
                {item.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Processo() {
  const steps = useMemo(
    () =>
      [
        {
          title: "Entrada",
          desc: "Cole link, PDF, Reel ou escreva a ideia em uma linha.",
          icon: FileText,
        },
        {
          title: "Estrutura",
          desc: "Modo rápido: a partir do conceito escolhido, a IA monta o carrossel. Modo avançado: triagem e espinha dorsal no Content Machine.",
          icon: Brain,
        },
        {
          title: "Refino",
          desc: "Escolha Editorial ou Spotlight, ajuste fontes, imagens (busca ou IA) e texto no preview.",
          icon: LayoutTemplate,
        },
        {
          title: "Publicar",
          desc: "Exporte PNG 4:5 (ou PDF) e poste no Instagram ou LinkedIn.",
          icon: Share2,
        },
      ] as const,
    []
  );

  return (
    <section id="processo" className="mx-auto max-w-6xl px-5 py-20">
      <div className="card-offset-orange p-8 md:p-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,280px)] lg:items-start">
          <div>
            <span className="tag-pill border-white/50 bg-white/10 text-white">
              Processo
            </span>
            <h2 className="editorial-serif mt-6 max-w-3xl text-4xl leading-[0.92] text-white md:text-[3.5rem]">
              Um lugar para ideia, texto, visual e export.
            </h2>
            <p className="mt-5 max-w-2xl text-white/85">
              Quando cada etapa vive em um app diferente, a mensagem esfria e o tempo some. Aqui você gera,
              escolhe o layout, revisa e baixa os PNG — sem sair do fluxo.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {steps.map(({ title, desc, icon: StepIcon }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border-2 border-white/35 bg-white/10 p-4 shadow-[3px_3px_0_0_rgba(10,10,10,0.35)]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-white/50 bg-white/15 text-white">
                    <StepIcon size={20} strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-white">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/85">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[280px] lg:mx-0 lg:max-w-none">
            <div className="rounded-3xl border-2 border-[#0A0A0A] bg-white/10 p-2 shadow-[6px_6px_0_0_#0A0A0A]">
              <div className="overflow-hidden rounded-2xl border border-white/20 bg-[#FFFDF9]/95">
                <Image
                  src="/brand/landing/process-spot.png"
                  alt="Fluxo: ideia, criação e publicação"
                  width={560}
                  height={560}
                  className="h-auto w-full object-cover"
                  sizes="280px"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PLANS_DATA = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    tagline: "Pra experimentar",
    bullets: [
      "5 carrosséis/mês",
      "Marca d'água Sequência Viral",
      "2 layouts · modo rápido e avançado",
      "Export PNG",
      "1 perfil",
    ],
    cta: "Criar conta grátis",
    href: "/app/login",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$9.99",
    period: "/mês",
    tagline: "Pra quem posta todo dia",
    bullets: [
      "30 carrosséis/mês",
      "Sem marca d'água",
      "Editorial & Spotlight inclusos",
      "Imagens com IA / busca",
      "Export PNG",
      "1 perfil",
    ],
    cta: "Assinar Pro",
    href: "/app/checkout?plan=pro",
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: "$29.99",
    period: "/mês",
    tagline: "Pra times e agências",
    bullets: [
      "Carrosséis ilimitados",
      "3 seats inclusos",
      "Suporte prioritário",
      "Custom branding",
      "Analytics avançado",
      "API de integração",
    ],
    cta: "Assinar Business",
    href: "/app/checkout?plan=business",
    highlighted: false,
  },
] as const;

function Pricing() {
  return (
    <section id="pricing" className="relative mx-auto max-w-6xl border-t-2 border-[#0A0A0A]/10 px-5 py-24">
      <div className="mb-14 max-w-2xl">
        <span className="tag-pill">
          <Rocket size={13} className="text-[var(--accent)]" />
          Planos
        </span>
        <h2 className="editorial-serif mt-6 text-[2.75rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Simples e transparente.
          <br />
          <span className="text-[var(--muted)]">Comece grátis hoje.</span>
        </h2>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {PLANS_DATA.map((plan) => {
          const isHighlighted = plan.highlighted;

          if (isHighlighted) {
            return (
              <article
                key={plan.id}
                className="relative flex flex-col overflow-hidden rounded-[28px] border-2 border-[#0A0A0A] shadow-[8px_8px_0_0_#0A0A0A] lg:-translate-y-2"
              >
                <span className="absolute right-4 top-4 z-10 rounded-full border-2 border-[#0A0A0A] bg-[#0A0A0A] px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest text-white">
                  Mais popular
                </span>

                <div className="relative bg-[#FFFDF9] p-8 pb-6">
                  <div className="flex items-start gap-2">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                      • {plan.tagline}
                    </p>
                    <span className="shrink-0 rounded-full border-2 border-[#0A0A0A] bg-[#B8F5C8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0A0A0A]">
                      −50%
                    </span>
                  </div>
                  <h3 className="editorial-serif mt-4 text-[1.85rem] leading-[1.05] text-[#0A0A0A]">
                    Perfeito pra quem
                    <br />
                    <span className="italic text-[var(--accent)]">publica todo dia</span>
                  </h3>
                  <div className="mt-5">
                    <span className="text-xs font-semibold text-[var(--muted)] line-through">
                      $19.99
                    </span>
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
                    background: "linear-gradient(135deg, #FF8534 0%, #EC6000 55%, #C94E00 100%)",
                  }}
                >
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {plan.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-center gap-2 text-[13px] font-semibold text-white"
                      >
                        <Check size={15} className="shrink-0 text-white/90" strokeWidth={3} />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          }

          return (
            <article key={plan.id} className="card-offset flex flex-col p-8">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                • {plan.tagline}
              </p>
              <h3 className="editorial-serif mt-3 text-[1.65rem] leading-tight text-[#0A0A0A]">
                {plan.name}
              </h3>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-5xl font-bold leading-none tracking-tight text-[#0A0A0A]">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm font-semibold text-[var(--muted)]">{plan.period}</span>
                )}
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {plan.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5 text-sm text-[#0A0A0A]/85">
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0 text-[var(--accent)]"
                      strokeWidth={2.5}
                    />
                    {bullet}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`${BTN_SECONDARY} mt-8 w-full border-[#0A0A0A] bg-white hover:bg-[#FFFDF9]`}
              >
                {plan.cta}
                <ArrowRight size={15} />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Testimonials() {
  const col1 = TESTIMONIALS.filter((_, i) => i % 3 === 0);
  const col2 = TESTIMONIALS.filter((_, i) => i % 3 === 1);
  const col3 = TESTIMONIALS.filter((_, i) => i % 3 === 2);

  const renderCard = (item: (typeof TESTIMONIALS)[number]) => (
    <TweetCard
      key={item.handle}
      authorName={item.name}
      authorHandle={item.handle}
      avatarUrl={item.avatar}
      content={item.content}
      className="rounded-[24px] border-2 border-[#0A0A0A] bg-[#FFFDF9] shadow-[6px_6px_0_0_#0A0A0A]"
      reply={
        item.reply
          ? {
              authorName: item.reply.name,
              authorHandle: item.reply.handle,
              content: item.reply.content,
            }
          : undefined
      }
    />
  );

  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <div className="mb-14 text-center">
        <span className="tag-pill">
          <Sparkles size={13} className="text-[var(--accent)]" />
          Quem usa
        </span>
        <h2 className="editorial-serif mt-6 text-[2.75rem] leading-[0.95] text-[#0A0A0A] sm:text-5xl">
          Quem usa, continua usando.{" "}
          <span className="text-[var(--muted)]">E conta por aí.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[var(--muted)]">
          Creators, agências e freelancers que trocaram horas de design por minutos de resultado.
        </p>
      </div>

      {/* Masonry columns */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-5">
        <div className="flex flex-col gap-5">{col1.map(renderCard)}</div>
        <div className="flex flex-col gap-5">{col2.map(renderCard)}</div>
        <div className="flex flex-col gap-5">{col3.map(renderCard)}</div>
      </div>

      {/* Mobile/tablet: 2 cols or 1 col */}
      <div className="grid gap-5 md:grid-cols-2 lg:hidden">
        {TESTIMONIALS.map(renderCard)}
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="mx-auto max-w-4xl px-5 py-20">
      <div className="mb-8 text-center">
        <span className="tag-pill">FAQ</span>
        <h2 className="editorial-serif mt-6 text-5xl leading-[0.95] text-[#0A0A0A]">
          Dúvidas antes de começar?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] text-[var(--muted)]">
          Preços, export, limites do plano grátis e uso da IA — respostas diretas abaixo.
        </p>
      </div>

      <div className="space-y-3">
        {LANDING_FAQ.map((item, index) => {
          const isOpen = open === index;
          return (
            <article key={item.q} className="card-offset p-5">
              <button
                type="button"
                onClick={() => setOpen((prev) => (prev === index ? -1 : index))}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
              >
                <span className="text-base font-bold text-[#0A0A0A]">{item.q}</span>
                <ChevronDown className={`transition-transform ${isOpen ? "rotate-180" : ""}`} size={18} />
              </button>
              {isOpen && <p id={`faq-answer-${index}`} className="mt-3 text-sm text-[var(--muted)]">{item.a}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t-4 border-[var(--accent)] bg-[#0A0A0A] py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-12deg, transparent, transparent 18px, rgba(255,133,52,0.35) 18px, rgba(255,133,52,0.35) 20px)",
        }}
      />

      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 bg-[#0A0A0A] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white/90">
          <Sparkles size={13} className="text-[var(--accent-light)]" />
          Pronto pro primeiro post?
        </span>
        <h2 className="editorial-serif mt-8 text-[3rem] leading-[0.92] text-white sm:text-[4.5rem] lg:text-[5.5rem]">
          Seu primeiro carrossel
          <br />
          <span className="text-[var(--accent-light)] italic">em 30 segundos.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
          Cole um link, um texto ou só uma ideia. Conceitos, variações e o layout que combina com seu post —
          com sua voz e seu timing.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/app/login" className={`${BTN_PRIMARY} px-8 py-4 text-base`}>
            Começar grátis
            <ArrowRight size={18} />
          </Link>
          <Link href="/app/roadmap" className={`${BTN_OUTLINE_DARK} px-6 py-3.5`}>
            Ver roadmap
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent-light)]" strokeWidth={2.5} /> Sem cartão
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent-light)]" strokeWidth={2.5} /> 5 carrosséis
            grátis
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check size={14} className="text-[var(--accent-light)]" strokeWidth={2.5} /> Cancele quando
            quiser
          </span>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t-2 border-[#0A0A0A] bg-[#FFFDF9] px-5 pt-16 pb-8 text-sm">
      <div className="mx-auto max-w-6xl">
        {/* Top grid */}
        <div className="grid gap-10 md:grid-cols-4 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <LogoMark />
              <span className="editorial-serif text-lg text-[#0A0A0A]">
                Sequência Viral<span className="text-[var(--accent)]">.</span>
              </span>
            </div>
            <p className="text-[13px] text-[#0A0A0A]/60 leading-relaxed mb-5">
              Carrosséis com IA que parecem feitos por você. Conceitos, variações, dois layouts e export PNG no mesmo lugar.
            </p>
            <a
              href="https://kaleidos.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#0A0A0A]/10 bg-white px-3 py-2 text-[11px] text-[#0A0A0A]/50 hover:border-[#0A0A0A]/25 hover:text-[#0A0A0A]/70 transition-all"
            >
              <span>Powered by</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/kaleidos-logo.svg"
                alt="Kaleidos"
                className="inline-block h-4 w-auto"
              />
              <span className="font-bold">Kaleidos</span>
            </a>
          </div>

          {/* Produto */}
          <div>
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A]/40 mb-4">
              Produto
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/app/login" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Criar carrossel
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Planos e preços
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Roadmap
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Conteúdo */}
          <div>
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A]/40 mb-4">
              Conteúdo
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/blog" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/blog/como-criar-carrosseis-virais-instagram-2026" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Guia: carrosséis virais
                </Link>
              </li>
              <li>
                <Link href="/blog/como-usar-ia-criar-conteudo-redes-sociais" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  IA para conteúdo
                </Link>
              </li>
              <li>
                <Link href="/blog/guia-completo-tamanhos-instagram-twitter-linkedin" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Guia de tamanhos
                </Link>
              </li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0A0A0A]/40 mb-4">
              Empresa
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a href="mailto:hi@sequencia-viral.app" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Contato
                </a>
              </li>
              <li>
                <Link href="/terms" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Termos de uso
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                  Privacidade
                </Link>
              </li>
              <li>
                <a
                  href="https://twitter.com/sequenciaviral"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors"
                >
                  Twitter / X
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/sequenciaviral"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider + bottom */}
        <div className="border-t border-[#0A0A0A]/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[#0A0A0A]/40">
            &copy; {year} Sequência Viral. Todos os direitos reservados.
          </p>
          <p className="text-[12px] text-[#0A0A0A]/40">
            Feito com ☕ por{" "}
            <a
              href="https://kaleidos.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:text-[#0A0A0A]/70 transition-colors"
            >
              Kaleidos
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0A0A0A] pb-16 md:pb-0">
      <Header />
      <Hero />
      <TrustStrip />
      <Features />
      <Processo />
      <Pricing />
      <Testimonials />
      <Faq />
      <FinalCta />
      <Footer />
      <MobileStickyCtA />
    </div>
  );
}
