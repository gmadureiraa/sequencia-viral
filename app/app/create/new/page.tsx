"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { upsertUserCarousel } from "@/lib/carousel-storage";
import { makeMockSlides } from "@/lib/create/types";

/**
 * Tela 01 — Nova criação. User escreve brief → persiste rascunho com
 * topic+tone+lang → navega pra /[id]/concepts (IA gera 5 ângulos
 * diferentes pra escolher). Só depois disso vem template e edit.
 */

type Tone = "editorial" | "informal" | "direto" | "provocativo";
type Lang = "pt-br" | "en";

const SHORTCUTS: { label: string; kicker: string; seed: string }[] = [
  {
    kicker: "Nº 01 · TUTORIAL",
    label: "Como fazer X",
    seed: "Como [ação específica] em [N passos / contexto]. Ex: como ganhar os primeiros 1.000 seguidores sem ads.",
  },
  {
    kicker: "Nº 02 · CASE",
    label: "Lições de um case",
    seed: "O que [marca/pessoa] fez para conseguir [resultado], e as lições aplicáveis ao seu negócio.",
  },
  {
    kicker: "Nº 03 · HOT TAKE",
    label: "Opinião forte",
    seed: "Por que [crença popular] está errada e o que você deveria fazer no lugar.",
  },
  {
    kicker: "Nº 04 · DADOS",
    label: "Dados surpreendentes",
    seed: "X dados que [público] não sabe sobre [tema] — e o que muda quando você entende.",
  },
  {
    kicker: "Nº 05 · MITOS",
    label: "Mitos vs verdades",
    seed: "N mitos sobre [tema] que ninguém questiona — e a verdade que contradiz cada um.",
  },
  {
    kicker: "Nº 06 · PROCESSO",
    label: "Explicador técnico",
    seed: "Como [processo/mecanismo] realmente funciona — passo a passo sem jargão.",
  },
];

const TONE_OPTS: { id: Tone; label: string }[] = [
  { id: "editorial", label: "Editorial" },
  { id: "informal", label: "Informal" },
  { id: "direto", label: "Direto" },
  { id: "provocativo", label: "Provocativo" },
];
const LANG_OPTS: { id: Lang; label: string }[] = [
  { id: "pt-br", label: "PT-BR" },
  { id: "en", label: "EN" },
];

function OptCycler<T extends string | number>({
  label,
  value,
  options,
  onChange,
  formatter,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  formatter?: (v: T) => string;
}) {
  const idx = options.indexOf(value);
  const next = () => {
    const ni = (idx + 1) % options.length;
    onChange(options[ni]);
  };
  const display = formatter ? formatter(value) : String(value);
  return (
    <button
      type="button"
      onClick={next}
      className="flex items-center justify-between px-4 py-[14px] transition-all"
      style={{
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "0 0 0 0 var(--sv-ink)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translate(-1px,-1px)";
        e.currentTarget.style.boxShadow = "3px 3px 0 0 var(--sv-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translate(0,0)";
        e.currentTarget.style.boxShadow = "0 0 0 0 var(--sv-ink)";
      }}
    >
      <span
        style={{
          fontFamily: "var(--sv-sans)",
          fontWeight: 600,
          fontSize: 13,
          color: "var(--sv-ink)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--sv-ink)",
          fontWeight: 700,
        }}
      >
        {display}
      </span>
    </button>
  );
}

