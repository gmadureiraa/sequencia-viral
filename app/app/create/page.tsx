"use client";

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import CarouselPreview from "@/components/app/carousel-preview";
import CarouselSlide from "@/components/app/carousel-slide";
import Loader from "@/components/kokonutui/loader";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { useAuth, type UserProfile } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  bumpCarouselUsage,
  fetchUserCarousel,
  isCarouselUuid,
  readGuestCarousels,
  type SavedCarousel,
  upsertGuestCarousel,
  upsertUserCarousel,
} from "@/lib/carousel-storage";

// ─── Types ──────────────────────────────────────────────────────────
type SourceType = "ai" | "link" | "video" | "instagram" | "idea";
type Step = "input" | "generating" | "pick" | "edit";
type TemplatePick = "twitter" | "principal" | "futurista" | "autoral";

// V2 flow types (Content Machine)
interface V2TriagemData {
  transformacao: string;
  friccao: string;
  angulo: string;
  evidencias: string;
}
interface V2Headline {
  line1: string;
  line2: string;
}
interface V2HeadlinesData {
  angulo_dominante: string;
  headlines: V2Headline[];
}
interface V2BackboneData {
  headline_escolhida: string;
  hook: string;
  mecanismo: string;
  prova: string;
  aplicacao: string;
  direcao: string;
}

// V2 sub-steps shown inside the pick/edit phases
type V2SubStep = "none" | "triagem" | "headlines" | "backbone" | "rendering";

interface Slide {
  heading: string;
  body: string;
  imageQuery: string;
  imageUrl?: string;
}

interface Variation {
  title: string;
  style: "data" | "story" | "provocative";
  qualityScore?: number;
  qualityReasoning?: string;
  slides: Slide[];
}

// ─── Constants ──────────────────────────────────────────────────────
const SOURCE_OPTIONS: {
  type: SourceType;
  icon: string;
  label: string;
  desc: string;
  emoji: string;
}[] = [
  {
    type: "ai",
    icon: "sparkles",
    label: "Sugestoes de IA",
    desc: "A IA sugere temas em alta para voce comecar",
    emoji: "✨",
  },
  {
    type: "link",
    icon: "link",
    label: "Link (artigo, blog, PDF)",
    desc: "Cole qualquer URL de conteudo textual",
    emoji: "🔗",
  },
  {
    type: "video",
    icon: "play",
    label: "Video do YouTube",
    desc: "Cole a URL — a gente puxa a transcricao",
    emoji: "🎬",
  },
  {
    type: "instagram",
    icon: "play",
    label: "Post ou Reel do Instagram",
    desc: "Cole o link de um post, carrossel ou reels",
    emoji: "📸",
  },
  {
    type: "idea",
    icon: "lightbulb",
    label: "Minha ideia",
    desc: "Escreva seu topico ou ideia em texto livre",
    emoji: "💡",
  },
];

const STYLE_BADGES: Record<string, { label: string; color: string; emoji: string }> = {
  data: { label: "Baseado em dados", color: "#2563eb", emoji: "📊" },
  story: { label: "Narrativa", color: "#16a34a", emoji: "📖" },
  provocative: { label: "Provocativo", color: "#dc2626", emoji: "🔥" },
};

const TEMPLATE_OPTIONS: {
  id: TemplatePick;
  emoji: string;
  name: string;
  desc: string;
  color: string;
}[] = [
  { id: "twitter", emoji: "\uD83D\uDC26", name: "Twitter", desc: "Estilo tweet screenshot \u2022 6-8 slides", color: "#0ea5e9" },
  { id: "principal", emoji: "\uD83D\uDCF0", name: "Principal", desc: "Imagem hero + texto bold \u2022 18 blocos", color: "#EC6000" },
  { id: "futurista", emoji: "\uD83D\uDD2E", name: "Futurista", desc: "Editorial limpo \u2022 14 textos", color: "#2563eb" },
  { id: "autoral", emoji: "\u270D\uFE0F", name: "Autoral", desc: "Narrativa continua \u2022 18 blocos", color: "#16a34a" },
];

const V2_TEMPLATE_COLORS: Record<Exclude<TemplatePick, "twitter">, { bg: string; accent: string }> = {
  principal: { bg: "#0A0A0A", accent: "#EC6000" },
  futurista: { bg: "#F8FAFC", accent: "#2563eb" },
  autoral: { bg: "#0A0A0A", accent: "#16a34a" },
};

const DEFAULT_PROFILE = {
  name: "Seu nome",
  handle: "@seuhandle",
  photoUrl: "",
};

function buildPreviewProfile(profile: UserProfile | null): typeof DEFAULT_PROFILE {
  if (!profile) return DEFAULT_PROFILE;
  const handle = profile.twitter_handle
    ? `@${profile.twitter_handle}`
    : profile.instagram_handle
      ? `@${profile.instagram_handle}`
      : "@seuhandle";
  return {
    name: profile.name || DEFAULT_PROFILE.name,
    handle,
    photoUrl: profile.avatar_url || "",
  };
}

function nicheSlugFromProfile(niches: string[] | undefined): string {
  if (!niches?.length) return "marketing";
  const blob = niches.join(" ").toLowerCase();
  if (blob.includes("cripto") || blob.includes("web3")) return "crypto";
  if (blob.includes("ia") || blob.includes("automa")) return "ai";
  if (blob.includes("finan")) return "finance";
  if (blob.includes("tech") || blob.includes("saas") || blob.includes("dev")) return "tech";
  if (blob.includes("edu") || blob.includes("educa")) return "education";
  if (blob.includes("saúde") || blob.includes("saude") || blob.includes("well")) return "health";
  if (blob.includes("market") || blob.includes("mkt")) return "marketing";
  return "business";
}

function hydrateFromSavedCarousel(
  c: SavedCarousel,
  setters: {
    setCarouselRecordId: (id: string | null) => void;
    setEditSlides: (slides: Slide[]) => void;
    setSlideStyle: (s: "white" | "dark") => void;
    setVariations: (v: Variation[]) => void;
    setSelectedVariation: (n: number) => void;
    setStep: (s: Step) => void;
  }
) {
  setters.setCarouselRecordId(c.id);
  setters.setEditSlides(c.slides);
  setters.setSlideStyle(c.style === "dark" ? "dark" : "white");
  if (c.variation) {
    setters.setVariations([
      {
        title: c.variation.title,
        style: c.variation.style as Variation["style"],
        slides: c.slides,
      },
    ]);
    setters.setSelectedVariation(0);
  } else {
    setters.setVariations([]);
    setters.setSelectedVariation(0);
  }
  setters.setStep("edit");
}

// ─── Icon Components ────────────────────────────────────────────────
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "sparkles":
      return (
        <svg {...props}>
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
          <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
        </svg>
      );
    case "link":
      return (
        <svg {...props}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "play":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg {...props}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg {...props}>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      );
    case "arrow-up":
      return (
        <svg {...props}>
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      );
    case "arrow-down":
      return (
        <svg {...props}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "trash":
      return (
        <svg {...props}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "grip":
      return (
        <svg {...props}>
          <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "image":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "upload":
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case "loader":
      return (
        <svg {...props} className="animate-spin">
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...props}>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...props}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case "chevron-up":
      return (
        <svg {...props}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      );
    case "eye":
      return (
        <svg {...props}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    default:
      return null;
  }
}

// ─── Main Component ─────────────────────────────────────────────────
export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[50vh] max-w-4xl flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-mono uppercase tracking-widest text-[var(--muted)]">
            Carregando editor...
          </p>
        </div>
      }
    >
      <CreatePageContent />
    </Suspense>
  );
}

