"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type PlanKey = "pro" | "business";

const PLAN_META: Record<
  PlanKey,
  {
    name: string;
    tagline: string;
    anchorPrice: number; // cents
    price: number; // cents
    discountLabel: string;
    features: string[];
  }
> = {
  pro: {
    name: "Pro",
    tagline: "Pra quem posta todo dia.",
    anchorPrice: 1999,
    price: 999,
    discountLabel: "50% de lançamento",
    features: [
      "30 carrosséis por mês",
      "Sem marca d'água",
      "Todos os estilos",
      "Imagens com IA + busca",
      "Export PNG",
      "1 perfil",
    ],
  },
  business: {
    name: "Business",
    tagline: "Pra times e agências.",
    anchorPrice: 4999,
    price: 2999,
    discountLabel: "40% de lançamento",
    features: [
      "Carrosséis ilimitados",
      "3 seats inclusos",
      "Custom branding",
      "Analytics avançado",
      "Suporte prioritário",
      "API de integração",
    ],
  },
};

const BUMP_META = {
  name: "Publicação automática",
  tagline: "Instagram · X · LinkedIn",
  priceCents: 499,
  bullets: [
    "Publica direto nas 3 redes",
    "Agendamento + fila",
    "Melhor horário sugerido",
  ],
};

function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session, profile, isGuest } = useAuth();

  const planParam = (searchParams.get("plan") || "pro") as PlanKey;
  const plan = PLAN_META[planParam] || PLAN_META.pro;

  const cancelled = searchParams.get("payment") === "cancelled";

  const [bump, setBump] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = plan.price + (bump ? BUMP_META.priceCents : 0);
  const anchorTotal = plan.anchorPrice + (bump ? BUMP_META.priceCents : 0);
  const savings = anchorTotal - subtotal;

  async function handleSubmit() {
    setError(null);

    if (isGuest || !session?.access_token) {
      setError("Faça login ou crie uma conta antes de assinar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          planId: planParam,
          email: user?.email || profile?.email || "",
          bump,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Não consegui criar a sessão de pagamento. Tente de novo.");
    } catch {
      setError("Erro na conexão com o pagamento. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] px-5 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-zinc-900"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        {cancelled && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Checkout cancelado. Nada foi cobrado — volte quando quiser.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
          {/* LEFT: details + orderbump */}
          <div className="space-y-5">
            {/* Header */}
            <header>
              <span className="tag-pill">
                <Sparkles size={13} className="text-[var(--accent)]" />
                Assinatura mensal
              </span>
              <h1 className="editorial-serif mt-5 text-4xl leading-[0.95] text-zinc-900 sm:text-5xl">
                Você está a um clique de{" "}
                <span className="text-[var(--accent)]">publicar mais</span>.
              </h1>
              <p className="mt-4 text-zinc-600">
                Plano <strong className="text-zinc-900">Sequência Viral {plan.name}</strong> — {plan.tagline}{" "}
                Cancele quando quiser, sem letra miúda.
              </p>
            </header>

            {/* Plan features */}
            <article className="rounded-[28px] border border-black/[0.06] bg-white p-7 shadow-[0_1px_3px_rgba(10,10,10,0.04),0_12px_30px_-8px_rgba(10,10,10,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[var(--accent)]">
                    O que tá incluso
                  </p>
                  <h2 className="mt-1 text-xl font-black text-zinc-900">
                    Sequência Viral {plan.name}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-zinc-400 line-through">
                    {formatPrice(plan.anchorPrice)}
                  </div>
                  <div className="text-2xl font-black leading-none text-zinc-900">
                    {formatPrice(plan.price)}
                    <span className="text-sm font-semibold text-zinc-500">/mês</span>
                  </div>
                </div>
              </div>
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-700">
                    <Check size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </article>

            {/* ORDERBUMP — publicação automática */}
            <motion.article
              layout
              className={`relative overflow-hidden rounded-[28px] border-2 border-dashed p-6 transition-all ${
                bump
                  ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                  : "border-[var(--accent)]/50 bg-[var(--accent-muted)]/50"
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => setBump((v) => !v)}
                  aria-pressed={bump}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                    bump
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--accent)]/60 bg-white"
                  }`}
                >
                  {bump && <Check size={14} strokeWidth={3.5} />}
                </button>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                          <Star size={10} />
                          Oferta exclusiva
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-black text-zinc-900">
                        {BUMP_META.name}{" "}
                        <span className="text-[var(--accent)]">+{formatPrice(BUMP_META.priceCents)}/mês</span>
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">{BUMP_META.tagline}</p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-1.5">
                    {BUMP_META.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-zinc-700">
                        <ArrowRight size={13} className="shrink-0 text-[var(--accent)]" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setBump((v) => !v)}
                    className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                      bump
                        ? "bg-white text-[var(--accent)] border border-[var(--accent)]"
                        : "bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]"
                    }`}
                  >
                    {bump ? (
                      <>
                        <Check size={14} />
                        Adicionado ao pedido
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Sim, quero garantir essa oferta
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.article>

            {/* Social proof */}
            <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["#FF8534", "#EC6000", "#D45500", "#0A0A0A"].map((c, i) => (
                    <div
                      key={i}
                      className="h-9 w-9 rounded-full border-2 border-white text-xs font-black text-white shadow-sm flex items-center justify-center"
                      style={{ background: c }}
                    >
                      {["A", "P", "L", "+"][i]}
                    </div>
                  ))}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-[var(--accent)]">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={13} fill="currentColor" />
                    ))}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-zinc-700">
                    500+ criadores brasileiros já usam
                  </p>
                  <p className="text-xs text-zinc-500">
                    &ldquo;Faço carrossel em 3 minutos, não 3 horas.&rdquo; — Ana @anamarketing
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: order summary + checkout */}
          <div className="lg:sticky lg:top-10 lg:self-start">
            <article className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(10,10,10,0.04),0_24px_60px_-12px_rgba(10,10,10,0.12)]">
              <div className="border-b border-black/5 p-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                  Resumo do pedido
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start justify-between gap-4 text-sm">
                    <div>
                      <p className="font-bold text-zinc-900">Sequência Viral {plan.name}</p>
                      <p className="text-xs text-zinc-500">Assinatura mensal</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-400 line-through">
                        {formatPrice(plan.anchorPrice)}
                      </div>
                      <div className="font-bold text-zinc-900">{formatPrice(plan.price)}</div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {bump && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-start justify-between gap-4 overflow-hidden text-sm"
                      >
                        <div>
                          <p className="font-bold text-zinc-900">{BUMP_META.name}</p>
                          <p className="text-xs text-zinc-500">Add-on mensal</p>
                        </div>
                        <p className="font-bold text-zinc-900">
                          {formatPrice(BUMP_META.priceCents)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Discount line */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--accent-muted)] px-3 py-2 text-[12px] font-bold text-[var(--accent)]">
                  <span>{plan.discountLabel}</span>
                  <span>-{formatPrice(savings)}</span>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-bold text-zinc-500">Total hoje</p>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 line-through">
                      {formatPrice(anchorTotal)}
                    </div>
                    <div className="text-3xl font-black leading-none text-zinc-900">
                      {formatPrice(subtotal)}
                      <span className="text-sm font-semibold text-zinc-500">/mês</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {error}
                  </p>
                )}

                {isGuest && (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    Você está em modo convidado.{" "}
                    <Link href="/app/login" className="underline">
                      Entre ou crie uma conta
                    </Link>{" "}
                    pra continuar.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || isGuest}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-4 text-base font-black text-white shadow-[0_12px_32px_-8px_rgba(236,96,0,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] transition hover:bg-[var(--accent-dark)] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Abrindo checkout…
                    </>
                  ) : (
                    <>
                      Finalizar assinatura
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-zinc-500">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  Pagamento processado pela Stripe · 100% seguro
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-400">
                  Cancele quando quiser · sem taxa escondida
                </p>
              </div>
            </article>

            {/* Dismiss */}
            <Link
              href="/app/settings"
              className="mt-4 flex items-center justify-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-900"
            >
              <X size={12} />
              Não, quero continuar no Free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
