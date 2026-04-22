/**
 * Tipos compartilhados para o fluxo novo de criação de carrossel
 * (new → templates → edit → preview).
 */

export interface CreateSlide {
  heading: string;
  body: string;
  imageQuery: string;
  imageUrl?: string;
  /** Variante de layout escolhida para este slide (capa, headline, foto, ...). */
  variant?: SlideVariant;
  /**
   * Cor de fundo por-slide. Quando presente, sobrescreve o `slideStyle` global
   * no render do template. Aceita qualquer valor CSS color (hex, rgb, var(...)).
   */
  bgColor?: string;
  /**
   * Toggle de camadas visíveis no render. Default: todas `true`.
   * - `title` oculta o `<h1>` (heading)
   * - `body` oculta o `<p>` (body)
   * - `bg` oculta imagem de fundo / textura / grid decorativo
   */
  layers?: SlideLayers;
}

export interface SlideLayers {
  title: boolean;
  body: boolean;
  bg: boolean;
}

export type SlideVariant =
  | "cover"
  | "headline"
  | "photo"
  | "quote"
  | "split"
  | "cta"
  // Novas variantes BrandsDecoded overhaul (2026-04-22)
  | "solid-brand"
  | "text-only"
  | "full-photo-bottom";

export interface PreviewProfile {
  name: string;
  handle: string;
  photoUrl: string;
}

export interface CreateConcept {
  title: string;
  hook: string;
  style: string;
  angle: string;
}

export interface CreateVariation {
  title: string;
  style: "data" | "story" | "provocative";
  slides: CreateSlide[];
}
