/**
 * GET /api/zernio/health
 *
 * Healthcheck da config Zernio. Usado pela UI admin pra mostrar badge de
 * status. NÃO é o cron healthcheck (esse é separado, pinga Gemini/Stripe/etc).
 *
 * Response shape:
 *   { ok: true,  profilesCount: 3 }
 *   { ok: false, error: "401: Invalid API key" }
 *   { ok: false, error: "ZERNIO_API_KEY ausente" }
 *
 * Cache: 60s server-side (só queremos saber "tá vivo?", não precisa real-time).
 */

import { requireAdmin } from "@/lib/server/auth";
import { pingZernio } from "@/lib/server/zernio";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const result = await pingZernio();
  // 200 mesmo em erro — caller usa o campo `ok` pra decidir UX.
  return Response.json(result, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
