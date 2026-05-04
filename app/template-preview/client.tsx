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

export default function TemplatePreviewClient({
  initial,
  initialFull,
  initialDark,
}: {
  initial: TemplateId;
  initialFull: boolean;
  initialDark: boolean;
}) {
  const [selected, setSelected] = useState<TemplateId>(initial);
  const [showAll, setShowAll] = useState<boolean>(initialFull);
  const [dark, setDark] = useState<boolean>(initialDark);
  const slides = showAll ? SLIDES_FULL : SLIDES_DEFAULT;

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("id", selected);
    if (showAll) url.searchParams.set("full", "1");
    else url.searchParams.delete("full");
    if (dark) url.searchParams.set("style", "dark");
    else url.searchParams.delete("style");
    window.history.replaceState({}, "", url.toString());
  }, [selected, showAll, dark]);

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
        de soltar pro fluxo de geração. URL aceita <code>?id=&lt;templateId&gt;</code>.
      </p>

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
