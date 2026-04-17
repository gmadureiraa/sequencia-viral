"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  PLANS,
  type PlanId,
  FREE_PLAN_USAGE_LIMIT,
  BUSINESS_USAGE_LIMIT_SENTINEL,
} from "@/lib/pricing";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Crown,
  Trash2,
  Save,
  AlertTriangle,
  Plus,
  X,
  Loader2,
  Sparkles,
  Check,
} from "lucide-react";

function isPaidPlanParam(id: string): id is PlanId {
  return id === "pro" || id === "business";
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const { profile, updateProfile, signOut, user, session, refreshProfile } =
    useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  const [name, setName] = useState(profile?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [twitterHandle, setTwitterHandle] = useState(profile?.twitter_handle || "");
  const [instagramHandle, setInstagramHandle] = useState(profile?.instagram_handle || "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedin_url || "");
  const [niche, setNiche] = useState<string[]>(profile?.niche || []);
  const [nicheInput, setNicheInput] = useState("");
  const [tone, setTone] = useState(profile?.tone || "casual");
  const [language, setLanguage] = useState(profile?.language || "pt-br");
  const [carouselStyle, setCarouselStyle] = useState(profile?.carousel_style || "white");

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setAvatarUrl(profile.avatar_url || "");
    setTwitterHandle(profile.twitter_handle || "");
    setInstagramHandle(profile.instagram_handle || "");
    setLinkedinUrl(profile.linkedin_url || "");
    setNiche(profile.niche || []);
    setTone(profile.tone || "casual");
    setLanguage(profile.language || "pt-br");
    setCarouselStyle(profile.carousel_style || "white");
  }, [profile]);

  useEffect(() => {
    const pay = searchParams.get("payment");
    const planParam = searchParams.get("plan");
    if (pay === "success") {
      setPaymentNotice(
        planParam && isPaidPlanParam(planParam)
          ? `Pagamento confirmado — plano ${PLANS[planParam].name} ativo. Obrigado!`
          : "Pagamento confirmado. Obrigado!"
      );
      void refreshProfile();
    } else if (pay === "cancelled") {
      setPaymentNotice("Checkout cancelado. Nada foi cobrado.");
    }
  }, [searchParams, refreshProfile]);

  const TONES = [
    { value: "professional", label: "Profissional", emoji: "👔" },
    { value: "casual", label: "Casual", emoji: "😎" },
    { value: "provocative", label: "Provocativo", emoji: "🔥" },
    { value: "educational", label: "Educacional", emoji: "🧠" },
  ];

  const NICHE_SUGGESTIONS = [
    "Marketing", "IA & Automação", "Cripto", "Finanças",
    "Educação", "Produtividade", "Saúde", "Design", "Tech", "Negócios",
  ];

  function addNiche(v: string) {
    const value = v.trim();
    if (!value || niche.includes(value)) return;
    setNiche([...niche, value]);
    setNicheInput("");
  }

  function removeNiche(value: string) {
    setNiche(niche.filter((n) => n !== value));
  }

  function handleUpgrade(planId: PlanId) {
    // Redireciona pra página de checkout customizada (ancoragem + orderbump + prova social).
    // A chamada real pra Stripe é feita de lá.
    window.location.href = `/app/checkout?plan=${planId}`;
  }

  async function handleSave() {
    setSaving(true);
    setPaymentNotice(null);
    try {
      await updateProfile({
        name,
        avatar_url: avatarUrl,
        twitter_handle: twitterHandle,
        instagram_handle: instagramHandle,
        linkedin_url: linkedinUrl,
        niche,
        tone,
        language,
        carousel_style: carouselStyle,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setPaymentNotice(
        e instanceof Error ? e.message : "Não foi possível salvar. Tente de novo."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      localStorage.removeItem("sequencia-viral_onboarding");
    } catch {
      /* ignore */
    }
    await signOut();
  }

  const plan = profile?.plan ?? "free";
  const used = profile?.usage_count ?? 0;
  const limit = profile?.usage_limit ?? FREE_PLAN_USAGE_LIMIT;
  const isUnlimited =
    plan === "business" ||
    (typeof limit === "number" && limit >= BUSINESS_USAGE_LIMIT_SENTINEL);
  const usageLabel = isUnlimited
    ? `Uso neste ciclo: ${used} carrosséis (sem teto prático no Business).`
    : `Uso neste ciclo: ${used} / ${limit} carrosséis.`;

  const planBlurb =
    plan === "free"
      ? `${FREE_PLAN_USAGE_LIMIT} carrosséis/mês no grátis · export PNG`
      : plan === "pro"
        ? `${PLANS.pro.carouselsPerMonth} carrosséis/mês · export PNG · 1 perfil`
        : plan === "business"
          ? "Carrosséis ilimitados · 3 seats · suporte prioritário"
          : "Consulte o suporte para detalhes do seu plano.";

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="tag-pill mb-6">Configurações</span>
        <h1 className="editorial-serif text-[3rem] sm:text-[4.5rem] md:text-[6rem] text-[var(--foreground)] leading-[0.95]">
          Seus <span className="italic text-[var(--accent)]">ajustes.</span>
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)] mb-12">
          Perfil, voz da marca e preferências. Tudo que torna o Sequência Viral <em>seu</em>.
        </p>
      </motion.div>

      {paymentNotice && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{paymentNotice}</span>
          <button
            type="button"
            onClick={() => setPaymentNotice(null)}
            className="shrink-0 text-emerald-700 hover:text-emerald-900"
            aria-label="Fechar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="space-y-8">
        {/* Profile Section */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="card-offset p-8"
        >
          <h2 className="editorial-serif text-2xl text-[var(--foreground)] mb-6 flex items-center gap-3">
            <User size={18} className="text-[var(--accent)]" />
            Perfil
          </h2>

          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-100"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-white text-lg font-bold">
                  {name?.[0]?.toUpperCase() || "U"}
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-500 mb-1">URL da foto</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">E-mail</label>
              <div className="flex items-center gap-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                <Mail size={14} />
                {profile?.email || "Não definido"}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Social Handles */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="card-offset p-8"
        >
          <h2 className="editorial-serif text-2xl text-[var(--foreground)] mb-6">Redes sociais</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Twitter / X</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </div>
                <input
                  type="text"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, ""))}
                  className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] pl-10 pr-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  placeholder="yourhandle"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Instagram</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                </div>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value.replace(/^@/, ""))}
                  className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] pl-10 pr-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  placeholder="yourhandle"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">LinkedIn</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </div>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] pl-10 pr-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Preferences */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="card-offset p-8"
        >
          <h2 className="editorial-serif text-2xl text-[var(--foreground)] mb-6">Preferências</h2>

          {/* Niche — free form */}
          <div className="mb-6">
            <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">Nichos e temas</label>

            {niche.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {niche.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-bold border border-[#0A0A0A]"
                    style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
                  >
                    {n}
                    <button onClick={() => removeNiche(n)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                      <X size={12} />
                    </button>
                  </span>
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
                }}
                placeholder="Ex: IA aplicada a marketing, cripto educacional…"
                className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3 pr-11 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
              <button
                onClick={() => addNiche(nicheInput)}
                disabled={!nicheInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {NICHE_SUGGESTIONS.filter((s) => !niche.includes(s)).slice(0, 8).map((s) => (
                <button
                  key={s}
                  onClick={() => addNiche(s)}
                  className="px-3 py-1 rounded-full bg-[#FFFDF9] border border-[#0A0A0A]/15 text-[11px] font-semibold text-[#0A0A0A]/70 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="mb-6">
            <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">Tom de voz</label>
            <div className="grid grid-cols-2 gap-2.5">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all flex items-center gap-2 ${
                    tone === t.value
                      ? "border-[#0A0A0A] bg-[#FFF6EC]"
                      : "border-[#0A0A0A]/15 bg-[#FFFDF9] hover:border-[#0A0A0A]/40"
                  }`}
                  style={tone === t.value ? { boxShadow: "3px 3px 0 0 #0A0A0A" } : {}}
                >
                  <span className="text-lg">{t.emoji}</span>
                  <span className="text-sm font-bold text-[#0A0A0A]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language & Style */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              >
                <option value="pt-br">Português (BR)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Estilo padrão</label>
              <select
                value={carouselStyle}
                onChange={(e) => setCarouselStyle(e.target.value)}
                className="w-full rounded-xl border border-[#0A0A0A]/20 bg-[#FFFDF9] px-4 py-3 text-sm text-[#0A0A0A] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              >
                <option value="white">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>
          </div>
        </motion.section>

        {/* Subscription */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="card-offset p-8"
        >
          <h2 className="editorial-serif text-2xl text-[var(--foreground)] mb-6 flex items-center gap-3">
            <Crown size={18} className="text-[var(--accent)]" />
            Assinatura
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-[#0A0A0A]">
                Plano atual:{" "}
                <span className="text-[var(--accent)]">
                  {plan === "free"
                    ? "Grátis"
                    : plan === "pro"
                      ? PLANS.pro.name
                      : plan === "business"
                        ? PLANS.business.name
                        : plan.charAt(0).toUpperCase() + plan.slice(1)}
                </span>
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">{planBlurb}</p>
              <p className="text-xs text-[var(--muted)] mt-2 font-medium">{usageLabel}</p>
              <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                Os dois templates visuais e os modos rápido e avançado estão disponíveis em qualquer plano. O limite mensal conta gerações de carrossel com IA (conceitos, texto e Content Machine).
              </p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mt-2">
                Novidades:{" "}
                <Link href="/app/roadmap" className="underline hover:text-[var(--foreground)]">
                  roadmap
                </Link>
              </p>
            </div>
            {plan === "free" && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleUpgrade("pro")}
                  className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-[var(--accent-dark)] transition-colors"
                  style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
                >
                  <Sparkles size={14} />
                  Assinar Pro — US$9,99/mês
                </button>
                <button
                  type="button"
                  onClick={() => handleUpgrade("business")}
                  className="inline-flex items-center justify-center gap-2 bg-[#0A0A0A] text-white px-6 py-3 rounded-xl text-sm font-bold border border-[#0A0A0A] hover:bg-zinc-800 transition-colors"
                  style={{ boxShadow: "4px 4px 0 0 var(--accent)" }}
                >
                  <Crown size={14} />
                  Assinar Business — US$29,99/mês
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* Save button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-scale w-full rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[var(--accent-dark)] hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
            {saving ? "Salvando…" : saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </motion.div>

        {/* Refazer Onboarding */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
        >
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-2 flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--accent)]" />
            Perfil de Conteúdo
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Refaça o onboarding para atualizar seu perfil de marca, nicho, tom de voz e pilares de conteúdo.
            Isso melhora a qualidade dos carrosséis gerados.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem("sequencia-viral_onboarding");
              if (profile && updateProfile) {
                updateProfile({ onboarding_completed: false });
              }
              window.location.href = "/app/onboarding";
            }}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            <Sparkles size={14} />
            Refazer onboarding
          </button>
        </motion.section>

        {/* Danger Zone */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-2xl border border-red-200 bg-red-50/50 p-6"
        >
          <h2 className="text-base font-semibold text-red-700 mb-2 flex items-center gap-2">
            <AlertTriangle size={18} />
            Zona de perigo
          </h2>
          <p className="text-sm text-red-600/80 mb-4">
            Essa ação é irreversível. Todos os seus dados serão apagados permanentemente.
          </p>

          <AnimatePresence>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50"
              >
                <Trash2 size={14} />
                Apagar conta
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700"
                  >
                    <Trash2 size={14} />
                    Sim, apagar minha conta
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-[var(--muted)]">
          Carregando configurações…
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
