// PUBLIC_OK: gateado por env var ZERNIO_DEBUG_TOKEN + header
// X-Debug-Token (timingSafeEqual). Quando env não setada, retorna 404
// silencioso. Não dá pra usar requireAdmin aqui porque o objetivo do
// endpoint é justamente debugar o motivo do gate admin estar quebrado.
/**
 * GET /api/zernio/debug-auth
 *
 * Endpoint de diagnóstico do gate admin. Retorna o que o edge middleware
 * VÊ ao receber a request — útil pra debugar redirects "fica voltando pra
 * Início".
 *
 * Mostra:
 *  - Lista de cookies recebidos (só nome + tamanho, não vaza valores)
 *  - Cookies sb-* identificados (nomes)
 *  - Email extraído do JWT decodificado
 *  - Lista de admin emails configurada
 *  - Veredicto final (passa ou não pelo gate)
 *
 * SEM proteção admin de propósito — admin não consegue acessar se gate
 * tá quebrado, então protegemos por outro mecanismo: requer header
 * `X-Debug-Token` igual a uma env var. Sem env var setada → 404.
 */

import { ADMIN_EMAILS } from "@/lib/admin-emails";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { decodeJwtEmail, getSupabaseSessionEmail } from "@/proxy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Production-safe: quando ZERNIO_DEBUG_TOKEN não setada, endpoint
  // retorna 404 (oculto). Pra ativar troubleshoot temporário, setar a env
  // var e mandar header `x-debug-token: <valor>`. Antes era "default
  // público" — perigoso em prod (vazava cookies do user pra qualquer
  // request).
  const debugToken = process.env.ZERNIO_DEBUG_TOKEN;
  if (!debugToken) {
    return new Response("not found", { status: 404 });
  }
  const provided = request.headers.get("x-debug-token");
  if (provided !== debugToken) {
    return new Response("not found", { status: 404 });
  }

  // Lê cookies da request — Next 16 expõe via Web API standard. Pra usar
  // o helper getSupabaseSessionEmail (que espera NextRequest), construímos
  // um shim leve com `cookies.getAll()`.
  const cookieHeader = request.headers.get("cookie") || "";
  const allCookies: Array<{ name: string; value: string }> = [];
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const name = part.slice(0, eq).trim();
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      if (name) allCookies.push({ name, value });
    }
  }

  const sbCookies = allCookies
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
    .map((c) => ({ name: c.name, valueLength: c.value.length }));

  // Reusa o parser real — shim de NextRequest com só o que ele lê.
  const fakeReq = {
    cookies: { getAll: () => allCookies },
  } as Parameters<typeof getSupabaseSessionEmail>[0];

  const email = await getSupabaseSessionEmail(fakeReq);
  const isAdmin = email !== null && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);

  // Diagnóstico extra: tenta extrair JWT bruto pra debug se falhou
  const jwtParseAttempt: {
    sourceCookies: number;
    combinedSize: number;
    parseOk: boolean;
    accessTokenFound: boolean;
    decodedEmail: string | null;
    error?: string;
  } = {
    sourceCookies: sbCookies.length,
    combinedSize: 0,
    parseOk: false,
    accessTokenFound: false,
    decodedEmail: null,
  };
  try {
    const chunkPattern = /^(sb-.+-auth-token)(?:\.(\d+))?$/;
    const groups = new Map<string, Array<{ index: number; value: string }>>();
    for (const c of allCookies) {
      const m = c.name.match(chunkPattern);
      if (!m) continue;
      const arr = groups.get(m[1]) ?? [];
      arr.push({
        index: m[2] !== undefined ? Number(m[2]) : -1,
        value: c.value,
      });
      groups.set(m[1], arr);
    }
    for (const chunks of groups.values()) {
      let combined: string;
      const single = chunks.find((c) => c.index === -1);
      if (single) {
        combined = single.value;
      } else {
        combined = chunks
          .filter((c) => c.index >= 0)
          .sort((a, b) => a.index - b.index)
          .map((c) => c.value)
          .join("");
      }
      jwtParseAttempt.combinedSize = combined.length;
      let raw = combined;
      if (raw.startsWith("base64-")) {
        raw = atob(raw.slice("base64-".length));
      }
      const parsed = JSON.parse(raw);
      jwtParseAttempt.parseOk = true;
      const accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
      if (accessToken && typeof accessToken === "string") {
        jwtParseAttempt.accessTokenFound = true;
        jwtParseAttempt.decodedEmail = decodeJwtEmail(accessToken);
        break;
      }
    }
  } catch (err) {
    jwtParseAttempt.error = err instanceof Error ? err.message : String(err);
  }

  // Lookup do profile do DB pra ver onboarding_completed, plan, etc.
  // Roadmap/Início bloqueados sugerem onboarding_completed=false (o
  // OnboardingGuard global redireciona pra /app/onboarding).
  let profileDiagnostic: Record<string, unknown> | null = null;
  if (email) {
    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      const { data: authUser } = await sb.auth.admin
        .listUsers({ page: 1, perPage: 200 })
        .then((res) => ({
          data: res.data?.users?.find(
            (u) => u.email?.toLowerCase().trim() === email.toLowerCase().trim()
          ),
        }));
      if (authUser) {
        const { data: profile } = await sb
          .from("profiles")
          .select("id, email, name, plan, onboarding_completed, usage_count, usage_limit, created_at")
          .eq("id", authUser.id)
          .maybeSingle();
        profileDiagnostic = {
          authUser: {
            id: authUser.id,
            email: authUser.email,
            createdAt: authUser.created_at,
            lastSignInAt: authUser.last_sign_in_at,
            emailConfirmedAt: authUser.email_confirmed_at,
          },
          profileRow: profile,
          profileExists: !!profile,
          onboardingCompleted: profile?.onboarding_completed ?? false,
        };
      } else {
        profileDiagnostic = {
          error: "auth user não encontrado pra esse email",
        };
      }
    } else {
      profileDiagnostic = { error: "service role client indisponível" };
    }
  }

  return Response.json(
    {
      veredict: {
        emailExtracted: email,
        isAdmin,
        wouldRedirect: !isAdmin,
        redirectTarget: !isAdmin ? (email ? "/app" : "/app/login") : null,
      },
      adminEmailsConfigured: ADMIN_EMAILS,
      cookies: {
        total: allCookies.length,
        names: allCookies.map((c) => c.name),
        sbAuthTokenCookies: sbCookies,
      },
      parseDiagnostic: jwtParseAttempt,
      profileDiagnostic,
      requestPath: new URL(request.url).pathname,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
