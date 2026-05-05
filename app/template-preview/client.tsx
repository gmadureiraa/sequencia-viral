"use client";

import { useEffect, useState } from "react";
import {
  TemplateRenderer,
  TEMPLATES_META,
  type SlideProps,
  type TemplateId,
} from "@/components/app/templates";

const MOCK_PROFILE = {
  name: "Gabriel Madureira",
  handle: "@ogmadureira",
  photoUrl:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
};

const MOCK_IMAGE_BLACK_AND_WHITE =
  "https://images.unsplash.com/photo-1455849318743-b2233052fcff?auto=format&fit=crop&w=1080&q=80";

const MOCK_HEADING = "passei 8 meses postando pra ninguém comentar";
const MOCK_TITLE = "1. o erro";
const MOCK_TITLE_BODY =
  "passei 8 meses produzindo conteúdo 'perfeito' sobre **IA e marketing**.\n\ntudo postado no horário, tudo formatado bonitinho. cadê todo mundo?";
const MOCK_CTA_HEADING = "salva pra usar amanhã.";
const MOCK_CTA_BODY =
  "manda pro amigo founder que tá adiando 'começar a usar IA pra valer'.";

const MOCK_QUOTE = "se você não tá criando friction, não tá criando memória.";
const MOCK_QUOTE_BODY = "— me citando ontem, 3am, depois de 4 reels que ninguém salvou.";

const ALL_VARIANTS: NonNullable<SlideProps["variant"]>[] = [
  "cover",
  "headline",
  "photo",
  "quote",
  "split",
  "cta",
  "solid-brand",
  "text-only",
  "full-photo-bottom",
];

type SlideSpec = {
  variant: NonNullable<SlideProps["variant"]>;
  heading: string;
  body: string;
  imageUrl?: string;
  slideNumber: number;
  isLastSlide?: boolean;
};

function buildSlides(variants: NonNullable<SlideProps["variant"]>[]): SlideSpec[] {
  return variants.map((variant, idx) => {
    const slideNumber = idx + 1;
    const isLast = idx === variants.length - 1;
    if (variant === "cover") {
      return {
        variant,
        heading: MOCK_HEADING,
        body: "",
        imageUrl: MOCK_IMAGE_BLACK_AND_WHITE,
        slideNumber,
      };
    }
    if (variant === "cta") {
      return {
        variant,
        heading: MOCK_CTA_HEADING,
        body: MOCK_CTA_BODY,
        slideNumber,
        isLastSlide: isLast,
      };
    }
    if (variant === "quote") {
      return {
        variant,
        heading: MOCK_QUOTE,
        body: MOCK_QUOTE_BODY,
        slideNumber,
      };
    }
    if (variant === "photo" || variant === "full-photo-bottom") {
      return {
        variant,
        heading: MOCK_TITLE,
        body: MOCK_TITLE_BODY,
        imageUrl: MOCK_IMAGE_BLACK_AND_WHITE,
        slideNumber,
      };
    }
    if (variant === "split") {
      return {
        variant,
        heading: MOCK_TITLE,
        body: MOCK_TITLE_BODY,
        imageUrl: MOCK_IMAGE_BLACK_AND_WHITE,
        slideNumber,
      };
    }
    return {
      variant,
      heading: MOCK_TITLE,
      body: MOCK_TITLE_BODY,
      slideNumber,
    };
  });
}

const SLIDES_DEFAULT: SlideSpec[] = buildSlides(["cover", "headline", "cta"]);
const SLIDES_FULL: SlideSpec[] = buildSlides(ALL_VARIANTS);

// 3 briefs reais simulados pra testar templates lado-a-lado.
type BriefId = 1 | 2 | 3;

const PHOTO_AI_DARK =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&q=80";
const PHOTO_FOUNDER_LAPTOP =
  "https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?auto=format&fit=crop&w=1080&q=80";
const PHOTO_OFFICE_DESK =
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1080&q=80";