function CreatePageContent() {
  const searchParams = useSearchParams();
  const { profile, user, isGuest, session, refreshProfile } = useAuth();
  const previewProfile = useMemo(() => buildPreviewProfile(profile), [profile]);

  const [step, setStep] = useState<Step>("input");
  const [sourceType, setSourceType] = useState<SourceType>("idea");
  const [topic, setTopic] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [niche, setNiche] = useState("marketing");
  const [tone, setTone] = useState("casual");
  const [language, setLanguage] = useState("pt-br");
  const [templatePick, setTemplatePick] = useState<TemplatePick>("twitter");

  // V2 Content Machine state (used when template !== "twitter")
  const [v2SubStep, setV2SubStep] = useState<V2SubStep>("none");
  const [v2Triagem, setV2Triagem] = useState<V2TriagemData | null>(null);
  const [v2Headlines, setV2Headlines] = useState<V2HeadlinesData | null>(null);
  const [v2SelectedHeadline, setV2SelectedHeadline] = useState<number | null>(null);
  const [v2Backbone, setV2Backbone] = useState<V2BackboneData | null>(null);
  const [v2Blocks, setV2Blocks] = useState<string[]>([]);
  const [v2EditedBlocks, setV2EditedBlocks] = useState<string[]>([]);
  const [v2Context, setV2Context] = useState("");
  const [v2Loading, setV2Loading] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [concepts, setConcepts] = useState<Array<{ title: string; hook: string; style: string; angle: string }>>([]);
  const [selectedVariation, setSelectedVariation] = useState<number>(0);
  const [editSlides, setEditSlides] = useState<Slide[]>([]);
  const [slideStyle, setSlideStyle] = useState<"white" | "dark">("white");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [carouselRecordId, setCarouselRecordId] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [imagePickerIndex, setImagePickerIndex] = useState<number | null>(null);
  const [imagePickerOptions, setImagePickerOptions] = useState<string[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [imageMode, setImageMode] = useState<"search" | "generate">("search");
  const [imageGeneratingSlides, setImageGeneratingSlides] = useState<Set<number>>(new Set());
  const [exportProgress, setExportProgress] = useState("");
  const [exportRenderSlides, setExportRenderSlides] = useState<Slide[] | null>(null);

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const exportContainerRef = useRef<HTMLDivElement | null>(null);
  const exportSlideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const editorCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const profileSyncedRef = useRef(false);

  useEffect(() => {
    if (!profile || profileSyncedRef.current) return;
    profileSyncedRef.current = true;
    setTone(profile.tone || "casual");
    setLanguage((profile.language || "pt-br").toLowerCase());
    setNiche(nicheSlugFromProfile(profile.niche));
    const cs = profile.carousel_style;
    if (cs === "dark" || cs === "white") setSlideStyle(cs);
  }, [profile]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 3800);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const rawId = searchParams.get("draft");
    if (!rawId) return;

    let cancelled = false;
    setDraftLoading(true);
    setError("");

    void (async () => {
      try {
        if (user && !isGuest && isCarouselUuid(rawId)) {
          if (!supabase) {
            if (!cancelled) {
              setError("Configure o Supabase para carregar rascunhos na nuvem.");
            }
            return;
          }
          const c = await fetchUserCarousel(supabase, rawId);
          if (cancelled) return;
          if (!c) {
            setError("Rascunho nao encontrado.");
            return;
          }
          hydrateFromSavedCarousel(c, {
            setCarouselRecordId,
            setEditSlides,
            setSlideStyle,
            setVariations,
            setSelectedVariation,
            setStep,
          });
          return;
        }

        const list = readGuestCarousels();
        const c = list.find((x) => x.id === rawId);
        if (cancelled) return;
        if (!c) {
          setError("Rascunho nao encontrado.");
          return;
        }
        hydrateFromSavedCarousel(c, {
          setCarouselRecordId,
          setEditSlides,
          setSlideStyle,
          setVariations,
          setSelectedVariation,
          setStep,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro ao carregar rascunho.");
        }
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, user, isGuest]);

  // ─── Keyboard navigation ─────────────────────────────────────────
  useEffect(() => {
    if (step !== "edit") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only when not focused on an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSlideIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSlideIndex((prev) => Math.min(editSlides.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, editSlides.length]);

  // Scroll editor card into view when active slide changes
  useEffect(() => {
    if (step !== "edit") return;
    const el = editorCardRefs.current[activeSlideIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSlideIndex, step]);

  // Auto-generate images for slides that don't have one yet when entering edit
  const autoImageFiredRef = useRef(false);
  useEffect(() => {
    if (step !== "edit" || autoImageFiredRef.current || !session?.access_token) return;
    if (editSlides.length === 0) return;
    const slidesWithoutImages = editSlides
      .map((s, i) => ({ slide: s, index: i }))
      .filter((x) => !x.slide.imageUrl && x.slide.imageQuery?.trim());
    if (slidesWithoutImages.length === 0) return;
    autoImageFiredRef.current = true;

    // Fetch images in parallel for slides missing them
    for (const { slide, index } of slidesWithoutImages) {
      setImageGeneratingSlides((prev) => new Set(prev).add(index));
      fetch("/api/images", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({ query: slide.imageQuery, mode: "search" }),
      })
        .then((r) => r.json())
        .then((data) => {
          const url: string | undefined = data?.images?.[0]?.url;
          if (url) {
            setEditSlides((prev) => {
              const updated = [...prev];
              if (updated[index] && !updated[index].imageUrl) {
                updated[index] = { ...updated[index], imageUrl: url };
              }
              return updated;
            });
          }
        })
        .catch(() => { /* swallow */ })
        .finally(() => {
          setImageGeneratingSlides((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        });
    }
  }, [step, editSlides.length, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ───────────────────────────────────────────────────
  // ─── V2 Content Machine helpers ─────────────────────────────────
  const callV2API = useCallback(
    async (
      apiStep: string,
      extra: Record<string, unknown> = {}
    ): Promise<Record<string, unknown> | null> => {
      setV2Loading(true);
      try {
        const res = await fetch("/api/generate-v2", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            step: apiStep,
            topic,
            template: templatePick,
            niche: niche || "geral",
            tone: tone || "informal",
            language,
            context: v2Context,
            ...extra,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
          toast.error(err.error || `Erro ${res.status}`);
          return null;
        }
        const json = await res.json();
        return json.data as Record<string, unknown>;
      } catch (err) {
        toast.error("Erro de conexao. Tente novamente.");
        console.error(err);
        return null;
      } finally {
        setV2Loading(false);
      }
    },
    [session, topic, templatePick, niche, tone, language, v2Context]
  );

  const handleV2StartTriagem = useCallback(async () => {
    const data = await callV2API("triagem");
    if (data) {
      const t = data as unknown as V2TriagemData;
      setV2Triagem(t);
      setV2Context(JSON.stringify(t));
      setV2SubStep("triagem");
    }
  }, [callV2API]);

  const handleV2GenerateHeadlines = useCallback(async () => {
    const data = await callV2API("headlines");
    if (data) {
      const h = data as unknown as V2HeadlinesData;
      setV2Headlines(h);
      setV2SelectedHeadline(null);
      setV2SubStep("headlines");
    }
  }, [callV2API]);

  const handleV2RefreshHeadlines = useCallback(async () => {
    const data = await callV2API("headlines");
    if (data) {
      const h = data as unknown as V2HeadlinesData;
      setV2Headlines(h);
      setV2SelectedHeadline(null);
    }
  }, [callV2API]);

  const handleV2GenerateBackbone = useCallback(async () => {
    if (v2SelectedHeadline === null || !v2Headlines) {
      toast.error("Escolha uma headline primeiro.");
      return;
    }
    const ctx =
      v2Context +
      "\n\nHEADLINE ESCOLHIDA (#" +
      (v2SelectedHeadline + 1) +
      "): " +
      v2Headlines.headlines[v2SelectedHeadline].line1 +
      " | " +
      v2Headlines.headlines[v2SelectedHeadline].line2;
    setV2Context(ctx);
    const data = await callV2API("backbone", {
      choice: v2SelectedHeadline + 1,
      context: ctx,
    });
    if (data) {
      const b = data as unknown as V2BackboneData;
      setV2Backbone(b);
      setV2Context(ctx + "\n\nESPINHA DORSAL: " + JSON.stringify(b));
      setV2SubStep("backbone");
    }
  }, [callV2API, v2Context, v2SelectedHeadline, v2Headlines]);

  const handleV2GenerateCarousel = useCallback(async () => {
    setV2SubStep("rendering");
    const data = await callV2API("render", { context: v2Context });
    if (data) {
      const r = data as unknown as { blocks: string[] };
      setV2Blocks(r.blocks);
      setV2EditedBlocks([...r.blocks]);
      setStep("edit");
    } else {
      setV2SubStep("backbone");
    }
  }, [callV2API, v2Context]);

  // Reset v2 state when going back to input
  const resetV2State = useCallback(() => {
    setV2SubStep("none");
    setV2Triagem(null);
    setV2Headlines(null);
    setV2SelectedHeadline(null);
    setV2Backbone(null);
    setV2Blocks([]);
    setV2EditedBlocks([]);
    setV2Context("");
  }, []);

  // STEP 1: Generate 5 concepts (cheap, fast ~1-2s)
  const handleGenerate = useCallback(async () => {
    setError("");
    if (isGuest || !session?.access_token) {
      setError("Para gerar carrosséis com IA, entre na sua conta.");
      return;
    }

    // V2 templates go through Content Machine flow (triagem -> headlines -> backbone -> render)
    if (templatePick !== "twitter") {
      resetV2State();
      setStep("generating");
      // Use topic directly (for V2, we pass the raw topic to the triagem step)
      const data = await callV2API("triagem");
      if (data) {
        const t = data as unknown as V2TriagemData;
        setV2Triagem(t);
        setV2Context(JSON.stringify(t));
        setV2SubStep("triagem");
        setStep("pick"); // We reuse "pick" step to show v2 sub-steps
      } else {
        setStep("input");
      }
      return;
    }

    setCarouselRecordId(null);
    setConcepts([]);
    setStep("generating");

    try {
      // For link/video/instagram sources, extract content first so concepts are based on actual source
      let conceptTopic = sourceType === "ai" ? "trending topics in " + niche : topic;
      if ((sourceType === "link" || sourceType === "video" || sourceType === "instagram") && sourceUrl.trim()) {
        try {
          const extractRes = await fetch("/api/extract-source", {
            method: "POST",
            headers: jsonWithAuth(session),
            body: JSON.stringify({ sourceType, sourceUrl }),
          });
          if (extractRes.ok) {
            const extractData = await extractRes.json();
            if (extractData.content) {
              // Combine extracted content with user's topic/focus
              conceptTopic = topic.trim()
                ? `${topic}\n\nConteúdo extraído da fonte:\n${extractData.content.slice(0, 2000)}`
                : extractData.content.slice(0, 2000);
            }
          } else {
            const errData = await extractRes.json().catch(() => ({ error: "Falha na extração" }));
            console.warn("[extract-source] Falhou:", errData.error);
            // Always block on extraction failure for URL sources — don't generate generic concepts
            setError(errData.error || "Não foi possível extrair o conteúdo da URL. Cole o texto no campo 'Minha ideia'.");
            setStep("input");
            return;
          }
        } catch (extractErr) {
          console.warn("[extract-source] Erro:", extractErr);
          setError("Não foi possível acessar a URL. Cole o conteúdo manualmente no campo 'Minha ideia'.");
          setStep("input");
          return;
        }
      }

      const res = await fetch("/api/generate-concepts", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          topic: conceptTopic,
          niche,
          tone,
          language,
        }),
      });

      let data: { concepts?: Array<{ title: string; hook: string; style: string; angle: string }>; error?: string };
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error(await res.text().then(t => t.slice(0, 200)));
      }

      if (!res.ok) throw new Error(data.error || "Falha ao gerar conceitos.");
      if (!data.concepts?.length) throw new Error("Nenhum conceito gerado. Tente outro tópico.");

      setConcepts(data.concepts);
      setStep("pick");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente de novo.");
      setStep("input");
    }
  }, [sourceType, sourceUrl, topic, niche, tone, language, isGuest, session, templatePick, callV2API, resetV2State]);

  // STEP 2: Generate full carousel from chosen concept (~5-8s)
  const handlePickConcept = useCallback(async (conceptIndex: number) => {
    const concept = concepts[conceptIndex];
    if (!concept || !session?.access_token) return;

    setStep("generating");

    try {
      // Pass original sourceType and sourceUrl so the generate API can extract content
      const effectiveSourceType = (sourceType === "link" || sourceType === "video" || sourceType === "instagram") && sourceUrl.trim()
        ? sourceType
        : "idea";

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          topic: `${concept.title}\n\nHook: ${concept.hook}\nAngle: ${concept.angle}\nStyle: ${concept.style}`,
          sourceType: effectiveSourceType,
          sourceUrl: effectiveSourceType !== "idea" ? sourceUrl : undefined,
          niche,
          tone,
          language,
        }),
      });

      let data: { variations?: Variation[]; error?: string };
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error(await res.text().then(t => t.slice(0, 200)));
      }

      if (!res.ok) throw new Error(data.error || "Falha na geração.");
      if (!data.variations?.length) throw new Error("Nenhum carrossel gerado.");

      setVariations(data.variations);
      // Go straight to edit with the first (and only) variation
      const slides = [...data.variations[0].slides];
      setSelectedVariation(0);
      setEditSlides(slides);
      setActiveSlideIndex(0);
      setStep("edit");

      // Auto-save
      const title = data.variations[0]?.title || slides[0]?.heading || "Sem título";
      const variationMeta = { title, style: data.variations[0].style };
      try {
        if (user && !isGuest && supabase) {
          try {
            const { row, inserted } = await upsertUserCarousel(supabase, user.id, {
              id: carouselRecordId,
              title,
              slides,
              slideStyle,
              variation: variationMeta,
              status: "draft",
            });
            setCarouselRecordId(row.id);
            if (inserted) {
              await bumpCarouselUsage(supabase, user.id);
              await refreshProfile();
            }
            lastSerializedSlidesRef.current = JSON.stringify({ editSlides: slides, slideStyle });
            console.log("[auto-save] Salvo no Supabase, id:", row.id);
            toast.success("Carrossel salvo automaticamente.");
          } catch (supaErr) {
            // Supabase failed — fall back to localStorage
            console.error("[auto-save] Supabase erro:", supaErr);
            const id = carouselRecordId ?? `carousel-${Date.now()}`;
            setCarouselRecordId(id);
            upsertGuestCarousel({ id, title, slides, style: slideStyle, variation: variationMeta, savedAt: new Date().toISOString(), status: "draft" });
            lastSerializedSlidesRef.current = JSON.stringify({ editSlides: slides, slideStyle });
            toast.warning("Salvo localmente — nuvem indisponível.");
          }
        } else {
          const id = carouselRecordId ?? `carousel-${Date.now()}`;
          setCarouselRecordId(id);
          upsertGuestCarousel({ id, title, slides, style: slideStyle, variation: variationMeta, savedAt: new Date().toISOString(), status: "draft" });
          lastSerializedSlidesRef.current = JSON.stringify({ editSlides: slides, slideStyle });
          console.log("[auto-save] Salvo localmente, id:", id);
        }
      } catch (e) {
        console.error("[auto-save] Erro inesperado:", e);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar carrossel.");
      setStep("pick"); // Go back to concept picker
    }
  }, [concepts, session, niche, tone, language, user, isGuest, supabase, carouselRecordId, slideStyle, refreshProfile, sourceType, sourceUrl]);

  const handleSelectVariation = async (index: number) => {
    setSelectedVariation(index);
    const slides = [...variations[index].slides];
    setEditSlides(slides);
    setActiveSlideIndex(0);
    setStep("edit");

    // Auto-save immediately when variation is picked
    const title = variations[index]?.title || slides[0]?.heading || "Sem titulo";
    const variationMeta = { title: variations[index].title, style: variations[index].style };
    try {
      if (user && !isGuest && supabase) {
        try {
          const { row, inserted } = await upsertUserCarousel(supabase, user.id, {
            id: carouselRecordId,
            title,
            slides,
            slideStyle: slideStyle,
            variation: variationMeta,
            status: "draft",
          });
          setCarouselRecordId(row.id);
          if (inserted) {
            await bumpCarouselUsage(supabase, user.id);
            await refreshProfile();
          }
          lastSerializedSlidesRef.current = JSON.stringify({ editSlides: slides, slideStyle });
          console.log("[auto-save] Variacao salva no Supabase, id:", row.id);
          toast.success("Carrossel salvo automaticamente.");
        } catch (supaErr) {
          console.error("[auto-save] Supabase erro:", supaErr);
          const id = carouselRecordId ?? `carousel-${Date.now()}`;
          setCarouselRecordId(id);
          upsertGuestCarousel({ id, title, slides, style: slideStyle, variation: variationMeta, savedAt: new Date().toISOString(), status: "draft" });
          lastSerializedSlidesRef.current = JSON.stringify({ editSlides: slides, slideStyle });
          toast.warning("Salvo localmente — nuvem indisponível.");
        }
      } else {
        const id = carouselRecordId ?? `carousel-${Date.now()}`;
        setCarouselRecordId(id);
        upsertGuestCarousel({
          id,
          title,
          slides,
          style: slideStyle,
          variation: variationMeta,
          savedAt: new Date().toISOString(),
          status: "draft",
        });
        lastSerializedSlidesRef.current = JSON.stringify({ editSlides: slides, slideStyle });
        console.log("[auto-save] Variacao salva localmente, id:", id);
      }
    } catch (e) {
      console.error("[auto-save] Erro inesperado:", e);
    }
  };

  const handleUpdateSlide = (
    index: number,
    field: keyof Slide,
    value: string
  ) => {
    setEditSlides((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddSlide = (afterIndex: number) => {
    setEditSlides((prev) => {
      const updated = [...prev];
      updated.splice(afterIndex + 1, 0, {
        heading: "Novo slide",
        body: "Adicione o texto deste slide.",
        imageQuery: "placeholder",
      });
      return updated;
    });
    setActiveSlideIndex(afterIndex + 1);
  };

  const handleRemoveSlide = (index: number) => {
    if (editSlides.length <= 2) return;
    if (deleteConfirm !== index) {
      setDeleteConfirm(index);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }
    setEditSlides((prev) => prev.filter((_, i) => i !== index));
    setDeleteConfirm(null);
    if (activeSlideIndex >= editSlides.length - 1) {
      setActiveSlideIndex(Math.max(0, editSlides.length - 2));
    }
  };

  const handleMoveSlide = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editSlides.length) return;
    setEditSlides((prev) => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
    setActiveSlideIndex(newIndex);
  };

  // ── Drag and drop ─────────────────────────────────────────────────
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      setEditSlides((prev) => {
        const updated = [...prev];
        const [removed] = updated.splice(draggedIndex, 1);
        updated.splice(dragOverIndex, 0, removed);
        return updated;
      });
      setActiveSlideIndex(dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // ── Image actions on editor slides ─────────────────────────────────
  const [imageLoadingIndex, setImageLoadingIndex] = useState<number | null>(null);

  const handleRemoveImage = (index: number) => {
    setEditSlides((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], imageUrl: undefined };
      return updated;
    });
  };

  const handleRefetchImage = async (index: number, overrideMode?: "search" | "generate") => {
    const slide = editSlides[index];
    const query = slide?.imageQuery?.trim();
    if (!query) {
      setError("Defina um termo de busca antes de trocar a imagem.");
      return;
    }
    const currentMode = overrideMode || imageMode;
    setImageLoadingIndex(index);
    setError("");
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({ query, count: 8, mode: currentMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na busca de imagem");
      const images: Array<{ url: string; generated?: boolean }> = data.images || [];
      if (images.length === 0) {
        throw new Error("Nenhuma imagem encontrada. Tente outro termo.");
      }
      // For generate mode with single result, apply directly
      if (currentMode === "generate" && images.length === 1) {
        setEditSlides((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], imageUrl: images[0].url };
          return updated;
        });
      } else {
        const urls = images.map((img) => img.url).filter(Boolean);
        setImagePickerOptions(urls);
        setImagePickerIndex(index);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao trocar imagem");
    } finally {
      setImageLoadingIndex(null);
    }
  };

  const handlePickImage = (url: string) => {
    if (imagePickerIndex === null) return;
    setEditSlides((prev) => {
      const updated = [...prev];
      updated[imagePickerIndex] = { ...updated[imagePickerIndex], imageUrl: url };
      return updated;
    });
    setImagePickerIndex(null);
    setImagePickerOptions([]);
  };

  const handleUploadImage = async (index: number, file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Arquivo precisa ser uma imagem.");
      return;
    }
    setImageLoadingIndex(index);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("carouselId", carouselRecordId || "draft");
      form.set("slideIndex", String(index));
      const headers: HeadersInit = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload falhou");
      setEditSlides((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], imageUrl: data.url };
        return updated;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setImageLoadingIndex(null);
    }
  };

  // ── Autosave debounced ─────────────────────────────────────────────
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const lastSerializedSlidesRef = useRef<string>("");

  useEffect(() => {
    if (step !== "edit" || editSlides.length === 0) return;
    const serialized = JSON.stringify({ editSlides, slideStyle });
    if (serialized === lastSerializedSlidesRef.current) return;

    const handle = window.setTimeout(async () => {
      setAutosaveState("saving");
      try {
        await handleSaveDraft();
        lastSerializedSlidesRef.current = serialized;
        setAutosaveState("saved");
        window.setTimeout(() => setAutosaveState("idle"), 1500);
      } catch {
        setAutosaveState("idle");
      }
    }, 1200);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSlides, slideStyle, step]);

  /**
   * Captura um slide do container de export (scale=1) como PNG 1080x1350.
   */
  const captureExportSlideAsPng = async (index: number): Promise<string> => {
    const el = exportSlideRefs.current[index];
    if (!el) throw new Error(`Export slide ref ${index} not found`);
    return toPng(el, {
      width: 1080,
      height: 1350,
      pixelRatio: 1,
      cacheBust: true,
      skipFonts: true,
      fetchRequestInit: { mode: "cors" } as RequestInit,
    });
  };

  /**
   * Monta o container de export oculto, aguarda render, executa callback, e limpa.
   */
  const withExportRender = async <T,>(
    slides: Slide[],
    fn: () => Promise<T>
  ): Promise<T> => {
    exportSlideRefs.current = [];
    setExportRenderSlides(slides);
    // Wait for React to render the hidden export container
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Extra delay for images to load
    await new Promise((r) => setTimeout(r, 500));
    try {
      return await fn();
    } finally {
      setExportRenderSlides(null);
      exportSlideRefs.current = [];
    }
  };

  /** PDF em memoria — usa export refs (scale=1) */
  const buildCarouselPdfBlob = async (): Promise<{ blob: Blob; count: number } | null> => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [1080, 1350],
      compress: true,
    });
    let added = 0;
    for (let i = 0; i < editSlides.length; i++) {
      try {
        setExportProgress(`Gerando PDF: slide ${i + 1} de ${editSlides.length}...`);
        const dataUrl = await captureExportSlideAsPng(i);
        if (added > 0) pdf.addPage([1080, 1350], "portrait");
        pdf.addImage(dataUrl, "PNG", 0, 0, 1080, 1350, undefined, "FAST");
        added++;
      } catch (slideErr) {
        console.warn(`[PDF] Falha ao capturar slide ${i + 1}:`, slideErr);
      }
    }
    if (added === 0) return null;
    const arrayBuf = pdf.output("arraybuffer");
    return { blob: new Blob([arrayBuf], { type: "application/pdf" }), count: added };
  };

  const handleExportPng = async () => {
    setIsExporting(true);
    setError("");
    setExportProgress("Preparando export...");
    try {
      await withExportRender(editSlides, async () => {
        let exported = 0;
        for (let i = 0; i < editSlides.length; i++) {
          setExportProgress(`Exportando slide ${i + 1} de ${editSlides.length}...`);
          try {
            const dataUrl = await captureExportSlideAsPng(i);
            const link = document.createElement("a");
            link.download = `slide-${i + 1}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            exported++;
            // Small delay between downloads so the browser doesn't block them
            await new Promise((r) => setTimeout(r, 400));
          } catch (slideErr) {
            console.warn(`[PNG] Falha ao capturar slide ${i + 1}:`, slideErr);
          }
        }
        if (exported === 0) {
          setError("Nenhum slide capturado. Tente de novo.");
        } else {
          toast.success(
            exported === 1
              ? "1 slide exportado com sucesso."
              : `${exported} slides exportados com sucesso.`
          );
        }
      });
    } catch (err) {
      console.error("Export PNG error:", err);
      setError(
        `Nao foi possivel exportar. ${err instanceof Error ? err.message : ""}`.trim()
      );
    }
    setExportProgress("");
    setIsExporting(false);
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    setError("");
    setExportProgress("Preparando PDF...");
    try {
      await withExportRender(editSlides, async () => {
        const built = await buildCarouselPdfBlob();
        if (!built) {
          setError("Nenhum slide pra exportar.");
        } else {
          const title = (variations[selectedVariation]?.title || "sequencia-viral-carrossel")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 50);
          const url = URL.createObjectURL(built.blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${title}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success(`PDF com ${built.count} slides baixado.`);
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
      console.error("Export PDF error:", msg, err);
      setError(`Nao foi possivel gerar PDF. ${msg}`.trim());
    }
    setExportProgress("");
    setIsExporting(false);
  };

  const handleSaveDraft = async (): Promise<string | null> => {
    const title =
      variations[selectedVariation]?.title ||
      editSlides[0]?.heading ||
      "Sem titulo";
    const variationMeta = variations[selectedVariation]
      ? {
          title: variations[selectedVariation].title,
          style: variations[selectedVariation].style,
        }
      : null;

    setError("");
    try {
      if (user && !isGuest && supabase) {
        try {
          const { row, inserted } = await upsertUserCarousel(supabase, user.id, {
            id: carouselRecordId,
            title,
            slides: editSlides,
            slideStyle: slideStyle,
            variation: variationMeta,
            status: "draft",
          });
          setCarouselRecordId(row.id);
          if (inserted) {
            await bumpCarouselUsage(supabase, user.id);
            await refreshProfile();
          }
          console.log("[save] Rascunho salvo na nuvem, id:", row.id);
          return row.id;
        } catch (supaErr) {
          // Supabase failed — fall back to localStorage
          console.error("[save] Supabase erro:", supaErr);
          const id = carouselRecordId ?? `carousel-${Date.now()}`;
          setCarouselRecordId(id);
          upsertGuestCarousel({
            id,
            title,
            slides: editSlides,
            style: slideStyle,
            variation: variationMeta ?? undefined,
            savedAt: new Date().toISOString(),
            status: "draft",
          });
          toast.warning("Salvo localmente — nuvem indisponível.");
          return id;
        }
      }
      if (!supabase) {
        console.warn("[save] Supabase nao configurado — salvando localmente.");
      }
      const id = carouselRecordId ?? `carousel-${Date.now()}`;
      setCarouselRecordId(id);
      upsertGuestCarousel({
        id,
        title,
        slides: editSlides,
        style: slideStyle,
        variation: variationMeta ?? undefined,
        savedAt: new Date().toISOString(),
        status: "draft",
      });
      return id;
    } catch (e) {
      console.error("[save] Erro ao salvar rascunho:", e);
      setError(
        e instanceof Error ? e.message : "Nao foi possivel salvar o rascunho."
      );
      return null;
    }
  };

  /** Envia PNG (+ PDF) ao Storage e persiste `export_assets` no Supabase. */
  const handleSaveExportsToCloud = async () => {
    if (!session?.access_token) {
      setError("Entre na sua conta para salvar exports na nuvem.");
      return;
    }
    setIsExporting(true);
    setError("");
    toast.success(null);
    try {
      const cloudId = await handleSaveDraft();
      if (!cloudId || !isCarouselUuid(cloudId)) {
        setError(
          "E necessario estar logado com o carrossel salvo na conta para enviar PNG/PDF a nuvem."
        );
        setIsExporting(false);
        return;
      }

      await withExportRender(editSlides, async () => {
        const form = new FormData();
        form.set("carouselId", cloudId);
        let pngCount = 0;
        for (let i = 0; i < editSlides.length; i++) {
          try {
            const dataUrl = await captureExportSlideAsPng(i);
            const blob = await (await fetch(dataUrl)).blob();
            form.append("png", blob, `slide-${i + 1}.png`);
            pngCount++;
          } catch (slideErr) {
            console.warn(`[cloud-export] Failed slide ${i + 1}:`, slideErr);
          }
        }
        if (pngCount === 0) {
          setError("Nenhum slide para enviar.");
          return;
        }

        const pdfBuilt = await buildCarouselPdfBlob();
        if (pdfBuilt) {
          form.append("pdf", pdfBuilt.blob, "carrossel.pdf");
        }

        const res = await fetch("/api/carousel/exports", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: form,
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Falha ao enviar exports");
        }
        toast.success(
          pdfBuilt
            ? `Nuvem: ${pngCount} PNG + PDF atualizados. Links na biblioteca.`
            : `Nuvem: ${pngCount} PNG atualizados.`
        );
      });
    } catch (err) {
      console.error("Save exports cloud:", err);
      setError(
        err instanceof Error ? err.message : "Nao foi possivel enviar a nuvem."
      );
    }
    setIsExporting(false);
  };

  // ─── Render ──────────────────────────────────────────────────────
  const stepNumber =
    step === "input"
      ? 1
      : step === "generating"
        ? 2
        : step === "pick"
          ? 3
          : 4;

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b border-[var(--border)] bg-white/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {step !== "input" && (
              <button
                onClick={() => {
                  if (step === "generating") return;
                  if (step === "pick") {
                    setStep("input");
                    resetV2State();
                  }
                  if (step === "edit") {
                    if (templatePick !== "twitter") {
                      setStep("pick");
                      setV2SubStep("backbone");
                    } else {
                      setStep("input");
                    }
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Icon name="arrow-left" size={18} />
              </button>
            )}
            <h1 className="editorial-serif text-3xl text-[var(--foreground)]">
              Criar carrossel<span className="text-[var(--accent)]">.</span>
            </h1>
          </div>

          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-2">
            {[
              { n: 1, label: "Tema" },
              { n: 2, label: "IA" },
              { n: 3, label: "Estilo" },
              { n: 4, label: "Editor" },
            ].map(({ n, label }) => (
              <div key={n} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all"
                    style={{
                      background:
                        n <= stepNumber ? "var(--accent)" : "var(--card)",
                      color: n <= stepNumber ? "#fff" : "var(--muted)",
                      border: n > stepNumber ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {n < stepNumber ? <Icon name="check" size={14} /> : n}
                  </div>
                  <span
                    className="text-[11px] font-semibold hidden md:inline"
                    style={{ color: n <= stepNumber ? "var(--accent)" : "var(--muted)" }}
                  >
                    {label}
                  </span>
                </div>
                {n < 4 && (
                  <div
                    className="w-6 h-0.5 rounded"
                    style={{
                      background: n < stepNumber ? "var(--accent)" : "var(--border)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Edit-step toolbar actions (inline) */}
          {step === "edit" && templatePick === "twitter" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[var(--card)] rounded-lg p-0.5 border border-[var(--border)]">
                <button
                  onClick={() => setSlideStyle("white")}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                  style={{
                    background: slideStyle === "white" ? "#fff" : "transparent",
                    boxShadow: slideStyle === "white" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  Claro
                </button>
                <button
                  onClick={() => setSlideStyle("dark")}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                  style={{
                    background: slideStyle === "dark" ? "#111" : "transparent",
                    color: slideStyle === "dark" ? "#fff" : "inherit",
                    boxShadow: slideStyle === "dark" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                  }}
                >
                  Escuro
                </button>
              </div>

              {/* Export dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportPanel(!showExportPanel)}
                  className="btn-scale flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "var(--accent)" }}
                >
                  <Icon name="download" size={15} />
                  Exportar
                  <Icon name={showExportPanel ? "chevron-up" : "chevron-down"} size={13} />
                </button>

                <AnimatePresence>
                  {showExportPanel && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-[var(--border)] shadow-xl z-50 p-2"
                    >
                      <button
                        onClick={() => { void handleExportPng(); setShowExportPanel(false); }}
                        disabled={isExporting}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors text-left disabled:opacity-50"
                      >
                        <Icon name="download" size={16} />
                        <div>
                          <div className="font-semibold">Baixar PNG</div>
                          <div className="text-[11px] text-[var(--muted)]">Imagens individuais</div>
                        </div>
                      </button>
                      <button
                        onClick={() => { void handleExportPdf(); setShowExportPanel(false); }}
                        disabled={isExporting}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors text-left disabled:opacity-50"
                      >
                        <Icon name="file-text" size={16} />
                        <div>
                          <div className="font-semibold">Baixar PDF</div>
                          <div className="text-[11px] text-[var(--muted)]">Todos slides em PDF</div>
                        </div>
                      </button>
                      <div className="h-px bg-[var(--border)] my-1" />
                      <button
                        onClick={() => { void handleSaveExportsToCloud(); setShowExportPanel(false); }}
                        disabled={isExporting || isGuest || !session?.access_token}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors text-left disabled:opacity-50"
                      >
                        <Icon name="cloud" size={16} />
                        <div>
                          <div className="font-semibold">Salvar na nuvem</div>
                          <div className="text-[11px] text-[var(--muted)]">PNG + PDF no Storage</div>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close export dropdown on outside click */}
      {showExportPanel && (
        <div className="fixed inset-0 z-10" onClick={() => setShowExportPanel(false)} />
      )}

      <div className="max-w-7xl mx-auto px-6 py-10">
        {draftLoading && (
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">
            Carregando rascunho...
          </div>
        )}
        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  className="text-red-400 hover:text-red-600 ml-4"
                >
                  &times;
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <span>{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice("")}
                  className="text-emerald-700 hover:text-emerald-900"
                  aria-label="Fechar"
                >
                  &times;
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── STEP 1: INPUT ──────────────────────────────────────── */}
        {step === "input" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-center mb-10">
              <h2
                className="text-3xl font-bold mb-3"
                style={{
                  fontFamily:
                    "var(--font-serif), 'DM Serif Display', Georgia, serif",
                }}
              >
                O que voce quer criar?
              </h2>
              <p className="text-[var(--muted)]">
                Escolha seu ponto de partida e a gente gera 3 variacoes do carrossel.
              </p>
            </div>

            {isGuest && (
              <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 text-sm leading-relaxed">
                <strong>Modo convidado:</strong> voce pode abrir e editar rascunhos salvos no
                navegador. Para <strong>gerar com IA</strong>, faca login — ai seus rascunhos
                tambem podem sincronizar na nuvem.
                <Link
                  href="/app/login"
                  className="mt-3 inline-block font-semibold text-[var(--accent)] underline underline-offset-2"
                >
                  Entrar na conta
                </Link>
              </div>
            )}

            {/* Source type cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {SOURCE_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.type}
                  onClick={() => setSourceType(opt.type)}
                  whileTap={{ scale: 0.97 }}
                  className={`card-lift p-5 rounded-xl border-2 text-left transition-all ${
                    sourceType === opt.type
                      ? "border-[var(--accent)] bg-[var(--accent)]/[0.04] shadow-md shadow-orange-500/5"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-zinc-300"
                  }`}
                >
                  <div className="text-2xl mb-3">{opt.emoji}</div>
                  <div className="font-semibold text-sm mb-1">{opt.label}</div>
                  <div className="text-xs text-[var(--muted)] leading-relaxed">{opt.desc}</div>
                </motion.button>
              ))}
            </div>

            {/* Input fields based on source type */}
            <div className="max-w-2xl mx-auto space-y-5">
              {sourceType === "link" && (
                <div>
                  <label className="block text-sm font-medium mb-2">URL do artigo</label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.com/article..."
                    className="w-full px-4 py-3.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition-all"
                  />
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-xs text-[var(--muted)] leading-relaxed space-y-2">
                    <p className="font-semibold text-[var(--foreground)]">
                      Link como fonte ou so inspiracao
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        <strong className="text-[var(--foreground)]">Extracao automatica</strong> funciona
                        melhor em blogs e paginas com texto limpo no HTML.
                      </li>
                      <li>
                        <strong className="text-[var(--foreground)]">Paywall, login ou PDF pesado</strong>{" "}
                        podem falhar — use o campo &ldquo;Tema / foco&rdquo; com um resumo ou cole trechos em{" "}
                        <strong className="text-[var(--foreground)]">Minha ideia</strong>.
                      </li>
                      <li>
                        <strong className="text-[var(--foreground)]">So estrutura / tom:</strong> descreva no
                        foco (&ldquo;mesma linha de argumento, exemplos do meu nicho&rdquo;) sem copiar literalmente.
                      </li>
                      <li>
                        Sempre <strong className="text-[var(--foreground)]">revise fatos e atribuicao</strong>{" "}
                        antes de publicar.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {sourceType === "video" && (
                <div>
                  <label className="block text-sm font-medium mb-2">URL do YouTube</label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-4 py-3.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition-all"
                  />
                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    A gente puxa a transcricao automatica do YouTube e usa como base.
                  </p>
                </div>
              )}

              {sourceType === "instagram" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Link do Instagram</label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://instagram.com/p/... ou /reel/..."
                    className="w-full px-4 py-3.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition-all"
                  />
                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    Funciona com posts, carrosseis e reels publicos. A gente puxa a legenda + hashtags + metricas pra usar como contexto.
                  </p>
                </div>
              )}

              {(sourceType === "idea" ||
                sourceType === "link" ||
                sourceType === "video" ||
                sourceType === "instagram") && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {sourceType === "idea" ? "Sua ideia" : "Tema / foco"}
                  </label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={
                      sourceType === "idea"
                        ? "Ex.: 5 ferramentas de IA que mudaram meu marketing..."
                        : "Ex.: Destaque os principais aprendizados sobre growth..."
                    }
                    rows={3}
                    className="w-full px-4 py-3.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition-all resize-none"
                  />
                </div>
              )}

              {/* Settings row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--muted)]">Nicho</label>
                  <select
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm bg-white focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="marketing">Marketing</option>
                    <option value="tech">Tech</option>
                    <option value="crypto">Crypto / Web3</option>
                    <option value="finance">Finance</option>
                    <option value="ai">AI / Automation</option>
                    <option value="business">Business</option>
                    <option value="health">Health & Wellness</option>
                    <option value="education">Education</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--muted)]">Tom</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm bg-white focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="professional">Profissional</option>
                    <option value="casual">Casual</option>
                    <option value="provocative">Provocativo</option>
                    <option value="educational">Educacional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--muted)]">
                    Idioma do carrossel
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm bg-white focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="pt-br">Portugues (BR)</option>
                    <option value="en">English</option>
                    <option value="es">Espanol</option>
                  </select>
                </div>
              </div>

              {/* Template picker */}
              <div>
                <label className="block text-xs font-medium mb-2 text-[var(--muted)]">
                  Escolha o template
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {TEMPLATE_OPTIONS.map((t) => {
                    const selected = templatePick === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplatePick(t.id)}
                        className={`relative rounded-xl border-2 p-4 text-left transition-all duration-200 active:scale-[0.97] ${
                          selected
                            ? "border-[var(--accent)] bg-[var(--accent)]/[0.04] shadow-md shadow-orange-500/5"
                            : "border-[var(--border)] bg-[var(--card)] hover:border-zinc-300"
                        }`}
                      >
                        {selected && (
                          <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px]" style={{ background: "var(--accent)" }}>
                            <Icon name="check" size={10} />
                          </div>
                        )}
                        <div className="text-xl mb-2">{t.emoji}</div>
                        <p className="text-sm font-bold" style={{ color: selected ? "var(--accent)" : "var(--foreground)" }}>
                          {t.name}
                        </p>
                        <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                          {t.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={
                  isGuest ||
                  !session?.access_token ||
                  (sourceType === "idea" && !topic.trim()
                    ? true
                    : (sourceType === "link" ||
                          sourceType === "video" ||
                          sourceType === "instagram") &&
                        !sourceUrl.trim()
                      ? true
                      : false)
                }
                className="btn-scale btn-glow w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: "var(--accent)" }}
              >
                Gerar ideias
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 2: GENERATING ─────────────────────────────────── */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader
              size="lg"
              title="Gerando..."
              subtitle="A IA está trabalhando no seu conteúdo"
            />
            <div className="mt-4">
              <AITextLoading
                className="!text-xl"
                texts={[
                  "Analisando o tópico...",
                  "Criando ângulos diferentes...",
                  "Escrevendo copy dos slides...",
                  "Aplicando tom de voz...",
                  "Finalizando...",
                ]}
              />
            </div>
          </div>
        )}

        {/* ─── STEP 3: PICK CONCEPT / V2 FLOW ───────────────────── */}
        {step === "pick" && templatePick === "twitter" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-center mb-10">
              <h2
                className="text-3xl font-bold mb-3"
                style={{ fontFamily: "var(--font-serif), 'DM Serif Display', Georgia, serif" }}
              >
                Escolha o angulo
              </h2>
              <p className="text-[var(--muted)]">
                5 abordagens diferentes. Escolha uma e geramos o carrossel completo.
              </p>
            </div>

            <div className="grid gap-3 max-w-2xl mx-auto">
              {concepts.map((concept, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => handlePickConcept(index)}
                  className="w-full text-left border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.03] transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-bold mt-0.5">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-[var(--foreground)] mb-1 group-hover:text-[var(--accent)] transition-colors">
                        {concept.hook}
                      </h3>
                      <p className="text-sm text-[var(--muted)] leading-relaxed">
                        {concept.angle}
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)] px-2 py-0.5 rounded-full">
                        {concept.style}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => { setStep("input"); setConcepts([]); }}
                className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
              >
                &larr; Voltar e tentar outro topico
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── V2 Content Machine sub-steps (non-twitter templates) ── */}
        {step === "pick" && templatePick !== "twitter" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto"
          >
            {/* V2 Progress bar */}
            <div className="mb-8 flex items-center gap-1">
              {(["triagem", "headlines", "backbone", "render"] as const).map((s, i) => {
                const labels = ["Triagem", "Headlines", "Espinha", "Carrossel"];
                const stepOrder = ["triagem", "headlines", "backbone", "rendering"];
                const currentIdx = stepOrder.indexOf(v2SubStep);
                const isActive = i === currentIdx;
                const isDone = i < currentIdx;
                return (
                  <div key={s} className="flex items-center gap-1 flex-1">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all border ${
                        isActive
                          ? "bg-[var(--accent)] text-white border-[var(--accent)] scale-110"
                          : isDone
                            ? "bg-zinc-800 text-white border-zinc-800"
                            : "bg-white text-zinc-300 border-zinc-200"
                      }`}
                    >
                      {isDone ? <Icon name="check" size={12} /> : i + 1}
                    </div>
                    <span className={`text-[11px] font-semibold hidden sm:block ${isActive ? "text-[var(--foreground)]" : isDone ? "text-zinc-500" : "text-zinc-300"}`}>
                      {labels[i]}
                    </span>
                    {i < 3 && <div className={`flex-1 h-0.5 mx-1 rounded ${isDone ? "bg-zinc-800" : "bg-zinc-100"}`} />}
                  </div>
                );
              })}
            </div>

            {/* TRIAGEM */}
            {v2SubStep === "triagem" && v2Triagem && (
              <div className="space-y-6">
                <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
                  <div className="bg-zinc-900 text-white px-6 py-3">
                    <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">Etapa 1 -- Triagem</span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {[
                      { label: "Transformacao", value: v2Triagem.transformacao },
                      { label: "Friccao central", value: v2Triagem.friccao },
                      { label: "Angulo narrativo", value: v2Triagem.angulo },
                      { label: "Evidencias", value: v2Triagem.evidencias },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-6 py-4">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] mb-1">{label}</p>
                        <p className="text-[14px] text-[var(--foreground)] leading-relaxed">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep("input"); resetV2State(); }}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--muted)] hover:border-zinc-400 transition"
                  >
                    <Icon name="arrow-left" size={16} />
                    Voltar
                  </button>
                  <button
                    onClick={handleV2GenerateHeadlines}
                    disabled={v2Loading}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl text-white py-3 text-[15px] font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                    style={{ background: "var(--accent)" }}
                  >
                    {v2Loading ? (
                      <><Icon name="loader" size={18} /> Gerando headlines...</>
                    ) : (
                      <>Gerar Headlines <Icon name="arrow-left" size={16} /></>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* HEADLINES */}
            {v2SubStep === "headlines" && v2Headlines && (
              <div className="space-y-6">
                <div className="rounded-xl border border-[var(--border)] bg-white px-6 py-4">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Angulo dominante</p>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">{v2Headlines.angulo_dominante}</p>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">Escolha 1 headline (capa do carrossel)</label>
                  <div className="grid gap-3">
                    {v2Headlines.headlines.map((h, i) => {
                      const isSelected = v2SelectedHeadline === i;
                      return (
                        <button
                          key={i}
                          onClick={() => setV2SelectedHeadline(i)}
                          className={`relative rounded-xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.99] ${
                            isSelected
                              ? "border-[var(--accent)] bg-[var(--accent)]/[0.03] shadow-md"
                              : "border-[var(--border)] bg-white hover:border-zinc-300"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border transition ${
                              isSelected ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-zinc-50 text-zinc-400 border-zinc-200"
                            }`}>
                              {isSelected ? <Icon name="check" size={14} /> : i + 1}
                            </div>
                            <div>
                              <p className="text-[15px] font-bold text-[var(--foreground)] leading-snug">{h.line1}</p>
                              <p className="text-[14px] text-[var(--muted)] mt-1 leading-snug">{h.line2}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setV2SubStep("triagem")}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--muted)] hover:border-zinc-400 transition"
                  >
                    <Icon name="arrow-left" size={16} /> Voltar
                  </button>
                  <button
                    onClick={handleV2RefreshHeadlines}
                    disabled={v2Loading}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--muted)] hover:border-zinc-400 transition disabled:opacity-40"
                  >
                    <Icon name="loader" size={14} /> Refazer
                  </button>
                  <button
                    onClick={handleV2GenerateBackbone}
                    disabled={v2Loading || v2SelectedHeadline === null}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl text-white py-3 text-[15px] font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                    style={{ background: "var(--accent)" }}
                  >
                    {v2Loading ? (
                      <><Icon name="loader" size={18} /> Construindo espinha...</>
                    ) : (
                      <>Construir Espinha Dorsal</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* BACKBONE */}
            {v2SubStep === "backbone" && v2Backbone && (
              <div className="space-y-6">
                <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
                  <div className="bg-zinc-900 text-white px-6 py-3">
                    <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">Etapa 3 -- Espinha Dorsal</span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {[
                      { label: "Headline escolhida", value: v2Backbone.headline_escolhida },
                      { label: "Hook", value: v2Backbone.hook },
                      { label: "Mecanismo", value: v2Backbone.mecanismo },
                      { label: "Prova", value: v2Backbone.prova },
                      { label: "Aplicacao", value: v2Backbone.aplicacao },
                      { label: "Direcao", value: v2Backbone.direcao },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-6 py-4">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] mb-1">{label}</p>
                        <p className="text-[14px] text-[var(--foreground)] leading-relaxed">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setV2SubStep("headlines")}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--muted)] hover:border-zinc-400 transition"
                  >
                    <Icon name="arrow-left" size={16} /> Voltar
                  </button>
                  <button
                    onClick={handleV2GenerateCarousel}
                    disabled={v2Loading}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl text-white py-3 text-[15px] font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                    style={{ background: "var(--accent)" }}
                  >
                    {v2Loading ? (
                      <><Icon name="loader" size={18} /> Renderizando carrossel...</>
                    ) : (
                      <><Icon name="sparkles" size={18} /> Gerar Carrossel</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* RENDERING loading */}
            {v2SubStep === "rendering" && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader size="lg" title="Renderizando..." subtitle="Gerando os blocos do carrossel" />
              </div>
            )}

            {/* Back to input when no sub-step data is loaded yet */}
            {v2SubStep === "none" && (
              <div className="text-center py-10">
                <p className="text-sm text-[var(--muted)]">Carregando...</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── STEP 4: EDIT SLIDES (unified with export) ─────────── */}
        {step === "edit" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* ── V2 Block Editor (non-twitter templates) ── */}
            {templatePick !== "twitter" && v2EditedBlocks.length > 0 && (
              <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-serif), 'DM Serif Display', Georgia, serif" }}>
                      Editar blocos
                    </h2>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      Template {templatePick} &middot; {v2EditedBlocks.length} blocos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(v2EditedBlocks.join("\n\n"));
                        toast.success("Texto copiado!");
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border)] hover:bg-zinc-50 transition-all"
                    >
                      <Icon name="file-text" size={13} />
                      Copiar
                    </button>
                    <button
                      onClick={async () => {
                        // Save v2 blocks as carousel
                        const title = v2Headlines?.headlines[v2SelectedHeadline ?? 0]?.line1 || v2EditedBlocks[0]?.replace(/^texto\s+\d+\s*[-\u2013\u2014]\s*/i, "") || "Carrossel v2";
                        const slides = v2EditedBlocks.map((block, i) => {
                          const content = block.replace(/^texto\s+\d+\s*[-\u2013\u2014]\s*/i, "");
                          return { heading: i === 0 ? title : `Slide ${i + 1}`, body: content, imageQuery: "" };
                        });
                        const variationMeta = { title, style: templatePick };
                        try {
                          if (user && !isGuest && supabase) {
                            const { row, inserted } = await upsertUserCarousel(supabase, user.id, {
                              id: carouselRecordId,
                              title,
                              slides,
                              slideStyle: "dark",
                              variation: variationMeta,
                              status: "draft",
                            });
                            setCarouselRecordId(row.id);
                            if (inserted) {
                              await bumpCarouselUsage(supabase, user.id);
                              await refreshProfile();
                            }
                            toast.success("Carrossel salvo na nuvem!");
                          } else {
                            const id = carouselRecordId ?? `carousel-v2-${Date.now()}`;
                            setCarouselRecordId(id);
                            upsertGuestCarousel({ id, title, slides, style: "dark", variation: variationMeta, savedAt: new Date().toISOString(), status: "draft" });
                            toast.success("Carrossel salvo localmente!");
                          }
                        } catch (e) {
                          console.error("[v2-save] Erro:", e);
                          toast.error("Erro ao salvar carrossel.");
                        }
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: "var(--accent)" }}
                    >
                      <Icon name="check" size={13} />
                      Salvar
                    </button>
                  </div>
                </div>

                {/* Block cards */}
                <div className="space-y-3">
                  {v2EditedBlocks.map((block, i) => (
                    <V2BlockCard
                      key={i}
                      index={i}
                      text={block}
                      templateColor={V2_TEMPLATE_COLORS[templatePick as Exclude<TemplatePick, "twitter">]?.accent || "#EC6000"}
                      onChange={(val) => {
                        const next = [...v2EditedBlocks];
                        next[i] = val;
                        setV2EditedBlocks(next);
                      }}
                    />
                  ))}
                </div>

                {/* Back */}
                <button
                  onClick={() => {
                    setStep("pick");
                    setV2SubStep("backbone");
                  }}
                  className="mt-6 flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                >
                  &larr; Voltar para espinha dorsal
                </button>
              </div>
            )}

            {/* ── Twitter Slide Editor (existing) ── */}
            {templatePick === "twitter" && (
            <>
            {/* Editor header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2
                  className="text-2xl font-bold"
                  style={{
                    fontFamily:
                      "var(--font-serif), 'DM Serif Display', Georgia, serif",
                  }}
                >
                  Editar seus slides
                </h2>
                <p className="text-sm text-[var(--muted)] mt-1 flex items-center gap-3">
                  <span>
                    {editSlides.length} slides &middot;{" "}
                    {STYLE_BADGES[variations[selectedVariation]?.style]?.label ||
                      "Personalizado"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      autosaveState === "saving"
                        ? "text-zinc-400"
                        : autosaveState === "saved"
                          ? "text-emerald-600"
                          : "text-amber-500"
                    }`}
                  >
                    {autosaveState === "saving" ? (
                      <>
                        <Icon name="loader" size={11} />
                        Salvando...
                      </>
                    ) : autosaveState === "saved" ? (
                      <>
                        <Icon name="check" size={11} />
                        Salvo
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Nao salvo
                      </>
                    )}
                  </span>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline">
                    Setas do teclado navegam entre slides
                  </span>
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_440px] gap-8">
              {/* Slide editor list */}
              <div className="space-y-3">
                {editSlides.map((slide, index) => {
                  const isActive = index === activeSlideIndex;
                  const isDragOver = index === dragOverIndex && draggedIndex !== index;

                  return (
                    <motion.div
                      key={index}
                      ref={(el) => { editorCardRefs.current[index] = el; }}
                      layout
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setActiveSlideIndex(index)}
                      className={`rounded-xl p-4 transition-all cursor-pointer ${
                        isActive
                          ? "border-2 border-[var(--accent)] bg-white shadow-lg shadow-orange-500/5 ring-1 ring-[var(--accent)]/10"
                          : "border border-[var(--border)] bg-white hover:border-zinc-300 hover:shadow-sm"
                      } ${isDragOver ? "border-dashed border-[var(--accent)] bg-orange-50/30" : ""} ${
                        draggedIndex === index ? "opacity-50 scale-[0.98]" : ""
                      }`}
                    >
                      {/* Slide header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="text-zinc-300 cursor-grab active:cursor-grabbing hover:text-zinc-500 transition-colors"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <Icon name="grip" size={14} />
                          </div>
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
                              isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
                            }`}
                          >
                            Slide {index + 1}
                          </span>
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveSlide(index, "up"); }}
                            disabled={index === 0}
                            className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-20 transition-colors"
                            title="Mover para cima"
                          >
                            <Icon name="arrow-up" size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveSlide(index, "down"); }}
                            disabled={index === editSlides.length - 1}
                            className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-20 transition-colors"
                            title="Mover para baixo"
                          >
                            <Icon name="arrow-down" size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddSlide(index); }}
                            className="p-1 rounded-md hover:bg-orange-50 transition-colors text-[var(--accent)]"
                            title="Adicionar slide depois"
                          >
                            <Icon name="plus" size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveSlide(index); }}
                            disabled={editSlides.length <= 2}
                            className={`p-1 rounded-md disabled:opacity-20 transition-all ${
                              deleteConfirm === index
                                ? "bg-red-100 text-red-600"
                                : "hover:bg-red-50 text-red-400"
                            }`}
                            title={
                              deleteConfirm === index
                                ? "Clique de novo para confirmar"
                                : "Remover slide"
                            }
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Slide content — always visible but compact when not active */}
                      <AnimatePresence initial={false}>
                        {isActive ? (
                          <motion.div
                            key="expanded"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          >
                            <input
                              type="text"
                              value={slide.heading}
                              onChange={(e) =>
                                handleUpdateSlide(index, "heading", e.target.value)
                              }
                              className="w-full font-bold text-[16px] mb-1.5 px-3 py-2 rounded-lg border border-transparent focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 focus:outline-none bg-transparent hover:bg-zinc-50 transition-colors tracking-tight"
                              placeholder="Titulo do slide... (use **palavra** pra negrito)"
                            />
                            <textarea
                              value={slide.body}
                              onChange={(e) =>
                                handleUpdateSlide(index, "body", e.target.value)
                              }
                              rows={3}
                              className="w-full text-[13px] leading-relaxed text-zinc-700 px-3 py-2 rounded-lg border border-transparent focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 focus:outline-none bg-transparent resize-none hover:bg-zinc-50 transition-colors"
                              placeholder="Texto do slide... (use **palavra** pra negrito, Enter pra quebrar linha)"
                            />

                            {/* Image row */}
                            <div className="mt-2 flex items-start gap-3">
                              {/* Thumbnail */}
                              <div className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)] bg-zinc-100 group">
                                {slide.imageUrl ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={slide.imageUrl}
                                      alt={slide.heading || `Imagem do slide ${index + 1}`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                    {(imageLoadingIndex === index || imageGeneratingSlides.has(index)) && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                                        <Icon name="loader" size={14} />
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                    {(imageLoadingIndex === index || imageGeneratingSlides.has(index)) ? (
                                      <Icon name="loader" size={14} />
                                    ) : (
                                      <Icon name="image" size={16} />
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Query + actions */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <input
                                    type="text"
                                    value={slide.imageQuery}
                                    onChange={(e) =>
                                      handleUpdateSlide(index, "imageQuery", e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void handleRefetchImage(index);
                                      }
                                    }}
                                    className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] bg-white hover:bg-zinc-50 transition-colors"
                                    placeholder="Termo de busca"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); void handleRefetchImage(index, "search"); }}
                                    disabled={imageLoadingIndex === index || imageGeneratingSlides.has(index)}
                                    className="shrink-0 text-[10px] font-bold px-2 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
                                    title="Buscar outra imagem"
                                  >
                                    Buscar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); void handleRefetchImage(index, "generate"); }}
                                    disabled={imageLoadingIndex === index || imageGeneratingSlides.has(index)}
                                    className="shrink-0 text-[10px] font-bold px-2 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                    title="Gerar imagem com IA"
                                  >
                                    Gerar IA
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1">
                                  <label className="cursor-pointer inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-600 hover:text-[var(--accent)] transition-colors px-1.5 py-0.5 rounded-md hover:bg-orange-50">
                                    <Icon name="upload" size={10} />
                                    Upload
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) void handleUploadImage(index, f);
                                        e.target.value = "";
                                      }}
                                      disabled={imageLoadingIndex === index}
                                    />
                                  </label>
                                  {slide.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-600 hover:text-red-600 transition-colors px-1.5 py-0.5 rounded-md hover:bg-red-50"
                                      title="Remover imagem"
                                    >
                                      <Icon name="trash" size={10} />
                                      Remover
                                    </button>
                                  )}
                                </div>

                                {imagePickerIndex === index && imagePickerOptions.length > 0 && (
                                  <div className="mt-2 rounded-xl border border-[var(--border)] bg-white p-3 shadow-lg">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[11px] font-semibold text-zinc-700">Escolha uma imagem</span>
                                      <button
                                        type="button"
                                        onClick={() => { setImagePickerIndex(null); setImagePickerOptions([]); }}
                                        className="text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors"
                                      >
                                        Fechar
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                      {imagePickerOptions.map((url, imgIdx) => (
                                        <button
                                          key={imgIdx}
                                          type="button"
                                          onClick={() => handlePickImage(url)}
                                          className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[var(--accent)] transition-all"
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={url}
                                            alt={`Opcao ${imgIdx + 1}`}
                                            className="w-full h-full object-cover"
                                          />
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          /* Collapsed state: show a compact summary */
                          <motion.div
                            key="collapsed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-3 px-1"
                          >
                            {slide.imageUrl && (
                              <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden border border-[var(--border)]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={slide.imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-zinc-800 truncate">
                                {slide.heading || "Sem titulo"}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">
                                {slide.body || "Sem texto"}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {/* Add slide at end */}
                <motion.button
                  layout
                  onClick={() => handleAddSlide(editSlides.length - 1)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--accent)] text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Icon name="plus" size={16} />
                  Adicionar slide
                </motion.button>
              </div>

              {/* Preview panel */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-2">
                    <Icon name="eye" size={13} />
                    Preview
                  </div>
                  <div className="text-[11px] text-zinc-400 font-medium">
                    Slide {activeSlideIndex + 1}/{editSlides.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                  <CarouselPreview
                    slides={editSlides}
                    profile={previewProfile}
                    style={slideStyle}
                    slideRefs={slideRefs}
                    activeSlideIndex={activeSlideIndex}
                    onSlideSelect={setActiveSlideIndex}
                    showThumbnails
                  />
                </div>

                {/* Quick export bar below preview */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleExportPng}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border)] hover:bg-orange-50 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all disabled:opacity-50"
                  >
                    <Icon name="download" size={13} />
                    {isExporting ? "..." : "PNG"}
                  </button>
                  <button
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border)] hover:bg-orange-50 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all disabled:opacity-50"
                  >
                    <Icon name="file-text" size={13} />
                    {isExporting ? "..." : "PDF"}
                  </button>
                  <button
                    onClick={() => void handleSaveDraft()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border)] hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all"
                  >
                    <Icon name="check" size={13} />
                    Salvar
                  </button>
                </div>
              </div>
            </div>
            </>
            )}
          </motion.div>
        )}
      </div>

      {/* Hidden export container — renders at full 1080x1350 for PNG/PDF capture */}
      {exportRenderSlides && (
        <div
          ref={exportContainerRef}
          style={{ position: "fixed", left: "-9999px", top: 0, opacity: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          {exportRenderSlides.map((slide, i) => (
            <div
              key={i}
              ref={(el) => { exportSlideRefs.current[i] = el; }}
            >
              <CarouselSlide
                heading={slide.heading}
                body={slide.body}
                imageUrl={slide.imageUrl}
                slideNumber={i + 1}
                totalSlides={exportRenderSlides.length}
                profile={previewProfile}
                style={slideStyle}
                isLastSlide={i === exportRenderSlides.length - 1}
                showFooter={i === 0}
                scale={1}
              />
            </div>
          ))}
        </div>
      )}

      {/* Export progress indicator */}
      {exportProgress && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white text-sm font-medium px-5 py-2.5 rounded-full backdrop-blur-sm">
          {exportProgress}
        </div>
      )}
    </div>
  );
}

