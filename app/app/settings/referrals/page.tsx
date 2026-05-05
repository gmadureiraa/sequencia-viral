"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Wallet,
  TrendingUp,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { APP_URL } from "@/lib/app-url";
import { toast } from "sonner";

type MeResponse = {
  code: string;
  signupCount: number;
  conversionCount: number;
  totalCreditCents: number;
};

type ReferralItem = {
  id: string;
  email: string;
  status: "pending" | "signup" | "converted" | "expired";
  signupAt: string | null;
  conversionAt: string | null;
  rewardAmountCents: number;
  rewardApplied: boolean;
  createdAt: string;
};

function formatBrl(cents: number): string {
  const v = cents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

/**
 * Cada conversão = 1 mês grátis (reward = 1× preço Pro mensal). totalCents/N
 * conversões dá quantos meses acumulados.
 */
function formatProMonths(totalCents: number, conversionCount: number): string {
  if (conversionCount <= 0) return "0 meses";
  const months = conversionCount; // 1 conversão = 1 mês exatamente
  void totalCents;
  return months === 1 ? "1 mês grátis" : `${months} meses grátis`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function statusLabel(status: ReferralItem["status"]): {
  label: string;
  bg: string;
  fg: string;
} {
  switch (status) {
    case "converted":
      return {
        label: "Pago — crédito ativo",
        bg: "var(--sv-green)",
        fg: "var(--sv-ink)",
      };
    case "signup":
      return { label: "Cadastrado", bg: "#F4C453", fg: "var(--sv-ink)" };
    case "pending":
      return {
        label: "Aguardando",
        bg: "rgba(10,10,10,0.06)",
        fg: "var(--sv-ink)",
      };
    case "expired":
    default:
      return {
        label: "Expirado",
        bg: "rgba(10,10,10,0.04)",
        fg: "var(--sv-muted)",
      };
  }
}

export default function ReferralsPage() {
  const { session, loading: authLoading } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [items, setItems] = useState<ReferralItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.access_token) {
      setLoading(false);
      setError("Faça login pra ver suas indicações.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = jsonWithAuth(session);
        const [meRes, listRes] = await Promise.all([
          fetch("/api/referrals/me", { headers }),
          fetch("/api/referrals/list", { headers }),
        ]);
        if (!meRes.ok) throw new Error(`me ${meRes.status}`);
        if (!listRes.ok) throw new Error(`list ${listRes.status}`);
        const meData = (await meRes.json()) as MeResponse;
        const listData = (await listRes.json()) as { items: ReferralItem[] };
        if (cancelled) return;
        setMe(meData);
        setItems(listData.items);
      } catch (e) {
        if (cancelled) return;
        console.error("[referrals page] erro:", e);
        setError("Não consegui carregar suas indicações. Tenta de novo daqui a pouco.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, authLoading]);

  const link = useMemo(() => {
    if (!me?.code) return "";
    return `${APP_URL}/?ref=${me.code}`;
  }, [me]);

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Falhou copiar — tenta selecionar manualmente.");
    }
  }

  async function handleShare() {
    if (!link) return;
    const text = `Tô usando o Sequência Viral pra criar carrosséis com IA — usa meu link e ganha 30% off no primeiro mês: ${link}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: "Sequência Viral",
          text,
          url: link,
        });
        return;
      } catch {
        /* user cancelled — fall through */
      }
    }
    // Fallback: copia + abre Twitter intent
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensagem copiada — cola onde quiser.");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1.5"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          <ArrowLeft size={12} /> Ajustes
        </Link>
      </div>

      {/* Header */}
      <header className="mb-8">
        <div
          className="mb-2 inline-flex items-center gap-2"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: "10px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          <Gift size={14} /> Indique e ganhe
        </div>
        <h1
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: "44px",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "var(--sv-ink)",
          }}
        >
          R$ 25 de crédito por <em className="italic">cada amigo</em> que
          assinar.
        </h1>
        <p
          className="mt-3 max-w-2xl"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: "15px",
            color: "var(--sv-ink)",
            lineHeight: 1.55,
          }}
        >
          Compartilhe seu link. Quem entra usando ele ganha{" "}
          <strong>30% off no primeiro mês</strong>. Quando o pagamento dele
          rola, <strong>R$ 25,00</strong> caem no seu saldo Stripe e abatem
          automaticamente na sua próxima fatura. Sem limite — pode acumular o
          quanto quiser.
        </p>
      </header>

      {/* Hero — link grande copiável */}
      {loading ? (
        <div
          className="mb-8 flex items-center gap-3 rounded-xl p-6"
          style={{
            border: "1.5px solid var(--sv-ink)",
            background: "var(--sv-white, #FFFFFF)",
            boxShadow: "4px 4px 0 0 var(--sv-ink)",
          }}
        >
          <Loader2 size={16} className="animate-spin" />
          <span
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: "11px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
            }}
          >
            Carregando seu link…
          </span>
        </div>
      ) : error ? (
        <div
          className="mb-8 rounded-xl p-6"
          style={{
            border: "1.5px solid #FF5842",
            background: "rgba(255, 88, 66, 0.06)",
            color: "var(--sv-ink)",
            fontFamily: "var(--sv-sans)",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      ) : (
        me && (
          <div
            className="mb-10 rounded-2xl p-6 lg:p-8"
            style={{
              border: "2px solid var(--sv-ink)",
              background: "var(--sv-green)",
              boxShadow: "6px 6px 0 0 var(--sv-ink)",
            }}
          >
            <div
              className="mb-2"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: "9.5px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--sv-ink)",
                fontWeight: 700,
              }}
            >
              ● Seu link de indicação
            </div>
            <div
              className="mb-4 flex flex-wrap items-baseline gap-3 break-all"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: "20px",
                color: "var(--sv-ink)",
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              {link}
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 transition-all"
                style={{
                  background: "var(--sv-ink)",
                  color: "var(--sv-paper)",
                  border: "1.5px solid var(--sv-ink)",
                  fontFamily: "var(--sv-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  boxShadow: "3px 3px 0 0 rgba(0,0,0,0.25)",
                }}
              >
                {copied ? (
                  <>
                    <Check size={14} /> Copiado
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copiar link
                  </>
                )}
              </button>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 transition-all"
                style={{
                  background: "transparent",
                  color: "var(--sv-ink)",
                  border: "1.5px solid var(--sv-ink)",
                  fontFamily: "var(--sv-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                <Share2 size={14} /> Compartilhar
              </button>
            </div>

            {/* Share canais diretos — WhatsApp / X / E-mail */}
            <div className="mt-4 flex flex-wrap gap-2">
              <ChannelButton
                bg="#25D366"
                label="WhatsApp"
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Tô usando o Sequência Viral pra criar carrosséis com IA — usa meu link e ganha 30% off no primeiro mês: ${link}`
                )}`}
              />
              <ChannelButton
                bg="var(--sv-ink)"
                fg="var(--sv-paper)"
                label="X / Twitter"
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `Carrosséis com IA em ~60s — ${link}`
                )}`}
              />
              <ChannelButton
                bg="var(--sv-yellow)"
                label="E-mail"
                href={`mailto:?subject=${encodeURIComponent(
                  "Sequência Viral — IA pra carrosséis"
                )}&body=${encodeURIComponent(
                  `Tô usando o Sequência Viral pra criar carrosséis com IA. Usa meu link e ganha 30% off no primeiro mês:\n\n${link}`
                )}`}
              />
            </div>
          </div>
        )
      )}

      {/* Stat cards */}
      {me && (
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Users size={16} />}
            label="Indicados"
            value={String(me.signupCount)}
            hint="Cadastraram com seu link"
          />
          <StatCard
            icon={<TrendingUp size={16} />}
            label="Conversões"
            value={String(me.conversionCount)}
            hint="Pagaram primeira fatura"
          />
          <StatCard
            icon={<Wallet size={16} />}
            label="Meses grátis de Pro"
            value={formatProMonths(me.totalCreditCents, me.conversionCount)}
            hint={`= ${formatBrl(me.totalCreditCents)} em crédito Stripe (abate auto na próxima fatura)`}
            highlight
          />
        </div>
      )}

      {/* Tabela */}
      <section>
        <h2
          className="mb-3"
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: "22px",
            color: "var(--sv-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Histórico de indicações
        </h2>
        {!items || items.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{
              border: "1.5px dashed var(--sv-ink)",
              background: "rgba(10,10,10,0.02)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: "14px",
                color: "var(--sv-muted)",
              }}
            >
              Ainda sem indicações. Cola seu link em qualquer rede que você usa
              — cada amigo que assinar vale <strong>1 mês grátis de Pro</strong>.
            </p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-xl"
            style={{
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-white, #FFFFFF)",
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
            }}
          >
            <table className="w-full text-left">
              <thead>
                <tr
                  style={{
                    background: "var(--sv-ink)",
                    color: "var(--sv-paper)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Recompensa</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const s = statusLabel(row.status);
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderTop:
                          idx === 0 ? "none" : "1px solid rgba(10,10,10,0.08)",
                        fontFamily: "var(--sv-sans)",
                        fontSize: "13.5px",
                        color: "var(--sv-ink)",
                      }}
                    >
                      <td className="px-4 py-3.5">
                        {formatDate(row.conversionAt || row.signupAt || row.createdAt)}
                      </td>
                      <td className="px-4 py-3.5" style={{ fontFamily: "var(--sv-mono)", fontSize: "12px" }}>
                        {row.email}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1"
                          style={{
                            background: s.bg,
                            color: s.fg,
                            fontFamily: "var(--sv-mono)",
                            fontSize: "9.5px",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3.5 text-right"
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: "13px",
                          fontWeight: 700,
                          color:
                            row.status === "converted"
                              ? "var(--sv-ink)"
                              : "var(--sv-muted)",
                        }}
                      >
                        {row.rewardApplied
                          ? `+ ${formatBrl(row.rewardAmountCents)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Regras */}
      <aside
        className="mt-10 rounded-xl p-6"
        style={{
          border: "1.5px solid var(--sv-ink)",
          background: "rgba(10,10,10,0.03)",
        }}
      >
        <div
          className="mb-2"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: "9.5px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
            fontWeight: 700,
          }}
        >
          Como funciona
        </div>
        <ul
          className="space-y-2"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: "13.5px",
            color: "var(--sv-ink)",
            lineHeight: 1.6,
          }}
        >
          <li>
            <strong>1.</strong> Seu amigo clica no seu link e usa o cupom{" "}
            <code
              style={{
                fontFamily: "var(--sv-mono)",
                background: "var(--sv-green)",
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              AMIGOPRO30
            </code>{" "}
            — ele ganha 30% off no primeiro mês.
          </li>
          <li>
            <strong>2.</strong> Quando o pagamento dele cai, você ganha{" "}
            <strong>R$ 25 de crédito</strong> direto no Stripe.
          </li>
          <li>
            <strong>3.</strong> Esse crédito abate automático na sua próxima
            fatura. Acumula sem teto — chame 10 amigos, pague 10 meses de menos.
          </li>
          <li>
            <strong>4.</strong> Auto-indicação não vale (a gente bloqueia). Link
            tem validade de 30 dias no navegador do convidado.
          </li>
        </ul>
      </aside>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        border: "1.5px solid var(--sv-ink)",
        background: highlight ? "var(--sv-green)" : "var(--sv-white, #FFFFFF)",
        boxShadow: "3px 3px 0 0 var(--sv-ink)",
      }}
    >
      <div
        className="mb-2 inline-flex items-center gap-1.5"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: "9px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--sv-ink)",
          fontWeight: 700,
        }}
      >
        {icon} {label}
      </div>
      <div
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: "32px",
          letterSpacing: "-0.02em",
          color: "var(--sv-ink)",
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      <div
        className="mt-1.5"
        style={{
          fontFamily: "var(--sv-sans)",
          fontSize: "11.5px",
          color: highlight ? "var(--sv-ink)" : "var(--sv-muted)",
        }}
      >
        {hint}
      </div>
    </div>
  );
}

/**
 * Botão de share direto pra um canal externo (WhatsApp / Twitter / E-mail).
 * Cor de fundo + ícone definem o canal — manter consistência com a paleta SV.
 */
function ChannelButton({
  href,
  label,
  bg,
  fg = "var(--sv-ink)",
}: {
  href: string;
  label: string;
  bg: string;
  fg?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 transition-all"
      style={{
        background: bg,
        color: fg,
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
        fontFamily: "var(--sv-mono)",
        fontSize: 10.5,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 700,
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translate(-1px, -1px)";
        e.currentTarget.style.boxShadow = "4px 4px 0 0 var(--sv-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translate(0, 0)";
        e.currentTarget.style.boxShadow = "2px 2px 0 0 var(--sv-ink)";
      }}
    >
      {label}
    </a>
  );
}
