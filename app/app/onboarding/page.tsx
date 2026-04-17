"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import type { BrandAnalysis } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import {
  User,
  AtSign,
  Palette,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Link as LinkIcon,
  Loader2,
  X,
  Plus,
  BarChart3,
  MessageSquareQuote,
  Mic2,
  TrendingUp,
  Target,
  Users,
  Pencil,
} from "lucide-react";
import Loader from "@/components/kokonutui/loader";
import AITextLoading from "@/components/kokonutui/ai-text-loading";

// ──────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────

const TONES = [
  { value: "professional", label: "Profissional", emoji: "👔", desc: "Limpo, autoritário, polido" },
  { value: "casual", label: "Casual", emoji: "😎", desc: "Amigável, conversacional, próximo" },
  { value: "provocative", label: "Provocativo", emoji: "🔥", desc: "Ousado, chama atenção, direto" },
  { value: "educational", label: "Educacional", emoji: "🧠", desc: "Claro, estruturado, didático" },
];

const LANGUAGES = [
  { value: "pt-br", label: "Português (BR)", flag: "🇧🇷" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "es", label: "Español", flag: "🇪🇸" },
];

const STYLES = [
  { value: "white", label: "Claro", preview: "bg-[#FFFDF9] border-[#0A0A0A]" },
  { value: "dark", label: "Escuro", preview: "bg-[#0A0A0A] border-[#0A0A0A]" },
];

const NICHE_SUGGESTIONS = [
  "Marketing",
  "IA & Automação",
  "Cripto",
  "Finanças",
  "Educação",
  "Produtividade",
  "Saúde",
  "Fitness",
  "Design",
  "Tech",
  "Negócios",
  "Comportamento",
];

const STEP_ICONS = [AtSign, BarChart3, Palette, Mic2, Sparkles];
const STEP_LABELS = ["Redes", "Análise", "Preferências", "Voz", "Começar"];

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface RecentPost {
  text: string;
  likes: number;
  comments: number;
}

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
}

interface VoiceSample {
  tone: string;
  label: string;
  emoji: string;
  hook: string;
  preview: string;
}

interface OnboardingData {
  name: string;
  avatar_url: string;
  twitter_handle: string;
  instagram_handle: string;
  linkedin_url: string;
  niche: string[];
  tone: string;
  language: string;
  carousel_style: string;
  bio?: string;
  content_pillars: string[];
  audience_description: string;
  inspirations: string[];
  voice_preference: string;
}

function initialData(): OnboardingData {
  return {
    name: "",
    avatar_url: "",
    twitter_handle: "",
    instagram_handle: "",
    linkedin_url: "",
    niche: [],
    tone: "casual",
    language: "pt-br",
    carousel_style: "white",
    content_pillars: [],
    audience_description: "",
    inspirations: [],
    voice_preference: "",
  };
}

