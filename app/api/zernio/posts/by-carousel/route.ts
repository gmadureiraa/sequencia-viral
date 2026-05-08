// PUBLIC_OK: stub 410 Gone (deprecated em 05/05) — sem lógica, sem dados.
/**
 * DEPRECATED — movido pra /api/zernio/by-carousel pra evitar conflito
 * de roteamento com /posts/[id]. Mantido como stub 410.
 */
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { error: "Use /api/zernio/by-carousel" },
    { status: 410 }
  );
}
