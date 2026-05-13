"use client";

import { forwardRef } from "react";
import TemplateManifesto from "./template-manifesto";
import TemplateFuturista from "./template-futurista";
import TemplateAutoral from "./template-autoral";
import TemplateTwitter from "./template-twitter";
import TemplateAmbitious from "./template-ambitious";
import TemplateBlank from "./template-blank";
import TemplateBohdan from "./template-bohdan";
import TemplatePaperMono from "./template-paper-mono";
import TemplateMadureira from "./template-madureira";
import TemplateMadureiraReflection from "./template-madureira-reflection";
import type { SlideProps, TemplateId, TemplateMeta } from "./types";

export type { SlideProps, TemplateId, TemplateMeta } from "./types";

/**
 * Orchestrator — escolhe o template certo baseado em `templateId`.
 * Repassa ref e todas as props de `SlideProps` pro componente alvo.
 */
export const TemplateRenderer = forwardRef<
  HTMLDivElement,
  SlideProps & { templateId: TemplateId }
>(function TemplateRenderer({ templateId, ...rest }, ref) {
  switch (templateId) {
    case "manifesto":
      return <TemplateManifesto ref={ref} {...rest} />;
    case "futurista":
      return <TemplateFuturista ref={ref} {...rest} />;
    case "autoral":
      return <TemplateAutoral ref={ref} {...rest} />;
    case "twitter":
      return <TemplateTwitter ref={ref} {...rest} />;
    case "ambitious":
      return <TemplateAmbitious ref={ref} {...rest} />;
    case "blank":
      return <TemplateBlank ref={ref} {...rest} />;
    case "bohdan":
      return <TemplateBohdan ref={ref} {...rest} />;
    case "paper-mono":
      return <TemplatePaperMono ref={ref} {...rest} />;
    case "madureira":
      return <TemplateMadureira ref={ref} {...rest} />;
    case "madureira-reflection":
      return <TemplateMadureiraReflection ref={ref} {...rest} />;
    default:
      return <TemplateTwitter ref={ref} {...rest} />;
  }
});

/** Metadados pra picker de template na UI (nome, kicker, paleta de preview). */
export const TEMPLATES_META: TemplateMeta[] = [
  {
    id: "manifesto",
    name: "Manifesto",
    kicker: "Nº 01 · EDITORIAL",
    palette: ["#0A0A0A", "#7CF067", "#F7F5EF"],
  },
  {
    id: "futurista",
    name: "Futurista",
    kicker: "Nº 02 · TECH",
    palette: ["#0B0F1E", "#00F0A0", "#FFFFFF"],
  },
  {
    id: "autoral",
    name: "Autoral",
    kicker: "Nº 03 · ZINE",
    palette: ["#F7F5EF", "#D262B2", "#0A0A0A"],
  },
  {
    id: "twitter",
    name: "Twitter v2",
    kicker: "Nº 04 · SCREENSHOT",
    palette: ["#FFFFFF", "#1D9BF0", "#0A0A0A"],
  },
  {
    id: "ambitious",
    name: "Ambição",
    kicker: "Nº 05 · MOTIVACIONAL",
    palette: ["#0A0A0A", "#EACB7C", "#F5F5F5"],
  },
  {
    id: "blank",
    name: "Editorial",
    kicker: "Nº 06 · EDITORIAL MIX",
    palette: ["#F9F9F9", "#222222", "#111111"],
  },
  {
    id: "bohdan",
    name: "Bohdan",
    kicker: "Nº 07 · DESIGN-FORWARD",
    palette: ["#0E0E0E", "#C8FF3D", "#FAFAF7"],
  },
  {
    id: "paper-mono",
    name: "Paper Mono",
    kicker: "Nº 08 · CONFESSIONAL",
    palette: ["#ECE9DD", "#0E0E10", "#1A1A1A"],
  },
  {
    id: "madureira",
    name: "Madureira",
    kicker: "Nº 09 · CAPA IA",
    palette: ["#0B0F1E", "#00F0A0", "#FFFFFF"],
  },
  {
    id: "madureira-reflection",
    name: "Madureira Reflexão",
    kicker: "Nº 10 · TEXTO-PURO",
    palette: ["#000000", "#f4f1ea", "#e63a1f"],
  },
];

export {
  TemplateManifesto,
  TemplateFuturista,
  TemplateAutoral,
  TemplateTwitter,
  TemplateAmbitious,
  TemplateBlank,
  TemplateBohdan,
  TemplatePaperMono,
  TemplateMadureira,
  TemplateMadureiraReflection,
};
