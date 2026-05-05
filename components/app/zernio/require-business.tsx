"use client";

import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * Gate client-side: bloqueia conteúdo até confirmar que user é admin OU
 * tem plan="business". Free/pro veem upgrade prompt em vez do conteúdo.
 *
 * Backend (`requireAdminOrPlan`) é o source of truth — esse componente
 * só evita confusão de UI mostrando feature que o user não pode usar.
 *
 * Uso:
 *   <RequireBusiness feature="Conectar redes">
 *     <ConteudoBusinessOnly />
 *   </RequireBusiness>
 */
export function RequireBusiness({
  children,
  feature = "Esse recurso",
  description,
}: {
  children: React.ReactNode;
  feature?: string;
  description?: string;
}) {
  const { user, profile, loading } = useAuth();
  const email = profile?.email ?? user?.email ?? null;
  const authResolved = !loading;
  const isAdmin = authResolved && isAdminEmail(email);
  const isBusiness = authResolved && profile?.plan === "business";
  const allowed = isAdmin || isBusiness;

  if (!authResolved) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "40vh" }}
      >
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (allowed) return <>{children}</>;

  return (
    <div className="mx-auto" style={{ maxWidth: 640, padding: "32px 20px" }}>
      <div className="sv-card" style={{ padding: 32, textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--sv-yellow)",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
          }}
        >
          <Sparkles size={24} color="var(--sv-ink)" />
        </div>
        <span className="sv-eyebrow">
          <span className="sv-dot" /> Plano Business
        </span>
        <h2
          className="sv-display mt-3"
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          {feature} é <em>exclusivo</em>.
        </h2>
        <p
          style={{
            color: "var(--sv-muted, #555)",
            fontSize: 14,
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          {description ??
            "Disponível só pro plano Business. Conecte Instagram + LinkedIn, agende posts e configure piloto automático com gatilhos."}
        </p>
        <Link
          href="/app/plans"
          className="sv-btn sv-btn-primary"
          style={{
            marginTop: 24,
            padding: "14px 22px",
            textDecoration: "none",
          }}
        >
          Fazer upgrade →
        </Link>
      </div>
    </div>
  );
}
