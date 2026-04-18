"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Crown, Sparkles, Star, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLANS, FREE_PLAN_USAGE_LIMIT } from "@/lib/pricing";
import posthog from "posthog-js";

type PlanCard = {
  id: "free" | "pro" | "business";
  name: string;
  price: string;
  priceNote: string;
  anchor?: string;
  badge?: string;
  tagline: string;
  features: readonly string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
};

const CARDS: PlanCard[] = [
  {
    id: "free",
    name: "Grátis",
    price: "US$ 0",
    priceNote: "pra sempre",
    tagline: "Pra testar o fluxo.",
    features: [
      `${FREE_PLAN_USAGE_LIMIT} carrosséis por mês`,
      "Todas as origens (YouTube, blog, Instagram, ideia)",
      "Editor completo",
      "Export PNG com marca d'água",
    ],
    ctaLabel: "Continuar no grátis",
    ctaHref: "/app/create",
  },
  {
    id: "pro",
    name: PLANS.pro.name,
    price: "US$ 9,99",
    priceNote: "por mês",
    anchor: "US$ 19,99",
    badge: "Mais popular",
    tagline: "Pra quem posta todo dia.",
    features: PLANS.pro.features,
    ctaLabel: "Assinar Pro",
    ctaHref: "/app/checkout?plan=pro",
    highlight: true,
  },
  {
    id: "business",
    name: PLANS.business.name,
    price: "US$ 29,99",
    priceNote: "por mês",
    anchor: "US$ 49,99",
    tagline: "Pra times e agências.",
    features: PLANS.business.features,
    ctaLabel: "Assinar Business",
    ctaHref: "/app/checkout?plan=business",
  },
];

export default function PlansPage() {
  const { profile } = useAuth();
  const currentPlan = profile?.plan ?? "free";

  return (
    <div className="mx-auto max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="tag-pill mb-6">
          <Sparkles size={13} className="text-[var(--accent)]" />
          Planos e upgrade
        </span>
        <h1 className="editorial-serif text-[2.5rem] sm:text-[3.5rem] md:text-[5rem] text-[var(--foreground)] leading-[0.95]">
          Escolha o plano que{" "}
          <span className="italic text-[var(--accent)]">cabe no seu ritmo.</span>
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)] max-w-2xl">
          Todos os planos têm acesso a todas as origens (YouTube, blog, Instagram,
          ideia), modo avançado e export em PNG/PDF. A diferença é quantos
          carrosséis por mês e marca d&apos;água.
        </p>
      </motion.div>

      {/* Planos */}
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {CARDS.map((card, i) => {
          const isCurrent = currentPlan === card.id;
          return (
            <motion.article
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`relative rounded-[28px] border-2 p-7 transition-all ${
                card.highlight
                  ? "border-[#0A0A0A] bg-[#FFFDF9] shadow-[6px_6px_0_0_#0A0A0A]"
                  : "border-black/10 bg-white shadow-[3px_3px_0_0_rgba(10,10,10,0.08)]"
              }`}
            >
              {card.badge && (
                <span className="absolute -top-3 left-7 rounded-full bg-[var(--accent)] border-2 border-[#0A0A0A] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-[2px_2px_0_0_#0A0A0A]">
                  <Star size={10} className="inline -mt-0.5 mr-1" />
                  {card.badge}
                </span>
              )}

              <div className="flex items-center gap-2">
                {card.id === "free" && <Zap size={18} className="text-[var(--muted)]" />}
                {card.id === "pro" && <Sparkles size={18} className="text-[var(--accent)]" />}
                {card.id === "business" && <Crown size={18} className="text-[var(--accent)]" />}
                <h2 className="editorial-serif text-3xl text-[#0A0A0A]">{card.name}</h2>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{card.tagline}</p>

              <div className="mt-6 flex items-baseline gap-2">
                {card.anchor && (
                  <span className="text-base font-semibold text-zinc-400 line-through">
                    {card.anchor}
                  </span>
                )}
                <span className="text-4xl font-black text-[#0A0A0A]">
                  {card.price}
                </span>
                <span className="text-sm font-medium text-[var(--muted)]">
                  / {card.priceNote}
                </span>
              </div>

              <ul className="mt-6 space-y-2.5">
                {card.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-[#0A0A0A]/80"
                  >
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0 text-[var(--accent)]"
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                {isCurrent ? (
                  <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0A0A0A]/15 bg-transparent px-5 py-3 text-sm font-bold text-[var(--muted)]">
                    <Check size={15} />
                    Plano atual
                  </div>
                ) : (
                  <Link
                    href={card.ctaHref}
                    onClick={() =>
                      posthog.capture("plans_cta_clicked", {
                        plan: card.id,
                        from_plan: currentPlan,
                      })
                    }
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0A0A0A] px-5 py-3 text-sm font-bold transition hover:-translate-x-0.5 hover:-translate-y-0.5 ${
                      card.highlight
                        ? "bg-[var(--accent)] text-white shadow-[4px_4px_0_0_#0A0A0A] hover:shadow-[6px_6px_0_0_#0A0A0A]"
                        : "bg-[#FFFDF9] text-[#0A0A0A] shadow-[3px_3px_0_0_#0A0A0A] hover:shadow-[5px_5px_0_0_#0A0A0A]"
                    }`}
                  >
                    {card.ctaLabel}
                    <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>

      {/* FAQ curto */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mt-16 rounded-[28px] border border-black/10 bg-white p-8"
      >
        <h2 className="editorial-serif text-2xl text-[#0A0A0A]">
          Perguntas rápidas.
        </h2>
        <dl className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <dt className="text-sm font-bold text-[#0A0A0A]">
              Posso cancelar quando quiser?
            </dt>
            <dd className="mt-1 text-sm text-[var(--muted)]">
              Sim. Cancela pelo Stripe Portal nas configurações — o plano
              permanece ativo até o fim do ciclo e depois volta pro grátis.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[#0A0A0A]">
              Meu carrossel permanece se eu voltar pro grátis?
            </dt>
            <dd className="mt-1 text-sm text-[var(--muted)]">
              Tudo que você já gerou continua salvo. O limite só afeta novas
              gerações a partir do downgrade.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[#0A0A0A]">
              Tem desconto anual?
            </dt>
            <dd className="mt-1 text-sm text-[var(--muted)]">
              Em breve. Enquanto isso, o preço de lançamento (50% Pro / 40%
              Business) continua no mensal.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[#0A0A0A]">
              Qual a diferença técnica entre Pro e Business?
            </dt>
            <dd className="mt-1 text-sm text-[var(--muted)]">
              Pro é pra 1 creator. Business inclui 3 seats, API de integração
              e suporte prioritário. Também remove o teto mensal.
            </dd>
          </div>
        </dl>
      </motion.section>
    </div>
  );
}