const BRIEFS: Record<BriefId, { label: string; slides: SlideSpec[] }> = {
  1: {
    label: "Brief 1 · Lista IA (tech/dados)",
    slides: [
      {
        variant: "cover",
        heading: "5 capacidades de IA que você ainda não usa.",
        body: "",
        imageUrl: PHOTO_AI_DARK,
        slideNumber: 1,
      },
      {
        variant: "headline",
        heading: "1. transcrever reunião em 5 conteúdos.",
        body: "1h de call vira 1 carrossel + 1 thread + 1 reel. tudo automático. tempo investido em revisão: 15min.",
        slideNumber: 2,
      },
      {
        variant: "split",
        heading: "2. agente que pesquisa por você.",
        body: "perplexity + claude desk + 1 prompt salvo. relatório de mercado em 30min, com fontes. era 3 dias.",
        imageUrl: PHOTO_OFFICE_DESK,
        slideNumber: 3,
      },
      {
        variant: "headline",
        heading: "3. carrossel viral em 30s.",
        body: "cole brief no sequencia viral, escolhe template, recebe 8 slides com voz do seu perfil. design + copy + imagem.",
        slideNumber: 4,
      },
      {
        variant: "photo",
        heading: "4. reel adaptado de viral.",
        body: "cola link do reel + reels viral devolve roteiro+storyboard adaptado pra sua marca. 12s de IA, 30min de gravação.",
        imageUrl: PHOTO_FOUNDER_LAPTOP,
        slideNumber: 5,
      },
      {
        variant: "headline",
        heading: "5. cobrança automática.",
        body: "kaleidos pay dispara lembrete via telegram + abre whatsapp pré-preenchido. zero planilha de inadimplência.",
        slideNumber: 6,
      },
      {
        variant: "quote",
        heading: "70% do dia que sobra é o que vale.",
        body: "— estratégia, ângulo, opinião. o resto IA já faz hoje.",
        slideNumber: 7,
      },
      {
        variant: "cta",
        heading: "Salva esse pra usar essa semana.",
        body: "Comenta IA que mando o stack completo no DM com link de cada uma.",
        slideNumber: 8,
        isLastSlide: true,
      },
    ],
  },
  2: {
    label: "Brief 2 · Demiti cliente R$ 18k (confessional)",
    slides: [
      {
        variant: "cover",
        heading: "Demiti um cliente de R$ 18k mês passado.",
        body: "",
        imageUrl: PHOTO_FOUNDER_LAPTOP,
        slideNumber: 1,
      },
      {
        variant: "headline",
        heading: "Por que demitir um cliente de R$ 18k.",
        body: "Não foi falta de dinheiro. Foi sobra de reunião. 4h por semana só pra atualizar planilha que ele nunca lia.",
        slideNumber: 2,
      },
      {
        variant: "photo",
        heading: "O custo real do cliente errado.",
        body: "16h/mês × 1 sócio sênior = R$ 8k de custo oculto. Resultado: o cliente não dava lucro. Era prejuízo com aparência de receita.",
        imageUrl: PHOTO_OFFICE_DESK,
        slideNumber: 3,
      },
      {
        variant: "split",
        heading: "Sinais que ignoramos por 6 meses.",
        body: "→ Pedia 'só uma reunião rápida' 3× por semana.\n→ Reclamava de tudo, nunca aprovava nada.\n→ Comparava com agência grande que cobra 5×.",
        imageUrl: PHOTO_AI_DARK,
        slideNumber: 4,
      },
      {
        variant: "headline",
        heading: "A conversa de 12 minutos.",
        body: "Mandei áudio explicando que não era encaixe. Ofereci 30 dias de transição. Ele agradeceu (e ficou aliviado). Eu também.",
        slideNumber: 5,
      },
      {
        variant: "quote",
        heading: "Cliente errado é inadimplência de tempo.",
        body: "— você cobra a fatura, mas paga com sócio cansado e time desmotivado.",
        slideNumber: 6,
      },
      {
        variant: "full-photo-bottom",
        heading: "30 dias depois: faturei mais.",
        body: "Vaga aberta foi pra um cliente novo de R$ 22k que toma 1/3 da operação. Lucro real subiu. Reunião caiu pela metade.",
        imageUrl: PHOTO_FOUNDER_LAPTOP,
        slideNumber: 7,
      },
      {
        variant: "cta",
        heading: "Auditar tua carteira: salva pra fazer hoje.",
        body: "Se não consegue identificar 1 cliente errado nos 5 primeiros minutos, é provável que tenha mais de um.",
        slideNumber: 8,
        isLastSlide: true,
      },
    ],
  },
  3: {
    label: "Brief 3 · 70% do dia perdido (provocador)",
    slides: [
      {
        variant: "cover",
        heading: "70% do seu dia é trabalho que IA já faz hoje.",
        body: "",
        imageUrl: PHOTO_AI_DARK,
        slideNumber: 1,
      },
      {
        variant: "headline",
        heading: "A conta que ninguém faz.",
        body: "10 horas / dia × 70% = 7 horas em tarefa repetitiva. Em 1 semana: 35h. Em 1 mês: 140h. Em 1 ano: 1.680h jogadas fora.",
        slideNumber: 2,
      },
      {
        variant: "split",
        heading: "Onde o tempo vaza.",
        body: "→ pesquisa: 3 dias → 30min com agentes\n→ carrossel: 1h → 30s\n→ reel: 4h → 12s + edição\n→ reunião → conteúdo: 2h → 15min\n→ cobrança: manual → telegram + WA pré-preenchido",
        imageUrl: PHOTO_OFFICE_DESK,
        slideNumber: 3,
      },
      {
        variant: "photo",
        heading: "Não é IA mágica. É IA dentro do fluxo.",
        body: "A diferença entre 'usar ChatGPT' e implementar IA na operação é a mesma entre 'martelo na mesa' e 'carpinteiro na obra'.",
        imageUrl: PHOTO_FOUNDER_LAPTOP,
        slideNumber: 4,
      },
      {
        variant: "headline",
        heading: "O que você ganha quando recupera 70%.",
        body: "Estratégia. Ângulo. Opinião. As coisas que IA não faz pra você. As que crescem o negócio.",
        slideNumber: 5,
      },
      {
        variant: "text-only",
        heading: "Não é o tempo que falta.",
        body: "É o tempo que tá sendo gasto onde não devia.",
        slideNumber: 6,
      },
      {
        variant: "quote",
        heading: "Quem economiza tempo cresce. Os outros giram.",
        body: "— a diferença é IA dentro da operação.",
        slideNumber: 7,
      },
      {
        variant: "cta",
        heading: "Quer ver onde a IA corta 70% do teu dia?",
        body: "Comenta DIAGNÓSTICO que mando o link da consultoria gratuita pra mapear teus 5 maiores gargalos.",
        slideNumber: 8,
        isLastSlide: true,
      },
    ],
  },
};

