"use client";

/**
 * Onboarding v2.1 — incorpora feedback:
 *  - Importa 20 posts + imagem real + flag carrossel.
 *  - Grid mostra imagens via /api/img-proxy (IG CDN tem token que expira).
 *  - Vision transcription de 8 posts (Gemini 2.5 Flash inline image) pra alimentar
 *    brand-analysis com texto dos slides — nao so legenda.
 *  - DNA editavel: nichos (chips), tom (select), quem-voce-e rico (3-5 frases).
 *  - Upload de foto de perfil (pra template Twitter).
 *  - Cor da marca custom (hex input + swatches).
 *  - Estilo de imagem e design com mini preview visuais inline.
 *  - Piloto automatico removido — feature futura.
 *  - Gera 3 carrosseis reais no final (paralelo /api/generate), persiste, redireciona.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Loader2,
  X,
  Pencil,
  Instagram,
  Sparkles,
  Upload,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import type { BrandAnalysis } from "@/lib/auth-context";
import { jsonWithAuth, authHeaders } from "@/lib/api-auth-headers";
import { scrubInstagramCdn } from "@/lib/instagram-cdn";
import { upsertUserCarousel } from "@/lib/carousel-storage";
import { supabase } from "@/lib/supabase";
import type { DesignTemplateId } from "@/lib/carousel-templates";
import { FacebookLoginButton } from "@/components/facebook-login-button";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────
type RecentPost = {
  text: string;
  likes: number;
  comments: number;
  imageUrl: string | null;
  slideUrls: string[];
  isCarousel: boolean;
  permalink: string | null;
  timestamp: string | null;
};

interface ScrapedProfile {
  handle: string;
  platform: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  niche: string | null;
  recentPosts: RecentPost[];
  partial: boolean;
}

interface BrandAnalysisResult {
  detected_niche: string[];
  tone_detected: string;
  top_topics: string[];
  posting_frequency: string;
  avg_engagement: { likes: number; comments: number };
  suggested_pillars: string[];
  suggested_audience: string;
  who_you_are?: string;
  communication_style?: string;
}

interface Suggestion {
  id: string;
  title: string;
  hook: string;
  angle: string;
  style?: string;
}

// ──────────────────────────────────────────────────────────────────
// Presets
// ──────────────────────────────────────────────────────────────────
const TONE_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "educational", label: "Educacional" },
  { value: "professional", label: "Profissional" },
  { value: "provocative", label: "Provocador" },
] as const;

const BRAND_COLORS = [
  { id: "green", label: "Lima", hex: "#7CF067" },
  { id: "ink", label: "Preto", hex: "#0A0A0A" },
  { id: "pink", label: "Pink", hex: "#D262B2" },
  { id: "blue", label: "Azul", hex: "#2B5FFF" },
  { id: "orange", label: "Laranja", hex: "#FF4A1C" },
  { id: "yellow", label: "Mostarda", hex: "#F5C518" },
] as const;

const IMAGE_STYLES = [
  {
    id: "photo",
    label: "Fotografia editorial",
    desc: "Cenas reais, luz natural, grana",
    preview: "/onboarding-styles/photo.jpg",
  },
  {
    id: "illus",
    label: "Ilustração",
    desc: "Traço limpo, cores planas, geometria",
    preview: "/onboarding-styles/illus.jpg",
  },
  {
    id: "iso3d",
    label: "3D isométrico",
    desc: "Objetos em perspectiva, gradiente pastel",
    preview: "/onboarding-styles/iso3d.jpg",
  },
] as const;

// ──────────────────────────────────────────────────────────────────
// Step machine
// ──────────────────────────────────────────────────────────────────
type Step =
  | "about"
  | "connect"
  | "analyze"
  | "refs"
  | "dna"
  | "photo"
  | "visual"
  | "ideas"
  | "generating"
  | "done";

const STEP_ORDER: Step[] = [
  "about",
  "connect",
  "analyze",
  "refs",
  "dna",
  "photo",
  "visual",
  "ideas",
  "generating",
  "done",
];

function stepIndex(s: Step): number {
  return STEP_ORDER.indexOf(s);
}

function proxyImage(url: string | null | undefined): string | null {
  if (!url) return null;
  // URLs do Supabase ja sao publicas e estaveis — nao precisa proxy.
  // (scrape-cache.ts sobe imagens do IG pro bucket carousel-images.)
  if (url.includes("/storage/v1/object/public/")) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { profile, user, session, updateProfile } = useAuth();

  const [step, setStep] = useState<Step>("about");
  const [saving, setSaving] = useState(false);

  // about
  const [displayName, setDisplayName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // connect
  const [igHandle, setIgHandle] = useState("");

  // analyze
  const [scrapedProfile, setScrapedProfile] = useState<ScrapedProfile | null>(
    null
  );
  const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysisResult | null>(
    null
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzePhase, setAnalyzePhase] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);

  // dna (editable)
  const [dnaNiches, setDnaNiches] = useState<string[]>([]);
  const [dnaTone, setDnaTone] = useState<string>("casual");
  const [dnaWho, setDnaWho] = useState("");
  const [dnaAudience, setDnaAudience] = useState("");
  const [dnaStyle, setDnaStyle] = useState("");
  const [dnaPillars, setDnaPillars] = useState("");
  const [newNiche, setNewNiche] = useState("");

  // refs (posts que o user ama) — opcionais, 0-3 URLs.
  //  Persiste em brand_analysis.__reference_posts. Uma versao futura vai
  //  ter um extractor que le o texto desses posts pra alimentar a voz da
  //  IA; por enquanto ficam so como memoria guardada.
  const [referencePosts, setReferencePosts] = useState<string[]>(["", "", ""]);

  // photo
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [avatarUploadedUrl, setAvatarUploadedUrl] = useState<string | null>(
    null
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // visual
  const [colorHex, setColorHex] = useState<string>("#7CF067");
  // imageStyleId aceita "photo" | "illus" | "iso3d" | "custom" (quando o
  // usuario subiu referencias proprias, os presets ficam ocultos).
  const [imageStyleId, setImageStyleId] = useState<string>("photo");
  const [designId, setDesignId] = useState<DesignTemplateId>("manifesto");
  // Upload de referencias visuais proprias (0-3). Se houver, roda
  // /api/brand-aesthetic e guarda a description inline.
  const [brandImageRefs, setBrandImageRefs] = useState<string[]>([]);
  const [brandImageUploading, setBrandImageUploading] = useState(false);
  const [imageAesthetic, setImageAesthetic] = useState<{
    description: string;
    palette?: string[];
    keywords?: string[];
    updatedAt?: string;
  } | null>(null);
  const [aestheticAnalyzing, setAestheticAnalyzing] = useState(false);
  const [aestheticError, setAestheticError] = useState<string | null>(null);
  const brandRefsInputRef = useRef<HTMLInputElement | null>(null);

  // ideas
  const [ideas, setIdeas] = useState<Suggestion[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [approvedIdeas, setApprovedIdeas] = useState<Suggestion[]>([]);

  // generating
  const [genProgress, setGenProgress] = useState<
    Array<{
      title: string;
      status: "queued" | "running" | "done" | "error";
      carouselId?: string;
    }>
  >([]);

  // Pre-fill from profile once
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (profile) {
      if (profile.name) setDisplayName(profile.name);
      if (profile.instagram_handle) setIgHandle(profile.instagram_handle);
      if (profile.avatar_url) {
        setAvatarUploadedUrl(profile.avatar_url);
        setAvatarDataUrl(profile.avatar_url);
      }
    }
    if (user?.user_metadata && !displayName) {
      const fn = (user.user_metadata as Record<string, unknown>).full_name;
      if (typeof fn === "string") setDisplayName(fn);
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user]);

  useEffect(() => {
    // Hard guard: usuario que ja completou onboarding nao pode refazer —
    // evita loop de geracao gratuita toda vez. Pra ajustar tom/nicho
    // depois, usa /app/settings (abas Perfil e Voz).
    if (profile?.onboarding_completed) router.replace("/app");
  }, [profile?.onboarding_completed, router]);

  const goto = useCallback((next: Step) => setStep(next), []);

  // ─── Run analysis: scrape → vision → brand-analysis ───
  const runAnalysis = useCallback(
    async (handleInput: string, preScraped?: ScrapedProfile) => {
      // Accept either:
      //   - handle (passa pelo Apify scraper)
      //   - preScraped (ja veio do FB Login — mesmo shape)
      const clean = (preScraped?.handle ?? handleInput)
        .replace(/^@/, "")
        .trim();
      if (!clean && !preScraped) {
        setAnalysisError("Digite seu @ do Instagram pra gente começar.");
        return;
      }
      setAnalyzing(true);
      setAnalysisError(null);
      setAnalyzePhase(1);
      try {
        let scraped: ScrapedProfile;
        if (preScraped) {
          scraped = preScraped;
        } else {
          scraped = await fetch("/api/profile-scraper", {
            method: "POST",
            headers: jsonWithAuth(session),
            body: JSON.stringify({ platform: "instagram", handle: clean }),
          }).then(async (r) => {
            if (!r.ok) {
              const b = await r.json().catch(() => null);
              throw new Error(
                typeof b?.error === "string"
                  ? b.error
                  : "Não consegui ler esse perfil."
              );
            }
            return (await r.json()) as ScrapedProfile;
          });
        }

        setScrapedProfile(scraped);
        setAnalyzePhase(2);

        if (!scraped.recentPosts || scraped.recentPosts.length === 0) {
          setAnalyzePhase(6);
          return;
        }

        // Vision transcription (best-effort)
        setAnalyzePhase(3);
        const postsForVision = scraped.recentPosts
          .slice(0, 8)
          .map((p, i) => ({
            id: String(i),
            imageUrl: p.imageUrl ?? p.slideUrls[0] ?? "",
          }))
          .filter((p) => !!p.imageUrl);

        let transcripts: Array<{
          id: string;
          visible_text: string;
          scene: string;
        }> = [];
        if (postsForVision.length > 0) {
          try {
            const visionRes = await fetch("/api/post-transcripts", {
              method: "POST",
              headers: jsonWithAuth(session),
              body: JSON.stringify({ posts: postsForVision }),
            });
            if (visionRes.ok) {
              const body = await visionRes.json();
              if (Array.isArray(body?.transcripts))
                transcripts = body.transcripts;
            }
          } catch {
            /* best effort */
          }
        }

        setAnalyzePhase(4);
        const analysisRes = await fetch("/api/brand-analysis", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            bio: scraped.bio,
            recentPosts: scraped.recentPosts.slice(0, 12).map((p) => ({
              text: p.text,
              likes: p.likes,
              comments: p.comments,
              isCarousel: p.isCarousel,
            })),
            transcripts,
            handle: clean,
            platform: "instagram",
            followers: scraped.followers,
          }),
        });
        if (!analysisRes.ok) {
          const b = await analysisRes.json().catch(() => null);
          throw new Error(
            typeof b?.error === "string" ? b.error : "Falha na análise."
          );
        }
        const analysis = (await analysisRes.json()) as BrandAnalysisResult;
        setBrandAnalysis(analysis);
        setDnaNiches(analysis.detected_niche ?? []);
        setDnaTone(analysis.tone_detected ?? "casual");
        setDnaWho(
          analysis.who_you_are ??
            scraped.bio ??
            `${scraped.name ?? clean} — criador de conteúdo.`
        );
        setDnaAudience(analysis.suggested_audience ?? "");
        setDnaStyle(
          analysis.communication_style ??
            `Tom ${analysis.tone_detected}. Formato dominante: ${analysis.posting_frequency}.`
        );
        setDnaPillars((analysis.suggested_pillars ?? []).join(", "));
        setAnalyzePhase(6);
      } catch (err) {
        setAnalysisError(
          err instanceof Error ? err.message : "Erro inesperado."
        );
        setAnalyzePhase(0);
      } finally {
        setAnalyzing(false);
      }
    },
    [session]
  );

  // ─── Avatar upload ───
  const handlePickAvatar = () => fileInputRef.current?.click();

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem > 5MB. Usa uma menor.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result ?? "");
      setAvatarDataUrl(dataUrl);
      try {
        setAvatarUploading(true);
        const form = new FormData();
        form.append("file", file);
        form.append("carouselId", "profile");
        form.append("slideIndex", "0");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: authHeaders(session),
          body: form,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.url) {
          throw new Error(body?.error || "Upload falhou.");
        }
        setAvatarUploadedUrl(body.url);
        toast.success("Foto salva.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Upload falhou."
        );
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ─── Brand image refs (step visual) ───
  async function handleBrandRefsChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (brandImageRefs.length + files.length > 3) {
      toast.error("Máximo 3 imagens de referência.");
      return;
    }
    setBrandImageUploading(true);
    setAestheticError(null);
    try {
      const uploads = Array.from(files).map(async (file) => {
        if (!file.type.startsWith("image/")) {
          throw new Error(`"${file.name}" não é imagem.`);
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`"${file.name}" > 5MB.`);
        }
        const form = new FormData();
        form.append("file", file);
        form.append("carouselId", "brand-refs");
        form.append("slideIndex", String(Math.floor(Math.random() * 1_000_000)));
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: authHeaders(session),
          body: form,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.url) {
          throw new Error(body?.error || "Upload falhou.");
        }
        return body.url as string;
      });
      const urls = await Promise.all(uploads);
      const merged = [...brandImageRefs, ...urls].slice(0, 3);
      setBrandImageRefs(merged);
      toast.success(`${urls.length} referência(s) salva(s).`);
      // Se virou "custom", apaga selecao de preset pra UI ficar clara.
      setImageStyleId("custom");
      // Roda analise Gemini Vision em background.
      void analyzeAesthetic(merged);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload falhou.");
    } finally {
      setBrandImageUploading(false);
      if (brandRefsInputRef.current) brandRefsInputRef.current.value = "";
    }
  }

  function removeBrandRef(idx: number) {
    const next = brandImageRefs.filter((_, i) => i !== idx);
    setBrandImageRefs(next);
    if (next.length === 0) {
      // User removeu tudo — volta pra preset default.
      setImageStyleId("photo");
      setImageAesthetic(null);
      return;
    }
    void analyzeAesthetic(next);
  }

  const analyzeAesthetic = useCallback(
    async (urls: string[]) => {
      if (urls.length === 0) {
        setImageAesthetic(null);
        return;
      }
      setAestheticAnalyzing(true);
      setAestheticError(null);
      try {
        const res = await fetch("/api/brand-aesthetic", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({ imageUrls: urls }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : "Falha na análise."
          );
        }
        setImageAesthetic({
          description: String(body.aesthetic ?? ""),
          palette: Array.isArray(body.palette) ? body.palette : [],
          keywords: Array.isArray(body.keywords) ? body.keywords : [],
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        setAestheticError(
          err instanceof Error ? err.message : "Erro inesperado."
        );
      } finally {
        setAestheticAnalyzing(false);
      }
    },
    [session]
  );

  // ─── Ideas generation ───
  const regenIdeas = useCallback(async () => {
    setIdeasLoading(true);
    try {
      try {
        await updateProfile({ niche: dnaNiches, tone: dnaTone });
      } catch {
        /* best effort */
      }
      const res = await fetch("/api/suggestions?refresh=1", {
        method: "GET",
        headers: jsonWithAuth(session),
      });
      if (!res.ok) {
        setIdeas([]);
        return;
      }
      const body = (await res.json()) as { items?: Suggestion[] };
      setIdeas((body.items ?? []).slice(0, 6));
      setApprovedIdeas([]);
    } catch {
      setIdeas([]);
    } finally {
      setIdeasLoading(false);
    }
  }, [session, dnaNiches, dnaTone, updateProfile]);

  useEffect(() => {
    if (step === "ideas" && ideas.length === 0) void regenIdeas();
  }, [step, ideas.length, regenIdeas]);

  const toggleIdea = (idea: Suggestion) => {
    setApprovedIdeas((prev) => {
      const exists = prev.find((i) => i.id === idea.id);
      if (exists) return prev.filter((i) => i.id !== idea.id);
      if (prev.length >= 3) return prev;
      return [...prev, idea];
    });
  };

  // ─── Save profile + generate 3 carousels ───
  const generationStartedRef = useRef(false);
  useEffect(() => {
    if (step !== "generating" || generationStartedRef.current) return;
    generationStartedRef.current = true;
    void runGeneration();
    // Reset quando sair de "generating" — se user voltar ou remount, tenta
    // de novo em vez de skip silencioso.
    return () => {
      if (step !== "generating") generationStartedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function saveProfileBeforeGeneration() {
    const pillars = dnaPillars
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const validRefs = referencePosts
      .map((u) => u.trim())
      .filter(
        (u) => u.length > 0 && /^https?:\/\//i.test(u)
      );
    const brand: BrandAnalysis = {
      detected_niche: dnaNiches,
      tone_detected: dnaTone,
      top_topics: brandAnalysis?.top_topics ?? [],
      posting_frequency: brandAnalysis?.posting_frequency ?? "",
      avg_engagement:
        brandAnalysis?.avg_engagement ?? { likes: 0, comments: 0 },
      content_pillars: pillars,
      audience_description: dnaAudience,
      inspirations: [],
      voice_preference: "",
      voice_samples: [],
      tabus: [],
      content_rules: [],
      ...(validRefs.length > 0
        ? {
            __reference_posts: {
              urls: validRefs,
              addedAt: new Date().toISOString(),
            },
          }
        : {}),
      ...(imageAesthetic
        ? { __image_aesthetic: imageAesthetic }
        : {}),
    };
    await updateProfile({
      name: displayName || undefined,
      avatar_url:
        avatarUploadedUrl ||
        scrubInstagramCdn(scrapedProfile?.avatarUrl ?? "") ||
        "",
      instagram_handle: igHandle.replace(/^@/, ""),
      niche: dnaNiches,
      tone: dnaTone,
      carousel_style: designId,
      brand_colors: [colorHex],
      brand_image_refs: brandImageRefs.length > 0 ? brandImageRefs : undefined,
      onboarding_completed: true,
      brand_analysis: brand,
    });
  }

  async function runGeneration() {
    setSaving(true);
    try {
      await saveProfileBeforeGeneration();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao salvar perfil."
      );
      setSaving(false);
      return;
    }
    setSaving(false);

    // Gera exatamente quantos temas o user aprovou (min 1, max 3). Antes
    // era fixo em 3 — user reclamou que falhava com 1-2 selecionados.
    const pickedIdeas = approvedIdeas.slice(0, 3);
    if (pickedIdeas.length === 0) {
      goto("done");
      return;
    }

    // Pre-aloca UUIDs: se /api/generate falhar no meio do retry, o upsert
    // usa o mesmo id e NAO duplica carrossel na gallery.
    const randomId = (): string => {
      const g = globalThis as unknown as {
        crypto?: { randomUUID?: () => string };
      };
      if (g.crypto?.randomUUID) return g.crypto.randomUUID();
      // Fallback muito basico se crypto.randomUUID nao existir (Node < 19).
      return (
        Math.random().toString(36).slice(2, 10) +
        "-" +
        Math.random().toString(36).slice(2, 10) +
        "-" +
        Date.now().toString(36)
      );
    };
    const queue = pickedIdeas.map((idea) => ({
      idea,
      carouselId: randomId(),
    }));

    setGenProgress(
      queue.map(({ idea }) => ({
        title: idea.title,
        status: "queued" as const,
      }))
    );

    // Serializa: 3 chamadas em sequencia. Evita race da quota check atomica
    // no fallback non-RPC (3 paralelos podem ler usage_count<limit e todos
    // insertam, estourando o free tier).
    for (let i = 0; i < queue.length; i++) {
      const { idea, carouselId } = queue[i];
      setGenProgress((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: "running" } : p))
      );
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            topic: idea.title + (idea.angle ? ` — ${idea.angle}` : ""),
            sourceType: "idea",
            niche: dnaNiches[0] ?? "",
            tone: dnaTone,
            language: "pt-br",
            designTemplate: designId,
          }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => null);
          throw new Error(
            typeof b?.error === "string" ? b.error : "Falha na geração"
          );
        }
        const body = await res.json();
        if (supabase && user) {
          const slides = Array.isArray(body.slides) ? body.slides : [];
          const saved = await upsertUserCarousel(supabase, user.id, {
            id: carouselId,
            title: body.title || idea.title,
            slides,
            slideStyle: "white",
            status: "draft",
            designTemplate: designId,
            creationMode: "quick",
            accentOverride: colorHex,
          });
          setGenProgress((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, status: "done", carouselId: saved.row.id }
                : p
            )
          );
        }
      } catch (err) {
        setGenProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: "error" } : p))
        );
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error("[onboarding-generate] idea failed:", err);
        toast.error(
          `Carrossel "${idea.title.slice(0, 40)}${
            idea.title.length > 40 ? "…" : ""
          }" falhou: ${msg.slice(0, 80)}`
        );
      }
    }

    setTimeout(() => goto("done"), 600);
  }

  const canAdvanceAbout = displayName.trim().length >= 2;
  const progress = stepIndex(step) / (STEP_ORDER.length - 1);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--sv-paper)" }}
    >
      <TopBar progress={progress} step={step} />
      <main className="flex flex-1 items-start justify-center px-5 py-10 md:py-14">
        <div className="w-full max-w-[960px]">
          <AnimatePresence mode="wait">
            {step === "about" && (
              <StepAbout
                key="about"
                name={displayName}
                setName={setDisplayName}
                whatsapp={whatsapp}
                setWhatsapp={setWhatsapp}
                disabled={!canAdvanceAbout}
                onNext={() => goto("connect")}
              />
            )}
            {step === "connect" && (
              <StepConnect
                key="connect"
                session={session}
                handle={igHandle}
                setHandle={setIgHandle}
                onBack={() => goto("about")}
                onConnect={async () => {
                  goto("analyze");
                  await runAnalysis(igHandle);
                }}
                onMetaProfile={async (profile) => {
                  setIgHandle(profile.handle ?? "");
                  goto("analyze");
                  await runAnalysis("", profile);
                }}
                onSkip={() => goto("photo")}
              />
            )}
            {step === "analyze" && (
              <StepAnalyze
                key="analyze"
                phase={analyzePhase}
                scrapedProfile={scrapedProfile}
                analysis={brandAnalysis}
                analyzing={analyzing}
                error={analysisError}
                onRetry={() => runAnalysis(igHandle)}
                onBack={() => goto("connect")}
                onNext={() => goto("refs")}
              />
            )}
            {step === "refs" && (
              <StepRefs
                key="refs"
                urls={referencePosts}
                setUrls={setReferencePosts}
                onBack={() => goto("analyze")}
                onNext={() => goto("dna")}
              />
            )}
            {step === "dna" && (
              <StepDNA
                key="dna"
                scrapedProfile={scrapedProfile}
                analysis={brandAnalysis}
                niches={dnaNiches}
                setNiches={setDnaNiches}
                newNiche={newNiche}
                setNewNiche={setNewNiche}
                tone={dnaTone}
                setTone={setDnaTone}
                who={dnaWho}
                setWho={setDnaWho}
                audience={dnaAudience}
                setAudience={setDnaAudience}
                styleLine={dnaStyle}
                setStyleLine={setDnaStyle}
                pillars={dnaPillars}
                setPillars={setDnaPillars}
                onBack={() => goto("refs")}
                onNext={() => goto("photo")}
              />
            )}
            {step === "photo" && (
              <StepPhoto
                key="photo"
                onPick={handlePickAvatar}
                onChange={handleAvatarChange}
                fileInputRef={fileInputRef}
                preview={avatarDataUrl}
                uploading={avatarUploading}
                onBack={() => goto("dna")}
                onNext={() => goto("visual")}
              />
            )}
            {step === "visual" && (
              <StepVisual
                key="visual"
                colorHex={colorHex}
                setColorHex={setColorHex}
                imageStyleId={imageStyleId}
                setImageStyleId={setImageStyleId}
                designId={designId}
                setDesignId={setDesignId}
                brandImageRefs={brandImageRefs}
                onPickBrandRefs={() => brandRefsInputRef.current?.click()}
                onRemoveBrandRef={removeBrandRef}
                brandRefsInputRef={brandRefsInputRef}
                onBrandRefsChange={handleBrandRefsChange}
                brandImageUploading={brandImageUploading}
                imageAesthetic={imageAesthetic}
                aestheticAnalyzing={aestheticAnalyzing}
                aestheticError={aestheticError}
                onBack={() => goto("photo")}
                onNext={() => goto("ideas")}
              />
            )}
            {step === "ideas" && (
              <StepIdeas
                key="ideas"
                ideas={ideas}
                approvedIdeas={approvedIdeas}
                loading={ideasLoading}
                onToggle={toggleIdea}
                onRegen={regenIdeas}
                onBack={() => goto("visual")}
                onNext={() => goto("generating")}
              />
            )}
            {step === "generating" && (
              <StepGenerating
                key="gen"
                progress={genProgress}
                saving={saving}
              />
            )}
            {step === "done" && (
              <StepDone
                key="done"
                generated={
                  genProgress.filter((p) => p.status === "done").length
                }
                approvedIdeas={approvedIdeas}
                onGoDashboard={() => router.push("/app")}
                onGoCreate={() => router.push("/app/create/new")}
                firstCarouselId={
                  genProgress.find((p) => p.status === "done")?.carouselId ??
                  null
                }
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Top bar
// ──────────────────────────────────────────────────────────────────
function TopBar({ progress, step }: { progress: number; step: Step }) {
  const pct = Math.round(progress * 100);
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-5 md:px-10"
      style={{
        height: 60,
        background: "var(--sv-paper)",
        borderBottom: "1px solid rgba(10,10,10,.1)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: "var(--sv-green)",
            border: "1.5px solid var(--sv-ink)",
          }}
        >
          <Sparkles size={13} color="#0A0A0A" />
        </span>
        <span
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: 16,
            lineHeight: 1,
            color: "var(--sv-ink)",
          }}
        >
          Sequência <em className="italic">Viral</em>
        </span>
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--sv-muted)",
            paddingLeft: 12,
            borderLeft: "1px solid rgba(10,10,10,.15)",
            marginLeft: 12,
          }}
        >
          ONBOARDING {step.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-3 min-w-[180px]">
        <div
          className="flex-1"
          style={{
            height: 4,
            background: "rgba(10,10,10,0.1)",
            border: "1px solid var(--sv-ink)",
            minWidth: 120,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "var(--sv-ink)",
              transition: "width .4s",
            }}
          />
        </div>
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--sv-ink)",
            whiteSpace: "nowrap",
          }}
        >
          {step === "done" ? "100%" : `${pct}%`}
        </span>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────
