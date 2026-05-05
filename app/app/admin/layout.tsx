"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * Layout guard pra todas as rotas /app/admin/*.
 *
 * Bloqueia render dos children até resolver auth + valida admin email. Sem
 * isso, cada página admin tinha seu próprio useEffect → flash de UI antes
 * do redirect (especialmente visível em /app/admin/zernio/calendar e
 * /app/admin/zernio/autopilot).
 *
 * Backend continua sendo a source of truth: lib/server/auth.ts::requireAdmin
 * + lib/admin-emails.ts gate todos os endpoints /api/zernio/* e /api/admin/*.
 * Esse layout é DEFESA EM PROFUNDIDADE pro client + UX (sem flash).
 *
 * Por que client component (e não server): @supabase/ssr não está instalado
 * e Supabase JS nativamente armazena sessão client-side. Pra fazer 100%
 * server-side precisaria adicionar @supabase/ssr — fica como evolução futura.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  // Email canônico pra check: prefere profile.email (já normalizado), cai
  // pra user.email do Supabase auth se profile ainda não carregou.
  const email = profile?.email ?? user?.email ?? null;
  const authResolved = !loading;
  const isAuthenticated = authResolved && !!user;
  const isAdmin = authResolved && isAdminEmail(email);

  useEffect(() => {
    if (!authResolved) return;
    if (!isAuthenticated) {
      router.replace("/app/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/app");
    }
  }, [authResolved, isAuthenticated, isAdmin, router]);

  // 1. Carregando sessão → spinner
  if (!authResolved) {
    return (
      <div style={fullscreenStyle}>
        <Loader2 className="animate-spin" size={20} />
        <span style={kickerStyle}>Verificando acesso...</span>
      </div>
    );
  }

  // 2. Não autenticado → mensagem (router.replace cuida do redirect)
  if (!isAuthenticated) {
    return (
      <div style={fullscreenStyle}>
        <Lock size={20} />
        <span style={kickerStyle}>Faça login pra acessar.</span>
      </div>
    );
  }

  // 3. Autenticado mas não admin → bloqueia + redireciona pra /app
  if (!isAdmin) {
    return (
      <div style={fullscreenStyle}>
        <Lock size={20} />
        <span style={kickerStyle}>Área restrita ao admin.</span>
        <span style={subKickerStyle}>Redirecionando...</span>
      </div>
    );
  }

  // 4. Admin OK → renderiza children
  return <>{children}</>;
}

const fullscreenStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: "60vh",
  padding: 24,
  fontFamily: "var(--sv-sans)",
  color: "var(--sv-ink)",
};

const kickerStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sv-soft, #6b6b6b)",
};

const subKickerStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--sv-soft, #9c9c9c)",
};
