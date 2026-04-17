"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
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
} from "lucide-react";
import Loader from "@/components/kokonutui/loader";
import AITextLoading from "@/components/kokonutui/ai-text-loading";

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

const STEP_ICONS = [AtSign, User, Palette, Sparkles];
const STEP_LABELS = ["Redes", "Perfil", "Preferências", "Começar"];

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

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, user, session, updateProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
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

  // Auto-pull profile from scraper
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
      const p = await res.json();
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
      // Jump to step 1 so user can confirm
      setDirection(1);
      setStep(1);
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Erro ao buscar perfil.");
    } finally {
      setScraping(false);
    }
  }

  function next() {
    if (step < 3) {
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

  async function finish(mode: "ideas" | "link") {
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
        {scraping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FAFAF8]/95 backdrop-blur-md"
          >
            <Loader
              size="lg"
              title="Lendo seu perfil"
              subtitle="Puxando nome, foto, bio e os temas que você costuma falar"
            />
            <div className="mt-4">
              <AITextLoading
                className="!text-xl"
                texts={[
                  "Buscando seu perfil…",
                  "Lendo seus últimos posts…",
                  "Entendendo seu nicho…",
                  "Aprendendo seu tom de voz…",
                  "Quase pronto…",
                ]}
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
              {step === 1 && <StepProfile data={data} update={update} />}
              {step === 2 && <StepPreferences data={data} update={update} />}
              {step === 3 && <StepCreate onFinish={finish} />}
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
          {step > 0 && step < 3 && (
            <button
              onClick={next}
              className="text-[11px] text-[var(--muted)] hover:text-[#0A0A0A] transition-colors uppercase tracking-widest font-semibold"
            >
              Pular
            </button>
          )}
          {step < 3 && step > 0 && (
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
// Step 0 — Conectar redes e puxar perfil
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
        A gente puxa nome, foto, bio e os temas que você costuma falar; você revisa no próximo passo.
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
            Puxando seu perfil…
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Puxar meu perfil
          </>
        )}
      </button>

      <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] text-center mt-6">
        Ou clique em pular e preencha à mão
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 1 — Perfil (pré-preenchido, editável)
// ──────────────────────────────────────────────────────────────────
function StepProfile({
  data,
  update,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
}) {
  return (
    <div>
      <span className="tag-pill mb-6">
        <span className="font-mono">Nº 02</span> Confirme
      </span>
      <h2 className="editorial-serif text-4xl md:text-5xl text-[#0A0A0A] leading-[0.95] mb-3">
        Dá uma <span className="italic text-[var(--accent)]">olhada.</span>
      </h2>
      <p className="text-[var(--muted)] mb-8 leading-relaxed">
        Ajuste o que quiser — o que estiver errado a gente corrige agora.
      </p>

      {/* Avatar */}
      <div className="flex items-center gap-5 mb-6">
        <div className="relative">
          {data.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.avatar_url}
              alt="Avatar"
              className="h-20 w-20 rounded-2xl object-cover border border-[#0A0A0A]"
              style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-white border border-[#0A0A0A]"
              style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
            >
              <User size={28} />
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
            URL da foto
          </label>
          <input
            type="url"
            value={data.avatar_url}
            onChange={(e) => update({ avatar_url: e.target.value })}
            className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            placeholder="https://…"
          />
        </div>
      </div>

      {/* Name */}
      <div className="mb-5">
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
          Seu nome
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
          className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3.5 text-base text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="Seu nome completo"
        />
      </div>

      {/* LinkedIn */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
          LinkedIn (opcional)
        </label>
        <input
          type="url"
          value={data.linkedin_url}
          onChange={(e) => update({ linkedin_url: e.target.value })}
          className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3.5 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="https://linkedin.com/in/…"
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 2 — Preferências (nicho free-form + tom + estilo)
// ──────────────────────────────────────────────────────────────────
function StepPreferences({
  data,
  update,
}: {
  data: OnboardingData;
  update: (d: Partial<OnboardingData>) => void;
}) {
  const [nicheInput, setNicheInput] = useState("");

  function addNiche(value: string) {
    const v = value.trim();
    if (!v) return;
    if (data.niche.includes(v)) return;
    update({ niche: [...data.niche, v] });
    setNicheInput("");
  }

  function removeNiche(value: string) {
    update({ niche: data.niche.filter((n) => n !== value) });
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
        Digite os temas que você trata — quanto mais específico, melhor o Sequência Viral
        vai entender sua voz.
      </p>

      {/* Niche — free form */}
      <div className="mb-8">
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
          Nichos e temas
        </label>

        {/* Chips */}
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
                <button
                  onClick={() => removeNiche(n)}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                >
                  <X size={12} />
                </button>
              </motion.span>
            ))}
          </div>
        )}

        {/* Input */}
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
            placeholder="Ex: IA aplicada a marketing, cripto educacional, automação no-code…"
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

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
              Sugestões rápidas
            </p>
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

      {/* Tone */}
      <div className="mb-8">
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

      {/* Language */}
      <div className="mb-8">
        <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
          Idioma
        </label>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => update({ language: l.value })}
              className={`rounded-full px-4 py-2 text-sm font-bold border transition-all flex items-center gap-1.5 ${
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
        <div className="flex gap-3">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => update({ carousel_style: s.value })}
              className={`flex items-center gap-3 rounded-xl border px-5 py-3.5 transition-all ${
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
  );
}

// ──────────────────────────────────────────────────────────────────
// Step 3 — Começar
// ──────────────────────────────────────────────────────────────────
function StepCreate({ onFinish }: { onFinish: (mode: "ideas" | "link") => void }) {
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
        <span className="font-mono">Nº 04</span> Pronto
      </span>
      <h2 className="editorial-serif text-4xl md:text-5xl text-[#0A0A0A] leading-[0.95] mb-4">
        Tudo pronto.<br />
        <span className="italic text-[var(--accent)]">Vamos criar?</span>
      </h2>
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
          Me dê ideias
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
