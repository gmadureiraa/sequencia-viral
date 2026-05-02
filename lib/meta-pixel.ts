/**
 * Meta Pixel — helpers de eventos de conversão.
 *
 * O <MetaPixel /> de `components/MetaPixel.tsx` (montado em `app/layout.tsx`)
 * inicializa o pixel `1315597820451507` e dispara `PageView`. Eventos de
 * conversão (Lead, CompleteRegistration, Subscribe) são wired manualmente nos
 * pontos do funil — chamados a partir desses helpers.
 *
 * Cada função é safe-no-op em SSR e quando o pixel não está pronto (ex.: ad
 * blockers, primeiro paint antes do script async carregar). Isso evita
 * exceptions no client + permite chamar sem checagem prévia nos callers.
 *
 * Convenções:
 *  - `Lead` → email cadastrado (signup completo). NÃO disparar em login.
 *  - `CompleteRegistration` → primeiro carrossel gerado (user "ativo"
 *    de verdade). Gate por `localStorage.sv_first_generation_tracked` pra
 *    nunca duplicar entre sessões/dispositivos.
 *  - `Subscribe` → pós-checkout Stripe success. Limpar searchParam após
 *    disparo pra evitar re-fire em refresh.
 *
 * Referência: BM 704738313932684 (Madureira Cripto), Ad Account 948714981394558.
 */

/** Dispara `Lead`. Use em signup success (não em login). */
export function trackLead(contentName = 'free_signup'): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', 'Lead', { content_name: contentName });
}

/**
 * Dispara `CompleteRegistration`. Use no primeiro carrossel gerado OU email
 * confirmado, o que vier primeiro. Gate via localStorage no caller.
 */
export function trackCompleteRegistration(status = 'first_carousel'): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', 'CompleteRegistration', { status });
}

/**
 * Dispara `Subscribe` pós checkout Stripe. `value` em BRL decimal (ex.: 49.90).
 * `predicted_ltv` é estimado como 12× value (ano).
 */
export function trackSubscribe(value: number, plan: string): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', 'Subscribe', {
    value,
    currency: 'BRL',
    predicted_ltv: value * 12,
    content_name: `sv_${plan}`,
  });
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
