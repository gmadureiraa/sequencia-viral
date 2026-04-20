"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import type { BrandAnalysis } from "@/lib/auth-context";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { toast } from "sonner";
import { scrubInstagramCdn } from "@/lib/instagram-cdn";

// ──────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────

const NICHES = [
  { value: "marketing", glyph: "✦", name: "Marketing", hint: "crescimento orgânico" },
  { value: "business", glyph: "◆", name: "Negócios", hint: "estratégia e ops" },
  { value: "tech", glyph: "●", name: "Tech", hint: "dev / produto / IA" },
  { value: "finance", glyph: "☆", name: "Finanças", hint: "pessoal / cripto / invest" },
  { value: "design", glyph: "◈", name: "Design", hint: "visual / ux / brand" },
  { value: "health", glyph: "❋", name: "Saúde", hint: "bem-estar / nutrição" },
  { value: "education", glyph: "✺", name: "Educação", hint: "ensino / cursos" },
  { value: "lifestyle", glyph: "◉", name: "Lifestyle", hint: "rotina / hobbies" },
  { value: "other", glyph: "✴", name: "Outro", hint: "defina no texto livre" },
] as const;

const VOICES = [
  {
    value: "editorial",
    glyph: "✦",
    label: "Editorial",
    hint: "ritmo de revista. frases afiadas, referências.",
  },
  {
    value: "direct",
    glyph: "◆",
    label: "Direto",
    hint: "fato, dado, conclusão. zero enrolação.",
  },
  {
    value: "provocative",
    glyph: "❋",
    label: "Provocador",
    hint: "contraditório por design. faz pensar.",
  },
  {
    value: "personal",
    glyph: "☆",
    label: "Pessoal",
    hint: "bastidores, vulnerabilidade, aprendizado.",
  },
] as const;

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

interface OnboardingData {
  name: string;
  avatar_url: string;
  twitter_handle: string;
  instagram_handle: string;
  linkedin_url: string;
  website_url: string;
  niche: string[];
  tone: string;
  language: string;
  carousel_style: string;
  bio?: string;
  content_pillars: string[];
  audience_description: string;
  inspirations: string[];
  voice_preference: string;
  niche_primary: string;
  voice_samples: string[];
  tabus: string[];
  content_rules: string[];
}

