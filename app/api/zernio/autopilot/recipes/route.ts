// PUBLIC_OK: stub 410 Gone (deprecated em 05/05) — sem lógica, sem dados.
/**
 * DEPRECATED — substituído por /api/zernio/triggers em 05/05.
 * Mantido como stub 410 Gone pra qualquer client antigo. UI v2 não usa.
 */
export const runtime = "nodejs";

const GONE = {
  error:
    "Este endpoint foi substituído. Use /api/zernio/triggers (schedule/rss/webhook).",
};

export async function GET() {
  return Response.json(GONE, { status: 410 });
}
export async function POST() {
  return Response.json(GONE, { status: 410 });
}
