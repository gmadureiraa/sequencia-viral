"use client";

import { Suspense, useEffect, useState } from "react";
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
import posthog from "posthog-js";

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
    anchorPrice: 1990, // $19.90 preço normal pós-lançamento
    price: 990,        // $9.90 lançamento
    discountLabel: "50% de lançamento",
    features: [
      "30 carrosséis por mês",
      "Sem marca d'água",
      "Todos os estilos",
      "Imagens com IA + busca",
      "Export PNG",
      "3 perfis de marca",
    ],
  },
  business: {
    name: "Agência",
    tagline: "Pra times e agências.",
    anchorPrice: 3990, // $39.90
    price: 2990,       // $29.90 lançamento
    discountLabel: "25% de lançamento",
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
  const { user, session, profile } = useAuth();

  const planParam = (searchParams.get("plan") || "pro") as PlanKey;
  const plan = PLAN_META[planParam] || PLAN_META.pro;

  const cancelled = searchParams.get("payment") === "cancelled";
  const intervalParam: "month" | "year" =
    searchParams.get("interval") === "year" ? "year" : "month";

  const [bump, setBump] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<
    | {
        code: string;
        discountPct?: number | null;
        discountAmountCents?: number | null;
      }
    | null
  >(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Auto-aplica cupom vindo de ?coupon= (popup welcome) OU de localStorage
  // (salvo depois do signup pra sobreviver ao login redirect).
  useEffect(() => {
    if (appliedCoupon) return;
    const urlCoupon = searchParams.get("coupon");
    let code = urlCoupon?.trim() || "";
    if (!code && typeof window !== "undefined") {
      try {
        code = window.localStorage.getItem("sv_pending_coupon") || "";
      } catch {
        /* ignore */
      }
    }
    if (!code) return;
    setCouponInput(code);
    // auto-validate e apply
    void (async () => {
      setCouponValidating(true);
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, planId: planParam }),
        });
        const data = (await res.json()) as {
          valid?: boolean;
          coupon?: {
            code: string;
            discountPct?: number | null;
            discountAmountCents?: number | null;
          };
          error?: string;
        };
        if (data.valid && data.coupon) {
          setAppliedCoupon(data.coupon);
          // Limpa o storage pra não re-aplicar infinitamente.
          try {
            window.localStorage.removeItem("sv_pending_coupon");
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* silencioso — usuário pode aplicar manual depois */
      } finally {
        setCouponValidating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = plan.price + (bump ? BUMP_META.priceCents : 0);
  const anchorTotal = plan.anchorPrice + (bump ? BUMP_META.priceCents : 0);
  const savings = anchorTotal - subtotal;

  const couponDiscountCents = appliedCoupon
    ? appliedCoupon.discountAmountCents
      ? appliedCoupon.discountAmountCents
      : appliedCoupon.discountPct
        ? Math.round((subtotal * appliedCoupon.discountPct) / 100)
        : 0
    : 0;

  async function handleApplyCoupon() {
    setCouponError(null);
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Digite um código.");
      return;
    }
    setCouponValidating(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, planId: planParam }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        coupon?: {
          code: string;
          discountPct?: number | null;
          discountAmountCents?: number | null;
        };
        error?: string;
      };
      if (!data.valid || !data.coupon) {
        setCouponError(data.error || "Cupom inválido.");
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon(data.coupon);
        setCouponError(null);
      }
    } catch {
      setCouponError("Não consegui validar. Tenta de novo.");
    } finally {
      setCouponValidating(false);
    }
  }

  async function handleSubmit() {
    setError(null);

    if (!session?.access_token) {
      setError("Faça login ou crie uma conta antes de assinar.");
      return;
    }

    posthog.capture("checkout_initiated", {
      plan: planParam,
      price_cents: plan.price,
      bump_added: bump,
      total_cents: subtotal,
    });

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
          interval: intervalParam,
          email: user?.email || profile?.email || "",
          bump,
          couponCode: appliedCoupon?.code || undefined,
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

            {/* Orderbump "Publicação automática" removido temporariamente —
                 feature vai ser lançada no roadmap próximo (veja /roadmap).
                 Código mantido em BUMP_META pra reativar quando estiver
                 pronto. Sem orderbump, `bump` sempre false no submit. */}

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

                </div>

                {/* Discount line */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--accent-muted)] px-3 py-2 text-[12px] font-bold text-[var(--accent)]">
                  <span>{plan.discountLabel}</span>
                  <span>-{formatPrice(savings)}</span>
                </div>

                {/* Coupon input */}
                <div className="mt-4">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800">
                      <span>
                        Cupom <strong>{appliedCoupon.code}</strong>{" "}
                        {appliedCoupon.discountPct
                          ? `(-${appliedCoupon.discountPct}%)`
                          : appliedCoupon.discountAmountCents
                            ? `(-${formatPrice(appliedCoupon.discountAmountCents)})`
                            : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponInput("");
                        }}
                        className="text-emerald-700 hover:underline"
                      >
                        remover
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                        Cupom de desconto
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) =>
                            setCouponInput(e.target.value.toUpperCase())
                          }
                          placeholder="BETA50"
                          className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-mono uppercase tracking-wider focus:border-[var(--accent)] focus:outline-none"
                          disabled={couponValidating}
                          maxLength={32}
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={couponValidating || !couponInput.trim()}
                          className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-bold text-zinc-900 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                        >
                          {couponValidating ? "..." : "Aplicar"}
                        </button>
                      </div>
                      {couponError && (
                        <p className="mt-1.5 text-[11px] font-semibold text-red-600">
                          {couponError}
                        </p>
                      )}
                    </div>
                  )}
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

                {/* Garantia 7 dias */}
                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                      Garantia de 7 dias
                    </p>
                    <p className="text-[11px] text-emerald-900/80">
                      Se não rolar, devolvemos 100% do valor. Sem pergunta.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-red-700">{error}</p>
                    <a
                      href={`mailto:madureira@kaleidosdigital.com?subject=${encodeURIComponent(
                        "Sequência Viral — Falha no checkout"
                      )}&body=${encodeURIComponent(
                        `Olá, tentei assinar o plano ${plan.name} (${formatPrice(plan.price)}/mês)` +
                          ` e o checkout falhou. Plano: ${planParam}.`
                      )}`}
                      className="mt-1 inline-block font-semibold text-red-900 underline"
                    >
                      Falar com a gente por email →
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !session?.access_token}
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