export default function NewCarouselPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [idea, setIdea] = useState("");
  const [tone, setTone] = useState<Tone>("editorial");
  const [lang, setLang] = useState<Lang>("pt-br");
  const [submitting, setSubmitting] = useState(false);

  const niche = useMemo(() => {
    const blob = (profile?.niche ?? []).join(" ").toLowerCase();
    if (blob.includes("cripto") || blob.includes("web3")) return "crypto";
    if (blob.includes("ia") || blob.includes("automa")) return "ai";
    if (blob.includes("market") || blob.includes("mkt")) return "marketing";
    return "business";
  }, [profile]);

  async function handleSubmit() {
    if (!idea.trim()) {
      toast.error("Escreva uma ideia antes de seguir.");
      return;
    }
    if (!user || !supabase) {
      toast.error("Faça login para criar um carrossel.");
      return;
    }
    setSubmitting(true);
    try {
      // Persiste rascunho inicial com metadados (brief vai na variation.style
      // como hint pra rota /concepts/ saber o tema, tom e idioma).
      const mockSlides = makeMockSlides(idea, 8);
      const { row } = await upsertUserCarousel(supabase, user.id, {
        id: null,
        title: idea.slice(0, 80),
        slides: mockSlides,
        slideStyle: "white",
        status: "draft",
        variation: {
          title: idea.slice(0, 80),
          style: `${tone}|${lang}|${niche}`,
        },
      });
      router.push(`/app/create/${row.id}/concepts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1100, minWidth: 0 }}
    >
      {/* eyebrow */}
      <span className="sv-eyebrow">
        <span className="sv-dot" /> Nº 01 · Brief · Novo carrossel
      </span>

      <h1
        className="sv-display mt-3"
        style={{
          fontSize: "clamp(26px, 3.6vw, 40px)",
          lineHeight: 1.04,
          letterSpacing: "-0.02em",
        }}
      >
        Qual é a <em>ideia</em> do{" "}
        <span
          style={{
            background: "var(--sv-green)",
            padding: "0 8px",
            fontStyle: "italic",
          }}
        >
          carrossel
        </span>
        ?
      </h1>
      <p
        className="mt-1.5"
        style={{
          color: "var(--sv-muted)",
          fontSize: 13.5,
          lineHeight: 1.5,
          maxWidth: 520,
        }}
      >
        Escreve um tema, cola um link, joga um rascunho. Depois a IA monta
        cinco ângulos diferentes pra você escolher o caminho.
      </p>

      {/* Split: 2 cols no desktop, 1 col em mobile — min-width 0 impede overflow */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2" style={{ minWidth: 0 }}>
        {/* LEFT — brief */}
        <div className="flex flex-col gap-4" style={{ minWidth: 0 }}>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Ex: A estratégia dos três zeros da Coca-Cola e por que ela redefine o mercado de bebidas..."
            style={{
              minHeight: 150,
              fontFamily: "var(--sv-display)",
              fontSize: 19,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              padding: 16,
              background: "var(--sv-white)",
              border: "1.5px solid var(--sv-ink)",
              outline: 0,
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
              fontWeight: 400,
              resize: "vertical",
              color: "var(--sv-ink)",
              width: "100%",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "5px 5px 0 0 var(--sv-green)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "3px 3px 0 0 var(--sv-ink)";
            }}
          />

          <div>
            <div
              className="mb-2"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Atalhos · clique pra preencher o prompt
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="text-left transition-all"
                  style={{
                    padding: "10px 12px",
                    border: "1.5px solid var(--sv-ink)",
                    background: "var(--sv-white)",
                    boxShadow: "0 0 0 0 var(--sv-ink)",
                  }}
                  onClick={() => setIdea(s.seed)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translate(-1px,-1px)";
                    e.currentTarget.style.boxShadow =
                      "3px 3px 0 0 var(--sv-ink)";
                    e.currentTarget.style.background = "var(--sv-green)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translate(0,0)";
                    e.currentTarget.style.boxShadow = "0 0 0 0 var(--sv-ink)";
                    e.currentTarget.style.background = "var(--sv-white)";
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 8.5,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--sv-muted)",
                    }}
                  >
                    {s.kicker}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--sv-ink)",
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div
              className="mb-2.5"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Tom e idioma
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptCycler
                label="Tom"
                value={tone}
                options={TONE_OPTS.map((o) => o.id)}
                onChange={(v) => setTone(v)}
                formatter={(v) =>
                  TONE_OPTS.find((o) => o.id === v)?.label ?? String(v)
                }
              />
              <OptCycler
                label="Idioma"
                value={lang}
                options={LANG_OPTS.map((o) => o.id)}
                onChange={(v) => setLang(v)}
                formatter={(v) =>
                  LANG_OPTS.find((o) => o.id === v)?.label ?? String(v)
                }
              />
            </div>
            <p
              className="mt-2"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                color: "var(--sv-muted)",
                letterSpacing: "0.08em",
              }}
            >
              A IA decide a quantidade de slides e o CTA ideal pra cada ângulo.
            </p>
          </div>

          <button
            type="button"
            disabled={submitting || !idea.trim()}
            onClick={handleSubmit}
            className="sv-btn sv-btn-primary"
            style={{
              padding: "11px 18px",
              fontSize: 11,
              alignSelf: "flex-start",
              opacity: submitting || !idea.trim() ? 0.55 : 1,
              cursor: submitting || !idea.trim() ? "not-allowed" : "pointer",
            }}
          >
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.3 5.8 22l2.4-8.1L2 9.4h7.6z" />
            </svg>
            {submitting ? "Preparando..." : "Ver caminhos possíveis →"}
          </button>
        </div>

        {/* RIGHT — preview de como vai funcionar (estático, explicativo) */}
        <aside
          style={{
            padding: 18,
            background: "var(--sv-ink)",
            color: "var(--sv-paper)",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,.08) 1px, transparent 1.5px)",
            backgroundSize: "14px 14px",
            minWidth: 0,
            height: "fit-content",
          }}
        >
          <div
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--sv-green)",
              marginBottom: 10,
            }}
          >
            ✦ Como funciona
          </div>
          <h3
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 17,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              fontWeight: 400,
              marginBottom: 10,
            }}
          >
            Você escreve. A IA gera <em>cinco ângulos</em>. Você escolhe{" "}
            <em>um</em> e refina.
          </h3>
          <ol
            style={{
              paddingLeft: 0,
              listStyle: "none",
              display: "grid",
              gap: 7,
              marginTop: 10,
            }}
          >
            {[
              { n: "01", t: "Escreva", d: "Brief livre no box ao lado." },
              {
                n: "02",
                t: "Veja caminhos",
                d: "A IA devolve 5 ângulos (dado / história / provocação / tutorial / contrarian).",
              },
              {
                n: "03",
                t: "Escolha um",
                d: "Clique no ângulo. A IA gera o carrossel completo.",
              },
              {
                n: "04",
                t: "Pick template",
                d: "Escolhe o tratamento visual (4 opções).",
              },
              {
                n: "05",
                t: "Edita e exporta",
                d: "Refina slide a slide. PNG / PDF.",
              },
            ].map((step) => (
              <li
                key={step.n}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr",
                  gap: 8,
                  alignItems: "start",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 20,
                    lineHeight: 1,
                    color: "var(--sv-green)",
                  }}
                >
                  {step.n}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontWeight: 700,
                      fontSize: 12,
                      color: "var(--sv-paper)",
                    }}
                  >
                    {step.t}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontSize: 11,
                      color: "rgba(247,245,239,0.6)",
                      lineHeight: 1.4,
                      marginTop: 1,
                    }}
                  >
                    {step.d}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </motion.div>
  );
}
