"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import posthog from "posthog-js";

/**
 * Landing /v2 — ANGLE: AUTOPILOT
 * Narrativa: "Seu Instagram no piloto automático em 5min".
 * Inspiração: posttar.com — direto, simples, foco em constância.
 * CTAs apontam pra /app/login?mode=signup (3 carrosséis grátis).
 *
 * Evento PostHog: lp_viewed { lp_variant: "autopilot" }
 */

const STATS = [
  { value: "60s", label: "Carrossel pronto" },
  { value: "3 grátis", label: "Pra testar" },
  { value: "100%", label: "Sem Canva" },
  { value: "5min", label: "Setup completo" },
];

const SECTIONS = [
  {
    eyebrow: "CONSTÂNCIA",
    title: "Poste todo dia sem precisar começar do zero",
    body:
      "Sua constância não depende mais de inspiração. A Sequência Viral cria, agenda e publica pra você, todo dia. Conectou o Instagram, ligou o piloto automático.",
    cta: "Ver como funciona",
    accent: true,
  },
  {
    eyebrow: "SEM DESIGNER",
    title: "Carrosséis com a sua marca, sem abrir o Canva",
    body:
      "Conteúdo no padrão de um social media e designer profissionais, com as suas cores, fontes e logo aplicados automaticamente. Você não precisa montar nada — só revisar antes de publicar.",
    cta: "Quero testar grátis",
    accent: false,
  },
  {
    eyebrow: "CONVERSÃO",
    title: "Seu perfil trabalhando pra trazer clientes, não só curtidas",
    body:
      "A IA escreve no seu tom, sobre o seu nicho, com hook que dá vontade de ler. Resultado: carrossel salvável, comentário que vira DM, DM que vira venda.",
    cta: "Começar agora",
    accent: false,
  },
];

const HOW = [
  {
    step: "01",
    title: "Conecte o seu Instagram",
    body: "1 clique via parceria oficial com a Meta. Zero risco de banimento.",
  },
  {
    step: "02",
    title: "Refine o DNA da sua marca",
    body: "Cores, fontes, logo e tom de voz. O que torna os carrosséis seus.",
  },
  {
    step: "03",
    title: "Ligue o Piloto Automático",
    body:
      "Escolha frequência e horários. A máquina cria, monta e publica por você.",
  },
];

const FAQ = [
  {
    q: "Corro risco de banimento no Instagram?",
    a: "Não. Usamos a parceria oficial da Meta (Graph API), o mesmo padrão de segurança do próprio app do Instagram. Nenhuma senha sai do seu navegador.",
  },
  {
    q: "É automático mesmo? Preciso escolher as imagens?",
    a: "É automático de verdade. A IA escolhe imagens (banco ou geradas) baseadas no contexto. Mas se você quiser, pode revisar e trocar antes de publicar.",
  },
  {
    q: "Preciso saber de design ou marketing pra usar?",
    a: "Não. A Sequência Viral substitui o designer e o copywriter. Você cola um link (vídeo, artigo, post) ou só uma ideia — ela escreve, monta e exporta.",
  },
  {
    q: "Os carrosséis vão parecer com a minha marca?",
    a: "Sim. Você configura cores, fontes e logo uma vez. Todo carrossel novo já sai com a sua identidade visual aplicada.",
  },
  {
    q: "Posso editar os posts antes de publicar?",
    a: "Sim. Tudo é editável: texto, fonte, cor, ordem dos slides, template. Você aprova antes de ir ao ar.",
  },
  {
    q: "Tem teste grátis?",
    a: "Sim — 3 carrosséis grátis pra testar. Sem cartão. Se gostar, assina por R$ 49,90/mês.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sem fidelidade. Cancela pelo painel em 2 cliques.",
  },
];

