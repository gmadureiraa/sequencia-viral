/**
 * Template visual único: formato thread (Twitter/X) — preview/export em `EditorialSlide`.
 * Geração de texto: conceitos → /api/generate (layout não altera o prompt).
 */

export type DesignTemplateId = "twitter";

/** Único layout do produto (thread / Twitter). */
export const DEFAULT_DESIGN_TEMPLATE: DesignTemplateId = "twitter";

export type CreationMode = "quick" | "guided";

/** Preferência de pessoas em fotos (busca stock + prompt Imagen). */
export type ImagePeopleMode = "auto" | "with_people" | "no_people";

export function normalizeImagePeopleMode(
  raw: string | null | undefined
): ImagePeopleMode {
  if (raw === "with_people" || raw === "no_people") return raw;
  return "auto";
}

/** Sufixo curto em inglês para busca de imagens (Serper/Unsplash). */
export function imagePeopleModeSearchSuffix(mode: ImagePeopleMode): string {
  switch (mode) {
    case "with_people":
      return "real people candid professional photography authentic portrait lifestyle";
    case "no_people":
      return "no people empty scene still life architecture texture object detail";
    default:
      return "";
  }
}

/** Instruções extras para o prompt do Imagen (inglês). */
export function imagePeopleModeImagenInstruction(mode: ImagePeopleMode): string {
  switch (mode) {
    case "with_people":
      return "Include one or more realistic adult human subjects naturally integrated into the scene; diverse, natural poses and expressions; photorealistic skin and fabric.";
    case "no_people":
      return "Strictly no people: no faces, no full bodies, no silhouettes that read as persons. Focus on environment, objects, hands-free workspace, architecture, nature, or abstract detail.";
    default:
      return "If the slide theme implies people or human activity, show believable diverse adults in natural light; otherwise prefer strong environmental or object photography without inventing people.";
  }
}

/** Regras narrativas do Content Machine (render). */
const CONTENT_MACHINE_NARRATIVE_RULES =
  "Exatamente 16 blocos. Narrativa contínua estilo editorial premium: alternância de ritmo, micro-ganchos entre blocos, capa forte + fechamento com CTA que referencia o gancho inicial.";

export const DESIGN_TEMPLATES: {
  id: DesignTemplateId;
  emoji: string;
  name: string;
  desc: string;
  color: string;
  blockCount: number;
  figmaLabel: string;
  imageSearchStyleHint: string;
  imageGenRealismFragment: string;
}[] = [
  {
    id: "twitter",
    emoji: "𝕏",
    name: "Thread (Twitter/X)",
    desc: "Formato screenshot de thread: avatar, nome, @, texto e imagem — tipografia fixa estilo rede social.",
    color: "#FF5500",
    blockCount: 16,
    figmaLabel: "Template Thread",
    imageSearchStyleHint:
      "social thread screenshot style photography photorealistic candid natural light documentary",
    imageGenRealismFragment:
      "Hyper-realistic photograph suitable for a social thread carousel: natural light, authentic environment, believable detail. Must look like a real photo — not illustration, not 3D render, not anime.",
  },
] as const;

export const EDITORIAL_ACCENT = "#FF5500";
export const EDITORIAL_BG_DARK = "#121212";
export const EDITORIAL_BG_LIGHT = "#fafafa";

export function getDesignTemplateMeta(id: DesignTemplateId) {
  return DESIGN_TEMPLATES.find((t) => t.id === id) ?? DESIGN_TEMPLATES[0];
}

/** Valor persistido legado (editorial/spotlight) → único template atual. */
export function normalizeDesignTemplate(
  raw: string | null | undefined
): DesignTemplateId {
  void raw;
  return "twitter";
}

export const CONTENT_MACHINE_RENDER_SPECS: Record<
  DesignTemplateId,
  { blocks: number; rules: string }
> = {
  twitter: { blocks: 16, rules: CONTENT_MACHINE_NARRATIVE_RULES },
};

export function usesNativeSlidePreview(_template: DesignTemplateId): boolean {
  return true;
}

/** @deprecated */
export function usesTweetStylePreview(_template: DesignTemplateId): boolean {
  return true;
}

export type PluginExportPayload = {
  version: 1;
  designTemplate: DesignTemplateId;
  creationMode: CreationMode;
  figmaFileUrl: string;
  generatedAt: string;
  blocks: string[];
};

const FIGMA_TEMPLATES_URL =
  "https://www.figma.com/design/K503FED5B8c6xQbwjgS9wp/Templates-%7C-Content-Machine-4.0";

export function buildContentMachinePluginExport(args: {
  designTemplate: DesignTemplateId;
  creationMode: CreationMode;
  blocks: string[];
}): PluginExportPayload {
  return {
    version: 1,
    designTemplate: args.designTemplate,
    creationMode: args.creationMode,
    figmaFileUrl: FIGMA_TEMPLATES_URL,
    generatedAt: new Date().toISOString(),
    blocks: args.blocks,
  };
}

export function pluginExportToPrettyText(payload: PluginExportPayload): string {
  const meta = getDesignTemplateMeta(payload.designTemplate);
  const lines = [
    `Postflow → Content Machine (template Figma: ${meta.figmaLabel})`,
    `Modo: ${payload.creationMode === "guided" ? "Avançado (Content Machine)" : "Rápido"}`,
    `Arquivo: ${payload.figmaFileUrl}`,
    "",
    "--- Blocos (cole no plugin na ordem) ---",
    "",
    ...payload.blocks.map((b, i) => `${i + 1}. ${b.replace(/^texto\s+\d+\s*[-–—]\s*/i, "").trim()}`),
  ];
  return lines.join("\n");
}
