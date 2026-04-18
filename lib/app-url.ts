/**
 * URLs canônicas da aplicação.
 *
 * Trocar em 1 lugar só. Prefira sempre importar `APP_URL` daqui em vez
 * de hardcodar. Se precisar parametrizar (ex: preview URL do Vercel no
 * próprio deploy), setar `NEXT_PUBLIC_APP_URL`.
 */

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://viral.kaleidos.com.br";

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "madureira@kaleidosdigital.com";

/** Origens aceitas em CORS/CSRF/Stripe. Cobre www + apex + vercel preview. */
export const ALLOWED_ORIGINS = [
  "https://viral.kaleidos.com.br",
  "https://www.viral.kaleidos.com.br",
  "https://sequencia-viral.vercel.app",
];
