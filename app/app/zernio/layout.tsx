"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/**
 * Layout de /app/zernio/* — apenas garante que o user está autenticado.
 *
 * Plan gating é feito em CADA página individualmente:
 *   - /app/zernio/calendar           → todos os planos podem ver
 *   - /app/zernio (page)             → só Pro (DB 'business' — conectar IG/LI)
 *   - /app/zernio/autopilot          → só Pro (Piloto Auto)
 *   - /app/zernio/connected          → só Pro (callback OAuth)
 *
 * Páginas Pro-only usam <RequireBusiness> wrapper que mostra
 * upgrade prompt em vez de redirect — ensina sobre a feature.
 */
export default function ZernioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/app/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "60vh" }}
      >
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
