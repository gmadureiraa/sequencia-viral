import { requireAuthenticatedUser } from "@/lib/server/auth";

export const maxDuration = 5;

/**
 * GET /api/suggestions
 *
 * 28/04: Recurso de "ideias sugeridas" desligado por decisão Gabriel —
 * dashboard ficou mais simples sem ele e a IA gastava tokens gerando
 * ideias que ninguém clicava. Endpoint mantido como no-op pra não
 * quebrar bookmarks/clientes antigos. Retorna `{ items: [] }`.
 *
 * Pra reativar: `git revert` deste commit OU restaurar a versão de
 * `git log -p app/api/suggestions/route.ts`.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  return Response.json({
    items: [],
    disabled: true,
  });
}