function initialData(): OnboardingData {
  return {
    name: "",
    avatar_url: "",
    twitter_handle: "",
    instagram_handle: "",
    linkedin_url: "",
    website_url: "",
    niche: [],
    tone: "casual",
    language: "pt-br",
    carousel_style: "white",
    content_pillars: [],
    audience_description: "",
    inspirations: [],
    voice_preference: "",
    niche_primary: "",
    voice_samples: [],
    tabus: [],
    content_rules: [],
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
// Tone mapping (voice_preference → tone)
// ──────────────────────────────────────────────────────────────────
const VOICE_TO_TONE: Record<string, string> = {
  editorial: "educational",
  direct: "professional",
  provocative: "provocative",
  personal: "casual",
};

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, user, session, updateProfile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [direction, setDirection] = useState(1);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProfile, setScrapedProfile] = useState<ScrapedProfile | null>(null);
  const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysisResult | null>(null);
  const [analyzingBrand, setAnalyzingBrand] = useState(false);
  const [finishing, setFinishing] = useState(false);
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

  // Redirect away if already onboarded
  useEffect(() => {
    if (profile?.onboarding_completed) {
      router.replace("/app");
    }
  }, [profile, router]);

  const update = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem("sequencia-viral_onboarding", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // ─── Scrape + brand analysis ───
  async function pullProfile(
    platform: "twitter" | "instagram" | "linkedin" | "website",
    handle: string
  ) {
    if (!handle.trim()) {
      setScrapeError("Digite um handle para buscar.");
      return;
    }
    setScraping(true);
    setScrapeError(null);
    try {
      const cleanHandle =
        platform === "website" || platform === "linkedin"
          ? handle.trim()
          : handle.replace(/^@/, "").trim();
      const res = await fetch("/api/profile-scraper", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({ platform, handle: cleanHandle }),
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

      // Instagram CDN bloqueia download de foto — scraper retorna null de
      // propósito. Avisa o user pra subir a foto depois em Ajustes.
      if (platform === "instagram" && !p.avatarUrl && !data.avatar_url) {
        toast.info(
          "Instagram bloqueia download da foto de perfil. Continue sem — dá pra subir em Ajustes → Perfil."
        );
      }

      const niches: string[] = [];
      if (p.niche && typeof p.niche === "string") niches.push(p.niche);

      update({
        name: p.name || data.name,
        avatar_url: p.avatarUrl || data.avatar_url,
        bio: p.bio || data.bio,
        twitter_handle:
          platform === "twitter" ? cleanHandle : data.twitter_handle,
        instagram_handle:
          platform === "instagram" ? cleanHandle : data.instagram_handle,
        linkedin_url:
          platform === "linkedin" ? cleanHandle : data.linkedin_url,
        website_url:
          platform === "website" ? cleanHandle : data.website_url,
        niche: niches.length
          ? Array.from(new Set([...data.niche, ...niches]))
          : data.niche,
      });

      // Brand analysis
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
            const detectedNiches = analysis.detected_niche || [];
            const detectedTone = analysis.tone_detected || data.tone;
            update({
              niche: Array.from(
                new Set([...data.niche, ...niches, ...detectedNiches])
              ),
              tone: detectedTone,
              content_pillars: analysis.suggested_pillars || [],
              audience_description: analysis.suggested_audience || "",
            });
          } else {
            setScrapeError("Não consegui analisar a marca. Você pode pular esse passo.");
          }
        } catch (e) {
          console.warn("[onboarding] Brand analysis failed:", e);
          setScrapeError("Erro ao analisar marca. Você pode pular esse passo.");
        } finally {
          setAnalyzingBrand(false);
        }
      }
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Erro ao buscar perfil.");
    } finally {
      setScraping(false);
    }
  }

  const goStep = useCallback((target: 1 | 2 | 3 | 4) => {
    setDirection(target > step ? 1 : -1);
    setStep(target);
  }, [step]);

  async function finish(mode: "ideas" | "link") {
    setFinishing(true);
    try {
      // map voice_preference → tone if set
      const tone = data.voice_preference
        ? VOICE_TO_TONE[data.voice_preference] || data.tone
        : brandAnalysis?.tone_detected || data.tone;

      const brand: BrandAnalysis = {
        detected_niche: brandAnalysis?.detected_niche || data.niche,
        tone_detected: brandAnalysis?.tone_detected || tone,
        top_topics: brandAnalysis?.top_topics || [],
        posting_frequency: brandAnalysis?.posting_frequency || "",
        avg_engagement: brandAnalysis?.avg_engagement || { likes: 0, comments: 0 },
        content_pillars: data.content_pillars || [],
        audience_description: data.audience_description || "",
        inspirations: data.inspirations || [],
        voice_preference: data.voice_preference || "",
        voice_samples: data.voice_samples || [],
        tabus: data.tabus || [],
        content_rules: data.content_rules || [],
      };

      await updateProfile({
        name: data.name,
        // Limpa avatar se veio do CDN do Instagram — URL expira em ~1h e
        // deixa o perfil com foto quebrada. User faz upload depois.
        avatar_url: scrubInstagramCdn(data.avatar_url) || "",
        twitter_handle: data.twitter_handle,
        instagram_handle: data.instagram_handle,
        linkedin_url: data.linkedin_url,
        niche: data.niche,
        tone,
        language: data.language,
        carousel_style: data.carousel_style,
        onboarding_completed: true,
        brand_analysis: brand,
      });
    } catch (err) {
      console.error("[onboarding] Failed to save profile:", err);
      toast.error(
        err instanceof Error
          ? `Falha ao salvar perfil: ${err.message}`
          : "Falha ao salvar perfil. Tente novamente."
      );
      posthog.capture("onboarding_save_failed", {
        mode,
        error: err instanceof Error ? err.message : String(err),
      });
      setFinishing(false);
      return;
    }
    posthog.capture("onboarding_completed", {
      mode,
      has_twitter: !!data.twitter_handle,
      has_instagram: !!data.instagram_handle,
      niche_count: data.niche.length,
      tone: data.tone,
      language: data.language,
      voice: data.voice_preference,
    });
    try {
      localStorage.removeItem("sequencia-viral_onboarding");
    } catch {
      // ignore
    }
    window.location.href = `/app/create?source=${mode}`;
  }

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--sv-paper)" }}
    >
      {/* ============ Top bar (60px) ============ */}
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M8 12l3 3 5-6"
                stroke="#0A0A0A"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
        </div>

        {/* Stepper */}
        <nav
          className="hidden items-center gap-2 md:flex"
          aria-label="Progresso do onboarding"
        >
          {[1, 2, 3, 4].map((n, i) => {
            const state =
              n < step ? "done" : n === step ? "on" : "idle";
            return (
              <div key={n} className="flex items-center gap-2">
                <button
                  onClick={() => goStep(n as 1 | 2 | 3 | 4)}
                  className="flex items-center gap-2 uppercase"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color:
                      state === "idle" ? "var(--sv-muted)" : "var(--sv-ink)",
                    textDecoration: state === "done" ? "line-through" : "none",
                    background: "transparent",
                  }}
                >
                  <span
                    className="flex items-center justify-center italic"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "1.5px solid var(--sv-ink)",
                      background:
                        state === "on"
                          ? "var(--sv-green)"
                          : state === "done"
                          ? "var(--sv-ink)"
                          : "var(--sv-white)",
                      color: state === "done" ? "var(--sv-paper)" : "var(--sv-ink)",
                      fontFamily: "var(--sv-display)",
                      fontSize: 11,
                    }}
                  >
                    {n}
                  </span>
                  Nº 0{n}
                </button>
                {i < 3 && (
                  <span
                    aria-hidden
                    style={{
                      width: 28,
                      height: 1.5,
                      background: "var(--sv-ink)",
                      opacity: 0.3,
                    }}
                  />
                )}
              </div>
            );
          })}
        </nav>

        <button
          onClick={() => finish("ideas")}
          disabled={finishing}
          className="sv-btn sv-btn-ghost"
          style={{
            padding: "8px 12px",
            fontSize: 10,
            opacity: finishing ? 0.5 : 1,
          }}
        >
          Pular →
        </button>
      </header>

      {/* Mobile stepper */}
      <div className="md:hidden flex items-center justify-center gap-2 py-3 border-b border-[rgba(10,10,10,.08)]">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            style={{
              width: n === step ? 32 : 18,
              height: 4,
              background:
                n <= step ? "var(--sv-ink)" : "var(--sv-ink)",
              opacity: n <= step ? 1 : 0.2,
              transition: "all .3s",
            }}
          />
        ))}
      </div>

      {/* ============ Body ============ */}
      <main className="flex flex-1 items-start justify-center px-5 py-10 md:py-16">
        <div className="w-full max-w-[820px]">
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
              {step === 1 && (
                <StepNiche
                  data={data}
                  update={update}
                  onContinue={() => goStep(2)}
                />
              )}
              {step === 2 && (
                <StepNetworks
                  data={data}
                  update={update}
                  scraping={scraping}
                  analyzingBrand={analyzingBrand}
                  scrapeError={scrapeError}
                  brandAnalysis={brandAnalysis}
                  scrapedProfile={scrapedProfile}
                  pullProfile={pullProfile}
                  onBack={() => goStep(1)}
                  onContinue={() => goStep(3)}
                />
              )}
              {step === 3 && (
                <StepVoice
                  data={data}
                  update={update}
                  onBack={() => goStep(2)}
                  onContinue={() => goStep(4)}
                />
              )}
              {step === 4 && (
                <StepDetails
                  data={data}
                  update={update}
                  finishing={finishing}
                  onBack={() => goStep(3)}
                  onFinish={() => finish("ideas")}
                  onSkip={() => finish("ideas")}
                  session={session}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Full-screen overlay while finishing */}
      <AnimatePresence>
        {finishing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: "rgba(247,245,239,.95)" }}
          >
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "var(--sv-ink)" }}
            />
            <p
              className="mt-4 uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "var(--sv-ink)",
              }}
            >
              Preparando seu workspace…
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Shared bits
// ──────────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="sv-eyebrow mb-5 inline-flex">
      <span className="sv-dot" />
      {children}
    </span>
  );
}

