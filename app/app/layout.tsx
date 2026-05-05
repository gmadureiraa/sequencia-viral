"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  BookOpen,
  Sparkles,
  Search,
  Shield,
  CalendarClock,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  disabled?: boolean;
  tooltip?: { title: string; body: string };
};

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Início", icon: LayoutDashboard },
  // 'Criar' removido — ja existe o botao 'Novo carrossel' flutuante acima do
  // card de plano no bottom da sidebar. Mesma rota /app/create/new, redundante.
  { href: "/app/carousels", label: "Carrosséis", icon: FolderOpen },
  // Galeria (/app/gallery) foi removida do app — a rota nao existe mais.
  // O endpoint /api/gallery ainda pode existir como API interna (não é UI).
  { href: "/app/help", label: "Guia", icon: BookOpen },
  { href: "/app/settings", label: "Ajustes", icon: Settings },
  // Roadmap no rodape da nav — eh referencia estatica (lista de features
  // futuras), nao precisa de destaque.
  { href: "/app/roadmap", label: "Roadmap", icon: Map },
];

/**
 * Itens "Planejamento" e "Piloto auto" — comportamento dependente de role:
 *   - Admin (isAdminEmail): vira link real pras rotas Zernio
 *   - Não-admin: fica disabled "Em breve" com tooltip explicativo
 *
 * Quando feature for liberada pra todos os planos, mover pro NAV_ITEMS
 * principal e remover essa lógica.
 */
const PLANEJAMENTO_TOOLTIP = {
  title: "Planejamento",
  body: "Calendário de conteúdo pra organizar sua sequência e publicar direto no Instagram nos dias e horários certos.",
};
const PILOTO_TOOLTIP = {
  title: "Piloto automático",
  body: "A IA cuida de tudo sozinha: cria conteúdo no seu DNA e publica no seu Instagram sem você levantar um dedo.",
};

import { isAdminEmail } from "@/lib/admin-emails";

const ADMIN_NAV_ITEM: NavItem = {
  href: "/app/admin",
  label: "Admin",
  icon: Shield,
  badge: "Dev",
};

function planShortLabel(plan: string | undefined): string {
  const p = plan ?? "free";
  if (p === "free") return "Grátis";
  if (p === "pro") return "Pro";
  if (p === "business") return "Business";
  return p;
}

/**
 * Card de plano + barra de uso. Cores da barra:
 *  - 0-69% verde (sv-green)
 *  - 70-89% amarelo (sv-yellow ou amber 400)
 *  - 90-100% laranja/accent (alert)
 * Business é "ilimitado" (limit costuma ser >= 9999) — esconde a barra.
 */
