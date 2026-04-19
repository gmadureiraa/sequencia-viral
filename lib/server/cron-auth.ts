/**
 * Guard para rotas chamadas por cron. Antes aceitava o header
 * `x-vercel-cron` como prova de origem — mas esse header é um header HTTP
 * normal que QUALQUER cliente pode forjar (`curl -H "x-vercel-cron: 1"`).
 * Resultado: as rotas de cron (usage-reset, plan-limit, re-engagement etc)
 * estavam expostas ao mundo inteiro, cada uma rodando com service role e
 * mandando email via Resend ou zerando contadores de uso.
 *
 * Agora SEMPRE exige `Authorization: Bearer ${CRON_SECRET}`. O Vercel
 * Scheduler injeta esse header automaticamente quando o cron é declarado
 * em vercel.json com `headers: [{ key: "Authorization", value: "Bearer …" }]`.
 * Se o CRON_SECRET não estiver configurado, todas as rotas devolvem 401 —
 * falha segura, não aberta.
 */
export function isValidCronRequest(request: Request): boolean {
  const token = process.env.CRON_SECRET;
  if (!token) return false;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return auth.slice(7).trim() === token;
}

export function cronForbidden() {
  return Response.json({ error: "Forbidden" }, { status: 401 });
}
