import * as Sentry from "@sentry/nextjs";

/**
 * Server-side instrumentation hook do Next 16. Roda no startup do server
 * Node e do Edge runtime separadamente. Usar pra inicializar Sentry,
 * OpenTelemetry, etc.
 *
 * Sentry init é no-op quando `SENTRY_DSN` não está setado — zero overhead
 * em dev/preview sem DSN.
 *
 * Doc: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      tracesSampleRate: 0.1,
      // Não envia request bodies — pode conter briefings/dados sensíveis.
      sendDefaultPii: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

/**
 * Hook do Next 16 que captura erros de Server Components / Route Handlers
 * automaticamente. Sentry usa esse hook pra enriquecer com context da
 * request (URL, method, headers).
 */
export const onRequestError = Sentry.captureRequestError;
