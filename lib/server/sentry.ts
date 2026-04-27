import * as Sentry from "@sentry/nextjs";

/**
 * Helper pra capturar erros em Route Handlers com context estruturado.
 * No-op silencioso quando Sentry não está inicializado (sem DSN), então
 * é seguro usar em qualquer rota sem checar config.
 *
 * Uso:
 *   } catch (error) {
 *     captureRouteError(error, { route: "/api/generate", userId, payload });
 *     return Response.json({ error: "..." }, { status: 500 });
 *   }
 */
export function captureRouteError(
  error: unknown,
  context: {
    route: string;
    userId?: string | null;
    extra?: Record<string, unknown>;
    tags?: Record<string, string>;
  }
) {
  try {
    Sentry.withScope((scope) => {
      scope.setTag("route", context.route);
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.tags) {
        for (const [k, v] of Object.entries(context.tags)) {
          scope.setTag(k, v);
        }
      }
      if (context.extra) {
        scope.setContext("route_extra", context.extra);
      }
      Sentry.captureException(error);
    });
  } catch {
    // Sentry pode não estar inicializado — não quebra a request.
  }
}
