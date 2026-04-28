/**
 * Defaults canônicos pra `<TemplateRenderer>`.
 *
 * Existe pra GARANTIR que editor (canvas + thumbs), preview (iPhone +
 * export ref) renderizem IDENTICAMENTE. Antes (bugs reportados em
 * 2026-04-22 e 2026-04-28), os 4 callsites tinham defaults divergentes:
 *
 * - Canvas editor:  ?? "headline" + ?? DEFAULT_LAYERS
 * - Thumb editor:   ?? "headline" + ?? DEFAULT_LAYERS
 * - Preview iPhone: cru, sem ??  → render diferente
 * - Export ref:     cru, sem ??  → PNG/ZIP/PDF diferente do editor
 *
 * Isso causava divergência silenciosa: "no editor mostrou X, no preview
 * mostrou Y". Centralizando aqui, qualquer novo callsite começa idêntico.
 */

import type {
  SlideVariantName as SlideVariant,
  SlideLayerFlags,
} from "@/components/app/templates/types";

/** Layers default — todas camadas visíveis. */
export const DEFAULT_LAYERS: SlideLayerFlags = {
  title: true,
  body: true,
  bg: true,
};

/** Variant default — `headline` é o layout neutro de fallback. */
export const DEFAULT_VARIANT: SlideVariant = "headline";

/**
 * Resolve variant com fallback. Use em TODOS os callsites do
 * `<TemplateRenderer>` pra evitar divergência entre editor e preview.
 */
export function resolveVariant(raw: SlideVariant | undefined | null): SlideVariant {
  return raw ?? DEFAULT_VARIANT;
}

/**
 * Resolve layers com fallback. Use em TODOS os callsites.
 */
export function resolveLayers(
  raw: SlideLayerFlags | undefined | null
): SlideLayerFlags {
  return raw ?? DEFAULT_LAYERS;
}