function DisplayH1({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: "var(--sv-display)",
        fontSize: "clamp(40px, 5.2vw, 60px)",
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
        fontWeight: 400,
        color: "var(--sv-ink)",
        marginBottom: 14,
        padding: "2px 0",
      }}
    >
      {children}
    </h1>
  );
}

function SubLine({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--sv-sans)",
        color: "var(--sv-muted)",
        fontSize: 15,
        lineHeight: 1.55,
        marginBottom: 32,
        maxWidth: 560,
      }}
    >
      {children}
    </p>
  );
}

function Footer({
  back,
  primary,
}: {
  back?: { label: string; onClick: () => void };
  primary: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div
      className="mt-10 flex items-center justify-between"
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
      <button
        onClick={primary.onClick}
        disabled={primary.disabled}
        className="sv-btn sv-btn-primary"
        style={{
          padding: "14px 22px",
          fontSize: 12,
          opacity: primary.disabled ? 0.5 : 1,
        }}
      >
        {primary.label}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 1 — Niche
// ──────────────────────────────────────────────────────────────────
function StepNiche({
  data,
  update,
  onContinue,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
  onContinue: () => void;
}) {
  const selected = data.niche_primary || "";

  function pickNiche(value: string, name: string) {
    update({
      niche_primary: value,
      niche: Array.from(new Set([name, ...data.niche.filter((n) => n !== name)])),
    });
  }

  return (
    <div>
      <Eyebrow>● Nº 01 · Nicho</Eyebrow>
      <DisplayH1>
        Qual é o seu <em className="italic">território</em>?
      </DisplayH1>
      <SubLine>
        Escolha o principal — isso ajusta tom, exemplos e o banco de referência.
        Você pode refinar depois.
      </SubLine>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
      >
        {NICHES.map((n) => {
          const isOn = selected === n.value;
          return (
            <button
              key={n.value}
              type="button"
              onClick={() => pickNiche(n.value, n.name)}
              className="text-left transition-all"
              style={{
                padding: "18px 16px",
                background: isOn ? "var(--sv-green)" : "var(--sv-white)",
                border: isOn
                  ? "2.5px solid var(--sv-ink)"
                  : "1.5px solid var(--sv-ink)",
                boxShadow: isOn ? "4px 4px 0 0 var(--sv-ink)" : "none",
                transform: isOn ? "translate(-1px, -1px)" : "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isOn) {
                  e.currentTarget.style.transform = "translate(-1px, -1px)";
                  e.currentTarget.style.boxShadow = "3px 3px 0 0 var(--sv-ink)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isOn) {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              <div
                className="italic"
                style={{
                  fontFamily: "var(--sv-display)",
                  fontSize: 28,
                  lineHeight: 1,
                  marginBottom: 10,
                  color: "var(--sv-ink)",
                }}
              >
                {n.glyph}
              </div>
              <div
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--sv-ink)",
                  marginBottom: 4,
                }}
              >
                {n.name}
              </div>
              <div
                className="uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  color: isOn ? "var(--sv-ink)" : "var(--sv-muted)",
                }}
              >
                {n.hint}
              </div>
            </button>
          );
        })}
      </div>

      <Footer
        primary={{
          label: "Continuar →",
          onClick: onContinue,
          disabled: !selected,
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 2 — Networks
// ──────────────────────────────────────────────────────────────────
function StepNetworks({
  data,
  update,
  scraping,
  analyzingBrand,
  scrapeError,
  brandAnalysis,
  scrapedProfile,
  pullProfile,
  onBack,
  onContinue,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
  scraping: boolean;
  analyzingBrand: boolean;
  scrapeError: string | null;
  brandAnalysis: BrandAnalysisResult | null;
  scrapedProfile: ScrapedProfile | null;
  pullProfile: (
    platform: "twitter" | "instagram" | "linkedin" | "website",
    handle: string
  ) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [igInput, setIgInput] = useState(data.instagram_handle || "");
  const [twInput, setTwInput] = useState(data.twitter_handle || "");
  const [liInput, setLiInput] = useState(data.linkedin_url || "");
  const [siteInput, setSiteInput] = useState(data.website_url || "");
  const busy = scraping || analyzingBrand;

  const hasAnyAnalysis = !!brandAnalysis || !!scrapedProfile;

  return (
    <div>
      <Eyebrow>● Nº 02 · Redes</Eyebrow>
      <DisplayH1>
        Seu <em className="italic">sotaque</em> nas redes.
      </DisplayH1>
      <SubLine>
        Cola pelo menos um dos quatro — a gente lê os últimos posts sem você precisar
        logar, detecta nicho, tom e tópicos recorrentes. Mais redes = DNA mais afinado.
      </SubLine>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Instagram card */}
        <NetworkCard
          platform="instagram"
          title="Instagram"
          handle={igInput}
          setHandle={(v) => {
            setIgInput(v);
            update({ instagram_handle: v.replace(/^@/, "") });
          }}
          connected={!!scrapedProfile && scrapedProfile.platform === "instagram"}
          onConnect={() => pullProfile("instagram", igInput)}
          disabled={busy}
          busy={scraping}
          scrapedProfile={
            scrapedProfile?.platform === "instagram" ? scrapedProfile : null
          }
        />
        {/* Twitter card */}
        <NetworkCard
          platform="twitter"
          title="Twitter / X"
          handle={twInput}
          setHandle={(v) => {
            setTwInput(v);
            update({ twitter_handle: v.replace(/^@/, "") });
          }}
          connected={!!scrapedProfile && scrapedProfile.platform === "twitter"}
          onConnect={() => pullProfile("twitter", twInput)}
          disabled={busy}
          busy={scraping}
          scrapedProfile={
            scrapedProfile?.platform === "twitter" ? scrapedProfile : null
          }
        />
        {/* LinkedIn card */}
        <NetworkCard
          platform="linkedin"
          title="LinkedIn"
          handle={liInput}
          setHandle={(v) => {
            setLiInput(v);
            update({ linkedin_url: v.trim() });
          }}
          connected={!!scrapedProfile && scrapedProfile.platform === "linkedin"}
          onConnect={() => pullProfile("linkedin", liInput)}
          disabled={busy}
          busy={scraping}
          scrapedProfile={
            scrapedProfile?.platform === "linkedin" ? scrapedProfile : null
          }
        />
        {/* Website card */}
        <NetworkCard
          platform="website"
          title="Site / blog"
          handle={siteInput}
          setHandle={(v) => {
            setSiteInput(v);
            update({ website_url: v.trim() });
          }}
          connected={!!scrapedProfile && scrapedProfile.platform === "website"}
          onConnect={() => pullProfile("website", siteInput)}
          disabled={busy}
          busy={scraping}
          scrapedProfile={
            scrapedProfile?.platform === "website" ? scrapedProfile : null
          }
        />
      </div>

      {/* Live analysis status */}
      {busy && (
        <div
          className="mt-5 flex items-center gap-3"
          style={{
            padding: "14px 16px",
            border: "1.5px solid var(--sv-ink)",
            background: "var(--sv-white)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
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
              letterSpacing: "0.2em",
              color: "var(--sv-ink)",
            }}
          >
            {scraping
              ? "Lendo seu perfil…"
              : "Analisando sua marca com IA…"}
          </span>
        </div>
      )}

      {/* Error */}
      {scrapeError && !busy && (
        <div
          className="mt-5"
          style={{
            padding: "12px 14px",
            border: "1.5px solid #C23A1E",
            background: "#FFE8E4",
            color: "#7A1D0D",
            fontFamily: "var(--sv-sans)",
            fontSize: 12,
            fontWeight: 600,
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
          }}
        >
          {scrapeError}
        </div>
      )}

      {/* Analysis summary */}
      {hasAnyAnalysis && brandAnalysis && !busy && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 grid gap-3 md:grid-cols-3"
        >
          <MiniCard
            label="Nicho detectado"
            value={brandAnalysis.detected_niche.slice(0, 2).join(", ") || "—"}
          />
          <MiniCard
            label="Tom de voz"
            value={brandAnalysis.tone_detected || "—"}
            capitalize
          />
          <MiniCard
            label="Engajamento"
            value={`${brandAnalysis.avg_engagement.likes} · ${brandAnalysis.avg_engagement.comments}`}
            hint="curtidas · comentários"
          />
        </motion.div>
      )}

      <Footer
        back={{ label: "Voltar", onClick: onBack }}
        primary={{
          label: hasAnyAnalysis ? "Analisar voz →" : "Pular →",
          onClick: onContinue,
          disabled: busy,
        }}
      />
    </div>
  );
}

function NetworkCard({
  platform,
  title,
  handle,
  setHandle,
  connected,
  onConnect,
  disabled,
  busy,
  scrapedProfile,
}: {
  platform: "instagram" | "twitter" | "linkedin" | "website";
  title: string;
  handle: string;
  setHandle: (v: string) => void;
  connected: boolean;
  onConnect: () => void;
  disabled: boolean;
  busy: boolean;
  scrapedProfile: ScrapedProfile | null;
}) {
  const bg = connected ? "var(--sv-green)" : "var(--sv-white)";
  const isUrlInput = platform === "website";
  const prefix =
    platform === "website"
      ? "https://"
      : "@";
  const iconBg =
    platform === "instagram"
      ? "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)"
      : platform === "linkedin"
      ? "#0A66C2"
      : platform === "website"
      ? "var(--sv-paper)"
      : "var(--sv-ink)";
  const placeholder =
    platform === "website" ? "seusite.com" : "seuhandle";
  return (
    <div
      style={{
        padding: 24,
        background: bg,
        border: "1.5px solid var(--sv-ink)",
        boxShadow: connected ? "4px 4px 0 0 var(--sv-ink)" : "3px 3px 0 0 var(--sv-ink)",
        transform: connected ? "translate(-1px, -1px)" : "none",
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div
          className="flex items-center justify-center"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            border: "1.5px solid var(--sv-ink)",
            background: iconBg,
          }}
        >
          {platform === "instagram" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="18" cy="6" r="1" fill="#fff" />
            </svg>
          ) : platform === "twitter" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          ) : platform === "linkedin" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sv-ink)" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
          )}
        </div>
        {connected && (
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: "var(--sv-ink)",
            }}
          >
            ✓ Conectado
          </span>
        )}
      </div>
      <h3
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 22,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          fontWeight: 400,
          marginBottom: 6,
          color: "var(--sv-ink)",
        }}
      >
        {title}
      </h3>

      {connected && scrapedProfile ? (
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--sv-ink)",
            fontWeight: 700,
          }}
        >
          {platform === "website" ? scrapedProfile.handle : `@${scrapedProfile.handle}`}
          {scrapedProfile.followers
            ? ` · ${scrapedProfile.followers >= 1000 ? `${(scrapedProfile.followers / 1000).toFixed(1)}k` : scrapedProfile.followers} followers`
            : ""}
          {scrapedProfile.recentPosts?.length
            ? ` · ${scrapedProfile.recentPosts.length} posts lidos`
            : ""}
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex items-center justify-center"
              style={{
                width: isUrlInput ? 64 : 34,
                height: 38,
                borderRight: "1.5px solid var(--sv-ink)",
                fontFamily: isUrlInput ? "var(--sv-mono)" : "var(--sv-display)",
                fontSize: isUrlInput ? 10 : 16,
                color: "var(--sv-ink)",
                background: "var(--sv-white)",
                border: "1.5px solid var(--sv-ink)",
                fontWeight: isUrlInput ? 700 : 400,
                letterSpacing: isUrlInput ? "0.05em" : "0",
              }}
            >
              {prefix}
            </span>
            <input
              type="text"
              value={handle}
              onChange={(e) =>
                setHandle(
                  isUrlInput
                    ? e.target.value.replace(/^https?:\/\//, "")
                    : e.target.value.replace(/^@/, "")
                )
              }
              placeholder={placeholder}
              disabled={disabled}
              className="sv-input flex-1"
              style={{ padding: "10px 12px", fontSize: 13 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled && handle.trim()) onConnect();
              }}
            />
          </div>
          <button
            onClick={onConnect}
            disabled={disabled || !handle.trim()}
            className="sv-btn sv-btn-ink w-full justify-center"
            style={{
              padding: "10px 14px",
              fontSize: 11,
              opacity: disabled || !handle.trim() ? 0.5 : 1,
            }}
          >
            {busy ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Lendo…
              </>
            ) : (
              "Conectar →"
            )}
          </button>
        </>
      )}
    </div>
  );
}

