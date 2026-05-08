/**
 * 2026-05-08 — DESATIVADO. Antes este módulo retornava URLs hardcoded de
 * Unsplash quando o user escolhia um template e tinha slides sem imagem.
 * Gabriel pediu zero stock/busca online — toda imagem agora é GERADA por IA
 * (Gemini Imagen 4 / Flash Image) via /api/images com useDecider=true.
 *
 * Funções abaixo retornam string vazia / array vazio. Caller (templates page)
 * passa adiante e o auto-fill do editor (`/app/create/[id]/edit/page.tsx`)
 * detecta slides sem `imageUrl` e dispara geração com o image-decider.
 *
 * Os pools antigos foram removidos pra deixar claro que não há fallback
 * stock — qualquer dev que tente reativar precisa criar deliberadamente.
 */

import type { TemplateId } from "@/components/app/templates/types";

/**
 * Retorna array vazio em qualquer caso. Slides sem imageUrl ficam pendentes
 * e o auto-fill do editor gera com IA. Callers já tratam strings vazias
 * ("").
 */
export function defaultImagesForTemplate(
  _templateId: TemplateId,
  count: number
): string[] {
  return Array.from({ length: count }, () => "");
}

/**
 * Retorna undefined — sem fallback stock pra "primeira imagem" do template.
 * Caller (preview/onboarding) deve mostrar placeholder ou disparar geração.
 */
export function firstDefaultImage(_templateId: TemplateId): string | undefined {
  return undefined;
}
