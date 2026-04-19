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
  | "cta";

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

/** Mock inicial pra alimentar o rascunho antes do usuário escolher template. */
export function makeMockSlides(topic: string, count = 6): CreateSlide[] {
  const base = topic.trim() || "Sua ideia";
  const templates: { heading: string; body: string; variant: SlideVariant }[] = [
    {
      heading: base.slice(0, 80),
      body: "Capa do carrossel. Edite como quiser.",
      variant: "cover",
    },
    {
      heading: "A virada começa aqui.",
      body: "Apresenta o problema em uma frase curta.",
      variant: "headline",
    },
    {
      heading: "O número que ninguém viu.",
      body: "Traga **um dado concreto** pra sustentar o argumento.",
      variant: "headline",
    },
    {
      heading: "A mecânica por trás.",
      body: "Como funciona. O que faz sentido agora.",
      variant: "split",
    },
    {
      heading: "A aplicação prática.",
      body: "O próximo passo pra quem quer usar isso.",
      variant: "photo",
    },
    {
      heading: "Continua no próximo.",
      body: "CTA: salve, compartilhe, siga.",
      variant: "cta",
    },
    {
      heading: "Em resumo.",
      body: "Recapitule em três pontos.",
      variant: "quote",
    },
    {
      heading: "Quer ver mais?",
      body: "Siga **@seuhandle** pro próximo.",
      variant: "cta",
    },
  ];
  return templates.slice(0, Math.max(3, Math.min(count, templates.length))).map(
    (t) => ({
      heading: t.heading,
      body: t.body,
      imageQuery: base,
      variant: t.variant,
    })
  );
}