export default function LandingAutopilot() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    try {
      posthog.capture("lp_viewed", { lp_variant: "autopilot" });
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <main
      style={{
        background: "var(--sv-paper)",
        color: "var(--sv-ink)",
        fontFamily: "var(--sv-sans)",
        minHeight: "100vh",
      }}
    >
      {/* ============ TOP BAR ============ */}
      <header className="border-b" style={{ borderColor: "rgba(10,9,8,0.08)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/v2" className="font-bold tracking-tight text-lg">
            Sequência <span style={{ color: "var(--sv-green)" }}>Viral</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/app/login"
              className="sv-btn sv-btn-ghost"
              style={{ padding: "8px 14px", fontSize: 11 }}
            >
              Entrar
            </Link>
            <Link
              href="/app/login?mode=signup"
              className="sv-btn sv-btn-primary"
              style={{ padding: "8px 14px", fontSize: 11 }}
            >
              Testar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="mx-auto max-w-4xl px-5 pt-16 pb-12 text-center sm:pt-24 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-wider"
          style={{
            borderColor: "rgba(10,9,8,0.15)",
            background: "rgba(124,240,103,0.12)",
            color: "var(--sv-ink)",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--sv-green)" }}
          />
          3 carrosséis grátis · sem cartão
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
        >
          Seu Instagram no <br />
          <span style={{ color: "var(--sv-green)" }}>piloto automático</span>{" "}
          em 5min
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
          style={{ color: "rgba(10,9,8,0.72)" }}
        >
          Poste carrosséis com a sua marca todo dia no seu perfil sem precisar
          de designer, copywriter… nem de tempo.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25 }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
        >
          <Link
            href="/app/login?mode=signup"
            className="sv-btn sv-btn-primary w-full sm:w-auto"
            style={{
              padding: "18px 28px",
              fontSize: 13,
              minHeight: 52,
              fontWeight: 700,
            }}
          >
            Experimente com 3 carrosséis →
          </Link>
          <a
            href="#como-funciona"
            className="text-sm font-medium underline-offset-4 hover:underline"
            style={{ color: "rgba(10,9,8,0.65)" }}
          >
            Ver como funciona
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4"
          style={{
            borderColor: "rgba(10,9,8,0.10)",
            background: "rgba(10,9,8,0.06)",
          }}
        >
          {STATS.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center px-4 py-6"
              style={{ background: "var(--sv-paper)" }}
            >
              <div className="text-2xl font-bold sm:text-3xl">{s.value}</div>
              <div
                className="mt-1 text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "rgba(10,9,8,0.55)" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ============ 3 SEÇÕES (CONSTÂNCIA / SEM DESIGNER / CONVERSÃO) ============ */}
      <section className="mx-auto max-w-5xl space-y-12 px-5 pb-20 sm:space-y-20">
        {SECTIONS.map((sec, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="grid items-center gap-8 sm:grid-cols-[1.1fr_1fr] sm:gap-14"
          >
            <div>
              <div
                className="mb-3 inline-block text-[11px] font-mono font-semibold uppercase tracking-[0.18em]"
                style={{
                  color: sec.accent ? "var(--sv-green)" : "rgba(10,9,8,0.55)",
                }}
              >
                {sec.eyebrow}
              </div>
              <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {sec.title}
              </h2>
              <p
                className="mt-4 text-base leading-relaxed sm:text-lg"
                style={{ color: "rgba(10,9,8,0.70)" }}
              >
                {sec.body}
              </p>
              <Link
                href="/app/login?mode=signup"
                className="sv-btn sv-btn-outline mt-6 inline-flex"
                style={{ padding: "12px 20px", fontSize: 12 }}
              >
                {sec.cta} →
              </Link>
            </div>

            {/* Visual side — mockup-ish card */}
            <div
              className="relative rounded-2xl border p-6 sm:p-8"
              style={{
                background: sec.accent
                  ? "rgba(124,240,103,0.10)"
                  : "rgba(10,9,8,0.04)",
                borderColor: sec.accent
                  ? "rgba(124,240,103,0.30)"
                  : "rgba(10,9,8,0.10)",
                boxShadow: sec.accent
                  ? "4px 4px 0 0 var(--sv-green)"
                  : "4px 4px 0 0 rgba(10,9,8,0.10)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: "rgba(10,9,8,0.20)" }}
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: "rgba(10,9,8,0.20)" }}
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: "var(--sv-green)" }}
                />
              </div>
              <div className="mt-5 space-y-2">
                <div
                  className="h-2 w-3/4 rounded"
                  style={{ background: "rgba(10,9,8,0.16)" }}
                />
                <div
                  className="h-2 w-full rounded"
                  style={{ background: "rgba(10,9,8,0.08)" }}
                />
                <div
                  className="h-2 w-5/6 rounded"
                  style={{ background: "rgba(10,9,8,0.08)" }}
                />
                <div
                  className="h-2 w-4/5 rounded"
                  style={{ background: "rgba(10,9,8,0.08)" }}
                />
              </div>
              <div className="mt-6 flex items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-wider"
                  style={{
                    background: "var(--sv-ink)",
                    color: "var(--sv-paper)",
                  }}
                >
                  {sec.eyebrow}
                </span>
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-wider"
                  style={{
                    background: "rgba(10,9,8,0.08)",
                    color: "rgba(10,9,8,0.65)",
                  }}
                >
                  Auto
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* ============ COMO FUNCIONA ============ */}
      <section
        id="como-funciona"
        className="border-y"
        style={{
          borderColor: "rgba(10,9,8,0.10)",
          background: "rgba(10,9,8,0.03)",
        }}
      >
        <div className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <div className="text-center">
            <div
              className="mb-3 inline-block text-[11px] font-mono font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--sv-green)" }}
            >
              EM 5 MINUTOS VOCÊ TÁ NO AR
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Setup feito uma vez. <br className="hidden sm:block" />
              Conteúdo todo dia depois.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {HOW.map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border bg-white p-6 sm:p-8"
                style={{
                  borderColor: "rgba(10,9,8,0.10)",
                  boxShadow: "4px 4px 0 0 rgba(10,9,8,0.08)",
                }}
              >
                <div
                  className="font-mono text-3xl font-bold"
                  style={{ color: "var(--sv-green)" }}
                >
                  {h.step}
                </div>
                <h3 className="mt-4 text-lg font-bold leading-tight">
                  {h.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "rgba(10,9,8,0.65)" }}
                >
                  {h.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Simples como deve ser
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-base sm:text-lg"
            style={{ color: "rgba(10,9,8,0.65)" }}
          >
            Sem pegadinhas. Cancele quando quiser.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {/* FREE */}
          <div
            className="rounded-2xl border bg-white p-6 sm:p-7"
            style={{
              borderColor: "rgba(10,9,8,0.10)",
            }}
          >
            <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(10,9,8,0.55)" }}>
              GRÁTIS
            </div>
            <div className="mt-3">
              <span className="text-4xl font-bold">R$ 0</span>
              <span className="ml-2 text-sm" style={{ color: "rgba(10,9,8,0.55)" }}>
                pra sempre
              </span>
            </div>
            <p className="mt-3 text-sm" style={{ color: "rgba(10,9,8,0.65)" }}>
              Teste sem cartão. Veja se serve pra você.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li>✓ 3 carrosséis pra testar</li>
              <li>✓ Templates Futurista + Twitter</li>
              <li>✓ Export PNG pronto pra postar</li>
              <li style={{ color: "rgba(10,9,8,0.45)" }}>· Com marca d'água</li>
            </ul>
            <Link
              href="/app/login?mode=signup"
              className="sv-btn sv-btn-outline mt-7 w-full justify-center"
              style={{ padding: "14px 18px", fontSize: 12, minHeight: 48 }}
            >
              Começar grátis
            </Link>
          </div>

          {/* CREATOR (popular) */}
          <div
            className="relative rounded-2xl border-2 bg-white p-6 sm:p-7"
            style={{
              borderColor: "var(--sv-green)",
              boxShadow: "6px 6px 0 0 var(--sv-green)",
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--sv-ink)",
                color: "var(--sv-paper)",
              }}
            >
              MAIS POPULAR
            </div>
            <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--sv-green)" }}>
              CREATOR
            </div>
            <div className="mt-3">
              <span
                className="text-xl line-through"
                style={{ color: "rgba(10,9,8,0.40)" }}
              >
                R$ 99,90
              </span>
              <div>
                <span className="text-4xl font-bold">R$ 49,90</span>
                <span className="ml-2 text-sm" style={{ color: "rgba(10,9,8,0.55)" }}>
                  /mês
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm" style={{ color: "rgba(10,9,8,0.65)" }}>
              Pro criador que posta sério todo dia.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li>✓ 10 carrosséis por mês</li>
              <li>✓ Sem marca d'água</li>
              <li>✓ 1 perfil de marca (cor + fonte + logo)</li>
              <li>✓ Imagens IA (Imagen 4) + stock</li>
              <li>✓ Todas as origens (YouTube, blog, IG, ideia)</li>
            </ul>
            <Link
              href="/app/login?mode=signup"
              className="sv-btn sv-btn-primary mt-7 w-full justify-center"
              style={{ padding: "14px 18px", fontSize: 12, minHeight: 48, fontWeight: 700 }}
            >
              Experimente agora →
            </Link>
          </div>

          {/* PRO */}
          <div
            className="rounded-2xl border bg-white p-6 sm:p-7"
            style={{
              borderColor: "rgba(10,9,8,0.10)",
            }}
          >
            <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(10,9,8,0.55)" }}>
              PRO
            </div>
            <div className="mt-3">
              <span
                className="text-xl line-through"
                style={{ color: "rgba(10,9,8,0.40)" }}
              >
                R$ 199,90
              </span>
              <div>
                <span className="text-4xl font-bold">R$ 97,90</span>
                <span className="ml-2 text-sm" style={{ color: "rgba(10,9,8,0.55)" }}>
                  /mês
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm" style={{ color: "rgba(10,9,8,0.65)" }}>
              Piloto automático completo. Conecta IG + LinkedIn.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li>✓ 30 carrosséis por mês</li>
              <li>✓ Conecta Instagram + LinkedIn</li>
              <li>✓ Agendamento automático</li>
              <li>✓ Imagens IA + stock ilimitado</li>
              <li>✓ Suporte prioritário</li>
            </ul>
            <Link
              href="/app/login?mode=signup"
              className="sv-btn sv-btn-outline mt-7 w-full justify-center"
              style={{ padding: "14px 18px", fontSize: 12, minHeight: 48 }}
            >
              Quero o Pro
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section
        className="border-y"
        style={{
          borderColor: "rgba(10,9,8,0.10)",
          background: "rgba(10,9,8,0.03)",
        }}
      >
        <div className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Perguntas frequentes
          </h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((f, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={i}
                  className="rounded-xl border bg-white"
                  style={{ borderColor: "rgba(10,9,8,0.10)" }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="text-[15px] font-semibold">{f.q}</span>
                    <span
                      className="ml-4 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform"
                      style={{
                        background: open
                          ? "var(--sv-green)"
                          : "rgba(10,9,8,0.06)",
                        color: open ? "var(--sv-ink)" : "rgba(10,9,8,0.55)",
                        transform: open ? "rotate(45deg)" : "rotate(0deg)",
                      }}
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <div
                      className="px-5 pb-5 text-sm leading-relaxed"
                      style={{ color: "rgba(10,9,8,0.70)" }}
                    >
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
        <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Ligue o <span style={{ color: "var(--sv-green)" }}>piloto automático</span>{" "}
          do seu Instagram hoje
        </h2>
        <p
          className="mx-auto mt-5 max-w-xl text-base sm:text-lg"
          style={{ color: "rgba(10,9,8,0.70)" }}
        >
          3 carrosséis grátis pra testar. 5 minutos de setup. Sem cartão, sem
          fidelidade, sem letra miúda.
        </p>
        <Link
          href="/app/login?mode=signup"
          className="sv-btn sv-btn-primary mt-10 inline-flex"
          style={{
            padding: "20px 32px",
            fontSize: 14,
            minHeight: 56,
            fontWeight: 700,
          }}
        >
          Experimente grátis →
        </Link>
        <p
          className="mt-4 text-xs"
          style={{ color: "rgba(10,9,8,0.50)" }}
        >
          Sem cartão · Cancele com 2 cliques
        </p>
      </section>

      {/* ============ FOOTER ============ */}
      <footer
        className="border-t"
        style={{ borderColor: "rgba(10,9,8,0.10)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 sm:flex-row">
          <div className="text-xs" style={{ color: "rgba(10,9,8,0.55)" }}>
            © 2026 Sequência Viral · Produto da{" "}
            <a
              href="https://kaleidos.com.br"
              className="font-semibold underline-offset-4 hover:underline"
            >
              Kaleidos
            </a>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: "rgba(10,9,8,0.55)" }}>
            <Link href="/privacy" className="hover:underline">
              Privacidade
            </Link>
            <Link href="/terms" className="hover:underline">
              Termos
            </Link>
            <Link href="/" className="hover:underline">
              Versão completa
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
