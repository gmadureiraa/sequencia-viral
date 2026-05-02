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

const SLIDES: {
  variant: SlideProps["variant"];
  heading: string;
  body: string;
  imageUrl?: string;
  slideNumber: number;
  isLastSlide?: boolean;
}[] = [
  {
    variant: "cover",
    heading: MOCK_HEADING,
    body: "",
    imageUrl: MOCK_IMAGE_BLACK_AND_WHITE,
    slideNumber: 1,
  },
  {
    variant: "headline",
    heading: MOCK_TITLE,
    body: MOCK_TITLE_BODY,
    slideNumber: 2,
  },
  {
    variant: "cta",
    heading: MOCK_CTA_HEADING,
    body: MOCK_CTA_BODY,
    slideNumber: 3,
    isLastSlide: true,
  },
];

export default function TemplatePreviewClient({
  initial,
}: {
  initial: TemplateId;
}) {
  const [selected, setSelected] = useState<TemplateId>(initial);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("id", selected);
    window.history.replaceState({}, "", url.toString());
  }, [selected]);

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

      <div style={{ marginBottom: 16, color: "#000" }}>
        <strong>Template selecionado:</strong>{" "}
        <span data-testid="selected-id">{selected}</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {SLIDES.map((slide) => (
          <div key={slide.slideNumber}>
            <div
              style={{
                fontSize: 12,
                color: "#666",
                marginBottom: 8,
                fontFamily: "monospace",
              }}
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
              totalSlides={SLIDES.length}
              profile={MOCK_PROFILE}
              style="white"
              isLastSlide={slide.isLastSlide}
              scale={0.42}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
