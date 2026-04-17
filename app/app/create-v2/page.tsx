"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  upsertUserCarousel,
  upsertGuestCarousel,
  bumpCarouselUsage,
} from "@/lib/carousel-storage";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

type TemplateName = "principal" | "futurista" | "autoral" | "twitter";
type FlowStep = "input" | "triagem" | "headlines" | "backbone" | "render";

interface TriagemData {
  transformacao: string;
  friccao: string;
  angulo: string;
  evidencias: string;
}

interface Headline {
  line1: string;
  line2: string;
}

interface HeadlinesData {
  angulo_dominante: string;
  headlines: Headline[];
}

interface BackboneData {
  headline_escolhida: string;
  hook: string;
  mecanismo: string;
  prova: string;
  aplicacao: string;
  direcao: string;
}

interface RenderData {
  blocks: string[];
}

// ─── Template configs ───────────────────────────────────────────────

const TEMPLATES: {
  id: TemplateName;
  name: string;
  blocks: number;
  desc: string;
  color: string;
  icon: string;
}[] = [
  {
    id: "principal",
    name: "Principal",
    blocks: 18,
    desc: "Raciocinio desenvolvido, respiros e subtitulos",
    color: "#EC6000",
    icon: "P",
  },
  {
    id: "futurista",
    name: "Futurista",
    blocks: 14,
    desc: "Sintese densa, visual limpo, blocos curtos",
    color: "#2563eb",
    icon: "F",
  },
  {
    id: "autoral",
    name: "Autoral",
    blocks: 18,
    desc: "Leitura analitica fluida, menos quebras",
    color: "#16a34a",
    icon: "A",
  },
  {
    id: "twitter",
    name: "Twitter",
    blocks: 21,
    desc: "Thread visual, avanço passo a passo",
    color: "#0ea5e9",
    icon: "T",
  },
];

const STEPS: { key: FlowStep; label: string; num: number }[] = [
  { key: "input", label: "Input", num: 1 },
  { key: "triagem", label: "Triagem", num: 2 },
  { key: "headlines", label: "Headlines", num: 3 },
  { key: "backbone", label: "Espinha", num: 4 },
  { key: "render", label: "Carrossel", num: 5 },
];

// ─── Component ──────────────────────────────────────────────────────

