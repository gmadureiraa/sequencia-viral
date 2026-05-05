/**
 * Feature flag check pra crons SV.
 *
 * Permite pausar crons individuais (ou todos) sem deploy, apenas mudando
 * env vars no Vercel painel.
 *
 * Hierarquia (primeira que matchar ganha):
 *   1. `SV_CRON_<NAME>=false` → skip esse cron específico
 *   2. `SV_CRONS_ENABLED=false` → skip TODOS
 *   3. default = true (cron roda normalmente)
 *
 * `cronName` deve ser kebab-case ("zernio-autopilot") — convertido pra
 * SCREAMING_SNAKE no env lookup ("SV_CRON_ZERNIO_AUTOPILOT").
 *
 * Uso típico (no início do handler):
 *   if (!isCronEnabled("zernio-autopilot")) {
 *     return Response.json({ ok: true, skipped: "disabled by flag" });
 *   }
 */
export function isCronEnabled(cronName: string): boolean {
  const envKey = `SV_CRON_${cronName.toUpperCase().replace(/-/g, "_")}`;
  if (process.env[envKey] === "false") return false;
  if (process.env.SV_CRONS_ENABLED === "false") return false;
  return true;
}

export function cronSkipped(cronName: string) {
  return Response.json({
    ok: true,
    skipped: `cron "${cronName}" desabilitado por env var`,
  });
}