// ─── V2 Block Card Component ────────────────────────────────────────
function V2BlockCard({
  index,
  text,
  templateColor,
  onChange,
}: {
  index: number;
  text: string;
  templateColor: string;
  onChange: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);

  const match = text.match(/^texto\s+\d+\s*[-\u2013\u2014]\s*/i);
  const content = match ? text.slice(match[0].length) : text;
  const label = `texto ${index + 1}`;
  const isFirst = index === 0;

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: templateColor + "30" }}
    >
      <div
        className="flex items-center justify-between px-5 py-2"
        style={{ backgroundColor: isFirst ? templateColor + "10" : "transparent" }}
      >
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: templateColor }}>
          {label} {isFirst && "-- CAPA"}
        </span>
        <button
          onClick={() => {
            if (editing) {
              onChange(editValue);
              setEditing(false);
            } else {
              setEditValue(text);
              setEditing(true);
            }
          }}
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded transition-colors"
          style={{ color: templateColor, backgroundColor: templateColor + "15" }}
        >
          {editing ? "salvar" : "editar"}
        </button>
      </div>
      <div className="p-5">
        {editing ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[14px] text-zinc-900 focus:border-[var(--accent)] focus:outline-none transition"
            autoFocus
          />
        ) : (
          <p className={`text-[15px] leading-relaxed ${isFirst ? "font-bold text-lg" : ""}`} style={{ color: "#0A0A0A" }}>
            {content}
          </p>
        )}
      </div>
    </div>
  );
}
