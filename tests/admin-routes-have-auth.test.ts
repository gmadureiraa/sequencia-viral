/**
 * P1-1 — defesa em profundidade pro gate edge desabilitado.
 *
 * O middleware `proxy.ts` foi obrigado a remover o gate de
 * `/app/admin/*` porque a sessão Supabase persiste em localStorage
 * (não viaja em request → cookie indisponível no edge).
 *
 * Backend ainda está coberto via `requireAdmin` em cada handler
 * `/api/admin/**`, mas é fácil esquecer ao criar rota nova. Esse
 * teste enumera todos os arquivos `app/api/admin/**\/route.ts` e
 * exige uma das duas coisas:
 *
 *  1. Importar `requireAdmin` de `lib/server/auth` E referenciar
 *     `requireAdmin(` em pelo menos uma função handler exportada.
 *  2. Conter o marcador `// PUBLIC_OK:` na primeira linha do
 *     arquivo (justificativa explícita do dev).
 *
 * Falhar esse teste = CI vermelho até a rota nova ser gated.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const ADMIN_API_ROOT = join(REPO_ROOT, "app", "api", "admin");
const ZERNIO_API_ROOT = join(REPO_ROOT, "app", "api", "zernio");

function findRouteFiles(dir: string): string[] {
  let stat;
  try {
    stat = statSync(dir);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...findRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

function fileHasAuthGate(file: string): { ok: boolean; reason: string } {
  const src = readFileSync(file, "utf8");
  // Primeira linha (após shebang/whitespace) — escape hatch explícito.
  const firstLine = src.split("\n").slice(0, 3).join(" ");
  if (/PUBLIC_OK:/.test(firstLine)) {
    return { ok: true, reason: "PUBLIC_OK marker" };
  }

  const importsRequireAdmin = /from\s+["']@\/lib\/server\/auth["']/.test(src) &&
    /\brequireAdmin\b/.test(src);
  const callsRequireAdmin = /\brequireAdmin\s*\(/.test(src);

  if (importsRequireAdmin && callsRequireAdmin) {
    return { ok: true, reason: "imports + calls requireAdmin" };
  }

  return {
    ok: false,
    reason: importsRequireAdmin
      ? "imports requireAdmin but never calls it"
      : "missing requireAdmin import/call",
  };
}

describe("admin routes auth gate (defesa em profundidade P1-1)", () => {
  const routes = findRouteFiles(ADMIN_API_ROOT);

  it("encontra pelo menos uma rota admin pra evitar regressão silenciosa", () => {
    expect(routes.length, "esperava >=1 route.ts em app/api/admin").toBeGreaterThan(0);
  });

  for (const file of routes) {
    const rel = relative(REPO_ROOT, file);
    it(`${rel} tem requireAdmin (ou PUBLIC_OK justificado)`, () => {
      const r = fileHasAuthGate(file);
      expect(
        r.ok,
        `${rel}: ${r.reason}\n→ adicione 'import { requireAdmin } from "@/lib/server/auth"' e chame 'await requireAdmin(request)' no início do handler.`
      ).toBe(true);
    });
  }
});

/**
 * Zernio NÃO é admin-only — alguns endpoints liberam pra plano pro/business
 * via `requireAdminOrPlan`. Aqui só exigimos algum gate de auth (qualquer
 * uma das funções `require*` de `lib/server/auth` ou `lib/server/plan-gate`).
 */
function fileHasAnyAuthGate(file: string): { ok: boolean; reason: string } {
  const src = readFileSync(file, "utf8");
  const firstLine = src.split("\n").slice(0, 3).join(" ");
  if (/PUBLIC_OK:/.test(firstLine)) {
    return { ok: true, reason: "PUBLIC_OK marker" };
  }
  // Aceita: requireAdmin, requireAuthenticatedUser, requireAdminOrPlan,
  // requireUserSession, requirePlan, etc — qualquer função `require*(`
  // chamada no handler.
  const callsRequireGate =
    /\brequire(?:Admin|AuthenticatedUser|AdminOrPlan|UserSession|Plan|Auth|User|CronAuth)\s*\(/.test(
      src
    );
  // Cron endpoints podem usar `verifyCronSecret`/`isCronRequest` em vez de require*.
  const callsCronAuth = /\b(?:verifyCronSecret|isCronRequest|assertCronAuth)\s*\(/.test(src);
  if (callsRequireGate || callsCronAuth) {
    return { ok: true, reason: "has auth gate" };
  }
  return {
    ok: false,
    reason: "missing any require*/cron auth gate call",
  };
}

describe("zernio routes auth gate (require qualquer gate de auth)", () => {
  const routes = findRouteFiles(ZERNIO_API_ROOT);

  if (routes.length === 0) {
    it.skip("sem rotas em app/api/zernio (nada pra checar)", () => {});
    return;
  }

  for (const file of routes) {
    const rel = relative(REPO_ROOT, file);
    // Webhook do Zernio NÃO é gateado por user auth — é HMAC externo.
    if (rel.endsWith("webhook/route.ts")) continue;
    it(`${rel} tem algum gate de auth (require*/PUBLIC_OK)`, () => {
      const r = fileHasAnyAuthGate(file);
      expect(
        r.ok,
        `${rel}: ${r.reason}\n→ chame algum require* do lib/server/auth ou plan-gate, ou marque '// PUBLIC_OK: <razão>' no topo.`
      ).toBe(true);
    });
  }
});