function PlanCard({
  profile,
  planIsFree,
  onNavigate,
}: {
  profile: ReturnType<typeof useAuth>["profile"];
  planIsFree: boolean;
  onNavigate: () => void;
}) {
  const used = profile?.usage_count ?? 0;
  const limit = profile?.usage_limit ?? 5;
  // Plano business tem limit >= 9999 ou plan === "business" — tratamos como ∞.
  const isUnlimited = profile?.plan === "business" || limit >= 9999;
  const ratio = isUnlimited
    ? 0
    : Math.min(1, Math.max(0, used / Math.max(1, limit)));
  const pct = Math.round(ratio * 100);

  // Cor progressiva: verde até 70%, amber até 90%, accent acima.
  let barColor = "var(--sv-green)";
  let barText = "var(--sv-ink)";
  if (ratio >= 0.9) {
    barColor = "#FF5842"; // accent laranja Kaleidos — sinaliza limite
    barText = "var(--sv-paper)";
  } else if (ratio >= 0.7) {
    barColor = "#F4C453"; // amber 400 — atenção
    barText = "var(--sv-ink)";
  }

  if (planIsFree) {
    return (
      <Link
        href="/app/plans"
        onClick={onNavigate}
        className="block rounded-lg p-3.5 mb-2 transition-all"
        style={{
          background: "var(--sv-green)",
          color: "var(--sv-ink)",
          border: "1.5px solid var(--sv-paper)",
          boxShadow: "3px 3px 0 0 rgba(255,255,255,0.15)",
        }}
      >
        <div
          className="mb-1"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: "8.5px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            opacity: 0.75,
            fontWeight: 700,
          }}
        >
          Plano Grátis
        </div>
        <div
          className="flex items-center justify-between gap-2"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          <span>
            {used}/{limit} carrosséis
          </span>
          <span>→</span>
        </div>
        {/* Usage bar — só free tem barra (free=5/mês, evidente o limite) */}
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(10,10,10,0.18)" }}
          aria-label={`Uso: ${used} de ${limit} carrosséis (${pct}%)`}
        >
          <div
            style={{
              width: `${Math.max(4, pct)}%`,
              height: "100%",
              background: barColor,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </Link>
    );
  }

  // Pro/Business — não-link (já está em plano pago).
  return (
    <div
      className="rounded-lg p-3 mb-2"
      style={{
        background: "transparent",
        border: "1.5px solid rgba(247,245,239,0.18)",
        color: "var(--sv-paper)",
      }}
    >
      <div
        className="mb-1 flex items-center justify-between gap-2"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: "8.5px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(247,245,239,0.55)",
          fontWeight: 700,
        }}
      >
        <span>Plano {planShortLabel(profile?.plan)}</span>
        {!isUnlimited && (
          <span style={{ color: "rgba(247,245,239,0.85)" }}>
            {used}/{limit}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--sv-sans)",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {isUnlimited
          ? "Uso ilimitado ∞"
          : profile?.plan === "pro"
            ? "Pro ativo"
            : "Plano ativo"}
      </div>
      {/* Pro também mostra barra (30/mês) — vira sinal de upgrade pra business */}
      {!isUnlimited && (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(247,245,239,0.12)" }}
          aria-label={`Uso: ${used} de ${limit} carrosséis (${pct}%)`}
        >
          <div
            style={{
              width: `${Math.max(4, pct)}%`,
              height: "100%",
              background: barColor,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      )}
      {/* Aviso quando >= 90% — sugere upgrade no card pro */}
      {!isUnlimited && ratio >= 0.9 && profile?.plan === "pro" && (
        <Link
          href="/app/plans"
          onClick={onNavigate}
          className="mt-2 block text-center"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: "9px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: barText === "var(--sv-paper)" ? "#FF5842" : "var(--sv-green)",
            fontWeight: 700,
          }}
        >
          → Subir pra Business
        </Link>
      )}
    </div>
  );
}

