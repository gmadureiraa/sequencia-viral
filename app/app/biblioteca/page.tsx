"use client";

/**
 * Biblioteca de carrosséis-referência (swipe file).
 *
 * Espelha o visual da Biblioteca Viral do Reels Viral — cream + REC coral
 * + brutalist — mas adaptado pra carrosséis (formato 4:5 + modal slide a
 * slide com transcrição).
 *
 * Dados vivem em `library_carousels` (Supabase SV, leitura pública via RLS).
 * Imagens cacheadas no bucket `library-carousels`.
 *
 * Seed inicial: 187 carrosséis coletados em vault/99 - SISTEMA/biblioteca/
 * swipe-instagram/ (Filipe Viana, Doug de Marco, Afonso Molina + 12 outros).
 */

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Search, Sparkles, Heart, MessageCircle, ExternalLink, X as Close } from "lucide-react";

type LibrarySlide = {
  idx: number;
  image_url: string;
  text: string;
};

type LibraryCarousel = {
  id: string;
  ig_url: string;
  short_code: string | null;
  author_handle: string | null;
  caption: string | null;
  posted_at: string | null;
  cover_url: string | null;
  slides_count: number;
  slides: LibrarySlide[];
  likes_count: number | null;
  comments_count: number | null;
  categories: string[] | null;
  hook_pattern: string | null;
  featured: boolean;
};

const CATEGORIES: Array<{ id: string; label: string; emoji: string }> = [
  { id: "all", label: "Todos", emoji: "✨" },
  { id: "Tutorial", label: "Tutorial", emoji: "🎓" },
  { id: "Storytelling", label: "Storytelling", emoji: "📖" },
  { id: "Lista", label: "Lista", emoji: "📝" },
  { id: "Polêmica", label: "Polêmica", emoji: "🎯" },
  { id: "Bastidor", label: "Bastidor", emoji: "🎬" },
  { id: "Confessional", label: "Confessional", emoji: "💭" },
  { id: "Mito vs Verdade", label: "Mito vs Verdade", emoji: "⚖️" },
  { id: "Demonstração", label: "Demonstração", emoji: "🛠️" },
  { id: "Humor", label: "Humor", emoji: "😂" },
];

function fmtNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return String(n);
}

