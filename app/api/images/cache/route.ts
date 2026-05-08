import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  getRateLimitKey,
  getRequestIp,
  rateLimit,
} from "@/lib/server/rate-limit";
import { cacheExternalImage } from "@/lib/server/scrape-cache";
import { captureRouteError } from "@/lib/server/sentry";

export const maxDuration = 15;

/**
 * POST /api/images/cache
 * Body: { url: string }
 * Resposta: { url: string, cached: boolean }
 *
 * Pega uma URL externa (Serper/Google Images, Unsplash, etc.), baixa server-side
 * e sobe pro bucket `carousel-images/external-cache/{userId}/{hash}.ext`. Retorna
 * a URL pública do Supabase. Em caso de falha, retorna a URL original com
 * `cached: false` — o slide ainda funciona, só fica volátil.
 *
 * Por que existe (2026-05-08):
 *  - O picker manual (ImagePicker) entrega URL externa direto pro slide. Quando
 *    Serper devolve URL do Google Images proxy, ela expira em horas.
 *  - Bug Sam Altman 08/05: slide gerado hoje, baixado amanhã = imagem some.
 *  - Endpoint chamado pelo picker em `confirmPick` antes de setar a URL no slide.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  // Rate limit modesto: usuário ativo edita ~30 slides/hora; cap em 240/h
  // dá margem 8x. Limita abuse de cache flooding.
  const limiter = await rateLimit({
    key: getRateLimitKey(request, "images-cache", user.id),
    limit: 240,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit. Tenta de novo em alguns minutos." },
      { status: 429 }
    );
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.url || typeof body.url !== "string") {
    return Response.json({ error: "url obrigatória" }, { status: 400 });
  }
  const url = body.url.trim();
  if (url.length === 0 || url.length > 2000) {
    return Response.json({ error: "url inválida" }, { status: 400 });
  }
  // Hardening: aceita só http(s). Bloqueia data:, file:, etc.
  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ error: "url inválida" }, { status: 400 });
  }

  try {
    const cached = await cacheExternalImage(user.id, url);
    if (cached) {
      return Response.json({ url: cached, cached: true });
    }
    // Falha silenciosa — mantém URL externa pra não quebrar o picker.
    console.warn(
      `[images/cache] miss user=${user.id} ip=${getRequestIp(request)} url=${url.slice(0, 100)}`
    );
    return Response.json({ url, cached: false });
  } catch (err) {
    captureRouteError(err, { route: "/api/images/cache", userId: user.id });
    console.error("[images/cache] exception:", err);
    return Response.json({ url, cached: false });
  }
}
