/**
 * Pares de fonte legados (não usados no preview atual — thread usa stack fixa).
 * O formato thread estilo Twitter usa tipografia fixa —
 * `EDITORIAL_THREAD_FIXED_FONT_STACK` (abaixo).
 *
 * As variáveis --font-dm-serif, --font-playfair, --font-outfit, --font-inter,
 * --font-source-sans e --font-literata são carregadas SOMENTE no layout do
 * editor (`app/app/create/[id]/edit/layout.tsx`) — fora dele os stacks
 * caem no fallback nativo (Georgia, system-ui, Times, etc), o que mantém
 * o root layout enxuto pra LCP da landing.
 */

/** Thread / screenshot estilo Twitter — mesma stack do `carousel-slide` legado; sem troca de fonte na UI. */
export const EDITORIAL_THREAD_FIXED_FONT_STACK =
  '"Helvetica Neue", Helvetica, Arial, -apple-system, BlinkMacSystemFont, sans-serif';

export const EDITORIAL_TITLE_FONTS = [
  {
    id: "dm-serif",
    label: "Serif editorial",
    stack:
      'var(--font-dm-serif), "DM Serif Display", "Georgia", serif',
  },
  {
    id: "instrument",
    label: "Serif clássico",
    stack: 'var(--font-serif), "Instrument Serif", Georgia, serif',
  },
  {
    id: "playfair",
    label: "Serif impacto",
    stack: 'var(--font-playfair), "Playfair Display", Georgia, serif',
  },
  {
    id: "outfit",
    label: "Sans geométrico",
    stack: 'var(--font-outfit), "Outfit", system-ui, sans-serif',
  },
] as const;

export const EDITORIAL_BODY_FONTS = [
  {
    id: "plus-jakarta",
    label: "Sans moderno",
    stack:
      'var(--font-sans), "Plus Jakarta Sans", system-ui, sans-serif',
  },
  {
    id: "inter",
    label: "Sans neutro",
    stack: 'var(--font-inter), "Inter", system-ui, sans-serif',
  },
  {
    id: "source-sans",
    label: "Sans leitura",
    stack:
      'var(--font-source-sans), "Source Sans 3", system-ui, sans-serif',
  },
  {
    id: "literata",
    label: "Serif corpo",
    stack: 'var(--font-literata), "Literata", Georgia, serif',
  },
] as const;

export type EditorialTitleFontId = (typeof EDITORIAL_TITLE_FONTS)[number]["id"];
export type EditorialBodyFontId = (typeof EDITORIAL_BODY_FONTS)[number]["id"];

export const DEFAULT_TITLE_FONT_ID: EditorialTitleFontId = "dm-serif";
export const DEFAULT_BODY_FONT_ID: EditorialBodyFontId = "plus-jakarta";

export function resolveTitleFontStack(id?: string | null): string {
  const row = EDITORIAL_TITLE_FONTS.find((f) => f.id === id);
  return row?.stack ?? EDITORIAL_TITLE_FONTS[0].stack;
}

export function resolveBodyFontStack(id?: string | null): string {
  const row = EDITORIAL_BODY_FONTS.find((f) => f.id === id);
  return row?.stack ?? EDITORIAL_BODY_FONTS[0].stack;
}

export function normalizeTitleFontId(raw?: string | null): EditorialTitleFontId {
  return EDITORIAL_TITLE_FONTS.some((f) => f.id === raw)
    ? (raw as EditorialTitleFontId)
    : DEFAULT_TITLE_FONT_ID;
}

export function normalizeBodyFontId(raw?: string | null): EditorialBodyFontId {
  return EDITORIAL_BODY_FONTS.some((f) => f.id === raw)
    ? (raw as EditorialBodyFontId)
    : DEFAULT_BODY_FONT_ID;
}