export default function BibliotecaPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const [carousels, setCarousels] = useState<LibraryCarousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<LibraryCarousel | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("library_carousels")
        .select("*")
        .order("featured", { ascending: false })
        .order("likes_count", { ascending: false, nullsFirst: false })
        .order("added_at", { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) setError(error.message);
      else setCarousels((data || []) as LibraryCarousel[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return carousels.filter((c) => {
      if (filter !== "all" && !c.categories?.includes(filter)) return false;
      if (!q) return true;
      const hay = [
        c.author_handle,
        c.caption,
        c.hook_pattern,
        ...(c.slides?.slice(0, 2).map((s) => s.text) || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [carousels, search, filter]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--lib-paper, #F5F1E8)",
        color: "var(--lib-ink, #0A0908)",
        // tokens biblioteca-only — não polui resto do SV
        ["--lib-paper" as never]: "#F5F1E8",
        ["--lib-ink" as never]: "#0A0908",
        ["--lib-rec" as never]: "#FF3D2E",
        ["--lib-line" as never]: "#0A0908",
        fontFamily:
          '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 24px 80px" }}>
        <header style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            Biblioteca <i style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400 }}>de carrosséis.</i>
          </h1>
          <p style={{ fontSize: 16, opacity: 0.7, maxWidth: 720 }}>
            Carrosséis reais com transcrição slide a slide. Clica num pra ver a engenharia reversa,
            ou use como referência pra adaptar pra sua voz no <a href="/create" style={{ color: "var(--lib-rec)", textDecoration: "underline" }}>Adaptar</a>.
          </p>
        </header>

        {/* Search + filtros */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca por handle, caption, hook ou texto de slide…"
            style={{
              width: "100%",
              padding: "14px 16px 14px 48px",
              border: "1px solid var(--lib-line)",
              background: "white",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {CATEGORIES.map((c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid var(--lib-line)",
                  background: active ? "var(--lib-ink)" : "white",
                  color: active ? "var(--lib-paper)" : "var(--lib-ink)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contagem */}
        <div style={{ marginBottom: 16, fontSize: 13, opacity: 0.6 }}>
          {loading ? "Carregando…" : `${filtered.length} carrosséis${search || filter !== "all" ? " (filtrado)" : ""}`}
          {error && <span style={{ color: "var(--lib-rec)", marginLeft: 12 }}>erro: {error}</span>}
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((c) => (
            <CarouselCard
              key={c.id}
              carousel={c}
              onOpen={() => {
                setSelected(c);
                setSlideIdx(0);
              }}
            />
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              opacity: 0.5,
              fontSize: 14,
            }}
          >
            Nenhum carrossel encontrado pra esse filtro/busca.
          </div>
        )}
      </main>

      {selected && (
        <SlideModal
          carousel={selected}
          slideIdx={slideIdx}
          onChange={setSlideIdx}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function CarouselCard({
  carousel,
  onOpen,
}: {
  carousel: LibraryCarousel;
  onOpen: () => void;
}) {
  const cover = carousel.cover_url || carousel.slides?.[0]?.image_url || null;
  const cats = carousel.categories?.slice(0, 2) || [];
  return (
    <button
      onClick={onOpen}
      style={{
        all: "unset",
        display: "block",
        cursor: "pointer",
        border: "1px solid var(--lib-line)",
        background: "white",
        transition: "transform 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translate(-2px, -2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translate(0, 0)")}
    >
      <div
        style={{
          aspectRatio: "4 / 5",
          backgroundColor: "#2a1a14",
          backgroundImage: cover
            ? `url(${cover}), linear-gradient(135deg, #2a1a14, #4a2a1f, #1a1a1a)`
            : "linear-gradient(135deg, #2a1a14, #4a2a1f, #1a1a1a)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {carousel.featured && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "var(--lib-rec)",
              color: "white",
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.14em",
              padding: "3px 6px",
              zIndex: 2,
              fontFamily: '"Geist Mono", ui-monospace, monospace',
            }}
          >
            ⭐ TOP
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "rgba(10, 9, 8, 0.85)",
            color: "white",
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.14em",
            padding: "3px 6px",
            zIndex: 2,
            backdropFilter: "blur(4px)",
            fontFamily: '"Geist Mono", ui-monospace, monospace',
          }}
        >
          {carousel.slides_count} SLIDES
        </div>

        {/* Métricas overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            right: 8,
            display: "flex",
            justifyContent: "space-between",
            color: "white",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: '"Geist Mono", ui-monospace, monospace',
            textShadow: "0 1px 2px rgba(0,0,0,0.7)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Heart size={11} fill="currentColor" /> {fmtNumber(carousel.likes_count)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MessageCircle size={11} fill="currentColor" /> {fmtNumber(carousel.comments_count)}
          </span>
        </div>
      </div>

      {/* footer card */}
      <div style={{ padding: "10px 12px" }}>
        {cats.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {cats.map((cat) => {
              const c = CATEGORIES.find((cc) => cc.id === cat) || CATEGORIES.find((cc) => cc.label === cat);
              return (
                <span
                  key={cat}
                  style={{
                    fontSize: 9,
                    padding: "2px 5px",
                    background: "var(--lib-paper)",
                    border: "1px solid var(--lib-line)",
                    fontFamily: '"Geist Mono", ui-monospace, monospace',
                    letterSpacing: "0.05em",
                  }}
                >
                  {c?.emoji || ""} {cat}
                </span>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>
          @{carousel.author_handle || "?"}
        </div>
      </div>
    </button>
  );
}

function SlideModal({
  carousel,
  slideIdx,
  onChange,
  onClose,
}: {
  carousel: LibraryCarousel;
  slideIdx: number;
  onChange: (i: number) => void;
  onClose: () => void;
}) {
  const slide = carousel.slides[slideIdx];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onChange(Math.min(carousel.slides.length - 1, slideIdx + 1));
      if (e.key === "ArrowLeft") onChange(Math.max(0, slideIdx - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideIdx, carousel.slides.length, onChange, onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 9, 8, 0.85)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--lib-paper, #F5F1E8)",
          width: "100%",
          maxWidth: 920,
          maxHeight: "90vh",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          overflow: "hidden",
          border: "1px solid var(--lib-line, #0A0908)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            background: "var(--lib-ink, #0A0908)",
            color: "white",
            border: "none",
            cursor: "pointer",
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Close size={16} />
        </button>

        {/* Slide image */}
        <div
          style={{
            background: "#2a1a14",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {slide?.image_url ? (
            <img
              src={slide.image_url}
              alt={`Slide ${slide.idx}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ color: "white" }}>sem imagem</div>
          )}
          {/* Nav arrows */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              right: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button
              onClick={() => onChange(Math.max(0, slideIdx - 1))}
              disabled={slideIdx === 0}
              style={{
                padding: "6px 12px",
                background: "rgba(255,255,255,0.95)",
                color: "var(--lib-ink, #0A0908)",
                border: "none",
                cursor: slideIdx === 0 ? "default" : "pointer",
                opacity: slideIdx === 0 ? 0.4 : 1,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: '"Geist Mono", ui-monospace, monospace',
              }}
            >
              ← ANT
            </button>
            <span
              style={{
                background: "rgba(10,9,8,0.85)",
                color: "white",
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                letterSpacing: "0.1em",
              }}
            >
              {slideIdx + 1} / {carousel.slides.length}
            </span>
            <button
              onClick={() => onChange(Math.min(carousel.slides.length - 1, slideIdx + 1))}
              disabled={slideIdx === carousel.slides.length - 1}
              style={{
                padding: "6px 12px",
                background: "rgba(255,255,255,0.95)",
                color: "var(--lib-ink, #0A0908)",
                border: "none",
                cursor: slideIdx === carousel.slides.length - 1 ? "default" : "pointer",
                opacity: slideIdx === carousel.slides.length - 1 ? 0.4 : 1,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: '"Geist Mono", ui-monospace, monospace',
              }}
            >
              PRÓX →
            </button>
          </div>
        </div>

        {/* Slide text + meta */}
        <div
          style={{
            padding: "32px 28px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                letterSpacing: "0.14em",
                opacity: 0.6,
                marginBottom: 4,
              }}
            >
              @{carousel.author_handle}
            </div>
            <a
              href={carousel.ig_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "var(--lib-rec, #FF3D2E)",
                textDecoration: "none",
              }}
            >
              ver no Instagram <ExternalLink size={11} />
            </a>
          </div>

          <div
            style={{
              fontSize: 11,
              fontFamily: '"Geist Mono", ui-monospace, monospace',
              letterSpacing: "0.14em",
              opacity: 0.5,
            }}
          >
            SLIDE {slide?.idx ?? slideIdx + 1}
          </div>

          <div
            style={{
              fontSize: 16,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              fontFamily: '"Instrument Serif", Georgia, serif',
            }}
          >
            {slide?.text || "[sem texto]"}
          </div>

          {/* Categorias do carrossel */}
          {carousel.categories && carousel.categories.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {carousel.categories.map((cat) => {
                const c =
                  CATEGORIES.find((cc) => cc.id === cat) ||
                  CATEGORIES.find((cc) => cc.label === cat);
                return (
                  <span
                    key={cat}
                    style={{
                      fontSize: 10,
                      padding: "3px 6px",
                      background: "white",
                      border: "1px solid var(--lib-line, #0A0908)",
                      fontFamily: '"Geist Mono", ui-monospace, monospace',
                    }}
                  >
                    {c?.emoji || ""} {cat}
                  </span>
                );
              })}
            </div>
          )}

          {/* CTA Adaptar */}
          <a
            href={`/create?ref=${encodeURIComponent(carousel.ig_url)}`}
            style={{
              marginTop: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "12px 18px",
              background: "var(--lib-rec, #FF3D2E)",
              color: "white",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: '"Geist Mono", ui-monospace, monospace',
              letterSpacing: "0.06em",
              textDecoration: "none",
            }}
          >
            <Sparkles size={14} /> ADAPTAR PRA MINHA VOZ
          </a>
        </div>
      </div>
    </div>
  );
}