function breadcrumbFor(pathname: string): { kicker: string; title: string } {
  // Mapa exato
  const map: Record<string, { kicker: string; title: string }> = {
    "/app": { kicker: "DASHBOARD", title: "INÍCIO" },
    "/app/create/new": { kicker: "NOVO", title: "CARROSSEL" },
    "/app/carousels": { kicker: "BIBLIOTECA", title: "CARROSSÉIS" },
    "/app/plans": { kicker: "PLANOS", title: "ASSINAR" },
    "/app/settings": { kicker: "CONTA", title: "AJUSTES" },
    "/app/roadmap": { kicker: "PRODUTO", title: "ROADMAP" },
    "/app/help": { kicker: "GUIA", title: "AJUDA" },
    "/app/onboarding": { kicker: "SETUP", title: "ONBOARDING" },
  };
  if (map[pathname]) return map[pathname];

  // Fallbacks (rotas dinâmicas)
  if (pathname.startsWith("/app/carousels/")) {
    return { kicker: "BIBLIOTECA", title: "EDITAR" };
  }
  if (pathname.startsWith("/app/create")) {
    return { kicker: "NOVO", title: "CARROSSEL" };
  }
  if (pathname.startsWith("/app/settings")) {
    return { kicker: "CONTA", title: "AJUSTES" };
  }

  return { kicker: "SEQUÊNCIA", title: "VIRAL" };
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/app" className="flex items-center gap-2.5 min-w-0">
      {/* Logo ransom-note — versao 'SV' só com letras colagem. Fundo escuro
          do sidebar combina com o recorte das letras. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-sv-mark.png"
        alt="SV"
        className="shrink-0"
        style={{
          width: 38,
          height: 38,
          objectFit: "contain",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
        }}
      />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[16px] leading-none tracking-[-0.01em]"
          style={{
            fontFamily: "var(--sv-display)",
            color: "var(--sv-paper)",
          }}
        >
          Sequência <em className="italic">Viral</em>
        </span>
        {!compact && (
          <span
            className="mt-1 block truncate text-[7.5px] uppercase tracking-[0.14em]"
            style={{
              fontFamily: "var(--sv-mono)",
              color: "rgba(247,245,239,0.5)",
            }}
          >
            By Kaleidos
          </span>
        )}
      </span>
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  profile,
  signOut,
  showCloseButton = false,
  onClose,
}: {
  pathname: string;
  onNavigate: () => void;
  profile: ReturnType<typeof useAuth>["profile"];
  signOut: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}) {
  const planIsFree = !profile?.plan || profile.plan === "free";

  return (
    <div
      className="flex h-full w-full flex-col gap-1.5 overflow-y-auto px-[18px] pb-5 pt-[22px]"
      style={{ background: "var(--sv-ink)", color: "var(--sv-paper)" }}
    >
      {/* Brand */}
      <div
        className="flex items-center justify-between gap-2 border-b px-1.5 pb-[22px] mb-2.5"
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        <Brand />
        {showCloseButton && (
          <button
            onClick={onClose}
            className="lg:hidden text-white/70 hover:text-white shrink-0"
            aria-label="Fechar menu lateral"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* CTA: + Novo carrossel */}
      <Link
        href="/app/create/new"
        onClick={onNavigate}
        className="flex items-center justify-center gap-2 rounded-full px-3.5 py-[11px] mb-3.5 transition-all"
        style={{
          background: "var(--sv-green)",
          color: "var(--sv-ink)",
          border: "1.5px solid var(--sv-paper)",
          fontFamily: "var(--sv-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 700,
          boxShadow: "3px 3px 0 0 rgba(255,255,255,0.15)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translate(-1px,-1px)";
          e.currentTarget.style.boxShadow =
            "5px 5px 0 0 rgba(255,255,255,0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translate(0,0)";
          e.currentTarget.style.boxShadow =
            "3px 3px 0 0 rgba(255,255,255,0.15)";
        }}
      >
        <PlusCircle size={14} strokeWidth={2.4} />
        Novo carrossel
      </Link>

      {/* Section label: Workspace */}
      <div
        className="px-2 pb-1.5 pt-2"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: "8.5px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(247,245,239,0.4)",
        }}
      >
        Workspace
      </div>

      {/* Nav — Planejamento/Piloto Auto:
            · admin → links Zernio reais
            · não-admin → disabled "Em breve"
          Item Admin (painel completo) é exclusivo de admins. */}
      {(() => {
        const isAdmin = isAdminEmail(profile?.email);
        const planejamentoItem: NavItem = isAdmin
          ? {
              href: "/app/admin/zernio/calendar",
              label: "Planejamento",
              icon: CalendarClock,
            }
          : {
              href: "#",
              label: "Planejamento",
              icon: CalendarClock,
              badge: "Em breve",
              disabled: true,
              tooltip: PLANEJAMENTO_TOOLTIP,
            };
        const pilotoItem: NavItem = isAdmin
          ? {
              href: "/app/admin/zernio/autopilot",
              label: "Piloto auto",
              icon: Rocket,
            }
          : {
              href: "#",
              label: "Piloto auto",
              icon: Rocket,
              badge: "Em breve",
              disabled: true,
              tooltip: PILOTO_TOOLTIP,
            };
        // Insere antes do Roadmap (último do NAV_ITEMS) — mantém ordem
        // visual: Início, Carrosséis, Guia, Ajustes, Planejamento, Piloto, Roadmap, Admin?
        const baseBeforeRoadmap = NAV_ITEMS.slice(0, NAV_ITEMS.length - 1);
        const roadmapItem = NAV_ITEMS[NAV_ITEMS.length - 1];
        const items: NavItem[] = [
          ...baseBeforeRoadmap,
          planejamentoItem,
          pilotoItem,
          roadmapItem,
          ...(isAdmin ? [ADMIN_NAV_ITEM] : []),
        ];
        return (
          <nav className="flex flex-col gap-[2px]">
            {items.map(({ href, label, icon: Icon, badge, disabled, tooltip }, idx) => {
          const active =
            !disabled &&
            (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
          const commonStyle = {
            fontFamily: "var(--sv-mono)",
            fontSize: "10.5px",
            letterSpacing: disabled ? "0.08em" : "0.12em",
            textTransform: "uppercase" as const,
            fontWeight: 600,
            background: active ? "var(--sv-green)" : "transparent",
            color: disabled
              ? "rgba(247,245,239,0.36)"
              : active
                ? "var(--sv-ink)"
                : "rgba(247,245,239,0.72)",
            boxShadow: active ? "2px 2px 0 0 rgba(0,0,0,0.3)" : "none",
            cursor: disabled ? "not-allowed" : "pointer",
          };
          const content = (
            <>
              <Icon size={15} strokeWidth={1.8} className="shrink-0" />
              <span
                className="flex-1 min-w-0"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
              {badge && (
                <span
                  className="shrink-0 rounded-full"
                  style={{
                    padding: disabled ? "1px 5px" : "1px 6px",
                    fontSize: disabled ? "7px" : "8px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    background:
                      disabled
                        ? "rgba(247,245,239,0.14)"
                        : active
                          ? "rgba(0,0,0,0.15)"
                          : "var(--sv-green)",
                    color: disabled
                      ? "rgba(247,245,239,0.55)"
                      : "var(--sv-ink)",
                  }}
                >
                  {badge}
                </span>
              )}
            </>
          );
          if (disabled) {
            return (
              <DisabledNavItem
                key={`${href}-${idx}`}
                commonStyle={commonStyle}
                content={content}
                tooltip={tooltip}
              />
            );
          }
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] transition-all duration-150"
              style={commonStyle}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "var(--sv-paper)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(247,245,239,0.72)";
                }
              }}
            >
              {content}
            </Link>
          );
        })}
          </nav>
        );
      })()}

      {/* Spacer */}
      <div className="flex-1 min-h-[20px]" />

      {/* Plan card + usage indicator (bar verde→amarelo→vermelho) */}
      <PlanCard profile={profile} planIsFree={planIsFree} onNavigate={onNavigate} />

      {/* User row */}
      <div
        className="flex items-center gap-2.5 border-t px-2.5 pt-3"
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`Foto de perfil de ${profile?.name || "usuário"}`}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
            style={{ border: "1.5px solid var(--sv-paper)" }}
          />
        ) : (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--sv-pink)",
              border: "1.5px solid var(--sv-paper)",
              fontFamily: "var(--sv-display)",
              fontStyle: "italic",
              fontSize: "14px",
              color: "var(--sv-ink)",
            }}
          >
            {profile?.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{
              fontFamily: "var(--sv-sans)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--sv-paper)",
            }}
          >
            {profile?.name || "Conta"}
          </div>
          <div
            className="truncate"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: "8.5px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(247,245,239,0.5)",
            }}
          >
            Plano {planShortLabel(profile?.plan)}
          </div>
        </div>
        <button
          onClick={signOut}
          aria-label="Sair"
          title="Sair"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
          style={{ color: "rgba(247,245,239,0.6)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "var(--sv-paper)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(247,245,239,0.6)";
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, user, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const authenticated = !!(user && session?.access_token);
  const isLoginPage = pathname === "/app/login";
  const isOnboardingPage = pathname === "/app/onboarding";
  // Admin bypass: rotas /app/admin/* não podem ser bloqueadas pelo gate
  // de onboarding — o admin precisa entrar mesmo antes de preencher
  // onboarding pessoal (ou depois, sem ser redirecionado pra wizard).
  const isAdminArea = pathname.startsWith("/app/admin");
  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (loading) return;

    if (!authenticated) {
      if (!isLoginPage) {
        router.replace("/app/login");
      }
      return;
    }

    // Admin acessando /app/admin nunca é forçado pra onboarding.
    if (isAdminArea && isAdmin) return;

    if (
      profile &&
      !profile.onboarding_completed &&
      !isOnboardingPage &&
      !isLoginPage
    ) {
      router.replace("/app/onboarding");
    }
  }, [
    loading,
    authenticated,
    profile,
    pathname,
    router,
    isLoginPage,
    isOnboardingPage,
    isAdminArea,
    isAdmin,
  ]);

  if (loading && !isLoginPage) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ background: "var(--sv-paper)" }}
      >
        <span
          className="inline-flex items-center gap-2"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: "10px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full animate-pulse"
            style={{
              background: "var(--sv-green)",
              border: "1px solid var(--sv-ink)",
            }}
          />
          Carregando sessão
        </span>
        <p
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: "28px",
            letterSpacing: "-0.02em",
            color: "var(--sv-ink)",
          }}
        >
          Sequência <em className="italic">Viral</em>
        </p>
      </div>
    );
  }

  if (!loading && !authenticated && !isLoginPage) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--sv-paper)" }}
      >
        <span
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: "10px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          ● Redirecionando pro login
        </span>
      </div>
    );
  }

  return <>{children}</>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Hide shell on login/onboarding
  const isFullscreenPage =
    pathname === "/app/login" || pathname === "/app/onboarding";

  const crumb = useMemo(() => breadcrumbFor(pathname), [pathname]);

  if (isFullscreenPage) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "var(--sv-paper)", color: "var(--sv-ink)" }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar desktop (static) + mobile (drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[240px] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:flex`}
        style={{ minHeight: "100vh" }}
      >
        <SidebarContent
          pathname={pathname}
          onNavigate={() => setSidebarOpen(false)}
          profile={profile}
          signOut={signOut}
          showCloseButton
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header (< lg) */}
        <header
          className="flex h-16 items-center justify-between gap-3 border-b px-4 lg:hidden"
          style={{
            background: "var(--sv-paper)",
            borderColor: "var(--sv-ink)",
            borderBottomWidth: "1.5px",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu lateral"
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-white)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
              color: "var(--sv-ink)",
            }}
          >
            <Menu size={18} />
          </button>
          <span
            className="truncate"
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: "18px",
              color: "var(--sv-ink)",
            }}
          >
            Sequência <em className="italic">Viral</em>
          </span>
          <Link
            href="/app/create/new"
            aria-label="Novo carrossel"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: "var(--sv-green)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
              color: "var(--sv-ink)",
            }}
          >
            <PlusCircle size={16} strokeWidth={2.4} />
          </Link>
        </header>

        {/* Desktop topbar removido 24/04 a pedido do Gabriel — navegação
            é só pelo sidebar esquerdo. Breadcrumb/search/botão "Novo"
            estavam duplicando o CTA do próprio sidebar. Mobile header
            continua acima pro drawer. */}

        <main className="flex-1 min-w-0 overflow-x-hidden p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:p-10 xl:p-14">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

/**
 * Item de nav disabled com tooltip controlado por state (Tailwind
 * group-hover:block estava falhando por algum motivo — render JIT?). Usa
 * onMouseEnter/Leave pra controlar visibilidade do card explicativo.
 */
function DisabledNavItem({
  commonStyle,
  content,
  tooltip,
}: {
  commonStyle: React.CSSProperties;
  content: React.ReactNode;
  tooltip?: { title: string; body: string };
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const itemRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function handleEnter() {
    if (!tooltip) return;
    const rect = itemRef.current?.getBoundingClientRect();
    if (rect) {
      // Position fixa (portal) — escapa do overflow-y-auto do sidebar.
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 12,
      });
    }
    setOpen(true);
  }

  return (
    <div
      ref={itemRef}
      aria-disabled
      className="nav-disabled relative flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] select-none"
      style={commonStyle}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      {content}
      {mounted &&
        tooltip &&
        open &&
        coords &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: "translateY(-50%)",
              minWidth: 220,
              maxWidth: 280,
              padding: "12px 14px",
              background: "var(--sv-ink)",
              color: "var(--sv-paper)",
              border: "1.5px solid var(--sv-ink)",
              borderRadius: 8,
              boxShadow: "3px 3px 0 0 rgba(0,0,0,0.35)",
              zIndex: 9999,
            }}
          >
            <div
              className="uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: "9px",
                letterSpacing: "0.18em",
                color: "var(--sv-green)",
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              ● Em breve · {tooltip.title}
            </div>
            <div
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: "12px",
                lineHeight: 1.5,
                letterSpacing: 0,
                textTransform: "none",
                color: "rgba(247,245,239,0.9)",
                fontWeight: 400,
              }}
            >
              {tooltip.body}
            </div>
          </div>,
          document.body
        )}
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
