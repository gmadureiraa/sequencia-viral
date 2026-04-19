"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import type { BrandAnalysis } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { toast } from "sonner";

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
    niche_primary: "",
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
        twitter_handle:
          platform === "twitter" ? handle.replace(/^@/, "") : data.twitter_handle,
        instagram_handle:
          platform === "instagram" ? handle.replace(/^@/, "") : data.instagram_handle,
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

  const goStep = useCallback((target: 1 | 2 | 3) => {
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
      };

      await updateProfile({
        name: data.name,
        avatar_url: data.avatar_url,
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
          {[1, 2, 3].map((n, i) => {
            const state =
              n < step ? "done" : n === step ? "on" : "idle";
            return (
              <div key={n} className="flex items-center gap-2">
                <button
                  onClick={() => goStep(n as 1 | 2 | 3)}
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
                {i < 2 && (
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
        {[1, 2, 3].map((n) => (
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
                  finishing={finishing}
                  onBack={() => goStep(2)}
                  onFinish={() => finish("ideas")}
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
  pullProfile: (platform: "twitter" | "instagram", handle: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [igInput, setIgInput] = useState(data.instagram_handle || "");
  const [twInput, setTwInput] = useState(data.twitter_handle || "");
  const busy = scraping || analyzingBrand;

  const hasAnyAnalysis = !!brandAnalysis || !!scrapedProfile;

  return (
    <div>
      <Eyebrow>● Nº 02 · Redes</Eyebrow>
      <DisplayH1>
        Seu <em className="italic">sotaque</em> nas redes.
      </DisplayH1>
      <SubLine>
        Cola o @ — a gente lê os últimos posts sem você precisar logar, detecta
        nicho, tom e tópicos recorrentes.
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
  platform: "instagram" | "twitter";
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
            background:
              platform === "instagram"
                ? "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)"
                : "var(--sv-ink)",
          }}
        >
          {platform === "instagram" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="18" cy="6" r="1" fill="#fff" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
          @{scrapedProfile.handle}
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
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
              placeholder="seuhandle"
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
  finishing,
  onBack,
  onFinish,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
  finishing: boolean;
  onBack: () => void;
  onFinish: () => void;
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
          label: finishing ? "Salvando…" : "Concluir →",
          onClick: onFinish,
          disabled: finishing || !selected,
        }}
      />
    </div>
  );
}