export default function CreateV2Page() {
  const { session, profile } = useAuth();

  // Flow state
  const [currentStep, setCurrentStep] = useState<FlowStep>("input");
  const [loading, setLoading] = useState(false);

  // Input
  const [topic, setTopic] = useState("");
  const [template, setTemplate] = useState<TemplateName>("principal");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("");

  // Step data
  const [triagem, setTriagem] = useState<TriagemData | null>(null);
  const [headlines, setHeadlines] = useState<HeadlinesData | null>(null);
  const [selectedHeadline, setSelectedHeadline] = useState<number | null>(null);
  const [backbone, setBackbone] = useState<BackboneData | null>(null);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [editedBlocks, setEditedBlocks] = useState<string[]>([]);

  // Context accumulator
  const [accumulatedContext, setAccumulatedContext] = useState("");

  // Save state
  const [carouselRecordId, setCarouselRecordId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on step change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [currentStep, loading]);

  // Prefill niche/tone from profile
  useEffect(() => {
    if (profile) {
      if (!niche) setNiche(Array.isArray(profile.niche) ? profile.niche.join(", ") : "");
      if (!tone) setTone(profile.tone || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // ─── API call helper ────────────────────────────────────────────

  const callAPI = useCallback(
    async (
      step: string,
      extra: Record<string, unknown> = {}
    ): Promise<Record<string, unknown> | null> => {
      setLoading(true);
      try {
        const res = await fetch("/api/generate-v2", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            step,
            topic,
            template,
            niche: niche || "geral",
            tone: tone || "informal",
            language: "pt-br",
            context: accumulatedContext,
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
        setLoading(false);
      }
    },
    [session, topic, template, niche, tone, accumulatedContext]
  );

  // ─── Step handlers ──────────────────────────────────────────────

  const handleStartTriagem = async () => {
    if (!topic.trim()) {
      toast.error("Cole um insumo antes de continuar.");
      return;
    }
    const data = await callAPI("triagem");
    if (data) {
      const t = data as unknown as TriagemData;
      setTriagem(t);
      setAccumulatedContext(JSON.stringify(t));
      setCurrentStep("triagem");
    }
  };

  const handleGenerateHeadlines = async () => {
    const data = await callAPI("headlines");
    if (data) {
      const h = data as unknown as HeadlinesData;
      setHeadlines(h);
      setSelectedHeadline(null);
      setCurrentStep("headlines");
    }
  };

  const handleRefreshHeadlines = async () => {
    const data = await callAPI("headlines");
    if (data) {
      const h = data as unknown as HeadlinesData;
      setHeadlines(h);
      setSelectedHeadline(null);
    }
  };

  const handleGenerateBackbone = async () => {
    if (selectedHeadline === null) {
      toast.error("Escolha uma headline primeiro.");
      return;
    }
    const ctx =
      accumulatedContext +
      "\n\nHEADLINE ESCOLHIDA (#" +
      (selectedHeadline + 1) +
      "): " +
      headlines!.headlines[selectedHeadline].line1 +
      " | " +
      headlines!.headlines[selectedHeadline].line2;
    setAccumulatedContext(ctx);
    const data = await callAPI("backbone", {
      choice: selectedHeadline + 1,
      context: ctx,
    });
    if (data) {
      const b = data as unknown as BackboneData;
      setBackbone(b);
      setAccumulatedContext(ctx + "\n\nESPINHA DORSAL: " + JSON.stringify(b));
      setCurrentStep("backbone");
    }
  };

  const handleGenerateCarousel = async () => {
    const data = await callAPI("render", { context: accumulatedContext });
    if (data) {
      const r = data as unknown as RenderData;
      setBlocks(r.blocks);
      setEditedBlocks([...r.blocks]);
      setCurrentStep("render");
    }
  };

  // ─── Export ─────────────────────────────────────────────────────

  const handleExportPng = async () => {
    if (!slidesRef.current) return;
    try {
      const dataUrl = await toPng(slidesRef.current, {
        backgroundColor: "#FAFAF8",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `carrossel-v2-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagem exportada!");
    } catch {
      toast.error("Erro ao exportar. Tente novamente.");
    }
  };

  const handleCopyText = () => {
    const text = editedBlocks.join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Texto copiado!");
  };

  // ─── Save carousel ─────────────────────────────────────────────
  const handleSaveCarousel = useCallback(async () => {
    if (editedBlocks.length === 0) return;
    setIsSaving(true);
    const title =
      headlines?.headlines[selectedHeadline ?? 0]?.line1 ||
      editedBlocks[0]?.replace(/^texto\s+\d+\s*[-–—]\s*/i, "") ||
      "Carrossel v2";
    const slides = editedBlocks.map((block, i) => {
      const content = block.replace(/^texto\s+\d+\s*[-–—]\s*/i, "");
      return { heading: i === 0 ? title : `Slide ${i + 1}`, body: content, imageQuery: "" };
    });
    const variationMeta = { title, style: template };

    try {
      const { user } = session ?? {};
      if (user && supabase) {
        try {
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
          }
          toast.success("Carrossel salvo na nuvem!");
        } catch (supaErr) {
          console.error("[create-v2] Supabase erro:", supaErr);
          const id = carouselRecordId ?? `carousel-v2-${Date.now()}`;
          setCarouselRecordId(id);
          upsertGuestCarousel({ id, title, slides, style: "dark", variation: variationMeta, savedAt: new Date().toISOString(), status: "draft" });
          toast.warning("Salvo localmente — nuvem indisponível.");
        }
      } else {
        const id = carouselRecordId ?? `carousel-v2-${Date.now()}`;
        setCarouselRecordId(id);
        upsertGuestCarousel({ id, title, slides, style: "dark", variation: variationMeta, savedAt: new Date().toISOString(), status: "draft" });
        toast.success("Carrossel salvo localmente!");
      }
    } catch (e) {
      console.error("[create-v2] Erro ao salvar:", e);
      toast.error("Erro ao salvar carrossel.");
    } finally {
      setIsSaving(false);
    }
  }, [editedBlocks, headlines, selectedHeadline, template, session, carouselRecordId]);

  // Auto-save when blocks are first generated (step 5 starts)
  useEffect(() => {
    if (currentStep === "render" && blocks.length > 0 && !carouselRecordId) {
      void handleSaveCarousel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, blocks.length]);

  // ─── Progress Bar ───────────────────────────────────────────────

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] border border-[#0A0A0A] text-white"
            style={{ boxShadow: "3px 3px 0 0 #0A0A0A" }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="editorial-serif text-3xl text-[#0A0A0A]">
              Carrossel 2.0
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Content Machine 5.4 -- criacao guiada em 5 etapas
            </p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8 flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isActive = i === currentStepIndex;
          const isDone = i < currentStepIndex;
          return (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 border ${
                  isActive
                    ? "bg-[var(--accent)] text-white border-[#0A0A0A] scale-110"
                    : isDone
                      ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                      : "bg-white text-[#0A0A0A]/40 border-[#0A0A0A]/20"
                }`}
                style={isActive ? { boxShadow: "2px 2px 0 0 #0A0A0A" } : {}}
              >
                {isDone ? <Check size={14} /> : step.num}
              </div>
              <span
                className={`text-[11px] font-semibold hidden sm:block ${
                  isActive ? "text-[#0A0A0A]" : isDone ? "text-[#0A0A0A]/60" : "text-[#0A0A0A]/30"
                }`}
              >
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 rounded transition-colors ${
                    isDone ? "bg-[#0A0A0A]" : "bg-[#0A0A0A]/10"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Content area */}
      <div ref={scrollRef} className="space-y-6">
        <AnimatePresence mode="wait">
          {/* ─── STEP 1: INPUT ───────────────────────────────── */}
          {currentStep === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Topic input */}
              <div className="rounded-2xl border-2 border-[#0A0A0A] bg-white p-6" style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}>
                <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3 block">
                  Insumo (tema, link, ideia, texto)
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Cole aqui o insumo: um link, uma ideia, uma transcricao, um print de texto..."
                  rows={5}
                  className="w-full resize-none rounded-xl border border-[#0A0A0A]/10 bg-[#FAFAF8] px-4 py-3 text-[15px] text-[#0A0A0A] placeholder:text-[#0A0A0A]/30 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition"
                />
              </div>

              {/* Optional niche/tone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[#0A0A0A]/10 bg-white p-4">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2 block">
                    Nicho (opcional)
                  </label>
                  <input
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="Ex: marketing digital"
                    className="w-full rounded-lg border border-[#0A0A0A]/10 bg-[#FAFAF8] px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#0A0A0A]/30 focus:border-[var(--accent)] focus:outline-none transition"
                  />
                </div>
                <div className="rounded-2xl border border-[#0A0A0A]/10 bg-white p-4">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2 block">
                    Tom (opcional)
                  </label>
                  <input
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="Ex: informal, direto"
                    className="w-full rounded-lg border border-[#0A0A0A]/10 bg-[#FAFAF8] px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#0A0A0A]/30 focus:border-[var(--accent)] focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Template picker */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3 block">
                  Template do carrossel
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((t) => {
                    const selected = template === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id)}
                        className={`relative rounded-2xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.97] ${
                          selected
                            ? "border-[#0A0A0A] bg-white"
                            : "border-[#0A0A0A]/10 bg-white hover:border-[#0A0A0A]/30"
                        }`}
                        style={selected ? { boxShadow: "3px 3px 0 0 #0A0A0A" } : {}}
                      >
                        {selected && (
                          <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white border border-[#0A0A0A]">
                            <Check size={12} />
                          </div>
                        )}
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm font-black mb-3 border border-[#0A0A0A]"
                          style={{ backgroundColor: t.color, boxShadow: "2px 2px 0 0 #0A0A0A" }}
                        >
                          {t.icon}
                        </div>
                        <p className="text-sm font-bold text-[#0A0A0A]">{t.name}</p>
                        <p className="text-[11px] text-[var(--muted)] mt-0.5">
                          {t.blocks} blocos -- {t.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleStartTriagem}
                disabled={loading || !topic.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-white py-4 text-[15px] font-bold border-2 border-[#0A0A0A] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analisando insumo...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Iniciar Triagem
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* ─── STEP 2: TRIAGEM ─────────────────────────────── */}
          {currentStep === "triagem" && triagem && (
            <motion.div
              key="triagem"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div
                className="rounded-2xl border-2 border-[#0A0A0A] bg-white overflow-hidden"
                style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
              >
                <div className="bg-[#0A0A0A] text-white px-6 py-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">
                    Etapa 2 -- Triagem
                  </span>
                </div>
                <div className="divide-y divide-[#0A0A0A]/10">
                  {[
                    { label: "Transformacao", value: triagem.transformacao },
                    { label: "Friccao central", value: triagem.friccao },
                    { label: "Angulo narrativo", value: triagem.angulo },
                    { label: "Evidencias", value: triagem.evidencias },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-6 py-4">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] mb-1">
                        {label}
                      </p>
                      <p className="text-[14px] text-[#0A0A0A] leading-relaxed">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep("input")}
                  className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A]/20 bg-white px-5 py-3 text-sm font-semibold text-[#0A0A0A]/60 hover:border-[#0A0A0A]/40 transition"
                >
                  <ArrowLeft size={16} />
                  Voltar
                </button>
                <button
                  onClick={handleGenerateHeadlines}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-white py-3 text-[15px] font-bold border-2 border-[#0A0A0A] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                  style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Gerando headlines...
                    </>
                  ) : (
                    <>
                      Gerar Headlines
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 3: HEADLINES ───────────────────────────── */}
          {currentStep === "headlines" && headlines && (
            <motion.div
              key="headlines"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Angulo dominante */}
              <div className="rounded-2xl border border-[#0A0A0A]/10 bg-white px-6 py-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
                  Angulo dominante selecionado
                </p>
                <p className="text-sm text-[#0A0A0A] leading-relaxed">
                  {headlines.angulo_dominante}
                </p>
              </div>

              {/* Headlines grid */}
              <div className="space-y-3">
                <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
                  Escolha 1 headline (capa do carrossel)
                </label>
                <div className="grid gap-3">
                  {headlines.headlines.map((h, i) => {
                    const isSelected = selectedHeadline === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedHeadline(i)}
                        className={`relative rounded-2xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.99] ${
                          isSelected
                            ? "border-[#0A0A0A] bg-white"
                            : "border-[#0A0A0A]/10 bg-white hover:border-[#0A0A0A]/30"
                        }`}
                        style={isSelected ? { boxShadow: "3px 3px 0 0 #0A0A0A" } : {}}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border transition ${
                              isSelected
                                ? "bg-[var(--accent)] text-white border-[#0A0A0A]"
                                : "bg-[#FAFAF8] text-[#0A0A0A]/40 border-[#0A0A0A]/20"
                            }`}
                          >
                            {isSelected ? <Check size={14} /> : i + 1}
                          </div>
                          <div>
                            <p className="text-[15px] font-bold text-[#0A0A0A] leading-snug">
                              {h.line1}
                            </p>
                            <p className="text-[14px] text-[#0A0A0A]/70 mt-1 leading-snug">
                              {h.line2}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep("triagem")}
                  className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A]/20 bg-white px-5 py-3 text-sm font-semibold text-[#0A0A0A]/60 hover:border-[#0A0A0A]/40 transition"
                >
                  <ArrowLeft size={16} />
                  Voltar
                </button>
                <button
                  onClick={handleRefreshHeadlines}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A]/20 bg-white px-5 py-3 text-sm font-semibold text-[#0A0A0A]/60 hover:border-[#0A0A0A]/40 transition disabled:opacity-40"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Refazer
                </button>
                <button
                  onClick={handleGenerateBackbone}
                  disabled={loading || selectedHeadline === null}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-white py-3 text-[15px] font-bold border-2 border-[#0A0A0A] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                  style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Construindo espinha...
                    </>
                  ) : (
                    <>
                      Construir Espinha Dorsal
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 4: BACKBONE ────────────────────────────── */}
          {currentStep === "backbone" && backbone && (
            <motion.div
              key="backbone"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div
                className="rounded-2xl border-2 border-[#0A0A0A] bg-white overflow-hidden"
                style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
              >
                <div className="bg-[#0A0A0A] text-white px-6 py-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">
                    Etapa 4 -- Espinha Dorsal
                  </span>
                </div>
                <div className="divide-y divide-[#0A0A0A]/10">
                  {[
                    { label: "Headline escolhida", value: backbone.headline_escolhida },
                    { label: "Hook", value: backbone.hook },
                    { label: "Mecanismo", value: backbone.mecanismo },
                    { label: "Prova", value: backbone.prova },
                    { label: "Aplicacao", value: backbone.aplicacao },
                    { label: "Direcao", value: backbone.direcao },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-6 py-4">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] mb-1">
                        {label}
                      </p>
                      <p className="text-[14px] text-[#0A0A0A] leading-relaxed">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep("headlines")}
                  className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A]/20 bg-white px-5 py-3 text-sm font-semibold text-[#0A0A0A]/60 hover:border-[#0A0A0A]/40 transition"
                >
                  <ArrowLeft size={16} />
                  Voltar
                </button>
                <button
                  onClick={handleGenerateCarousel}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-white py-3 text-[15px] font-bold border-2 border-[#0A0A0A] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                  style={{ boxShadow: "4px 4px 0 0 #0A0A0A" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Renderizando carrossel...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Gerar Carrossel
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 5: RENDER ──────────────────────────────── */}
          {currentStep === "render" && editedBlocks.length > 0 && (
            <motion.div
              key="render"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
                    Template {template} -- {editedBlocks.length} blocos
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0A0A0A]/60 hover:border-[#0A0A0A]/40 transition"
                  >
                    <Copy size={14} />
                    Copiar
                  </button>
                  <button
                    onClick={handleSaveCarousel}
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0A0A0A]/60 hover:border-[#0A0A0A]/40 transition disabled:opacity-40"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Salvar
                  </button>
                  <button
                    onClick={handleExportPng}
                    className="flex items-center gap-2 rounded-xl bg-[var(--accent)] text-white px-4 py-2 text-sm font-bold border-2 border-[#0A0A0A] transition hover:brightness-110"
                    style={{ boxShadow: "2px 2px 0 0 #0A0A0A" }}
                  >
                    <Download size={14} />
                    Exportar PNG
                  </button>
                </div>
              </div>

              {/* Slides preview */}
              <div ref={slidesRef} className="space-y-4">
                {editedBlocks.map((block, i) => (
                  <SlideCard
                    key={i}
                    index={i}
                    text={block}
                    template={template}
                    onChange={(val) => {
                      const next = [...editedBlocks];
                      next[i] = val;
                      setEditedBlocks(next);
                    }}
                  />
                ))}
              </div>

              {/* Back */}
              <button
                onClick={() => setCurrentStep("backbone")}
                className="flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A]/20 bg-white px-5 py-3 text-sm font-semibold text-[#0A0A0A]/60 hover:border-[#0A0A0A]/40 transition"
              >
                <ArrowLeft size={16} />
                Voltar para espinha dorsal
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading overlay */}
        {loading && currentStep === "input" && null}
      </div>
    </div>
  );
}

// ─── Slide Card Component ───────────────────────────────────────────

function SlideCard({
  index,
  text,
  template,
  onChange,
}: {
  index: number;
  text: string;
  template: TemplateName;
  onChange: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);

  // Parse "texto N - content"
  const match = text.match(/^texto\s+\d+\s*[-–—]\s*/i);
  const content = match ? text.slice(match[0].length) : text;
  const label = `texto ${index + 1}`;

  const templateColors: Record<TemplateName, { bg: string; accent: string; text: string }> = {
    principal: { bg: "#0A0A0A", accent: "#EC6000", text: "#FFFFFF" },
    futurista: { bg: "#F8FAFC", accent: "#2563eb", text: "#0F172A" },
    autoral: { bg: "#0A0A0A", accent: "#16a34a", text: "#FFFFFF" },
    twitter: { bg: "#FFFFFF", accent: "#0ea5e9", text: "#0F1419" },
  };

  const colors = templateColors[template];
  const isFirstSlide = index === 0;

  return (
    <div
      className="rounded-2xl border-2 overflow-hidden transition-all"
      style={{
        borderColor: colors.accent + "40",
        boxShadow: isFirstSlide ? `3px 3px 0 0 ${colors.accent}` : undefined,
      }}
    >
      {/* Slide header */}
      <div
        className="flex items-center justify-between px-5 py-2"
        style={{ backgroundColor: colors.bg }}
      >
        <span
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: colors.accent }}
        >
          {label} {isFirstSlide && "-- CAPA"}
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
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded"
          style={{ color: colors.accent, backgroundColor: colors.accent + "15" }}
        >
          {editing ? "salvar" : "editar"}
        </button>
      </div>

      {/* Slide content */}
      <div className="p-5" style={{ backgroundColor: colors.bg + "08" }}>
        {editing ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-[#0A0A0A]/10 bg-white px-3 py-2 text-[14px] text-[#0A0A0A] focus:border-[var(--accent)] focus:outline-none transition"
            autoFocus
          />
        ) : (
          <p
            className={`text-[15px] leading-relaxed ${
              isFirstSlide ? "font-bold text-lg" : ""
            }`}
            style={{ color: "#0A0A0A" }}
          >
            {content}
          </p>
        )}
      </div>
    </div>
  );
}
