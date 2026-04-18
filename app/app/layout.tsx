"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  PlusCircle,
  FolderOpen,
  Settings,
  LogOut,
  Menu,
  X,
  Map,
  BarChart3,
  Send,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
  badge?: string;
};

function planShortLabel(plan: string | undefined): string {
  const p = plan ?? "free";
  if (p === "free") return "Grátis";
  if (p === "pro") return "Pro";
  if (p === "business") return "Business";
  return p;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Início", icon: LayoutDashboard },
  { href: "/app/create", label: "Criar", icon: PlusCircle },
  // create-v2 unified into /app/create with template picker
  { href: "/app/help", label: "Guia", icon: BookOpen },
  { href: "/app/carousels", label: "Meus carrosséis", icon: FolderOpen },
  { href: "/app/metrics", label: "Métricas", icon: BarChart3, comingSoon: true },
  { href: "/app/publish", label: "Publicar", icon: Send, comingSoon: true },
  { href: "/app/roadmap", label: "Roadmap", icon: Map },
  { href: "/app/settings", label: "Ajustes", icon: Settings },
];

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, user, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const authenticated = !!(user && session?.access_token);
  const isLoginPage = pathname === "/app/login";
  const isOnboardingPage = pathname === "/app/onboarding";

  useEffect(() => {
    if (loading) return;

    if (!authenticated) {
      if (!isLoginPage) {
        router.replace("/app/login");
      }
      return;
    }

    if (
      profile &&
      !profile.onboarding_completed &&
      !isOnboardingPage &&
      !isLoginPage
    ) {
      router.replace("/app/onboarding");
    }
  }, [loading, authenticated, profile, pathname, router, isLoginPage, isOnboardingPage]);

  if (loading && !isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <p className="text-sm font-semibold text-zinc-500">Carregando sessão…</p>
      </div>
    );
  }

  if (!loading && !authenticated && !isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <p className="text-sm font-semibold text-zinc-500">Redirecionando pro login…</p>
      </div>
    );
  }

  return <>{children}</>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Don't show app shell on login/onboarding
  const isFullscreenPage =
    pathname === "/app/login" || pathname === "/app/onboarding";

  if (isFullscreenPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen hero-kree8-bg">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r-2 border-[#0A0A0A] bg-[#FFFDF9] transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between border-b border-[#0A0A0A]/10 px-6">
          <Link href="/app" className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] border border-[#0A0A0A]"
              style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="editorial-serif text-2xl text-[#0A0A0A]">
              Sequência Viral<span className="text-[var(--accent)]">.</span>
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-zinc-400 hover:text-zinc-600"
            aria-label="Fechar menu lateral"
          >
            <X size={20} />
          </button>
        </div>

        {/* Kicker */}
        <div className="px-6 pt-6 pb-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
            Menu principal
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, comingSoon, badge }) => {
            const active = pathname === href;
            if (comingSoon) {
              return (
                <div
                  key={href}
                  role="link"
                  aria-disabled="true"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-semibold border border-transparent text-[#0A0A0A]/40 cursor-not-allowed select-none"
                  title={`${label} — Em breve`}
                >
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest rounded-full bg-[#0A0A0A]/10 text-[#0A0A0A]/60 px-2 py-0.5">
                    Em breve
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-semibold transition-all duration-200 border active:scale-[0.97] ${
                  active
                    ? "bg-[var(--accent)] text-white border-[#0A0A0A]"
                    : "text-[#0A0A0A]/70 border-transparent hover:bg-white hover:border-[#0A0A0A]/10 hover:text-[#0A0A0A]"
                }`}
                style={active ? { boxShadow: "3px 3px 0 0 #0A0A0A" } : {}}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className={`text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[var(--accent)]/10 text-[var(--accent)]"
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Plan card */}
        {(!profile?.plan || profile.plan === "free") && (
          <div className="mx-4 mb-4 p-5 card-soft border border-[#0A0A0A]/8">
            <p className="text-[10px] font-mono uppercase tracking-widest opacity-80 mb-2">
              Plano {planShortLabel(profile?.plan)}
            </p>
            <p className="editorial-serif text-xl leading-tight mb-3">
              Upgrade pra Pro
            </p>
            <Link
              href="/app/settings"
              className="inline-flex items-center gap-1.5 text-[12px] font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
            >
              Ver planos →
            </Link>
          </div>
        )}
        {profile?.plan && profile.plan !== "free" && (
          <div className="mx-4 mb-4 p-4 card-soft border border-[#0A0A0A]/8">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
              Plano {planShortLabel(profile.plan)}
            </p>
            <p className="text-sm font-bold text-[#0A0A0A]">
              {profile.plan === "pro" ? "Pro ativo" : "Business ativo"}
            </p>
          </div>
        )}

        {/* User info */}
        <div className="border-t border-[#0A0A0A]/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Foto de perfil de ${profile?.name || "usuário"}`}
                className="h-10 w-10 rounded-full object-cover border border-[#0A0A0A]"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white text-sm font-bold border border-[#0A0A0A]">
                {profile?.name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0A0A0A] truncate">
                {profile?.name || "Conta"}
              </p>
              <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] truncate">
                {profile?.plan === "free"
                  ? "Plano grátis"
                  : profile?.plan === "pro"
                    ? "Plano Pro"
                    : "Plano Business"}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--muted)] transition-colors hover:bg-white hover:text-[#0A0A0A]"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header className="flex h-16 items-center justify-between border-b-2 border-[#0A0A0A] bg-[#FFFDF9] px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-[#0A0A0A]" aria-label="Abrir menu lateral">
            <Menu size={24} />
          </button>
          <span className="editorial-serif text-xl">
            Sequência Viral<span className="text-[var(--accent)]">.</span>
          </span>
          <div className="w-6" />
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden p-6 lg:p-10 xl:p-14">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OnboardingGuard>
        <AppShell>{children}</AppShell>
      </OnboardingGuard>
    </AuthProvider>
  );
}
