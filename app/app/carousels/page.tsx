"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlusCircle,
  Search,
  Trash2,
  Copy,
  Pencil,
  Download,
  Sparkles,
  Filter,
  FileText,
  ImageIcon,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import type { UserProfile } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CarouselListSkeleton } from "@/components/app/carousel-skeleton";
import EditorialSlide from "@/components/app/editorial-slide";
import CarouselFeedbackPanel from "@/components/app/carousel-feedback";
import {
  bumpCarouselUsage,
  deleteUserCarousel,
  fetchUserCarousels,
  isCarouselUuid,
  type SavedCarousel,
  upsertUserCarousel,
} from "@/lib/carousel-storage";
import { DEFAULT_DESIGN_TEMPLATE } from "@/lib/carousel-templates";
import posthog from "posthog-js";

const LIBRARY_SLIDE_PREVIEW_SCALE = 0.14;

function buildLibraryPreviewProfile(profile: UserProfile | null): {
  name: string;
  handle: string;
  photoUrl: string;
} {
  if (!profile) {
    return { name: "Seu nome", handle: "@seuhandle", photoUrl: "" };
  }
  const handle = profile.twitter_handle
    ? `@${profile.twitter_handle}`
    : profile.instagram_handle
      ? `@${profile.instagram_handle}`
      : "@seuhandle";
  return {
    name: profile.name || "Seu nome",
    handle,
    photoUrl: profile.avatar_url || "",
  };
}

