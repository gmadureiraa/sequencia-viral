// PUBLIC_OK: stub 410 Gone (deprecated em 05/05) — sem lógica, sem dados.
/**
 * DEPRECATED — substituído por /api/zernio/triggers/[id] em 05/05.
 */
export const runtime = "nodejs";

const GONE = { error: "Use /api/zernio/triggers/[id]" };

export async function PATCH() {
  return Response.json(GONE, { status: 410 });
}
export async function DELETE() {
  return Response.json(GONE, { status: 410 });
}
