/**
 * Guard simples para rotas chamadas por cron (Vercel Cron ou manual).
 * Aceita:
 *   - Authorization: Bearer ${CRON_SECRET} (manual/externo)
 *   - x-vercel-cron: 1 (header injetado automaticamente pelo Vercel Cron)
 */
export function isValidCronRequest(request: Request): boolean {
  const fromVercelCron = request.headers.get("x-vercel-cron");
  if (fromVercelCron) return true;

  const token = process.env.CRON_SECRET;
  if (!token) return false;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return auth.slice(7).trim() === token;
}

export function cronForbidden() {
  return Response.json({ error: "Forbidden" }, { status: 401 });
}
