"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  PlusCircle,
  FolderOpen,
  Layers,
  CalendarDays,
  Crown,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Zap,
  Eye,
  Bookmark,
  BarChart3,
  Clock,
  Map,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchUserCarousels, readGuestCarousels, type SavedCarousel } from "@/lib/carousel-storage";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const { profile, user, isGuest } = useAuth();
  const [carousels, setCarousels] = useState<SavedCarousel[]>([]);

  const loadCarousels = useCallback(async () => {
    if (user && !isGuest && supabase) {
      try {
        const list = await fetchUserCarousels(supabase);
        setCarousels(list);
      } catch {
        setCarousels([]);
      }
      return;
    }
    setCarousels(readGuestCarousels());
  }, [user, isGuest]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCarousels();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadCarousels]);

  const name = profile?.name?.split(" ")[0] || "criador";
  const savedInLibrary = carousels.length;
  const plan = profile?.plan ?? "free";
  const usageLimit = profile?.usage_limit ?? 5;
  const usageCount = profile?.usage_count ?? 0;
  const isUnlimited = usageLimit >= 999000;
  const greeting = getGreeting();
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const recentCarousels = carousels.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between mb-8"
      >
        <span className="tag-pill">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          {today}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] hidden sm:inline">
          Dashboard · Ed. {new Date().getFullYear()}
        </span>
      </motion.div>

      {isGuest && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 rounded-[22px] border border-[#0A0A0A] bg-amber-50/90 px-5 py-4 text-sm text-amber-950 shadow-[4px_4px_0_0_#0A0A0A]"
        >
          <strong className="font-bold">Modo convidado:</strong> seus rascunhos ficam salvos neste
          navegador. Para nuvem, histórico entre dispositivos e fluxo completo,{" "}
          <Link href="/app/login" className="font-bold text-[var(--accent)] underline underline-offset-2">
            entre ou crie uma conta
          </Link>
          . (Importar @ no onboarding sem login é temporário — veja o{" "}
          <Link href="/roadmap" className="font-bold underline underline-offset-2">
            roadmap
          </Link>
          .)
        </motion.div>
      )}

      {/* Welcome — editorial hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-14"
      >
        <h1 className="editorial-serif text-[3rem] sm:text-[4.5rem] md:text-[6rem] text-[var(--foreground)] leading-[0.95]">
          {greeting}, <span className="italic text-[var(--accent)]">{name}.</span>
        </h1>
        <p className="mt-4 text-xl text-[var(--muted)] max-w-xl">
          Seu estúdio de conteúdo está pronto. O que vamos publicar hoje?
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          <Link
            href="/app/help"
            className="font-semibold text-[var(--accent)] underline underline-offset-2 hover:opacity-90"
          >
            Abrir o guia completo
          </Link>{" "}
          — perfil, tema, link como inspiração e export.
        </p>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10"
      >
        <StatCard
          icon={<Layers size={18} />}
          kicker="Nº 01"
          label="Carrosséis na biblioteca"
          value={String(savedInLibrary)}
        />
        <StatCard
          icon={<CalendarDays size={18} />}
          kicker="Nº 02"
          label={isGuest ? "Rascunhos (limite free)" : "Uso do plano (criações)"}
          value={
            isUnlimited
              ? "Ilimitado"
              : isGuest
                ? `${Math.min(savedInLibrary, usageLimit)}/${usageLimit}`
                : `${usageCount}/${usageLimit}`
          }
          progress={
            isUnlimited
              ? undefined
              : isGuest
                ? Math.min(1, savedInLibrary / usageLimit)
                : Math.min(1, usageCount / usageLimit)
          }
        />
        <StatCard
          icon={<Crown size={18} />}
          kicker="Nº 03"
          label="Seu plano"
          value={plan.charAt(0).toUpperCase() + plan.slice(1)}
          highlight
        />
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-12"
      >
        <Link
          href="/app/create"
          className="card-offset-orange md:col-span-3 p-8 group relative overflow-hidden"
        >
          <div className="relative z-10">
            <span className="text-[11px] font-mono uppercase tracking-widest opacity-80">
              Ação primária
            </span>
            <h3 className="editorial-serif text-4xl md:text-5xl mt-3 mb-3 leading-[0.95]">
              Criar novo carrossel
            </h3>
            <p className="text-white/80 max-w-sm mb-6">
              A partir de um link, um vídeo ou só uma ideia solta.
            </p>
            <span className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur px-5 py-2.5 rounded-xl text-sm font-bold border border-white/20 transition-colors">
              <PlusCircle size={16} /> Começar <ArrowRight size={14} />
            </span>
          </div>
          {/* Decorative bloom */}
          <div
            className="absolute -right-20 -bottom-20 w-72 h-72 rounded-full opacity-40 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 60%)",
            }}
          />
        </Link>

        <Link href="/app/carousels" className="card-offset md:col-span-2 p-7 group">
          <div className="flex items-start justify-between mb-6">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)]">
              Biblioteca
            </span>
            <div className="w-11 h-11 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center text-[var(--accent)]">
              <FolderOpen size={18} />
            </div>
          </div>
          <h3 className="editorial-serif text-3xl text-[var(--foreground)] mb-2">
            Meus carrosséis
          </h3>
          <p className="text-[14px] text-[var(--muted)] leading-relaxed">
            Veja, edite e republique tudo que você já criou.
          </p>
          <div className="mt-5 pt-5 border-t border-[#0A0A0A]/10 flex items-center justify-between">
                       <span className="editorial-serif text-3xl text-[var(--accent)]">
              {savedInLibrary}
            </span>
            <ArrowRight
              size={18}
              className="text-[var(--muted)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all"
            />
          </div>
        </Link>
      </motion.div>

      {/* Recent carousels */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)]">
              Nº 04 · Recentes
            </span>
            <h2 className="editorial-serif text-4xl text-[var(--foreground)] mt-2">
              Últimos carrosséis
            </h2>
          </div>
          {recentCarousels.length > 0 && (
            <Link
              href="/app/carousels"
              className="text-[13px] font-semibold text-[var(--accent)] hover:underline"
            >
              Ver todos →
            </Link>
          )}
        </div>

        {recentCarousels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {recentCarousels.map((c) => (
              <RecentCarouselCard key={c.id} carousel={c} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </motion.div>

      {/* Métricas de publicação — preview (dados reais no roadmap) */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="mt-14"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <span className="tag-pill">
              <BarChart3 size={12} className="text-[var(--accent)]" /> Em breve
            </span>
            <h2 className="editorial-serif text-3xl md:text-4xl text-[var(--foreground)] mt-3">
              Métricas dos posts
            </h2>
            <p className="mt-2 text-[var(--muted)] max-w-lg text-[15px] leading-relaxed">
              Quando as redes estiverem conectadas, você acompanha alcance, saves e engajamento por
              carrossel — igual à visão pública do{" "}
              <Link href="/roadmap" className="font-semibold text-[var(--accent)] hover:underline">
                roadmap
              </Link>
              .
            </p>
          </div>
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[#0A0A0A] bg-[#FFFDF9] px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0_0_#0A0A0A] hover:bg-white transition-colors"
          >
            <Map size={16} />
            Ver métricas no roadmap
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <DashboardMetricTeaser icon={<Eye size={18} />} label="Alcance" value="—" />
          <DashboardMetricTeaser icon={<Bookmark size={18} />} label="Salvos" value="—" />
          <DashboardMetricTeaser icon={<BarChart3 size={18} />} label="Engajamento" value="—" />
          <DashboardMetricTeaser icon={<Clock size={18} />} label="Melhor horário" value="—" />
        </div>
        <p className="mt-3 text-[11px] font-mono uppercase tracking-widest text-[var(--muted)]">
          Placeholder até integração com APIs das redes
        </p>
      </motion.section>

      {/* Tip card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mt-12 card-offset p-8 flex items-center gap-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-muted)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
          <TrendingUp size={22} />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
            Dica do dia
          </p>
          <p className="editorial-serif text-xl text-[var(--foreground)]">
            Carrosséis com hook pergunta convertem <span className="text-[var(--accent)]">3x mais saves</span>.
          </p>
        </div>
        <Link
          href="/app/create"
          className="hidden sm:inline-flex items-center gap-2 text-[13px] font-bold text-[var(--accent)] hover:underline"
        >
          Tentar agora <ArrowRight size={14} />
        </Link>
      </motion.div>
    </div>
  );
}

function RecentCarouselCard({ carousel }: { carousel: SavedCarousel }) {
  const date = new Date(carousel.savedAt);
  const formatted = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <Link href={`/app/create?draft=${carousel.id}`} className="card-offset p-6 group">
      <div className="flex items-start gap-5">
        {/* Thumbnail */}
        <div
          className={`flex-shrink-0 w-20 h-24 rounded-xl flex flex-col items-center justify-center text-xs font-bold border border-[#0A0A0A] ${
            carousel.style === "dark"
              ? "bg-[#0A0A0A] text-white"
              : "bg-[#FFF6EC] text-[var(--accent)]"
          }`}
        >
          <span className="editorial-serif text-3xl leading-none">
            {carousel.slides.length}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-wider mt-1 opacity-70">
            slides
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
            {formatted}
          </p>
          <h3 className="editorial-serif text-xl text-[var(--foreground)] leading-tight mb-2 truncate">
            {carousel.title || carousel.slides[0]?.heading || "Sem título"}
          </h3>
          <p className="text-[13px] text-[var(--muted)] line-clamp-2">
            {carousel.slides[0]?.body || ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

function DashboardMetricTeaser({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card-offset p-4 md:p-5 opacity-95">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
        {icon}
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] mt-3">
        {label}
      </p>
      <p className="editorial-serif text-2xl text-[var(--foreground)] mt-1">{value}</p>
    </div>
  );
}

function StatCard({
  icon,
  kicker,
  label,
  value,
  progress,
  highlight,
}: {
  icon: ReactNode;
  kicker: string;
  label: string;
  value: string;
  progress?: number;
  highlight?: boolean;
}) {
  return (
    <div className={`p-6 ${highlight ? "card-offset-orange" : "card-offset"}`}>
      <div className="flex items-center justify-between mb-6">
        <span
          className={`text-[10px] font-mono uppercase tracking-widest ${
            highlight ? "opacity-70" : "text-[var(--muted)]"
          }`}
        >
          {kicker}
        </span>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            highlight
              ? "bg-white/15 text-white"
              : "bg-[var(--accent-muted)] text-[var(--accent)]"
          }`}
        >
          {icon}
        </div>
      </div>
      <p
        className={`editorial-serif text-5xl ${
          highlight ? "text-white" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </p>
      <p
        className={`text-[12px] mt-2 ${
          highlight ? "text-white/70" : "text-[var(--muted)]"
        }`}
      >
        {label}
      </p>
      {typeof progress === "number" && (
        <div
          className={`mt-4 h-1.5 rounded-full overflow-hidden ${
            highlight ? "bg-white/20" : "bg-[#0A0A0A]/10"
          }`}
        >
          <div
            className={`h-full rounded-full ${
              highlight ? "bg-white" : "bg-[var(--accent)]"
            }`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card-offset p-12 flex flex-col md:flex-row items-center gap-10">
      <div className="relative w-48 h-48 md:w-56 md:h-56 flex-shrink-0">
        <Image
          src="/brand/empty-carousels.png"
          alt="Nenhum carrossel ainda"
          fill
          sizes="224px"
          className="object-contain"
        />
      </div>
      <div className="flex-1 text-center md:text-left">
        <span className="tag-pill mb-4">
          <Sparkles size={12} className="text-[var(--accent)]" /> Comece aqui
        </span>
        <h3 className="editorial-serif text-3xl md:text-4xl text-[var(--foreground)] mb-3">
          Nenhum carrossel ainda.
        </h3>
        <p className="text-[var(--muted)] mb-6 max-w-md">
          Cole um link, um texto ou só uma ideia — a gente monta o primeiro pra
          você em 30 segundos.
        </p>
        <Link
          href="/app/create"
          className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-[var(--accent-dark)] transition-colors"
          style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
        >
          <Zap size={16} /> Criar primeiro carrossel
        </Link>
      </div>
    </div>
  );
}
