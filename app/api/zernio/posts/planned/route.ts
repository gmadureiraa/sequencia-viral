// PUBLIC_OK: stub 410 Gone (deprecated em 05/05) — sem lógica, sem dados.
/**
 * DEPRECATED — movido pra /api/zernio/planned-posts em 05/05.
 * Rota original conflitava com /api/zernio/posts/[id] (Next roteava
 * "planned" como id dinâmico). Mantido como stub 410 pra back-compat.
 */
export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    { error: "Use /api/zernio/planned-posts" },
    { status: 410 }
  );
}
