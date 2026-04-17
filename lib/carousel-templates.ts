/**
 * Dois templates visuais no produto — mesmo fluxo de geração (conceitos → /api/generate).
 * O que muda: composição no preview/export e hints de imagem (busca/IA).
 * Copy mais profunda vem do modo avançado (Content Machine / generate-v2), não do template.
 */

export type DesignTemplateId = "editorial" | "spotlight";

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

/** Regras narrativas do Content Machine (render) — idênticas para qualquer template visual. */
const CONTENT_MACHINE_NARRATIVE_RULES =
  "Exatamente 16 blocos. Narrativa contínua estilo editorial premium: alternância de ritmo, micro-ganchos entre blocos, capa forte + fechamento com CTA que referencia o gancho inicial. O layout visual escolhido no app não altera esta redação.";

export const DESIGN_TEMPLATES: {
  id: DesignTemplateId;
  emoji: string;
  name: string;
  desc: string;
  color: string;
  blockCount: number;
  figmaLabel: string;
  /** Palavras-chave extras para busca de imagens (inglês, estilo fotográfico). */
  imageSearchStyleHint: string;
  /** Fragmento para Imagen: hiper-realismo alinhado ao layout (inglês). */
  imageGenRealismFragment: string;
}[] = [
  {
    id: "editorial",
    emoji: "◆",
    name: "Editorial",
    desc: "Estilo revista premium: fundo claro/escuro, destaque laranja, imagens em cartão com cantos arredondados, tipografia forte.",
    color: "#FF5500",
    blockCount: 16,
    figmaLabel: "Template Editorial",
    imageSearchStyleHint:
      "editorial magazine photography photorealistic professional photo cinematic lighting shallow depth of field natural skin texture documentary style",
    imageGenRealismFragment:
      "Hyper-realistic editorial magazine photograph, full-frame camera quality, natural skin micro-texture, soft cinematic key and fill light, shallow depth of field, premium color science, authentic environment. Must look like a real photograph from a high-end editorial shoot — not illustration, not 3D render, not anime, not stock composite look.",
  },
  {
    id: "spotlight",
    emoji: "●",
    name: "Spotlight",
    desc: "Hero image no topo, acento azul, fotografia limpa e alto contraste — texto abaixo da imagem, sensação de capa de keynote.",
    color: "#0EA5E9",
    blockCount: 16,
    figmaLabel: "Template Spotlight",
    imageSearchStyleHint:
      "minimal keynote hero photography photorealistic clean high contrast bold composition lifestyle tech authentic environment HDR crisp detail",
    imageGenRealismFragment:
      "Ultra-realistic keynote hero photograph: bold composition, generous negative space, crisp modern lighting, high dynamic range, believable real-world setting. Apple-event or Wired-magazine photographic quality — tactile materials, real glass and metal reflections. Not CGI, not vector, not painterly.",
  },
] as const;

export const EDITORIAL_ACCENT = "#FF5500";
export const SPOTLIGHT_ACCENT = "#0EA5E9";
export const EDITORIAL_BG_DARK = "#121212";
export const EDITORIAL_BG_LIGHT = "#fafafa";

export function getDesignTemplateMeta(id: DesignTemplateId) {
  return DESIGN_TEMPLATES.find((t) => t.id === id) ?? DESIGN_TEMPLATES[0];
}

/** Normaliza valor persistido ou legado. IDs antigos caem em editorial. */
export function normalizeDesignTemplate(
  raw: string | null | undefined
): DesignTemplateId {
  if (raw === "spotlight") return "spotlight";
  if (raw === "editorial") return "editorial";
  return "editorial";
}

/** Rules for Content Machine `render` step — mesmas regras narrativas para ambos os templates. */
export const CONTENT_MACHINE_RENDER_SPECS: Record<
  DesignTemplateId,
  { blocks: number; rules: string }
> = {
  editorial: { blocks: 16, rules: CONTENT_MACHINE_NARRATIVE_RULES },
  spotlight: { blocks: 16, rules: CONTENT_MACHINE_NARRATIVE_RULES },
};

/** Preview nativo + export PNG/PDF usam `EditorialSlide`. */
export function usesNativeSlidePreview(_template: DesignTemplateId): boolean {
  return true;
}

/** @deprecated Use `usesNativeSlidePreview`. Mantido para buscas no código legado. */
export function usesTweetStylePreview(_template: DesignTemplateId): boolean {
  return false;
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