export default function TemplatePreviewClient({
  initial,
  initialFull,
  initialDark,
  initialBrief,
}: {
  initial: TemplateId;
  initialFull: boolean;
  initialDark: boolean;
  initialBrief: BriefId | null;
}) {
  const [selected, setSelected] = useState<TemplateId>(initial);
  const [showAll, setShowAll] = useState<boolean>(initialFull);
  const [dark, setDark] = useState<boolean>(initialDark);
  const [brief, setBrief] = useState<BriefId | null>(initialBrief);
  const slides = brief
    ? BRIEFS[brief].slides
    : showAll
      ? SLIDES_FULL
      : SLIDES_DEFAULT;

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("id", selected);
    if (showAll) url.searchParams.set("full", "1");
    else url.searchParams.delete("full");
    if (dark) url.searchParams.set("style", "dark");
    else url.searchParams.delete("style");
    if (brief) url.searchParams.set("brief", String(brief));
    else url.searchParams.delete("brief");
    window.history.replaceState({}, "", url.toString());
  }, [selected, showAll, dark, brief]);

  return (
    <div
      style={{
        padding: 32,
        fontFamily: "system-ui, sans-serif",
        background: "#fff",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "#000" }}
      >
        Template Preview (dev only)
      </h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Mock data, sem auth. Use pra validar visualmente novos templates antes
        de soltar pro fluxo de geração. URL aceita{" "}
        <code>?id=&lt;templateId&gt;&amp;brief=1|2|3</code>.
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <strong style={{ color: "#000", alignSelf: "center" }}>Brief:</strong>
        <button
          onClick={() => setBrief(null)}
          style={{
            padding: "8px 14px",
            border: "2px solid",
            borderColor: brief === null ? "#0E0E10" : "#ddd",
            background: brief === null ? "#0E0E10" : "#fff",
            color: brief === null ? "#fff" : "#0E0E10",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          mock genérico
        </button>
        {([1, 2, 3] as BriefId[]).map((b) => (
          <button
            key={b}
            onClick={() => setBrief(b)}
            style={{
              padding: "8px 14px",
              border: "2px solid",
              borderColor: brief === b ? "#0E0E10" : "#ddd",
              background: brief === b ? "#0E0E10" : "#fff",
              color: brief === b ? "#fff" : "#0E0E10",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {BRIEFS[b].label}
          </button>
        ))}
      </div>

      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}
      >
        {TEMPLATES_META.map((meta) => (
          <button
            key={meta.id}
            onClick={() => setSelected(meta.id)}
            style={{
              padding: "10px 18px",
              border: "2px solid",
              borderColor: selected === meta.id ? "#0E0E10" : "#ddd",
              background: selected === meta.id ? "#0E0E10" : "#fff",
              color: selected === meta.id ? "#fff" : "#0E0E10",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {meta.kicker} · {meta.name}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 16,
          color: "#000",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong>Template:</strong>{" "}
          <span data-testid="selected-id">{selected}</span>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          <span data-testid="full-mode">
            Mostrar todas as 9 variantes ({showAll ? "on" : "off"})
          </span>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
          />
          <span data-testid="dark-mode">Dark style ({dark ? "on" : "off"})</span>
        </label>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {slides.map((slide) => (
          <div key={slide.slideNumber}>
            <div
              style={{
                fontSize: 12,
                color: "#666",
                marginBottom: 8,
                fontFamily: "monospace",
              }}
              data-testid={`slide-label-${slide.slideNumber}`}
            >
              slide {slide.slideNumber} · variant: {slide.variant}
            </div>
            <TemplateRenderer
              templateId={selected}
              variant={slide.variant}
              heading={slide.heading}
              body={slide.body}
              imageUrl={slide.imageUrl}
              slideNumber={slide.slideNumber}
              totalSlides={slides.length}
              profile={MOCK_PROFILE}
              style={dark ? "dark" : "white"}
              isLastSlide={slide.isLastSlide}
              scale={0.42}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