// Atoms
// ──────────────────────────────────────────────────────────────────
function Card({
  children,
  pad = 28,
}: {
  children: React.ReactNode;
  pad?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      style={{
        padding: pad,
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "6px 6px 0 0 var(--sv-ink)",
      }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="sv-eyebrow mb-5 inline-flex">
      <span className="sv-dot" />
      {children}
    </span>
  );
}

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: "var(--sv-display)",
        fontSize: "clamp(32px, 4.4vw, 48px)",
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
        fontWeight: 400,
        color: "var(--sv-ink)",
        marginBottom: 12,
      }}
    >
      {children}
    </h1>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--sv-sans)",
        color: "var(--sv-muted)",
        fontSize: 15,
        lineHeight: 1.55,
        marginBottom: 28,
        maxWidth: 620,
      }}
    >
      {children}
    </p>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase mb-3"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 10,
        letterSpacing: "0.18em",
        color: "var(--sv-ink)",
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--sv-ink)",
          fontWeight: 700,
        }}
      >
        {label}
        {required && <span style={{ color: "var(--sv-pink)" }}> *</span>}
      </label>
      {children}
      {hint && (
        <span
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 12,
            color: "var(--sv-muted)",
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function Footer({
  back,
  primary,
  secondary,
}: {
  back?: { label: string; onClick: () => void };
  primary: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="mt-10 flex items-center justify-between gap-3"
      style={{ borderTop: "1.5px solid var(--sv-ink)", paddingTop: 20 }}
    >
      {back ? (
        <button
          onClick={back.onClick}
          className="sv-btn sv-btn-ghost"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          ← {back.label}
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        {secondary && (
          <button
            onClick={secondary.onClick}
            className="sv-btn sv-btn-ghost"
            style={{ padding: "10px 14px", fontSize: 11 }}
          >
            {secondary.label}
          </button>
        )}
        <button
          onClick={primary.onClick}
          disabled={primary.disabled || primary.loading}
          className="sv-btn sv-btn-primary"
          style={{
            padding: "14px 22px",
            fontSize: 12,
            opacity: primary.disabled || primary.loading ? 0.55 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {primary.loading && <Loader2 size={14} className="animate-spin" />}
          {primary.label}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: About
// ──────────────────────────────────────────────────────────────────
function StepAbout({
  name,
  setName,
  whatsapp,
  setWhatsapp,
  disabled,
  onNext,
}: {
  name: string;
  setName: (v: string) => void;
  whatsapp: string;
  setWhatsapp: (v: string) => void;
  disabled: boolean;
  onNext: () => void;
}) {
  return (
    <Card>
      <Eyebrow>● Passo 01 · Sobre você</Eyebrow>
      <H1>
        Vamos te <em className="italic">conhecer</em> rapidinho.
      </H1>
      <Sub>
        A gente precisa só do seu nome. Tudo que vem depois é gerado pela IA a
        partir do seu Instagram.
      </Sub>
      <div className="grid gap-4">
        <Field label="Como a gente te chama?" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="sv-input"
            style={{ padding: "12px 14px", fontSize: 14 }}
            autoFocus
          />
        </Field>
        <Field
          label="Telefone (opcional)"
          hint="Pra conseguirmos entrar em contato se precisar."
        >
          <div className="flex gap-2">
            <span
              className="flex items-center justify-center"
              style={{
                padding: "10px 12px",
                background: "var(--sv-white)",
                border: "1.5px solid var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                fontSize: 12,
              }}
            >
              🇧🇷 +55
            </span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 9 9999-9999"
              className="sv-input flex-1"
              style={{ padding: "12px 14px", fontSize: 14 }}
            />
          </div>
        </Field>
      </div>
      <Footer primary={{ label: "Avançar →", onClick: onNext, disabled }} />
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: Connect
// ──────────────────────────────────────────────────────────────────
function StepConnect({
  session,
  handle,
  setHandle,
  onConnect,
  onMetaProfile,
  onBack,
  onSkip,
}: {
  session: import("@supabase/supabase-js").Session | null;
  handle: string;
  setHandle: (v: string) => void;
  onConnect: () => void;
  onMetaProfile: (profile: ScrapedProfile) => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const clean = handle.replace(/^@/, "").trim();
  // FB Login escondido por enquanto — endpoints backend permanecem vivos
  // (Meta Live mode exige), mas botao nao aparece ate o flow estar testado.
  // Quando for ativar, reenable: const hasFbAppId = !!process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
  const hasFbAppId = false;
  return (
    <Card>
      <Eyebrow>● Passo 02 · Instagram</Eyebrow>
      <H1>
        Conecta o <em className="italic">Instagram</em>.
      </H1>
      <Sub>
        A gente lê seus últimos 20 posts, baixa as imagens, transcreve o texto
        dos slides e infere nicho, tom e público. Leva uns 30 segundos.
      </Sub>
      <div
        className="flex items-center gap-4 p-5"
        style={{
          background: "var(--sv-soft)",
          border: "1.5px solid var(--sv-ink)",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background:
              "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
            border: "1.5px solid var(--sv-ink)",
          }}
        >
          <Instagram size={24} color="#fff" />
        </div>
        <div className="flex-1">
          <div
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 22,
              color: "var(--sv-ink)",
              marginBottom: 4,
            }}
          >
            Seu @ do Instagram
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center justify-center"
              style={{
                width: 34,
                height: 38,
                borderRight: "1.5px solid var(--sv-ink)",
                fontFamily: "var(--sv-display)",
                fontSize: 16,
                color: "var(--sv-ink)",
                background: "var(--sv-white)",
                border: "1.5px solid var(--sv-ink)",
              }}
            >
              @
            </span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
              placeholder="seuhandle"
              className="sv-input flex-1"
              style={{ padding: "10px 12px", fontSize: 14 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && clean) onConnect();
              }}
            />
          </div>
        </div>
        <button
          onClick={onConnect}
          disabled={!clean}
          className="sv-btn sv-btn-primary"
          style={{
            padding: "14px 22px",
            fontSize: 12,
            opacity: clean ? 1 : 0.5,
          }}
        >
          Conectar →
        </button>
      </div>

      {hasFbAppId && (
        <div
          className="mt-5"
          style={{
            padding: 16,
            border: "1.5px dashed var(--sv-ink)",
            background: "rgba(24,119,242,0.04)",
          }}
        >
          <div
            className="uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "var(--sv-muted)",
              marginBottom: 10,
            }}
          >
            Alternativa · Instagram Business / Creator
          </div>
          <div
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 14,
              color: "var(--sv-ink)",
              marginBottom: 12,
            }}
          >
            Tem conta Business vinculada a uma Página Facebook? Conecta direto
            via Meta — mais rápido e não precisa scraper.
          </div>
          <FacebookLoginButton
            session={session}
            onSuccess={(profile) => onMetaProfile(profile)}
          />
        </div>
      )}

      <Footer
        back={{ label: "Voltar", onClick: onBack }}
        secondary={{ label: "Pular por enquanto", onClick: onSkip }}
        primary={{
          label: "Analisar →",
          onClick: onConnect,
          disabled: !clean,
        }}
      />
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: Analyze
// ──────────────────────────────────────────────────────────────────
function StepAnalyze({
  phase,
  scrapedProfile,
  analysis,
  analyzing,
  error,
  onRetry,
  onBack,
  onNext,
}: {
  phase: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  scrapedProfile: ScrapedProfile | null;
  analysis: BrandAnalysisResult | null;
  analyzing: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const steps = [
    { id: 1, label: "Importar posts" },
    { id: 2, label: "Ler bio e link" },
    { id: 3, label: "Ler imagens (OCR)" },
    { id: 4, label: "Analisar com IA" },
    { id: 5, label: "Montar DNA" },
  ];

  const displayPosts = scrapedProfile?.recentPosts.slice(0, 9) ?? [];

  return (
    <Card pad={0}>
      <div
        className="grid"
        style={{ gridTemplateColumns: "260px 1fr", minHeight: 540 }}
      >
        <aside
          style={{
            padding: 28,
            borderRight: "1.5px solid var(--sv-ink)",
            background: "var(--sv-soft)",
          }}
        >
          <Eyebrow>Análise IA</Eyebrow>
          <div className="flex flex-col gap-5">
            {steps.map((s) => {
              const done = phase > s.id;
              const active = phase === s.id;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      border: "1.5px solid var(--sv-ink)",
                      background: done
                        ? "var(--sv-green)"
                        : active
                          ? "var(--sv-white)"
                          : "transparent",
                    }}
                  >
                    {done ? (
                      <Check size={14} color="#0A0A0A" strokeWidth={2.5} />
                    ) : active ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                        style={{ color: "var(--sv-ink)" }}
                      />
                    ) : (
                      <span
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 11,
                          color: "var(--sv-muted)",
                        }}
                      >
                        {s.id}
                      </span>
                    )}
                  </span>
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      color:
                        active || done ? "var(--sv-ink)" : "var(--sv-muted)",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          {error && (
            <div
              className="mt-6"
              style={{
                padding: "12px 14px",
                border: "1.5px solid #C23A1E",
                background: "#FFE8E4",
                color: "#7A1D0D",
                fontFamily: "var(--sv-sans)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
          <button
            onClick={onBack}
            className="sv-btn sv-btn-ghost mt-6"
            style={{ padding: "8px 12px", fontSize: 11 }}
          >
            ← Voltar
          </button>
        </aside>

        <div style={{ padding: 28 }}>
          {scrapedProfile ? (
            <ProfileHeader sp={scrapedProfile} />
          ) : (
            <div
              className="animate-pulse"
              style={{
                height: 90,
                background: "var(--sv-soft)",
                border: "1.5px solid var(--sv-ink)",
              }}
            />
          )}

          <div
            className="mt-6 uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "var(--sv-muted)",
            }}
          >
            Posts analisados ({scrapedProfile?.recentPosts.length ?? 0})
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {Array.from({ length: 9 }).map((_, i) => {
              const post = displayPosts[i];
              const src = post ? proxyImage(post.imageUrl) : null;
              return (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1",
                    border: "1.5px solid var(--sv-ink)",
                    background: "var(--sv-soft)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={post?.text?.slice(0, 40) ?? ""}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse" />
                  )}
                  {post?.isCarousel && (
                    <span
                      className="uppercase"
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        padding: "2px 6px",
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        background: "rgba(10,10,10,0.8)",
                        color: "#fff",
                      }}
                    >
                      Carrossel
                    </span>
                  )}
                  {post && (
                    <span
                      className="uppercase"
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: "4px 6px",
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        background: "rgba(10,10,10,0.7)",
                        color: "#fff",
                      }}
                    >
                      ♥ {post.likes} · 💬 {post.comments}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="mt-8 flex items-center justify-between gap-3"
            style={{
              borderTop: "1.5px solid var(--sv-ink)",
              paddingTop: 16,
            }}
          >
            {error ? (
              <button
                onClick={onRetry}
                className="sv-btn sv-btn-ghost"
                style={{ padding: "10px 14px", fontSize: 11 }}
              >
                ↻ Tentar de novo
              </button>
            ) : (
              <span
                className="uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "var(--sv-muted)",
                }}
              >
                {analyzing
                  ? "Analisando..."
                  : analysis
                    ? "Análise pronta"
                    : "Aguardando..."}
              </span>
            )}
            <button
              onClick={onNext}
              disabled={!analysis && !error}
              className="sv-btn sv-btn-primary"
              style={{
                padding: "14px 22px",
                fontSize: 12,
                opacity: !analysis && !error ? 0.5 : 1,
              }}
            >
              {analysis ? "Ver meu DNA →" : "Continuar →"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: Refs (posts de referência — opcional, skippable)
// ──────────────────────────────────────────────────────────────────
function StepRefs({
  urls,
  setUrls,
  onBack,
  onNext,
}: {
  urls: string[];
  setUrls: (v: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function updateAt(i: number, v: string) {
    const next = [...urls];
    next[i] = v;
    setUrls(next);
  }
  // Aceita vazio (skip) ou ate 3 URLs validas. URL invalida bloqueia avancar
  // so se o campo foi preenchido — campo vazio eh ok.
  const normalized = urls.map((u) => u.trim());
  const invalid = normalized
    .map((u, i) => ({ u, i }))
    .filter(({ u }) => u.length > 0 && !/^https?:\/\//i.test(u));
  const canAdvance = invalid.length === 0;
  const filledCount = normalized.filter((u) => u.length > 0).length;
  return (
    <Card>
      <Eyebrow>● Passo extra · Referências</Eyebrow>
      <H1>
        Posts que você <em className="italic">ama</em>.
      </H1>
      <Sub>
        Cole até 3 posts que você se inspira (Instagram, LinkedIn, X). A IA
        usa como referência de estilo quando criar. Pode pular se não quiser.
      </Sub>

      <div className="grid gap-3">
        {urls.map((u, i) => {
          const invalidHere = u.trim().length > 0 && !/^https?:\/\//i.test(u.trim());
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <label
                className="uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "var(--sv-ink)",
                  fontWeight: 700,
                }}
              >
                Referência {i + 1}
              </label>
              <input
                type="url"
                value={u}
                onChange={(e) => updateAt(i, e.target.value)}
                placeholder="https://instagram.com/p/... ou linkedin.com/posts/..."
                className="sv-input"
                style={{
                  padding: "12px 14px",
                  fontSize: 13,
                  fontFamily: "var(--sv-mono)",
                  border: invalidHere
                    ? "1.5px solid #C23A1E"
                    : "1.5px solid var(--sv-ink)",
                  background: "var(--sv-white)",
                  outline: 0,
                }}
              />
              {invalidHere && (
                <span
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 12,
                    color: "#C23A1E",
                  }}
                >
                  Precisa começar com http:// ou https://
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="mt-6 flex items-center gap-2"
        style={{
          padding: "10px 14px",
          border: "1.5px dashed var(--sv-ink)",
          background: "var(--sv-soft)",
        }}
      >
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            color: "var(--sv-muted)",
          }}
        >
          {filledCount === 0
            ? "Nenhuma referência colada — pode pular"
            : `${filledCount} referência${filledCount === 1 ? "" : "s"} · salvas pra uso futuro`}
        </span>
      </div>

      <Footer
        back={{ label: "Voltar", onClick: onBack }}
        secondary={{ label: "Pular por enquanto", onClick: onNext }}
        primary={{
          label: "Próximo →",
          onClick: onNext,
          disabled: !canAdvance,
        }}
      />
    </Card>
  );
}

function ProfileHeader({ sp }: { sp: ScrapedProfile }) {
  const avatar = sp.avatarUrl ? proxyImage(sp.avatarUrl) : null;
  return (
    <div
      className="flex items-center gap-4"
      style={{
        padding: 18,
        border: "1.5px solid var(--sv-ink)",
        background: "var(--sv-white)",
      }}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt={sp.handle}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "1.5px solid var(--sv-ink)",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--sv-green)",
            border: "1.5px solid var(--sv-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--sv-display)",
            fontSize: 24,
            color: "var(--sv-ink)",
          }}
        >
          {(sp.name ?? sp.handle).slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: 20,
            color: "var(--sv-ink)",
          }}
        >
          {sp.name ?? `@${sp.handle}`}
        </div>
        <div
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 11,
            color: "var(--sv-muted)",
            letterSpacing: "0.1em",
          }}
        >
          @{sp.handle}
          {sp.followers != null && (
            <>
              {" · "}
              {sp.followers.toLocaleString("pt-BR")} seguidores
            </>
          )}
        </div>
        {sp.bio && (
          <p
            className="mt-2 truncate"
            style={{
              fontFamily: "var(--sv-sans)",
              fontSize: 13,
              color: "var(--sv-ink)",
            }}
          >
            {sp.bio}
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: DNA
// ──────────────────────────────────────────────────────────────────
function StepDNA(props: {
  scrapedProfile: ScrapedProfile | null;
  analysis: BrandAnalysisResult | null;
  niches: string[];
  setNiches: (v: string[]) => void;
  newNiche: string;
  setNewNiche: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  who: string;
  setWho: (v: string) => void;
  audience: string;
  setAudience: (v: string) => void;
  styleLine: string;
  setStyleLine: (v: string) => void;
  pillars: string;
  setPillars: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const {
    scrapedProfile,
    niches,
    setNiches,
    newNiche,
    setNewNiche,
    tone,
    setTone,
    who,
    setWho,
    audience,
    setAudience,
    styleLine,
    setStyleLine,
    pillars,
    setPillars,
    onBack,
    onNext,
  } = props;

  function addNiche(v: string) {
    const trimmed = v.trim();
    if (!trimmed) return;
    if (niches.includes(trimmed)) return;
    setNiches([...niches, trimmed].slice(0, 5));
    setNewNiche("");
  }

  return (
    <Card>
      <Eyebrow>● Passo 03 · DNA</Eyebrow>
      <H1>
        O que a gente <em className="italic">descobriu</em> sobre você.
      </H1>
      <Sub>
        Tudo foi inferido pela IA lendo bio, legendas e texto dos slides dos
        seus posts. Edita o que não bater — o resto a gente usa como verdade.
      </Sub>

      <div className="mb-6">
        <MiniLabel>Nichos detectados</MiniLabel>
        <div className="flex flex-wrap gap-2">
          {niches.map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-2 uppercase"
              style={{
                padding: "6px 12px",
                border: "1.5px solid var(--sv-ink)",
                background: "var(--sv-green)",
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.15em",
                fontWeight: 700,
                color: "var(--sv-ink)",
              }}
            >
              {n}
              <button
                onClick={() => setNiches(niches.filter((x) => x !== n))}
                style={{ cursor: "pointer" }}
                aria-label={`Remover ${n}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            value={newNiche}
            onChange={(e) => setNewNiche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNiche(newNiche);
              }
            }}
            placeholder="+ adicionar nicho"
            className="sv-input"
            style={{ padding: "6px 12px", fontSize: 12, minWidth: 180 }}
          />
        </div>
      </div>

      <div className="mb-6">
        <MiniLabel>Tom de voz</MiniLabel>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((t) => {
            const on = tone === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className="uppercase"
                style={{
                  padding: "8px 14px",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  fontWeight: 700,
                  background: on ? "var(--sv-pink)" : "var(--sv-white)",
                  color: "var(--sv-ink)",
                  border: "1.5px solid var(--sv-ink)",
                  cursor: "pointer",
                  boxShadow: on ? "3px 3px 0 0 var(--sv-ink)" : "none",
                  transform: on ? "translate(-1px, -1px)" : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {scrapedProfile?.followers != null && (
        <div className="mb-6">
          <MiniLabel>Alcance atual</MiniLabel>
          <span
            className="uppercase"
            style={{
              padding: "6px 12px",
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-white)",
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              fontWeight: 700,
              color: "var(--sv-ink)",
            }}
          >
            {scrapedProfile.followers.toLocaleString("pt-BR")} seguidores
          </span>
        </div>
      )}

      <div className="grid gap-4">
        <DnaField label="Quem você é" value={who} onChange={setWho} rows={4} />
        <DnaField
          label="Público-alvo"
          value={audience}
          onChange={setAudience}
          rows={4}
        />
        <DnaField
          label="Estilo de comunicação"
          value={styleLine}
          onChange={setStyleLine}
          rows={3}
        />
        <DnaField
          label="Pilares de conteúdo (separados por vírgula)"
          value={pillars}
          onChange={setPillars}
          rows={2}
        />
      </div>

      <Footer
        back={{ label: "Voltar", onClick: onBack }}
        primary={{ label: "Foto e identidade →", onClick: onNext }}
      />
    </Card>
  );
}

function DnaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--sv-ink)",
            fontWeight: 700,
          }}
        >
          {label}
        </label>
        <Pencil size={12} style={{ color: "var(--sv-muted)" }} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="sv-input"
        style={{
          padding: 14,
          fontFamily: "var(--sv-sans)",
          fontSize: 13,
          lineHeight: 1.55,
          background: "var(--sv-white)",
          border: "1.5px solid var(--sv-ink)",
          color: "var(--sv-ink)",
          resize: "vertical",
          outline: 0,
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: Photo upload
// ──────────────────────────────────────────────────────────────────
function StepPhoto({
  onPick,
  onChange,
  fileInputRef,
  preview,
  uploading,
  onBack,
  onNext,
}: {
  onPick: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  preview: string | null;
  uploading: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <Card>
      <Eyebrow>● Passo 04 · Foto de perfil</Eyebrow>
      <H1>
        Uma foto <em className="italic">sua</em>.
      </H1>
      <Sub>
        A foto aparece no cabeçalho dos carrosséis (template Twitter em
        especial). Instagram bloqueia hotlink da foto de perfil, por isso
        precisamos que você suba uma imagem aqui.
      </Sub>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onChange}
        hidden
      />

      <div className="flex flex-col items-center gap-5">
        <button
          onClick={onPick}
          disabled={uploading}
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            border: "2px dashed var(--sv-ink)",
            background: "var(--sv-soft)",
            overflow: "hidden",
            cursor: uploading ? "wait" : "pointer",
            position: "relative",
          }}
          aria-label="Escolher foto de perfil"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Foto de perfil"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <Upload size={28} color="#0A0A0A" />
              <span
                className="uppercase mt-2"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "var(--sv-ink)",
                }}
              >
                Escolher foto
              </span>
            </div>
          )}
          {uploading && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(10,10,10,0.5)" }}
            >
              <Loader2 size={28} className="animate-spin" color="#fff" />
            </div>
          )}
        </button>

        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--sv-muted)",
          }}
        >
          PNG, JPG ou WEBP — até 5MB
        </span>
      </div>

      <Footer
        back={{ label: "Voltar", onClick: onBack }}
        secondary={{ label: "Pular por enquanto", onClick: onNext }}
        primary={{
          label: "Próximo →",
          onClick: onNext,
          disabled: uploading,
        }}
      />
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: Visual
// ──────────────────────────────────────────────────────────────────
function StepVisual({
  colorHex,
  setColorHex,
  imageStyleId,
  setImageStyleId,
  designId,
  setDesignId,
  brandImageRefs,
  onPickBrandRefs,
  onRemoveBrandRef,
  brandRefsInputRef,
  onBrandRefsChange,
  brandImageUploading,
  imageAesthetic,
  aestheticAnalyzing,
  aestheticError,
  onBack,
  onNext,
}: {
  colorHex: string;
  setColorHex: (v: string) => void;
  imageStyleId: string;
  setImageStyleId: (v: string) => void;
  designId: DesignTemplateId;
  setDesignId: (v: DesignTemplateId) => void;
  brandImageRefs: string[];
  onPickBrandRefs: () => void;
  onRemoveBrandRef: (idx: number) => void;
  brandRefsInputRef: React.RefObject<HTMLInputElement | null>;
  onBrandRefsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  brandImageUploading: boolean;
  imageAesthetic: {
    description: string;
    palette?: string[];
    keywords?: string[];
    updatedAt?: string;
  } | null;
  aestheticAnalyzing: boolean;
  aestheticError: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  // Default = presets; se user subiu referencias, mostra custom mode.
  const [useCustomRefs, setUseCustomRefs] = useState(
    () => brandImageRefs.length > 0
  );
  // Sync externo — se referencias foram apagadas/adicionadas fora do toggle.
  useEffect(() => {
    if (brandImageRefs.length > 0 && !useCustomRefs) setUseCustomRefs(true);
  }, [brandImageRefs.length, useCustomRefs]);
  return (
    <Card>
      <Eyebrow>● Passo 05 · Identidade visual</Eyebrow>
      <H1>
        Escolha a <em className="italic">cara</em> dos posts.
      </H1>
      <Sub>
        Cor de destaque, estilo de imagem e design do carrossel. Você pode
        trocar qualquer um depois.
      </Sub>

      <div className="mb-8">
        <MiniLabel>Cor da marca</MiniLabel>
        <div className="flex flex-wrap items-center gap-3">
          {BRAND_COLORS.map((c) => {
            const on = colorHex.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.id}
                onClick={() => setColorHex(c.hex)}
                className="flex flex-col items-center"
                style={{ cursor: "pointer" }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: c.hex,
                    border: on
                      ? "3px solid var(--sv-ink)"
                      : "1.5px solid var(--sv-ink)",
                    boxShadow: on ? "3px 3px 0 0 var(--sv-ink)" : "none",
                    transform: on ? "translate(-1px, -1px)" : "none",
                  }}
                />
                <span
                  className="uppercase mt-1.5"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    color: on ? "var(--sv-ink)" : "var(--sv-muted)",
                    fontWeight: on ? 700 : 500,
                  }}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
          <div className="flex flex-col items-center">
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              style={{
                width: 44,
                height: 44,
                padding: 0,
                border: "1.5px solid var(--sv-ink)",
                background: "transparent",
                cursor: "pointer",
                borderRadius: "50%",
              }}
              aria-label="Escolher cor custom"
            />
            <span
              className="uppercase mt-1.5"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.15em",
                color: "var(--sv-muted)",
              }}
            >
              Custom
            </span>
          </div>
          <input
            type="text"
            value={colorHex}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === "") setColorHex(v);
            }}
            className="sv-input"
            style={{
              padding: "8px 12px",
              fontSize: 12,
              width: 120,
              fontFamily: "var(--sv-mono)",
            }}
            placeholder="#7CF067"
          />
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <MiniLabel>Estilo de imagem</MiniLabel>
          <button
            type="button"
            onClick={() => {
              // Toggle modo custom. Se desligar e tiver refs, nao apaga as
              // urls — so volta a mostrar os presets. User pode religar
              // que as imagens continuam la.
              setUseCustomRefs((v) => !v);
            }}
            className="uppercase"
            style={{
              padding: "6px 12px",
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.16em",
              fontWeight: 700,
              background: useCustomRefs ? "var(--sv-pink)" : "var(--sv-white)",
              color: "var(--sv-ink)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: useCustomRefs ? "2px 2px 0 0 var(--sv-ink)" : "none",
              cursor: "pointer",
            }}
          >
            {useCustomRefs ? "usando minhas refs" : "colar minhas próprias ↑"}
          </button>
        </div>

        {/* Input file escondido — controlado pelo ref do parent */}
        <input
          ref={brandRefsInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onBrandRefsChange}
          multiple
          hidden
        />

        {useCustomRefs ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => {
                const url = brandImageRefs[i];
                if (url) {
                  return (
                    <div
                      key={i}
                      className="relative"
                      style={{
                        aspectRatio: "1",
                        border: "1.5px solid var(--sv-ink)",
                        background: "var(--sv-soft)",
                        overflow: "hidden",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Referência ${i + 1}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveBrandRef(i)}
                        aria-label={`Remover referência ${i + 1}`}
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "var(--sv-ink)",
                          color: "#fff",
                          border: "1.5px solid var(--sv-ink)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={onPickBrandRefs}
                    disabled={brandImageUploading}
                    style={{
                      aspectRatio: "1",
                      border: "1.5px dashed var(--sv-ink)",
                      background: "var(--sv-soft)",
                      cursor: brandImageUploading ? "wait" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    {brandImageUploading ? (
                      <Loader2
                        size={22}
                        className="animate-spin"
                        style={{ color: "var(--sv-ink)" }}
                      />
                    ) : (
                      <Upload size={22} color="#0A0A0A" />
                    )}
                    <span
                      className="uppercase"
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        color: "var(--sv-ink)",
                      }}
                    >
                      {brandImageUploading ? "Enviando…" : "Adicionar"}
                    </span>
                  </button>
                );
              })}
            </div>

            {aestheticAnalyzing && (
              <div
                className="flex items-center gap-3"
                style={{
                  padding: "10px 14px",
                  border: "1.5px solid var(--sv-ink)",
                  background: "var(--sv-white)",
                }}
              >
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "var(--sv-ink)" }}
                />
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: "var(--sv-ink)",
                  }}
                >
                  Analisando suas referências…
                </span>
              </div>
            )}

            {imageAesthetic && !aestheticAnalyzing && (
              <div
                style={{
                  padding: "12px 16px",
                  border: "1.5px solid var(--sv-ink)",
                  background: "var(--sv-green)",
                  boxShadow: "3px 3px 0 0 var(--sv-ink)",
                }}
              >
                <div
                  className="uppercase mb-1.5"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    fontWeight: 700,
                    color: "var(--sv-ink)",
                  }}
                >
                  Estética detectada
                </div>
                <p
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--sv-ink)",
                  }}
                >
                  {imageAesthetic.description}
                </p>
                {imageAesthetic.palette &&
                  imageAesthetic.palette.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      {imageAesthetic.palette.slice(0, 6).map((hex, i) => (
                        <span
                          key={i}
                          title={hex}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: hex,
                            border: "1.5px solid var(--sv-ink)",
                          }}
                        />
                      ))}
                    </div>
                  )}
              </div>
            )}

            {aestheticError && (
              <div
                style={{
                  padding: "10px 14px",
                  border: "1.5px solid #C23A1E",
                  background: "#FFE8E4",
                  color: "#7A1D0D",
                  fontFamily: "var(--sv-sans)",
                  fontSize: 12,
                }}
              >
                Não consegui analisar as referências: {aestheticError}
              </div>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {IMAGE_STYLES.map((s) => {
            const on = imageStyleId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setImageStyleId(s.id)}
                className="text-left flex flex-col"
                style={{
                  padding: 0,
                  background: "var(--sv-white)",
                  border: "1.5px solid var(--sv-ink)",
                  boxShadow: on ? "4px 4px 0 0 var(--sv-ink)" : "none",
                  transform: on ? "translate(-1px, -1px)" : "none",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: 120,
                    position: "relative",
                    overflow: "hidden",
                    background: "var(--sv-soft)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.preview}
                    alt={s.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  {on && (
                    <span
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--sv-green)",
                        border: "1.5px solid var(--sv-ink)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={11} color="var(--sv-ink)" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div
                  style={{
                    padding: 14,
                    background: on ? "var(--sv-green)" : "var(--sv-white)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--sv-ink)",
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="uppercase"
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      color: "var(--sv-muted)",
                      marginTop: 4,
                    }}
                  >
                    {s.desc}
                  </div>
                </div>
              </button>
            );
          })}
          </div>
        )}
      </div>

      <div className="mb-2">
        <MiniLabel>Design do carrossel</MiniLabel>
        <div className="grid sm:grid-cols-2 gap-3">
          <DesignCard
            id="manifesto"
            label="Futurista"
            desc="Navy, grids finos, tipografia display de impacto"
            accent={colorHex}
            on={designId === "manifesto"}
            onClick={() => setDesignId("manifesto")}
          />
          <DesignCard
            id="twitter"
            label="Twitter"
            desc="Tweet no slide, avatar e bio no topo"
            accent={colorHex}
            on={designId === "twitter"}
            onClick={() => setDesignId("twitter")}
          />
        </div>
      </div>

      <Footer
        back={{ label: "Voltar", onClick: onBack }}
        primary={{ label: "Ver ideias →", onClick: onNext }}
      />
    </Card>
  );
}

function DesignCard({
  id,
  label,
  desc,
  accent,
  on,
  onClick,
}: {
  id: "manifesto" | "twitter";
  label: string;
  desc: string;
  accent: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left"
      style={{
        padding: 0,
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: on ? "4px 4px 0 0 var(--sv-ink)" : "none",
        transform: on ? "translate(-1px, -1px)" : "none",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {id === "manifesto" ? (
        <div
          style={{
            height: 200,
            background:
              "radial-gradient(circle at 30% 20%, #1a2142 0%, #0B0F1E 70%)",
            padding: 20,
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* grid lines sutis ao fundo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              opacity: 0.5,
              pointerEvents: "none",
            }}
          />
          <div className="flex items-center justify-between relative">
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.22em",
                color: accent,
                fontWeight: 700,
              }}
            >
              MANIFESTO // 01
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: accent,
                boxShadow: `0 0 12px ${accent}`,
              }}
            />
          </div>
          <div className="relative">
            <div
              style={{
                fontFamily: "var(--sv-display)",
                fontSize: 28,
                lineHeight: 1.05,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              A máquina já <em className="italic" style={{ color: accent }}>
                aprendeu
              </em>.
            </div>
            <span
              className="uppercase mt-3 inline-block"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 8,
                letterSpacing: "0.22em",
                color: "rgba(255,255,255,.5)",
              }}
            >
              @SEUHANDLE · 01 / 05
            </span>
          </div>
          <span
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              height: 4,
              background: accent,
            }}
          />
        </div>
      ) : (
        <div
          style={{
            height: 200,
            background: "#F7F5EF",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            color: "var(--sv-ink)",
            position: "relative",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: accent,
                border: "1.5px solid var(--sv-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--sv-display)",
                fontSize: 14,
                color: "var(--sv-ink)",
              }}
            >
              @
            </span>
            <div className="flex flex-col">
              <span
                className="flex items-center gap-1"
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontWeight: 700,
                  fontSize: 12,
                  color: "var(--sv-ink)",
                }}
              >
                Seu Nome
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill={accent}
                  style={{ display: "inline" }}
                >
                  <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-4-3.818-4-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5c-1.51 0-2.816.917-3.437 2.25-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .495.083.965.237 1.4-1.272.65-2.147 2.02-2.147 3.6 0 1.58.875 2.95 2.147 3.6-.154.435-.237.905-.237 1.4 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.336-.25.62 1.334 1.926 2.25 3.437 2.25 1.51 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.495-.084-.965-.237-1.4 1.272-.65 2.147-2.02 2.147-3.6zm-11.79 3.375L6.25 12.5l1.708-1.75 2.002 1.998 4.666-4.916L16.5 9.75l-5.78 6.125z" />
                </svg>
              </span>
              <span
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  color: "var(--sv-muted)",
                }}
              >
                @seuhandle
              </span>
            </div>
          </div>
          <p
            style={{
              fontFamily: "var(--sv-sans)",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--sv-ink)",
            }}
          >
            O tweet vira slide. 3 linhas por card, design limpo, avatar e handle
            como assinatura.
          </p>
          <div
            className="flex items-center gap-4 mt-auto"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              color: "var(--sv-muted)",
            }}
          >
            <span>♥ 1,2k</span>
            <span>🔁 324</span>
            <span>💬 87</span>
          </div>
          <span
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              height: 4,
              background: accent,
            }}
          />
        </div>
      )}
      <div
        style={{
          padding: 14,
          background: on ? "var(--sv-green)" : "var(--sv-white)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--sv-display)",
            fontSize: 20,
            color: "var(--sv-ink)",
          }}
        >
          {label}
        </div>
        <div
          className="uppercase mt-1"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.14em",
            color: "var(--sv-muted)",
          }}
        >
          {desc}
        </div>
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: Ideas
// ──────────────────────────────────────────────────────────────────
function StepIdeas({
  ideas,
  approvedIdeas,
  loading,
  onToggle,
  onRegen,
  onBack,
  onNext,
}: {
  ideas: Suggestion[];
  approvedIdeas: Suggestion[];
  loading: boolean;
  onToggle: (idea: Suggestion) => void;
  onRegen: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const approvedCount = approvedIdeas.length;
  const approvedIds = new Set(approvedIdeas.map((i) => i.id));
  return (
    <Card>
      <Eyebrow>● Passo 06 · Ideias</Eyebrow>
      <H1>
        Escolha <em className="italic">até 3 temas</em> pra virar carrossel.
      </H1>
      <Sub>
        Geradas em cima do DNA que você acabou de validar. A gente cria de 1 a
        3 carrosséis de verdade agora — você decide quantos.
      </Sub>

      <div
        className="flex items-center gap-3 mb-5"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        <div
          className="flex-1"
          style={{
            height: 5,
            background: "rgba(10,10,10,0.1)",
            border: "1px solid var(--sv-ink)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(approvedCount / 3) * 100}%`,
              background: "var(--sv-green)",
              transition: "width .3s",
            }}
          />
        </div>
        <span>{approvedCount} de 3 (min 1)</span>
      </div>

      {loading && ideas.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            height: 280,
            border: "1.5px solid var(--sv-ink)",
            background: "var(--sv-soft)",
          }}
        >
          <Loader2
            size={22}
            className="animate-spin"
            style={{ color: "var(--sv-ink)" }}
          />
          <span
            className="uppercase mt-3"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--sv-ink)",
            }}
          >
            Gerando com base no seu DNA…
          </span>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {ideas.slice(0, 6).map((idea) => {
            const selected = approvedIds.has(idea.id);
            const canSelect = selected || approvedCount < 3;
            return (
              <button
                key={idea.id}
                onClick={() => canSelect && onToggle(idea)}
                disabled={!canSelect}
                className="text-left"
                style={{
                  padding: 18,
                  background: selected ? "var(--sv-green)" : "var(--sv-white)",
                  border: "1.5px solid var(--sv-ink)",
                  boxShadow: selected ? "4px 4px 0 0 var(--sv-ink)" : "none",
                  transform: selected ? "translate(-1px, -1px)" : "none",
                  cursor: canSelect ? "pointer" : "not-allowed",
                  opacity: canSelect ? 1 : 0.4,
                  position: "relative",
                  transition: "transform .15s, box-shadow .15s",
                  minHeight: 150,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "1.5px solid var(--sv-ink)",
                    background: selected ? "var(--sv-ink)" : "var(--sv-white)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && (
                    <Check size={12} color="#fff" strokeWidth={3} />
                  )}
                </div>
                <div
                  className="uppercase"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: "var(--sv-muted)",
                    paddingRight: 30,
                  }}
                >
                  {idea.style ?? "Carrossel"}
                </div>
                <h3
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 18,
                    lineHeight: 1.2,
                    color: "var(--sv-ink)",
                    paddingRight: 10,
                  }}
                >
                  {idea.title}
                </h3>
                {idea.angle && (
                  <p
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontSize: 12,
                      color: "var(--sv-muted)",
                      lineHeight: 1.45,
                    }}
                  >
                    {idea.angle}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="mt-8 flex items-center justify-between gap-3"
        style={{ borderTop: "1.5px solid var(--sv-ink)", paddingTop: 20 }}
      >
        <button
          onClick={onBack}
          className="sv-btn sv-btn-ghost"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          ← Voltar
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegen}
            disabled={loading}
            className="sv-btn sv-btn-ghost"
            style={{
              padding: "10px 14px",
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            aria-label="Regerar"
          >
            <RefreshCw size={12} /> Regerar
          </button>
          <button
            onClick={onNext}
            disabled={approvedCount < 1}
            className="sv-btn sv-btn-primary"
            style={{
              padding: "14px 22px",
              fontSize: 12,
              opacity: approvedCount < 1 ? 0.5 : 1,
            }}
          >
            {approvedCount >= 1
              ? `Gerar ${approvedCount} carrossel${
                  approvedCount === 1 ? "" : "éis"
                } →`
              : "Escolhe pelo menos 1"}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: Generating
// ──────────────────────────────────────────────────────────────────
function StepGenerating({
  progress,
  saving,
}: {
  progress: Array<{
    title: string;
    status: "queued" | "running" | "done" | "error";
    carouselId?: string;
  }>;
  saving: boolean;
}) {
  const n = progress.length;
  return (
    <Card>
      <Eyebrow>● Passo 07 · Gerando</Eyebrow>
      <H1>
        Criando seu{n === 1 ? "" : "s"}{" "}
        <em className="italic">
          {n || 1} carrossel{n === 1 ? "" : "éis"}
        </em>
        .
      </H1>
      <Sub>
        A gente gera cada um com o DNA que você validou, as pilares, o tom e a
        identidade visual. Leva uns 30-60 segundos por peça.
      </Sub>

      <div className="flex flex-col gap-3">
        {saving && (
          <div
            className="flex items-center gap-3"
            style={{
              padding: "12px 16px",
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-soft)",
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
              }}
            >
              Salvando DNA…
            </span>
          </div>
        )}
        {progress.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-4"
            style={{
              padding: "14px 18px",
              border: "1.5px solid var(--sv-ink)",
              background:
                p.status === "done"
                  ? "var(--sv-green)"
                  : p.status === "error"
                    ? "#FFE8E4"
                    : "var(--sv-white)",
            }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1.5px solid var(--sv-ink)",
                background:
                  p.status === "done"
                    ? "var(--sv-ink)"
                    : p.status === "error"
                      ? "#C23A1E"
                      : "var(--sv-white)",
              }}
            >
              {p.status === "done" ? (
                <Check size={14} color="#7CF067" strokeWidth={2.5} />
              ) : p.status === "running" ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "var(--sv-ink)" }}
                />
              ) : p.status === "error" ? (
                <X size={14} color="#fff" />
              ) : (
                <span
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 11,
                    color: "var(--sv-muted)",
                  }}
                >
                  {i + 1}
                </span>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--sv-ink)",
                }}
              >
                {p.title}
              </div>
              <div
                className="uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  color: "var(--sv-muted)",
                }}
              >
                {p.status === "done"
                  ? "Pronto"
                  : p.status === "running"
                    ? "Gerando…"
                    : p.status === "error"
                      ? "Falhou — criar depois"
                      : "Na fila"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step: Done
// ──────────────────────────────────────────────────────────────────
function StepDone({
  generated,
  onGoDashboard,
  onGoCreate,
  firstCarouselId,
  approvedIdeas,
}: {
  generated: number;
  onGoDashboard: () => void;
  onGoCreate: () => void;
  firstCarouselId: string | null;
  approvedIdeas: Suggestion[];
}) {
  const [showPaywall, setShowPaywall] = useState(false);

  if (showPaywall) {
    return (
      <Card>
        <Eyebrow>● Último passo · Plano</Eyebrow>
        <H1>
          <em className="italic">Destrave</em> a sequência inteira.
        </H1>
        <Sub>
          Os 3 primeiros carrosséis já consumiram o limite gratuito. Pra
          continuar publicando no ritmo certo, escolha um plano.
        </Sub>

        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div
            style={{
              padding: 22,
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-white)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--sv-muted)",
              }}
            >
              Creator
            </span>
            <div
              style={{
                fontFamily: "var(--sv-display)",
                fontSize: 32,
                color: "var(--sv-ink)",
              }}
            >
              R$ 99,90<span style={{ fontSize: 14 }}>/mês</span>
            </div>
            <ul
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 13,
                color: "var(--sv-ink)",
                paddingLeft: 18,
                listStyle: "disc",
                lineHeight: 1.6,
              }}
            >
              <li>10 carrosséis / mês</li>
              <li>Até 12 slides por carrossel</li>
              <li>Todos os templates</li>
              <li>Edição ilimitada</li>
            </ul>
          </div>
          <div
            style={{
              padding: 22,
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-green)",
              boxShadow: "4px 4px 0 0 var(--sv-ink)",
              transform: "translate(-1px, -1px)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              position: "relative",
            }}
          >
            <span
              className="uppercase"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: "var(--sv-ink)",
                color: "#fff",
                padding: "3px 8px",
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.18em",
                fontWeight: 700,
              }}
            >
              Popular
            </span>
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--sv-ink)",
              }}
            >
              Pro
            </span>
            <div
              style={{
                fontFamily: "var(--sv-display)",
                fontSize: 32,
                color: "var(--sv-ink)",
              }}
            >
              R$ 97<span style={{ fontSize: 14 }}>/mês</span>
            </div>
            <ul
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 13,
                color: "var(--sv-ink)",
                paddingLeft: 18,
                listStyle: "disc",
                lineHeight: 1.6,
              }}
            >
              <li>30 carrosséis / mês</li>
              <li>Até 12 slides por carrossel</li>
              <li>Imagens IA + stock + cache</li>
              <li>Suporte prioritário</li>
            </ul>
          </div>
        </div>

        <div
          className="mt-8 flex items-center justify-between gap-3"
          style={{ borderTop: "1.5px solid var(--sv-ink)", paddingTop: 20 }}
        >
          <button
            onClick={onGoDashboard}
            className="sv-btn sv-btn-ghost"
            style={{ padding: "10px 14px", fontSize: 11 }}
          >
            Continuar grátis por enquanto
          </button>
          <button
            onClick={() => (window.location.href = "/app/plans")}
            className="sv-btn sv-btn-primary"
            style={{ padding: "14px 22px", fontSize: 12 }}
          >
            Ver planos completos →
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Eyebrow>● Passo 08 · Pronto</Eyebrow>
      <H1>
        <em className="italic">Pronto.</em> {generated} carrossel
        {generated === 1 ? "" : "éis"} gerado{generated === 1 ? "" : "s"}.
      </H1>
      <Sub>
        Cada um já está no seu editor com slides, título e imagem. Abre, refina
        o texto e posta.
      </Sub>

      {approvedIdeas.length > 0 && (
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1"
          style={{ marginBottom: 10 }}
        >
          {approvedIdeas.slice(0, 3).map((idea, i) => (
            <div
              key={idea.id}
              style={{
                padding: 14,
                border: "1.5px solid var(--sv-ink)",
                background: "var(--sv-white)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minHeight: 140,
              }}
            >
              <span
                className="uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--sv-muted)",
                }}
              >
                Carrossel {i + 1}
              </span>
              <h4
                style={{
                  fontFamily: "var(--sv-display)",
                  fontSize: 16,
                  lineHeight: 1.2,
                  color: "var(--sv-ink)",
                }}
              >
                {idea.title}
              </h4>
              {idea.angle && (
                <p
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 11,
                    color: "var(--sv-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {idea.angle.slice(0, 100)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className="flex flex-col gap-3 mt-2"
        style={{
          padding: 18,
          background: "var(--sv-soft)",
          border: "1.5px solid var(--sv-ink)",
        }}
      >
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--sv-ink)",
          }}
        >
          Heads up
        </span>
        <span
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
            color: "var(--sv-ink)",
          }}
        >
          Esses 3 carrosséis já consumiram seu limite gratuito. Continuar
          publicando com frequência = plano Creator ou Pro.
        </span>
      </div>

      <div
        className="mt-8 flex items-center justify-between gap-3"
        style={{ borderTop: "1.5px solid var(--sv-ink)", paddingTop: 20 }}
      >
        <button
          onClick={
            firstCarouselId
              ? () =>
                  (window.location.href = `/app/create/${firstCarouselId}/edit`)
              : onGoCreate
          }
          className="sv-btn sv-btn-ghost"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          Editar primeiro carrossel
        </button>
        <button
          onClick={() => setShowPaywall(true)}
          className="sv-btn sv-btn-primary"
          style={{ padding: "14px 22px", fontSize: 12 }}
        >
          Continuar →
        </button>
      </div>
    </Card>
  );
}