function MiniCard({
  label,
  value,
  hint,
  capitalize,
}: {
  label: string;
  value: string;
  hint?: string;
  capitalize?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "3px 3px 0 0 var(--sv-ink)",
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9,
          letterSpacing: "0.2em",
          color: "var(--sv-muted)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--sv-sans)",
          fontWeight: 700,
          fontSize: 14,
          color: "var(--sv-ink)",
          textTransform: capitalize ? "capitalize" : "none",
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 8.5,
            letterSpacing: "0.18em",
            color: "var(--sv-muted)",
            marginTop: 4,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 3 — Voice
// ──────────────────────────────────────────────────────────────────
function StepVoice({
  data,
  update,
  onBack,
  onContinue,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const selected = data.voice_preference;

  return (
    <div>
      <Eyebrow>● Nº 03 · Voz</Eyebrow>
      <DisplayH1>
        Como você <em className="italic">escreve</em>?
      </DisplayH1>
      <SubLine>
        Escolha um ponto de partida. A IA escreve os rascunhos calibrando para esse
        tom — dá pra trocar a qualquer hora.
      </SubLine>

      <div className="grid gap-3 md:grid-cols-2">
        {VOICES.map((v) => {
          const isOn = selected === v.value;
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => update({ voice_preference: v.value })}
              className="text-left transition-all"
              style={{
                padding: "22px 20px",
                background: isOn ? "var(--sv-green)" : "var(--sv-white)",
                border: isOn
                  ? "2.5px solid var(--sv-ink)"
                  : "1.5px solid var(--sv-ink)",
                boxShadow: isOn ? "5px 5px 0 0 var(--sv-ink)" : "none",
                transform: isOn ? "translate(-1px, -1px)" : "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isOn) {
                  e.currentTarget.style.transform = "translate(-1px, -1px)";
                  e.currentTarget.style.boxShadow = "4px 4px 0 0 var(--sv-ink)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isOn) {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              <div className="mb-3 flex items-start justify-between">
                <span
                  className="italic"
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 32,
                    lineHeight: 1,
                    color: "var(--sv-ink)",
                  }}
                >
                  {v.glyph}
                </span>
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "1.5px solid var(--sv-ink)",
                    background: isOn ? "var(--sv-ink)" : "var(--sv-white)",
                    color: isOn ? "var(--sv-green)" : "transparent",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "var(--sv-ink)",
                  marginBottom: 6,
                }}
              >
                {v.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: isOn ? "var(--sv-ink)" : "var(--sv-muted)",
                }}
              >
                {v.hint}
              </div>
            </button>
          );
        })}
      </div>

      <Footer
        back={{ label: "Voltar", onClick: onBack }}
        primary={{
          label: "Continuar →",
          onClick: onContinue,
          disabled: !selected,
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 4 — Voice Details (opcional, refina a voz da IA)
// ──────────────────────────────────────────────────────────────────
function StepDetails({
  data,
  update,
  finishing,
  onBack,
  onFinish,
  onSkip,
  session,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
  finishing: boolean;
  onBack: () => void;
  onFinish: () => void;
  onSkip: () => void;
  session: Session | null;
}) {
  const [samplesText, setSamplesText] = useState(
    data.voice_samples.join("\n\n---\n\n")
  );
  const [tabusInput, setTabusInput] = useState("");
  const [rulesText, setRulesText] = useState(data.content_rules.join("\n"));
  const [voiceLinks, setVoiceLinks] = useState<string[]>(["", "", ""]);
  const [voiceKind, setVoiceKind] = useState<"self" | "reference">("self");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceDna, setVoiceDna] = useState<{
    summary?: string;
    tone?: string[];
    hook_patterns?: string[];
    cta_style?: string;
  } | null>(null);

  async function ingestVoiceLinks() {
    const urls = voiceLinks.map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      setVoiceError("Cola pelo menos um link de post/reel do Instagram.");
      return;
    }
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const res = await fetch("/api/voice-ingest", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({ urls, kind: voiceKind }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Não consegui analisar os links."
        );
      }
      setVoiceDna(body?.voice_dna ?? null);
      if (Array.isArray(body?.voice_dna?.sample_captions)) {
        const caps = (body.voice_dna.sample_captions as string[])
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .slice(0, 3);
        if (caps.length > 0) {
          const merged = Array.from(
            new Set([...(data.voice_samples || []), ...caps])
          ).slice(0, 3);
          update({ voice_samples: merged });
          setSamplesText(merged.join("\n\n---\n\n"));
        }
      }
      toast.success("Voz analisada. Próximo carrossel sai com seu DNA.");
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Falha ao analisar.");
    } finally {
      setVoiceLoading(false);
    }
  }

  function commitSamples(v: string) {
    setSamplesText(v);
    const arr = v
      .split(/\n\s*---\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    update({ voice_samples: arr });
  }

  function addTabu() {
    const t = tabusInput.trim();
    if (!t) return;
    if (data.tabus.includes(t)) {
      setTabusInput("");
      return;
    }
    update({ tabus: [...data.tabus, t].slice(0, 20) });
    setTabusInput("");
  }

  function removeTabu(t: string) {
    update({ tabus: data.tabus.filter((x) => x !== t) });
  }

  function commitRules(v: string) {
    setRulesText(v);
    const arr = v
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    update({ content_rules: arr });
  }

  return (
    <div>
      <Eyebrow>● Nº 04 · Detalhes da voz (opcional)</Eyebrow>
      <DisplayH1>
        Ensine a IA a <em className="italic">imitar</em> você.
      </DisplayH1>
      <SubLine>
        Três campos opcionais. Quanto mais você der, menos genérica a IA fica —
        mas pode pular a qualquer hora.
      </SubLine>

      {/* Voice DNA via links */}
      <div
        className="mb-6"
        style={{
          padding: 18,
          background: "var(--sv-paper)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
        }}
      >
        <div
          className="mb-2 uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--sv-ink)",
            fontWeight: 700,
          }}
        >
          ✦ Ensine via links (recomendado)
        </div>
        <div
          className="mb-3"
          style={{
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--sv-muted)",
          }}
        >
          Cola até 3 links de carrosséis do Instagram (seus ou de referência). A IA
          lê a legenda e o texto dos slides, extrai padrão de hook, estrutura e CTA.
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setVoiceKind("self")}
            className="uppercase"
            style={{
              padding: "6px 12px",
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              fontWeight: 700,
              background: voiceKind === "self" ? "var(--sv-ink)" : "var(--sv-white)",
              color: voiceKind === "self" ? "var(--sv-white)" : "var(--sv-ink)",
              border: "1.5px solid var(--sv-ink)",
              cursor: "pointer",
            }}
          >
            Meus posts
          </button>
          <button
            type="button"
            onClick={() => setVoiceKind("reference")}
            className="uppercase"
            style={{
              padding: "6px 12px",
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              fontWeight: 700,
              background: voiceKind === "reference" ? "var(--sv-ink)" : "var(--sv-white)",
              color: voiceKind === "reference" ? "var(--sv-white)" : "var(--sv-ink)",
              border: "1.5px solid var(--sv-ink)",
              cursor: "pointer",
            }}
          >
            Referência
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {voiceLinks.map((url, i) => (
            <input
              key={i}
              type="url"
              value={url}
              onChange={(e) => {
                const next = [...voiceLinks];
                next[i] = e.target.value;
                setVoiceLinks(next);
              }}
              placeholder={`https://www.instagram.com/p/...`}
              disabled={voiceLoading}
              className="sv-input"
              style={{ padding: "10px 12px", fontSize: 13 }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={ingestVoiceLinks}
          disabled={voiceLoading || voiceLinks.every((u) => !u.trim())}
          className="sv-btn sv-btn-ink mt-3"
          style={{
            padding: "10px 16px",
            fontSize: 11,
            opacity:
              voiceLoading || voiceLinks.every((u) => !u.trim()) ? 0.5 : 1,
          }}
        >
          {voiceLoading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Lendo carrosséis…
            </>
          ) : (
            "Analisar DNA →"
          )}
        </button>

        {voiceError && (
          <div
            className="mt-3 uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "var(--sv-pink)",
              fontWeight: 700,
            }}
          >
            ⚠ {voiceError}
          </div>
        )}

        {voiceDna && (
          <div
            className="mt-4"
            style={{
              padding: 14,
              background: "var(--sv-green)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
            }}
          >
            <div
              className="mb-2 uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.15em",
                fontWeight: 700,
                color: "var(--sv-ink)",
              }}
            >
              ✓ DNA capturado
            </div>
            {voiceDna.summary && (
              <div
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--sv-ink)",
                  marginBottom: 8,
                }}
              >
                {voiceDna.summary}
              </div>
            )}
            {voiceDna.tone && voiceDna.tone.length > 0 && (
              <div
                className="uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: "var(--sv-ink)",
                  fontWeight: 700,
                }}
              >
                Tom: {voiceDna.tone.join(" · ")}
              </div>
            )}
            {voiceDna.cta_style && (
              <div
                className="mt-1"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: "var(--sv-ink)",
                  fontWeight: 700,
                }}
              >
                CTA: {voiceDna.cta_style}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Voice samples (fallback manual) */}
      <div className="mb-6">
        <div
          className="mb-2 uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--sv-muted)",
          }}
        >
          Ou cole texto manual · 1 a 3 posts
        </div>
        <textarea
          value={samplesText}
          onChange={(e) => commitSamples(e.target.value)}
          placeholder="Cole um post inteiro que você curtiu de como saiu. Separe múltiplos com uma linha contendo apenas ---"
          rows={5}
          style={{
            width: "100%",
            padding: 14,
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
            lineHeight: 1.5,
            background: "var(--sv-white)",
            border: "1.5px solid var(--sv-ink)",
            outline: 0,
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
            color: "var(--sv-ink)",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div
          className="mt-1.5 uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.14em",
            color: "var(--sv-muted)",
          }}
        >
          {data.voice_samples.length} / 3 exemplos detectados
        </div>
      </div>

      {/* Tabus */}
      <div className="mb-6">
        <div
          className="mb-2 uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--sv-muted)",
          }}
        >
          Palavras ou expressões que você NUNCA usa
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tabusInput}
            onChange={(e) => setTabusInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTabu();
              }
            }}
            placeholder="Ex: ninja, hack, mindset, game-changer"
            className="sv-input flex-1"
            style={{ padding: "10px 12px", fontSize: 13 }}
          />
          <button
            type="button"
            onClick={addTabu}
            className="sv-btn sv-btn-ink"
            style={{ padding: "8px 14px", fontSize: 11 }}
          >
            + Adicionar
          </button>
        </div>
        {data.tabus.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.tabus.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => removeTabu(t)}
                style={{
                  padding: "5px 10px",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 11,
                  border: "1.5px solid var(--sv-ink)",
                  background: "var(--sv-pink)",
                  color: "var(--sv-ink)",
                  cursor: "pointer",
                }}
                title="Clique pra remover"
              >
                {t} <span style={{ marginLeft: 4, opacity: 0.6 }}>×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content rules */}
      <div className="mb-4">
        <div
          className="mb-2 uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--sv-muted)",
          }}
        >
          Regras pra IA seguir · uma por linha
        </div>
        <textarea
          value={rulesText}
          onChange={(e) => commitRules(e.target.value)}
          placeholder={"Sempre citar fonte no último slide.\nSem emojis em títulos.\nFrases curtas, uma ideia por slide.\nNunca começar com \"Você sabia\"."}
          rows={5}
          style={{
            width: "100%",
            padding: 14,
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
            lineHeight: 1.5,
            background: "var(--sv-white)",
            border: "1.5px solid var(--sv-ink)",
            outline: 0,
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
            color: "var(--sv-ink)",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div
          className="mt-1.5 uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.14em",
            color: "var(--sv-muted)",
          }}
        >
          {data.content_rules.length} / 10 regras
        </div>
      </div>

      <div
        className="mt-10 flex items-center justify-between gap-3"
        style={{ borderTop: "1.5px solid var(--sv-ink)", paddingTop: 20 }}
      >
        <button
          onClick={onBack}
          disabled={finishing}
          className="sv-btn sv-btn-ghost"
          style={{ padding: "10px 14px", fontSize: 11, opacity: finishing ? 0.5 : 1 }}
        >
          ← Voltar
        </button>
        <div className="flex gap-2">
          <button
            onClick={onSkip}
            disabled={finishing}
            className="sv-btn sv-btn-ghost"
            style={{ padding: "10px 14px", fontSize: 11, opacity: finishing ? 0.5 : 1 }}
          >
            Pular →
          </button>
          <button
            onClick={onFinish}
            disabled={finishing}
            className="sv-btn sv-btn-primary"
            style={{
              padding: "14px 22px",
              fontSize: 12,
              opacity: finishing ? 0.5 : 1,
            }}
          >
            {finishing ? "Salvando…" : "Concluir →"}
          </button>
        </div>
      </div>
    </div>
  );
}
