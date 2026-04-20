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
  FileText,
  ImageIcon,
  ChevronDown,
  Tag,
  CheckSquare,
  Square,
  X,
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
  updateCarouselTags,
  upsertUserCarousel,
} from "@/lib/carousel-storage";
import { DEFAULT_DESIGN_TEMPLATE } from "@/lib/carousel-templates";
import posthog from "posthog-js";

const LIBRARY_SLIDE_PREVIEW_SCALE = 0.22;

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

type FilterKey = "all" | "drafts" | "published" | "archived";

export default function CarouselsPage() {
  const { user, refreshProfile, profile } = useAuth();
  const previewProfile = useMemo(() => buildLibraryPreviewProfile(profile), [profile]);
  const [carousels, setCarousels] = useState<SavedCarousel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest">("recent");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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

  const counts = useMemo(() => {
    return {
      all: carousels.length,
      drafts: carousels.filter((c) => c.status !== "published").length,
      published: carousels.filter((c) => c.status === "published").length,
      archived: 0,
    };
  }, [carousels]);

  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of carousels) {
      for (const t of c.tags || []) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [carousels]);

  const filtered = carousels
    .filter((c) => {
      if (filter === "drafts" && c.status === "published") return false;
      if (filter === "published" && c.status !== "published") return false;
      if (filter === "archived") return false;
      if (tagFilter && !(c.tags || []).includes(tagFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const title = (c.title || c.slides[0]?.heading || "").toLowerCase();
        const tagBlob = (c.tags || []).join(" ").toLowerCase();
        if (!title.includes(q) && !tagBlob.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.savedAt).getTime();
      const dateB = new Date(b.savedAt).getTime();
      return sort === "recent" ? dateB - dateA : dateA - dateB;
    });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((c) => c.id)));
  }

  async function handleBulkDelete() {
    if (!user || !supabase) {
      toast.error("Sessão inválida.");
      return;
    }
    const ids = Array.from(selected).filter(isCarouselUuid);
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} carrossel(is)? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setBulkBusy(true);
    let okCount = 0;
    for (const id of ids) {
      try {
        await deleteUserCarousel(supabase, user.id, id);
        posthog.capture("carousel_deleted", { carousel_id: id, bulk: true });
        okCount++;
      } catch (err) {
        console.warn("[bulk-delete] falha em", id, err);
      }
    }
    await loadCarousels();
    clearSelection();
    setBulkBusy(false);
    toast.success(`${okCount} removido(s).`);
  }

  async function handleBulkDuplicate() {
    if (!user || !supabase) {
      toast.error("Sessão inválida.");
      return;
    }
    const items = carousels.filter((c) => selected.has(c.id));
    if (items.length === 0) return;
    setBulkBusy(true);
    let okCount = 0;
    for (const carousel of items) {
      try {
        await upsertUserCarousel(supabase, user.id, {
          title: `${carousel.title || "Sem título"} (cópia)`,
          slides: carousel.slides,
          slideStyle: carousel.style === "dark" ? "dark" : "white",
          variation: carousel.variation ?? null,
          status: "draft",
          designTemplate: DEFAULT_DESIGN_TEMPLATE,
          creationMode: carousel.creationMode ?? "quick",
          imagePeopleMode: carousel.imagePeopleMode,
        });
        okCount++;
      } catch (err) {
        console.warn("[bulk-duplicate] falha em", carousel.id, err);
      }
    }
    if (okCount > 0) {
      await bumpCarouselUsage(supabase, user.id);
      await refreshProfile();
    }
    await loadCarousels();
    clearSelection();
    setBulkBusy(false);
    toast.success(`${okCount} duplicado(s).`);
  }

  function handleBulkExportJson() {
    const items = carousels.filter((c) => selected.has(c.id));
    if (items.length === 0) return;
    const payload = {
      meta: {
        app: "sequencia-viral",
        format_version: 1,
        exported_at: new Date().toISOString(),
        user_id: user?.id ?? null,
      },
      carousels: items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sequencia-viral-${items.length}-carrossel${
      items.length > 1 ? "s" : ""
    }-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${items.length} carrossel(is) exportado(s).`);
  }

  async function handleSaveTags(id: string, tags: string[]) {
    if (!user || !supabase) return;
    try {
      await updateCarouselTags(supabase, user.id, id, tags);
      await loadCarousels();
      toast.success("Tags atualizadas.");
    } catch (err) {
      console.error("[tags] falha:", err);
      toast.error("Não foi possível salvar as tags.");
    }
  }

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

  const total = carousels.length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero editorial */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <span className="sv-eyebrow mb-6">
          <span className="sv-dot" />
          Biblioteca · {total} {total === 1 ? "CARROSSEL" : "CARROSSÉIS"}
        </span>

        {loadError && (
          <div
            className="mt-5 mb-6 flex items-start justify-between gap-3 px-5 py-4 text-sm"
            style={{
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-white)",
              boxShadow: "3px 3px 0 0 var(--sv-orange)",
              color: "var(--sv-ink)",
              fontFamily: "var(--sv-sans)",
            }}
          >
            <span>
              <strong>Erro: </strong>
              {loadError}
            </span>
            <button
              onClick={() => loadCarousels()}
              className="sv-kicker underline"
              style={{ color: "var(--sv-ink)" }}
            >
              Tentar de novo
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h1
              className="sv-display"
              style={{ fontSize: "clamp(40px, 6vw, 72px)", lineHeight: 0.95, letterSpacing: "-0.02em" }}
            >
              Seus <em>carrosséis</em>.
            </h1>
            <p
              className="mt-4"
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 16,
                color: "var(--sv-muted)",
                maxWidth: 520,
              }}
            >
              {total} {total === 1 ? "peça salva" : "peças salvas"}. Filtre, duplique, exporte.
            </p>
          </div>
          <Link href="/app/create/new" className="sv-btn-primary self-start">
            + Novo carrossel
          </Link>
        </div>
      </motion.div>

      {/* Filters sticky */}
      {carousels.length > 0 && (
        <div
          className="sticky z-20 mb-8 -mx-4 px-4 py-3 md:-mx-6 md:px-6"
          style={{
            top: 72,
            background: "var(--sv-paper)",
            borderTop: "1.5px solid var(--sv-ink)",
            borderBottom: "1.5px solid var(--sv-ink)",
          }}
        >
          <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative flex-1 lg:max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--sv-muted)" }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="BUSCAR POR TÍTULO…"
                className="sv-input w-full pl-9"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              />
            </div>

            {/* Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", "Todos", counts.all],
                  ["drafts", "Em edição", counts.drafts],
                  ["published", "Publicados", counts.published],
                  ["archived", "Arquivados", counts.archived],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`sv-chip ${filter === key ? "sv-chip-on" : ""}`}
                >
                  {label} · {n}
                </button>
              ))}

              {/* Sort */}
              <button
                onClick={() => setSort(sort === "recent" ? "oldest" : "recent")}
                className="sv-chip"
                style={{ gap: 8 }}
              >
                {sort === "recent" ? "Mais recentes" : "Mais antigos"}
                <ChevronDown size={12} />
              </button>
            </div>
          </div>

          {/* Tag filter row */}
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="sv-kicker-sm inline-flex items-center gap-1"
                style={{ color: "var(--sv-muted)" }}
              >
                <Tag size={11} /> TAGS
              </span>
              {tagFilter && (
                <button
                  type="button"
                  className="sv-chip sv-chip-on"
                  onClick={() => setTagFilter(null)}
                  style={{ gap: 6 }}
                >
                  {tagFilter}
                  <X size={11} />
                </button>
              )}
              {allTags
                .filter(([t]) => t !== tagFilter)
                .map(([t, n]) => (
                  <button
                    key={t}
                    type="button"
                    className="sv-chip"
                    onClick={() => setTagFilter(t)}
                  >
                    {t} · {n}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div
          className="sticky z-20 mb-6 flex flex-wrap items-center gap-3 px-4 py-3"
          style={{
            top: 128,
            background: "var(--sv-ink)",
            color: "var(--sv-paper)",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "3px 3px 0 0 var(--sv-orange)",
          }}
        >
          <span
            className="sv-kicker-sm"
            style={{ color: "var(--sv-paper)", fontSize: 11 }}
          >
            ● {selected.size} SELECIONADO{selected.size > 1 ? "S" : ""}
          </span>
          <button
            type="button"
            onClick={selectAllFiltered}
            className="sv-btn-ghost"
            style={{ color: "var(--sv-paper)", fontSize: 10 }}
            disabled={bulkBusy}
          >
            Selecionar tudo
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkDuplicate}
              className="sv-btn-outline"
              style={{ color: "var(--sv-paper)", borderColor: "var(--sv-paper)", fontSize: 10 }}
              disabled={bulkBusy}
            >
              <Copy size={11} /> Duplicar
            </button>
            <button
              type="button"
              onClick={handleBulkExportJson}
              className="sv-btn-outline"
              style={{ color: "var(--sv-paper)", borderColor: "var(--sv-paper)", fontSize: 10 }}
              disabled={bulkBusy}
            >
              <Download size={11} /> Exportar JSON
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="sv-btn-outline"
              style={{
                color: "var(--sv-orange)",
                borderColor: "var(--sv-orange)",
                fontSize: 10,
              }}
              disabled={bulkBusy}
            >
              <Trash2 size={11} /> Excluir
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="sv-btn-ghost"
              style={{ color: "var(--sv-paper)", fontSize: 10 }}
              disabled={bulkBusy}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
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
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
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
                selected={selected.has(carousel.id)}
                onToggleSelect={() => toggleSelect(carousel.id)}
                onSaveTags={(tags) => handleSaveTags(carousel.id, tags)}
                onTagClick={(t) => setTagFilter(t)}
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
            className="py-16 text-center"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
            }}
          >
            ● Nenhum resultado pra esse filtro
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
  selected,
  onToggleSelect,
  onSaveTags,
  onTagClick,
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
  selected: boolean;
  onToggleSelect: () => void;
  onSaveTags: (tags: string[]) => void;
  onTagClick: (tag: string) => void;
}) {
  const [editingTags, setEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const date = new Date(carousel.savedAt);
  const rel = formatRelative(date);

  const title = carousel.title || carousel.slides[0]?.heading || "Sem título";
  const slideCount = carousel.slides.length;
  const status = carousel.status || "draft";
  const first = carousel.slides[0];
  const slideStyle = carousel.style === "dark" ? "dark" : "white";

  const isPublished = status === "published";

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="sv-card group flex flex-col overflow-hidden p-0"
      style={{
        padding: 0,
        outline: selected ? "3px solid var(--sv-orange)" : undefined,
        outlineOffset: selected ? -3 : undefined,
      }}
    >
      {/* Preview 4:5 */}
      <div
        className="relative aspect-[4/5] w-full overflow-hidden"
        style={{
          borderBottom: "1.5px solid var(--sv-ink)",
          background: carousel.style === "dark" ? "var(--sv-ink)" : "var(--sv-soft)",
        }}
      >
        {/* Select checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect();
          }}
          className="absolute left-3 top-3 z-10 flex items-center justify-center p-1.5"
          style={{
            background: selected ? "var(--sv-orange)" : "var(--sv-paper)",
            border: "1.5px solid var(--sv-ink)",
            color: selected ? "var(--sv-paper)" : "var(--sv-ink)",
          }}
          aria-label={selected ? "Desmarcar" : "Selecionar"}
          title={selected ? "Desmarcar" : "Selecionar"}
        >
          {selected ? <CheckSquare size={13} /> : <Square size={13} />}
        </button>
        {first ? (
          <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center">
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
          <div
            className="flex h-full items-center justify-center"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
            }}
          >
            ● Sem slides
          </div>
        )}

        {/* Hover toolbar */}
        <div
          className="absolute inset-x-0 bottom-0 flex translate-y-full items-center gap-2 px-3 py-3 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
          style={{
            background: "rgba(10,10,10,0.88)",
            borderTop: "1.5px solid var(--sv-ink)",
          }}
        >
          <Link
            href={`/app/create/${carousel.id}/edit`}
            className="sv-btn-primary"
            style={{ padding: "7px 12px", fontSize: 9.5 }}
          >
            <Pencil size={11} /> Editar
          </Link>
          <button
            onClick={onDuplicate}
            className="sv-btn-outline"
            style={{ padding: "7px 12px", fontSize: 9.5 }}
          >
            <Copy size={11} /> Duplicar
          </button>
          <Link
            href={`/app/create/${carousel.id}/edit`}
            className="sv-btn-outline"
            style={{ padding: "7px 12px", fontSize: 9.5 }}
          >
            <Download size={11} /> Exportar
          </Link>
          <button
            onClick={onDelete}
            className="sv-btn-ghost ml-auto"
            style={{
              padding: "7px 10px",
              color: deleteConfirm ? "var(--sv-orange)" : "var(--sv-paper)",
              background: deleteConfirm ? "rgba(255,74,28,0.15)" : "transparent",
              border: "1.5px solid transparent",
            }}
            title={deleteConfirm ? "Confirma exclusão" : "Excluir"}
          >
            <Trash2 size={11} />
            {deleteConfirm ? " Confirmar?" : ""}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className="sv-kicker-sm inline-flex items-center gap-1.5"
            style={{ color: "var(--sv-muted)" }}
          >
            <span
              className="inline-block h-[7px] w-[7px] rounded-full"
              style={{
                background: isPublished ? "var(--sv-green)" : "var(--sv-ink)",
                border: "1px solid var(--sv-ink)",
              }}
            />
            {isPublished ? "Publicado" : "Criado"} · {rel}
          </span>
          <span
            className="sv-kicker-sm"
            style={{ color: "var(--sv-muted)" }}
          >
            {slideCount} slides
          </span>
        </div>

        <h3
          className="line-clamp-2"
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: 22,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            color: "var(--sv-ink)",
          }}
        >
          {title}
        </h3>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(carousel.tags || []).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTagClick(t)}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px]"
              style={{
                background: "var(--sv-soft)",
                border: "1.5px solid var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--sv-ink)",
              }}
            >
              <Tag size={9} /> {t}
            </button>
          ))}
          {editingTags ? (
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const raw = tagDraft.trim().replace(/,$/, "");
                    if (raw) {
                      const next = Array.from(
                        new Set([...(carousel.tags || []), raw])
                      );
                      onSaveTags(next);
                    }
                    setTagDraft("");
                  } else if (e.key === "Escape") {
                    setEditingTags(false);
                    setTagDraft("");
                  }
                }}
                placeholder="nova tag"
                className="sv-input"
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  minWidth: 120,
                }}
              />
              {(carousel.tags || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => onSaveTags([])}
                  className="sv-btn-ghost"
                  style={{ padding: "4px 8px", fontSize: 9 }}
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingTags(false);
                  setTagDraft("");
                }}
                className="sv-btn-ghost"
                style={{ padding: "4px 8px", fontSize: 9 }}
              >
                OK
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingTags(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px]"
              style={{
                background: "transparent",
                border: "1.5px dashed var(--sv-muted)",
                fontFamily: "var(--sv-mono)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              + tag
            </button>
          )}
        </div>

        <CarouselFeedbackPanel
          carouselId={carousel.id}
          userId={userId}
          supabase={sb}
          initial={carousel.feedback ?? null}
          onSaved={onFeedbackSaved}
          compact
        />

        {carousel.exportAssets &&
          (carousel.exportAssets.pdfUrl ||
            (carousel.exportAssets.pngUrls?.length ?? 0) > 0) && (
            <div
              className="flex flex-wrap items-center gap-2 px-3 py-2"
              style={{
                border: "1.5px solid var(--sv-ink)",
                background: "var(--sv-soft)",
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--sv-ink)",
              }}
            >
              <span style={{ color: "var(--sv-muted)" }}>● Nuvem</span>
              {carousel.exportAssets.pdfUrl ? (
                <a
                  href={carousel.exportAssets.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1"
                  style={{
                    background: "var(--sv-white)",
                    border: "1.5px solid var(--sv-ink)",
                  }}
                >
                  <FileText size={11} />
                  PDF
                </a>
              ) : null}
              {carousel.exportAssets.pngUrls?.slice(0, 6).map((url, idx) => (
                <a
                  key={`${url}-${idx}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1 px-2 py-1"
                  style={{
                    background: "var(--sv-white)",
                    border: "1.5px solid var(--sv-ink)",
                  }}
                >
                  <ImageIcon size={10} />
                  {idx + 1}
                </a>
              ))}
              {(carousel.exportAssets.pngUrls?.length ?? 0) > 6 ? (
                <span style={{ color: "var(--sv-muted)" }}>
                  +{(carousel.exportAssets.pngUrls?.length ?? 0) - 6} PNG
                </span>
              ) : null}
            </div>
          )}

        {/* Inline actions (mobile fallback + desktop persistent) */}
        <div
          className="flex items-center gap-2 pt-3"
          style={{ borderTop: "1.5px solid rgba(10,10,10,0.1)" }}
        >
          <Link
            href={`/app/create/${carousel.id}/edit`}
            className="sv-btn-primary"
            style={{ padding: "7px 12px", fontSize: 9.5 }}
          >
            <Pencil size={11} /> Editar
          </Link>
          <button
            onClick={onDuplicate}
            className="sv-btn-outline"
            style={{ padding: "7px 12px", fontSize: 9.5 }}
          >
            <Copy size={11} /> Duplicar
          </button>
          <button
            onClick={onDelete}
            className="sv-btn-ghost ml-auto"
            style={{
              padding: "7px 10px",
              fontSize: 9.5,
              color: deleteConfirm ? "var(--sv-orange)" : "var(--sv-muted)",
              border: "1.5px solid transparent",
            }}
            title={deleteConfirm ? "Confirma exclusão" : "Excluir"}
          >
            <Trash2 size={11} />
            {deleteConfirm ? " Confirmar?" : ""}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function EmptyState() {
  return (
    <section className="sv-card-accent flex flex-col gap-6 p-10 md:flex-row md:items-center md:justify-between md:p-12">
      <div className="max-w-xl">
        <span
          className="sv-eyebrow"
          style={{ background: "var(--sv-ink)", color: "var(--sv-paper)" }}
        >
          <span className="sv-dot" />
          Coleção vazia
        </span>
        <h2
          className="sv-display mt-5"
          style={{ fontSize: "clamp(32px, 4.5vw, 56px)", lineHeight: 0.95 }}
        >
          Seu estúdio está em <em>branco</em>.
        </h2>
        <p
          className="mt-3"
          style={{ fontFamily: "var(--sv-sans)", fontSize: 16, color: "var(--sv-ink)" }}
        >
          Crie seu primeiro carrossel e ele aparece aqui. Dá pra salvar, editar,
          duplicar e exportar sem perder a ordem.
        </p>
      </div>
      <Link href="/app/create/new" className="sv-btn-ink self-start md:self-auto">
        <PlusCircle size={13} /> Criar primeiro carrossel
      </Link>
    </section>
  );
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) {
    const mins = Math.max(1, Math.round(diff / minute));
    return `há ${mins} min`;
  }
  if (diff < day) {
    const hrs = Math.round(diff / hour);
    return `há ${hrs}h`;
  }
  if (diff < 7 * day) {
    const days = Math.round(diff / day);
    return `há ${days}d`;
  }
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
