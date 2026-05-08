// PUBLIC_OK: stub 410 Gone (deprecated em 05/05) — sem lógica, sem dados.
/**
 * DEPRECATED — substituído por /api/zernio/triggers/[id]/run-now em 05/05.
 */
export const runtime = "nodejs";
export async function POST() {
  return Response.json(
    { error: "Use /api/zernio/triggers/[id]/run-now" },
    { status: 410 }
  );
}