export default function CarouselsPage() {
  const { user, refreshProfile, profile } = useAuth();
  const previewProfile = useMemo(() => buildLibraryPreviewProfile(profile), [profile]);
  const [carousels, setCarousels] = useState<SavedCarousel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "drafts" | "published">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest">("recent");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCarousels = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);
    if (!user || !supabase) {
      setCarousels([]);
      setIsLoading(false);
      return;
    }
    try {
      const cloudList = await fetchUserCarousels(supabase);
      setCarousels(cloudList);
    } catch (err) {
      console.error("[carousels] Supabase failed:", err);
      setLoadError("Não foi possível carregar seus carrosséis. Tente novamente.");
      setCarousels([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCarousels();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadCarousels]);

  const filtered = carousels
    .filter((c) => {
      if (filter === "drafts" && c.status !== "draft") return false;
      if (filter === "published" && c.status !== "published") return false;
      if (search) {
        const q = search.toLowerCase();
        const title = (c.title || c.slides[0]?.heading || "").toLowerCase();
        if (!title.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.savedAt).getTime();
      const dateB = new Date(b.savedAt).getTime();
      return sort === "recent" ? dateB - dateA : dateA - dateB;
    });

  async function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }
    try {
      if (user && supabase && isCarouselUuid(id)) {
        await deleteUserCarousel(supabase, user.id, id);
        posthog.capture("carousel_deleted", { carousel_id: id });
        await loadCarousels();
        toast.success("Carrossel removido.");
      } else {
        toast.error("Não foi possível remover este item.");
      }
    } catch {
      toast.error("Não foi possível remover. Tente de novo.");
    }
    setDeleteConfirm(null);
  }

  async function handleDuplicate(carousel: SavedCarousel) {
    try {
      if (!user || !supabase) {
        toast.error("Sessão inválida. Entre novamente.");
        return;
      }
      const { inserted } = await upsertUserCarousel(supabase, user.id, {
        title: `${carousel.title || "Sem título"} (cópia)`,
        slides: carousel.slides,
        slideStyle: carousel.style === "dark" ? "dark" : "white",
        variation: carousel.variation ?? null,
        status: "draft",
        designTemplate: DEFAULT_DESIGN_TEMPLATE,
        creationMode: carousel.creationMode ?? "quick",
        imagePeopleMode: carousel.imagePeopleMode,
      });
      if (inserted) {
        await bumpCarouselUsage(supabase, user.id);
        await refreshProfile();
      }
      await loadCarousels();
      toast.success("Carrossel duplicado.");
    } catch {
      toast.error("Não foi possível duplicar. Tente de novo.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="tag-pill mb-6">Biblioteca</span>
        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            <strong>Erro:</strong> {loadError}
            <button onClick={() => loadCarousels()} className="ml-3 font-bold underline">Tentar novamente</button>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <h1 className="editorial-serif text-[3rem] sm:text-[4.5rem] md:text-[6rem] text-[var(--foreground)] leading-[0.95]">
              Meus <span className="italic text-[var(--accent)]">carrosséis.</span>
            </h1>
            <p className="mt-4 text-lg text-[var(--muted)]">
              {carousels.length} {carousels.length === 1 ? "peça salva" : "peças salvas"} na coleção
            </p>
          </div>
          <Link
            href="/app/create"
            className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-[var(--accent-dark)] transition-colors self-start"
            style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
          >
            <PlusCircle size={16} />
            Novo carrossel
          </Link>
        </div>
      </motion.div>

      {/* Search and Filters */}
      {carousels.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10"
        >
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título…"
              className="w-full rounded-xl border border-[#0A0A0A] bg-[#FFFDF9] pl-11 pr-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:ring-2 focus:ring-[var(--accent)]/30 placeholder:text-[var(--muted)]"
              style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-[#FFFDF9] border border-[#0A0A0A] rounded-xl p-1" style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}>
            <Filter size={14} className="text-[var(--muted)] ml-2 mr-1" />
            {(["all", "drafts", "published"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === f
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[#0A0A0A]"
                }`}
              >
                {f === "all" ? "Todos" : f === "drafts" ? "Rascunhos" : "Publicados"}
              </button>
            ))}
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSort(sort === "recent" ? "oldest" : "recent")}
            className="flex items-center gap-1.5 bg-[#FFFDF9] border border-[#0A0A0A] rounded-xl px-4 py-2.5 text-xs font-bold text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-all"
            style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
          >
            <ArrowUpDown size={14} />
            {sort === "recent" ? "Recentes" : "Antigos"}
          </button>
        </motion.div>
      )}

      {/* Carousel Grid */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CarouselListSkeleton count={4} />
          </motion.div>
        ) : filtered.length > 0 ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {filtered.map((carousel, i) => (
              <CarouselCard
                key={carousel.id}
                carousel={carousel}
                index={i}
                deleteConfirm={deleteConfirm === carousel.id}
                previewProfile={previewProfile}
                userId={user?.id}
                supabase={supabase}
                onFeedbackSaved={() => void loadCarousels()}
                onDelete={() => handleDelete(carousel.id)}
                onDuplicate={() => handleDuplicate(carousel)}
              />
            ))}
          </motion.div>
        ) : carousels.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState />
          </motion.div>
        ) : (
          <motion.div
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16"
          >
            <p className="text-zinc-500">Nenhum carrossel encontrado com esse filtro.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CarouselCard({
  carousel,
  index,
  deleteConfirm,
  previewProfile,
  userId,
  supabase: sb,
  onFeedbackSaved,
  onDelete,
  onDuplicate,
}: {
  carousel: SavedCarousel;
  index: number;
  deleteConfirm: boolean;
  previewProfile: { name: string; handle: string; photoUrl: string };
  userId: string | undefined;
  supabase: SupabaseClient | null;
  onFeedbackSaved: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const date = new Date(carousel.savedAt);
  const formatted = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const title = carousel.title || carousel.slides[0]?.heading || "Sem título";
  const slideCount = carousel.slides.length;
  const status = carousel.status || "draft";
  const first = carousel.slides[0];
  const slideStyle = carousel.style === "dark" ? "dark" : "white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="card-soft overflow-hidden group"
    >
      {/* Preview: slide real (template Twitter) ou capa com imagem + texto */}
      <div
        className={`relative min-h-[200px] max-h-[240px] flex items-center justify-center border-b border-[#0A0A0A]/10 overflow-hidden ${
          carousel.style === "dark" ? "bg-[#0A0A0A]" : "bg-[#f4f4f5]"
        }`}
      >
        {first ? (
          <div className="w-full flex items-center justify-center py-3 px-2 pointer-events-none select-none">
            <EditorialSlide
              heading={first.heading || " "}
              body={first.body || " "}
              imageUrl={first.imageUrl}
              slideNumber={1}
              totalSlides={Math.max(slideCount, 1)}
              profile={previewProfile}
              style={slideStyle}
              isLastSlide={slideCount <= 1}
              showFooter
              scale={LIBRARY_SLIDE_PREVIEW_SCALE}
            />
          </div>
        ) : (
          <div className="py-12 text-sm text-[var(--muted)]">Sem slides</div>
        )}

        {/* Status badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
          <div
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#0A0A0A] ${
              status === "published"
                ? "bg-[var(--accent)] text-white"
                : "bg-[#FFFDF9] text-[#0A0A0A]"
            }`}
          >
            {status === "published" ? "Publicado" : "Rascunho"}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
          {formatted} · {slideCount} slides
        </p>
        <h3 className="editorial-serif text-2xl text-[var(--foreground)] leading-tight truncate mb-4">
          {title}
        </h3>

        <div className="mb-4">
          <CarouselFeedbackPanel
            carouselId={carousel.id}
            userId={userId}
            supabase={sb}
            initial={carousel.feedback ?? null}
            onSaved={onFeedbackSaved}
            compact
          />
        </div>

        {carousel.exportAssets &&
          (carousel.exportAssets.pdfUrl ||
            (carousel.exportAssets.pngUrls?.length ?? 0) > 0) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-[11px] font-semibold text-emerald-900">
              <span className="uppercase tracking-wider text-emerald-700/90">Nuvem</span>
              {carousel.exportAssets.pdfUrl ? (
                <a
                  href={carousel.exportAssets.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-emerald-800 shadow-sm ring-1 ring-emerald-200/80 hover:bg-emerald-50"
                >
                  <FileText size={12} />
                  PDF
                </a>
              ) : null}
              {carousel.exportAssets.pngUrls?.slice(0, 8).map((url, idx) => (
                <a
                  key={`${url}-${idx}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-0.5 rounded-md bg-white px-2 py-1 text-emerald-800 shadow-sm ring-1 ring-emerald-200/80 hover:bg-emerald-50"
                >
                  <ImageIcon size={11} />
                  {idx + 1}
                </a>
              ))}
              {(carousel.exportAssets.pngUrls?.length ?? 0) > 8 ? (
                <span className="text-emerald-700/80">
                  +{(carousel.exportAssets.pngUrls?.length ?? 0) - 8} PNG
                </span>
              ) : null}
            </div>
          )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-[#0A0A0A]/10">
          <Link
            href={`/app/create?draft=${carousel.id}`}
            className="btn-scale flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-dark)] transition-colors"
          >
            <Pencil size={12} />
            Editar
          </Link>
          <button
            onClick={onDuplicate}
            className="btn-scale flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[#0A0A0A]/5 hover:text-[#0A0A0A] transition-colors"
          >
            <Copy size={12} />
            Duplicar
          </button>
          <Link
            href={`/app/create?draft=${carousel.id}`}
            className="btn-scale flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[#0A0A0A]/5 hover:text-[#0A0A0A] transition-colors"
          >
            <Download size={12} />
            Exportar
          </Link>
          <button
            onClick={onDelete}
            className={`btn-scale ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              deleteConfirm
                ? "bg-red-100 text-red-600 animate-[pulse_0.3s_ease-in-out]"
                : "text-[var(--muted)] hover:text-red-500 hover:bg-red-50"
            }`}
          >
            <Trash2 size={12} />
            {deleteConfirm ? "Confirmar?" : ""}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="card-soft p-12 flex flex-col md:flex-row items-center gap-10">
      <div className="relative w-48 h-48 md:w-56 md:h-56 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/empty-carousels.png"
          alt="Nenhum carrossel"
          className="w-full h-full object-contain"
        />
      </div>
      <div className="flex-1 text-center md:text-left">
        <span className="tag-pill mb-4">
          <Sparkles size={12} className="text-[var(--accent)]" /> Coleção vazia
        </span>
        <h3 className="editorial-serif text-3xl md:text-4xl text-[var(--foreground)] mb-3">
          Seu estúdio está em branco.
        </h3>
        <p className="text-[var(--muted)] mb-6 max-w-md">
          Crie seu primeiro carrossel e ele aparece aqui. Você pode salvar, editar,
          duplicar e exportar como quiser.
        </p>
        <Link
          href="/app/create"
          className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-[var(--accent-dark)] transition-colors"
          style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
        >
          <PlusCircle size={16} />
          Criar primeiro carrossel
        </Link>
      </div>
    </div>
  );
}