function loadSavedData(): OnboardingData {
  if (typeof window === "undefined") return initialData();
  try {
    const saved = localStorage.getItem("sequencia-viral_onboarding");
    if (saved) return { ...initialData(), ...JSON.parse(saved) };
  } catch {
    // ignore
  }
  return initialData();
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, user, session, updateProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProfile, setScrapedProfile] = useState<ScrapedProfile | null>(null);
  const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysisResult | null>(null);
  const [analyzingBrand, setAnalyzingBrand] = useState(false);
  const [voiceSamples, setVoiceSamples] = useState<VoiceSample[]>([]);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [data, setData] = useState<OnboardingData>(() => {
    const saved = loadSavedData();
    if (profile) {
      if (!saved.name && profile.name) saved.name = profile.name;
      if (!saved.avatar_url && profile.avatar_url) saved.avatar_url = profile.avatar_url;
    }
    if (user?.user_metadata) {
      const meta = user.user_metadata;
      if (!saved.name && meta.full_name) saved.name = meta.full_name;
      if (!saved.avatar_url && meta.avatar_url) saved.avatar_url = meta.avatar_url;
    }
    return saved;
  });

  const update = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("sequencia-viral_onboarding", JSON.stringify(next));
      return next;
    });
  }, []);

  // Scrape profile + run brand analysis
  async function pullProfile(platform: "twitter" | "instagram", handle: string) {
    if (!handle.trim()) {
      setScrapeError("Digite um handle para buscar.");
      return;
    }
    setScraping(true);
    setScrapeError(null);
    try {
      const res = await fetch("/api/profile-scraper", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({ platform, handle: handle.replace(/^@/, "") }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(
          typeof errBody?.error === "string"
            ? errBody.error
            : "Não consegui buscar esse perfil agora."
        );
      }
      const p: ScrapedProfile = await res.json();
      setScrapedProfile(p);

      const niches: string[] = [];
      if (p.niche && typeof p.niche === "string") niches.push(p.niche);

      update({
        name: p.name || data.name,
        avatar_url: p.avatarUrl || data.avatar_url,
        bio: p.bio || data.bio,
        twitter_handle: platform === "twitter" ? handle.replace(/^@/, "") : data.twitter_handle,
        instagram_handle: platform === "instagram" ? handle.replace(/^@/, "") : data.instagram_handle,
        niche: niches.length ? Array.from(new Set([...data.niche, ...niches])) : data.niche,
      });

      setScraping(false);

      // Auto-trigger brand analysis
      if (p.recentPosts && p.recentPosts.length > 0) {
        setAnalyzingBrand(true);
        try {
          const analysisRes = await fetch("/api/brand-analysis", {
            method: "POST",
            headers: jsonWithAuth(session),
            body: JSON.stringify({
              bio: p.bio,
              recentPosts: p.recentPosts,
              handle: handle.replace(/^@/, ""),
              platform,
              followers: p.followers,
            }),
          });
          if (analysisRes.ok) {
            const analysis: BrandAnalysisResult = await analysisRes.json();
            setBrandAnalysis(analysis);

            // Pre-fill data from analysis
            const detectedNiches = analysis.detected_niche || [];
            const detectedTone = analysis.tone_detected || data.tone;
            update({
              niche: Array.from(new Set([...data.niche, ...niches, ...detectedNiches])),
              tone: detectedTone,
              content_pillars: analysis.suggested_pillars || [],
              audience_description: analysis.suggested_audience || "",
            });
          }
        } catch (e) {
          console.warn("[onboarding] Brand analysis failed:", e);
        } finally {
          setAnalyzingBrand(false);
        }
      }

      // Jump to step 1 (brand analysis)
      setDirection(1);
      setStep(1);
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Erro ao buscar perfil.");
      setScraping(false);
    }
  }

  function next() {
    if (step < 4) {
      setDirection(1);
      setStep(step + 1);
    }
  }

  function prev() {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  }

  // Load voice samples when entering step 3
  useEffect(() => {
    if (step === 3 && voiceSamples.length === 0 && !loadingVoice) {
      setLoadingVoice(true);
      const topics = brandAnalysis?.top_topics || data.niche;
      fetch("/api/voice-samples", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          niche: data.niche,
          topics,
          language: data.language,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((result) => {
          if (result?.samples) setVoiceSamples(result.samples);
        })
        .catch(() => {})
        .finally(() => setLoadingVoice(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function finish(mode: "ideas" | "link") {
    const brand: BrandAnalysis = {
      detected_niche: brandAnalysis?.detected_niche || data.niche,
      tone_detected: brandAnalysis?.tone_detected || data.tone,
      top_topics: brandAnalysis?.top_topics || [],
      posting_frequency: brandAnalysis?.posting_frequency || "",
      avg_engagement: brandAnalysis?.avg_engagement || { likes: 0, comments: 0 },
      content_pillars: data.content_pillars,
      audience_description: data.audience_description,
      inspirations: data.inspirations,
      voice_preference: data.voice_preference,
    };

    await updateProfile({
      name: data.name,
      avatar_url: data.avatar_url,
      twitter_handle: data.twitter_handle,
      instagram_handle: data.instagram_handle,
      linkedin_url: data.linkedin_url,
      niche: data.niche,
      tone: data.tone,
      language: data.language,
      carousel_style: data.carousel_style,
      onboarding_completed: true,
      brand_analysis: brand,
    });
    localStorage.removeItem("sequencia-viral_onboarding");
    router.push(`/app?action=create&source=${mode}`);
  }

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center hero-kree8-bg grain px-4 py-12">
      {/* Full-screen loader overlay during scraping */}
      <AnimatePresence>
        {(scraping || analyzingBrand) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FAFAF8]/95 backdrop-blur-md"
          >
            <Loader
              size="lg"
              title={scraping ? "Lendo seu perfil" : "Analisando seu perfil"}
              subtitle={
                scraping
                  ? "Puxando nome, foto, bio e os temas que você costuma falar"
                  : "Detectando nicho, tom de voz, tópicos e engajamento"
              }
            />
            <div className="mt-4">
              <AITextLoading
                className="!text-xl"
                texts={
                  scraping
                    ? [
                        "Buscando seu perfil...",
                        "Lendo seus ultimos posts...",
                        "Entendendo seu nicho...",
                        "Quase pronto...",
                      ]
                    : [
                        "Analisando seu perfil...",
                        "Detectando seu nicho...",
                        "Lendo o tom dos seus posts...",
                        "Mapeando topicos recorrentes...",
                        "Calculando engajamento medio...",
                        "Quase pronto...",
                      ]
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] border border-[#0A0A0A]"
          style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="editorial-serif text-3xl text-[#0A0A0A]">
          Sequência Viral<span className="text-[var(--accent)]">.</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-10 w-full max-w-xl">
        <div className="flex items-center justify-between mb-4">
          {STEP_LABELS.map((label, i) => {
            const Icon = STEP_ICONS[i];
            const active = i <= step;
            return (
              <div key={label} className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ scale: i === step ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-300 ${
                    i < step
                      ? "bg-[var(--accent)] text-white border-[#0A0A0A]"
                      : i === step
                      ? "bg-[#FFFDF9] text-[var(--accent)] border-[#0A0A0A]"
                      : "bg-[#FFFDF9] text-[var(--muted)] border-[#0A0A0A]/20"
                  }`}
                  style={active ? { boxShadow: "3px 3px 0 0 #0A0A0A" } : {}}
                >
                  {i < step ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <Icon size={18} />
                  )}
                </motion.div>
                <span
                  className={`text-[10px] font-mono uppercase tracking-widest transition-colors ${
                    active ? "text-[#0A0A0A]" : "text-[var(--muted)]"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step cards */}
      <div className="w-full max-w-xl overflow-visible">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="card-offset p-8 md:p-10">
              {step === 0 && (
                <StepSocial
                  data={data}
                  pullProfile={pullProfile}
                  scraping={scraping}
                  scrapeError={scrapeError}
                />
              )}
              {step === 1 && (
                <StepBrandIntelligence
                  data={data}
                  update={update}
                  scrapedProfile={scrapedProfile}
                  brandAnalysis={brandAnalysis}
                  analyzingBrand={analyzingBrand}
                />
              )}
              {step === 2 && (
                <StepPreferences
                  data={data}
                  update={update}
                  brandAnalysis={brandAnalysis}
                />
              )}
              {step === 3 && (
                <StepVoiceSample
                  data={data}
                  update={update}
                  voiceSamples={voiceSamples}
                  loading={loadingVoice}
                />
              )}
              {step === 4 && (
                <StepReady
                  data={data}
                  brandAnalysis={brandAnalysis}
                  scrapedProfile={scrapedProfile}
                  onFinish={finish}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex w-full max-w-xl items-center justify-between">
        <button
          onClick={prev}
          disabled={step === 0}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[#0A0A0A] disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronLeft size={16} />
          Voltar
        </button>

        <div className="flex items-center gap-5">
          {step > 0 && step < 4 && (
            <button
              onClick={next}
              className="text-[11px] text-[var(--muted)] hover:text-[#0A0A0A] transition-colors uppercase tracking-widest font-semibold"
            >
              Pular
            </button>
          )}
          {step < 4 && step > 0 && (
            <button
              onClick={next}
              className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-[var(--accent-dark)] transition-colors"
              style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
            >
              Continuar
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 0 — Social Connection
// ──────────────────────────────────────────────────────────────────
function StepSocial({
  data,
  pullProfile,
  scraping,
  scrapeError,
}: {
  data: OnboardingData;
  pullProfile: (platform: "twitter" | "instagram", handle: string) => void;
  scraping: boolean;
  scrapeError: string | null;
}) {
  const [platform, setPlatform] = useState<"twitter" | "instagram">("instagram");
  const [handle, setHandle] = useState(data.instagram_handle || data.twitter_handle || "");

  return (
    <div>
      <span className="tag-pill mb-6">
        <span className="font-mono">Nº 01</span> Começar
      </span>
      <h2 className="editorial-serif text-4xl md:text-5xl text-[#0A0A0A] leading-[0.95] mb-3">
        Me conta onde você <span className="italic text-[var(--accent)]">posta.</span>
      </h2>
      <p className="text-[var(--muted)] mb-8 leading-relaxed">
        Cole o @ do seu Instagram ou X — <strong className="text-[#0A0A0A] font-semibold">sem precisar logar</strong>.
        A gente puxa nome, foto, bio e analisa seus ultimos posts para entender seu estilo.
      </p>

      {/* Platform picker */}
      <div className="flex items-center gap-2 mb-4">
        {(["instagram", "twitter"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
              platform === p
                ? "bg-[var(--accent)] text-white border-[#0A0A0A]"
                : "bg-[#FFFDF9] text-[#0A0A0A] border-[#0A0A0A]/20 hover:border-[#0A0A0A]"
            }`}
            style={platform === p ? { boxShadow: "3px 3px 0 0 #0A0A0A" } : {}}
          >
            {p === "instagram" ? "Instagram" : "X / Twitter"}
          </button>
        ))}
      </div>

      {/* Handle input */}
      <div className="relative mb-4">
        <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
          placeholder="seuhandle"
          className="w-full rounded-xl border border-[#0A0A0A] bg-[#FFFDF9] pl-11 pr-4 py-4 text-base text-[#0A0A0A] outline-none transition-all focus:ring-2 focus:ring-[var(--accent)]/30 placeholder:text-[var(--muted)]"
          style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !scraping) pullProfile(platform, handle);
          }}
        />
      </div>

      {scrapeError && (
        <p className="text-sm text-red-600 mb-4">{scrapeError}</p>
      )}

      <button
        onClick={() => pullProfile(platform, handle)}
        disabled={scraping || !handle.trim()}
        className="w-full inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-white px-6 py-4 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
      >
        {scraping ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Puxando seu perfil...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Puxar meu perfil
          </>
        )}
      </button>

      <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] text-center mt-6">
        Ou clique em pular e preencha a mão
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 1 — Brand Intelligence (Profile Analysis)
// ──────────────────────────────────────────────────────────────────
function StepBrandIntelligence({
  data,
  update,
  scrapedProfile,
  brandAnalysis,
  analyzingBrand,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
  scrapedProfile: ScrapedProfile | null;
  brandAnalysis: BrandAnalysisResult | null;
  analyzingBrand: boolean;
}) {
  const [editingName, setEditingName] = useState(false);

  if (analyzingBrand) {
    return (
      <div className="text-center py-8">
        <Loader2 size={32} className="animate-spin text-[var(--accent)] mx-auto mb-4" />
        <p className="text-[var(--muted)]">Analisando seu perfil com IA...</p>
      </div>
    );
  }

  const hasBrandData = brandAnalysis && (brandAnalysis.detected_niche.length > 0 || brandAnalysis.top_topics.length > 0);

  return (
    <div>
      <span className="tag-pill mb-6">
        <span className="font-mono">Nº 02</span> Análise
      </span>
      <h2 className="editorial-serif text-4xl md:text-5xl text-[#0A0A0A] leading-[0.95] mb-3">
        {hasBrandData ? (
          <>Seu <span className="italic text-[var(--accent)]">raio-x.</span></>
        ) : (
          <>Dá uma <span className="italic text-[var(--accent)]">olhada.</span></>
        )}
      </h2>
      <p className="text-[var(--muted)] mb-8 leading-relaxed">
        {hasBrandData
          ? "Analisamos seus posts e montamos um resumo da sua marca. Revise e ajuste."
          : "Confirme as informações do seu perfil. Você pode editar o que quiser."}
      </p>

      {/* Profile header */}
      <div className="flex items-center gap-4 mb-6">
        {data.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.avatar_url}
            alt="Avatar"
            className="h-16 w-16 rounded-2xl object-cover border border-[#0A0A0A]"
            style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
          />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-white border border-[#0A0A0A]"
            style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
          >
            <User size={24} />
          </div>
        )}
        <div className="flex-1">
          {editingName ? (
            <input
              type="text"
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
              autoFocus
              className="text-lg font-bold text-[#0A0A0A] bg-transparent border-b-2 border-[var(--accent)] outline-none w-full"
            />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-[#0A0A0A]">{data.name || "Sem nome"}</p>
              <button onClick={() => setEditingName(true)} className="text-[var(--muted)] hover:text-[var(--accent)]">
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p className="text-sm text-[var(--muted)]">
            {data.instagram_handle ? `@${data.instagram_handle}` : ""}
            {data.instagram_handle && data.twitter_handle ? " · " : ""}
            {data.twitter_handle ? `@${data.twitter_handle}` : ""}
          </p>
        </div>
      </div>

      {/* Brand Analysis Card */}
      {hasBrandData && brandAnalysis && (
        <div className="space-y-4">
          {/* Detected Niche */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-[#0A0A0A]/15 bg-[#FFFDF9] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className="text-[var(--accent)]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">Nicho detectado</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {brandAnalysis.detected_niche.map((n) => (
                <span
                  key={n}
                  className="px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-bold border border-[var(--accent)]/20"
                >
                  {n}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Tone & Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-[#0A0A0A]/15 bg-[#FFFDF9] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageSquareQuote size={16} className="text-[var(--accent)]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">Tom de voz</span>
              </div>
              <p className="text-sm font-bold text-[#0A0A0A] capitalize">{brandAnalysis.tone_detected}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl border border-[#0A0A0A]/15 bg-[#FFFDF9] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-[var(--accent)]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">Frequência</span>
              </div>
              <p className="text-sm font-bold text-[#0A0A0A]">{brandAnalysis.posting_frequency}</p>
            </motion.div>
          </div>

          {/* Top Topics */}
          {brandAnalysis.top_topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-[#0A0A0A]/15 bg-[#FFFDF9] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={16} className="text-[var(--accent)]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">Tópicos recorrentes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {brandAnalysis.top_topics.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full bg-[#0A0A0A]/5 text-[#0A0A0A] text-xs font-semibold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Engagement */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl border border-[#0A0A0A]/15 bg-[#FFFDF9] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-[var(--accent)]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">Engajamento médio</span>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold text-[#0A0A0A]">{brandAnalysis.avg_engagement.likes}</p>
                <p className="text-[10px] font-mono uppercase text-[var(--muted)]">curtidas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0A0A0A]">{brandAnalysis.avg_engagement.comments}</p>
                <p className="text-[10px] font-mono uppercase text-[var(--muted)]">comentários</p>
              </div>
              {scrapedProfile?.followers && (
                <div>
                  <p className="text-2xl font-bold text-[#0A0A0A]">
                    {scrapedProfile.followers >= 1000
                      ? `${(scrapedProfile.followers / 1000).toFixed(1)}k`
                      : scrapedProfile.followers}
                  </p>
                  <p className="text-[10px] font-mono uppercase text-[var(--muted)]">seguidores</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* If no brand data, show simple profile edit */}
      {!hasBrandData && (
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Seu nome</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3.5 text-base text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              placeholder="Seu nome completo"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">URL da foto</label>
            <input
              type="url"
              value={data.avatar_url}
              onChange={(e) => update({ avatar_url: e.target.value })}
              className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">LinkedIn (opcional)</label>
            <input
              type="url"
              value={data.linkedin_url}
              onChange={(e) => update({ linkedin_url: e.target.value })}
              className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3.5 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              placeholder="https://linkedin.com/in/..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 2 — Content Preferences
// ──────────────────────────────────────────────────────────────────
function StepPreferences({
  data,
  update,
  brandAnalysis,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
  brandAnalysis: BrandAnalysisResult | null;
}) {
  const [nicheInput, setNicheInput] = useState("");
  const [pillarInput, setPillarInput] = useState("");
  const [inspirationInput, setInspirationInput] = useState("");

  function addNiche(value: string) {
    const v = value.trim();
    if (!v || data.niche.includes(v)) return;
    update({ niche: [...data.niche, v] });
    setNicheInput("");
  }

  function removeNiche(value: string) {
    update({ niche: data.niche.filter((n) => n !== value) });
  }

  function addPillar(value: string) {
    const v = value.trim();
    if (!v || data.content_pillars.includes(v)) return;
    if (data.content_pillars.length >= 5) return;
    update({ content_pillars: [...data.content_pillars, v] });
    setPillarInput("");
  }

  function removePillar(value: string) {
    update({ content_pillars: data.content_pillars.filter((p) => p !== value) });
  }

  function addInspiration(value: string) {
    const v = value.trim().replace(/^@/, "");
    if (!v || data.inspirations.includes(v)) return;
    if (data.inspirations.length >= 3) return;
    update({ inspirations: [...data.inspirations, v] });
    setInspirationInput("");
  }

  function removeInspiration(value: string) {
    update({ inspirations: data.inspirations.filter((i) => i !== value) });
  }

  const suggestions = NICHE_SUGGESTIONS.filter((s) => !data.niche.includes(s));

  return (
    <div>
      <span className="tag-pill mb-6">
        <span className="font-mono">Nº 03</span> Preferências
      </span>
      <h2 className="editorial-serif text-4xl md:text-5xl text-[#0A0A0A] leading-[0.95] mb-3">
        Sobre o que <span className="italic text-[var(--accent)]">você escreve?</span>
      </h2>
      <p className="text-[var(--muted)] mb-8 leading-relaxed">
        Quanto mais a gente souber, melhores vão ser os carrosséis.
      </p>

      {/* Niche — free form */}
      <div className="mb-6">
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
          Nichos e temas
        </label>

        {data.niche.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {data.niche.map((n) => (
              <motion.span
                key={n}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-bold border border-[#0A0A0A]"
                style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
              >
                {n}
                <button onClick={() => removeNiche(n)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                  <X size={12} />
                </button>
              </motion.span>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={nicheInput}
            onChange={(e) => setNicheInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addNiche(nicheInput);
              }
              if (e.key === "Backspace" && !nicheInput && data.niche.length > 0) {
                removeNiche(data.niche[data.niche.length - 1]);
              }
            }}
            placeholder="Ex: IA aplicada a marketing, cripto educacional..."
            className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3.5 pr-12 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
          <button
            onClick={() => addNiche(nicheInput)}
            disabled={!nicheInput.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-30 hover:bg-[var(--accent-dark)] transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Sugestões rápidas</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 8).map((s) => (
                <button
                  key={s}
                  onClick={() => addNiche(s)}
                  className="px-3 py-1 rounded-full bg-[#FFFDF9] border border-[#0A0A0A]/20 text-[11px] font-semibold text-[#0A0A0A]/70 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content Pillars */}
      <div className="mb-6">
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
          Pilares de conteúdo <span className="text-[var(--muted)]/60">(3-5 temas que você sempre aborda)</span>
        </label>

        {data.content_pillars.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {data.content_pillars.map((p) => (
              <motion.span
                key={p}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0A0A0A] text-white text-xs font-bold"
              >
                {p}
                <button onClick={() => removePillar(p)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                  <X size={12} />
                </button>
              </motion.span>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={pillarInput}
            onChange={(e) => setPillarInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addPillar(pillarInput);
              }
            }}
            placeholder="Ex: Dicas de marketing, Bastidores, Notícias do setor..."
            className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3.5 pr-12 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            disabled={data.content_pillars.length >= 5}
          />
          <button
            onClick={() => addPillar(pillarInput)}
            disabled={!pillarInput.trim() || data.content_pillars.length >= 5}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-[#0A0A0A] text-white disabled:opacity-30 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        {brandAnalysis?.suggested_pillars && brandAnalysis.suggested_pillars.length > 0 && data.content_pillars.length === 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Sugestões da IA</p>
            <div className="flex flex-wrap gap-1.5">
              {brandAnalysis.suggested_pillars.map((s) => (
                <button
                  key={s}
                  onClick={() => addPillar(s)}
                  className="px-3 py-1 rounded-full bg-[#FFFDF9] border border-[var(--accent)]/30 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Audience description */}
      <div className="mb-6">
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
          <Users size={12} className="inline mr-1" />
          Quem é seu público?
        </label>
        <textarea
          value={data.audience_description}
          onChange={(e) => update({ audience_description: e.target.value })}
          placeholder={brandAnalysis?.suggested_audience || "Ex: Empreendedores digitais de 25-40 anos que querem crescer no Instagram..."}
          rows={3}
          className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 resize-none"
        />
        {brandAnalysis?.suggested_audience && !data.audience_description && (
          <button
            onClick={() => update({ audience_description: brandAnalysis.suggested_audience })}
            className="mt-2 text-[11px] text-[var(--accent)] hover:underline font-semibold"
          >
            Usar sugestão da IA
          </button>
        )}
      </div>

      {/* Inspirations */}
      <div className="mb-6">
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
          Inspirações <span className="text-[var(--muted)]/60">(até 3 creators que você admira)</span>
        </label>

        {data.inspirations.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {data.inspirations.map((h) => (
              <motion.span
                key={h}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFDF9] border border-[#0A0A0A]/20 text-xs font-bold text-[#0A0A0A]"
              >
                @{h}
                <button onClick={() => removeInspiration(h)} className="hover:text-red-500 transition-colors">
                  <X size={12} />
                </button>
              </motion.span>
            ))}
          </div>
        )}

        {data.inspirations.length < 3 && (
          <div className="relative">
            <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={inspirationInput}
              onChange={(e) => setInspirationInput(e.target.value.replace(/^@/, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addInspiration(inspirationInput);
                }
              }}
              placeholder="handle do creator"
              className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] pl-10 pr-12 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            <button
              onClick={() => addInspiration(inspirationInput)}
              disabled={!inspirationInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-30 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Tone */}
      <div className="mb-6">
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
          Tom de voz
        </label>
        <div className="grid grid-cols-2 gap-3">
          {TONES.map((t) => (
            <motion.button
              key={t.value}
              onClick={() => update({ tone: t.value })}
              whileTap={{ scale: 0.97 }}
              className={`rounded-xl border px-4 py-4 text-left transition-all ${
                data.tone === t.value
                  ? "border-[#0A0A0A] bg-[#FFF6EC]"
                  : "border-[#0A0A0A]/15 bg-[#FFFDF9] hover:border-[#0A0A0A]/40"
              }`}
              style={data.tone === t.value ? { boxShadow: "3px 3px 0 0 #0A0A0A" } : {}}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{t.emoji}</span>
                <p className="text-sm font-bold text-[#0A0A0A]">{t.label}</p>
              </div>
              <p className="text-[11px] text-[var(--muted)]">{t.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Language + Style row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Language */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
            Idioma
          </label>
          <div className="flex flex-col gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                onClick={() => update({ language: l.value })}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold border transition-all flex items-center gap-1.5 ${
                  data.language === l.value
                    ? "bg-[var(--accent)] text-white border-[#0A0A0A]"
                    : "bg-[#FFFDF9] text-[#0A0A0A]/70 border-[#0A0A0A]/15 hover:border-[#0A0A0A]"
                }`}
                style={data.language === l.value ? { boxShadow: "2px 2px 0 0 #0A0A0A" } : {}}
              >
                <span>{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Carousel style */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
            Estilo de carrossel
          </label>
          <div className="flex flex-col gap-2">
            {STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => update({ carousel_style: s.value })}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                  data.carousel_style === s.value
                    ? "border-[#0A0A0A] bg-[#FFF6EC]"
                    : "border-[#0A0A0A]/15 bg-[#FFFDF9] hover:border-[#0A0A0A]/40"
                }`}
                style={data.carousel_style === s.value ? { boxShadow: "3px 3px 0 0 #0A0A0A" } : {}}
              >
                <div className={`h-8 w-8 rounded-lg border ${s.preview}`} />
                <span className="text-sm font-bold text-[#0A0A0A]">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 3 — Brand Voice Sample
// ──────────────────────────────────────────────────────────────────
function StepVoiceSample({
  data,
  update,
  voiceSamples,
  loading,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
  voiceSamples: VoiceSample[];
  loading: boolean;
}) {
  return (
    <div>
      <span className="tag-pill mb-6">
        <span className="font-mono">Nº 04</span> Voz
      </span>
      <h2 className="editorial-serif text-4xl md:text-5xl text-[#0A0A0A] leading-[0.95] mb-3">
        Qual soa mais <span className="italic text-[var(--accent)]">como você?</span>
      </h2>
      <p className="text-[var(--muted)] mb-8 leading-relaxed">
        Geramos 3 hooks de carrossel no seu nicho, cada um com um tom diferente.
        Escolha o que mais combina com a sua voz.
      </p>

      {loading && (
        <div className="text-center py-8">
          <Loader2 size={28} className="animate-spin text-[var(--accent)] mx-auto mb-3" />
          <p className="text-sm text-[var(--muted)]">Gerando exemplos no seu nicho...</p>
        </div>
      )}

      {!loading && voiceSamples.length > 0 && (
        <div className="space-y-4">
          {voiceSamples.map((sample) => (
            <motion.button
              key={sample.tone}
              onClick={() => update({ voice_preference: sample.tone })}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`w-full text-left rounded-xl border p-5 transition-all ${
                data.voice_preference === sample.tone
                  ? "border-[#0A0A0A] bg-[#FFF6EC] ring-2 ring-[var(--accent)]/20"
                  : "border-[#0A0A0A]/15 bg-[#FFFDF9] hover:border-[#0A0A0A]/40"
              }`}
              style={data.voice_preference === sample.tone ? { boxShadow: "4px 4px 0 0 #0A0A0A" } : {}}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{sample.emoji}</span>
                  <span className="text-sm font-bold text-[#0A0A0A]">{sample.label}</span>
                </div>
                {data.voice_preference === sample.tone && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white"
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                )}
              </div>
              <p className="text-base font-bold text-[#0A0A0A] mb-2">&ldquo;{sample.hook}&rdquo;</p>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{sample.preview}</p>
            </motion.button>
          ))}
        </div>
      )}

      {!loading && voiceSamples.length === 0 && (
        <div className="text-center py-8">
          <p className="text-[var(--muted)]">Nenhuma amostra disponível. Pule para continuar.</p>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 4 — Ready (Summary)
// ──────────────────────────────────────────────────────────────────
function StepReady({
  data,
  brandAnalysis,
  scrapedProfile,
  onFinish,
}: {
  data: OnboardingData;
  brandAnalysis: BrandAnalysisResult | null;
  scrapedProfile: ScrapedProfile | null;
  onFinish: (mode: "ideas" | "link") => void;
}) {
  const postsAnalyzed = scrapedProfile?.recentPosts?.length || 0;
  const topicsDetected = brandAnalysis?.top_topics?.length || data.niche.length || 0;
  const toneLabel = TONES.find((t) => t.value === (data.voice_preference || data.tone))?.label || data.tone;

  return (
    <div className="text-center py-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--accent)] border border-[#0A0A0A] text-white"
        style={{ boxShadow: "5px 5px 0 0 #0A0A0A" }}
      >
        <Sparkles size={36} />
      </motion.div>
      <span className="tag-pill mb-4">
        <span className="font-mono">Nº 05</span> Pronto
      </span>
      <h2 className="editorial-serif text-4xl md:text-5xl text-[#0A0A0A] leading-[0.95] mb-4">
        Seu perfil de conteúdo<br />
        <span className="italic text-[var(--accent)]">está pronto!</span>
      </h2>

      {/* Stats */}
      <div className="flex items-center justify-center gap-6 mb-8">
        {postsAnalyzed > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <p className="text-3xl font-bold text-[var(--accent)]">{postsAnalyzed}</p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">posts analisados</p>
          </motion.div>
        )}
        {topicsDetected > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <p className="text-3xl font-bold text-[var(--accent)]">{topicsDetected}</p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">tópicos detectados</p>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-3xl font-bold text-[var(--accent)]">
            {toneLabel.slice(0, 3).toUpperCase()}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">tom calibrado</p>
        </motion.div>
      </div>

      <p className="text-[var(--muted)] mb-8 max-w-sm mx-auto">
        Seu primeiro carrossel sai em 30 segundos. Escolha por onde começar.
      </p>

      <div className="space-y-3">
        <button
          onClick={() => onFinish("ideas")}
          className="w-full inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-white px-6 py-4 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-[var(--accent-dark)] transition-colors"
          style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
        >
          <Sparkles size={16} />
          Criar meu primeiro carrossel
        </button>
        <button
          onClick={() => onFinish("link")}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#FFFDF9] text-[#0A0A0A] px-6 py-4 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-[#FFF6EC] transition-colors"
          style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
        >
          <LinkIcon size={16} />
          Eu tenho um link
        </button>
      </div>
    </div>
  );
}
