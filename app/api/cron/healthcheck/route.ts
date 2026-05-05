import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";

export const maxDuration = 30;

/**
 * Healthcheck — pinga Supabase, Gemini, Stripe e Resend a cada 15min.
 * Se algum quebrar, posta alerta no Discord (via DISCORD_WEBHOOK_URL).
 * Se o webhook não estiver configurado, só loga warn.
 *
 * Schedule: `*​/15 * * * *` — ver vercel.json.
 */

type CheckResult = {
  name: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
};

async function timed(
  name: string,
  fn: () => Promise<void>
): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkSupabase(): Promise<CheckResult> {
  return timed("supabase", async () => {
    const sb = createServiceRoleSupabaseClient();
    if (!sb) throw new Error("service role client indisponível");
    // head count (não lê linhas) — menor custo
    const { error } = await sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) throw new Error(error.message);
  });
}

async function checkGemini(): Promise<CheckResult> {
  return timed("gemini", async () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY ausente");
    // Chama o endpoint público de listModels (latência baixa, sem custo)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    }
  });
}

async function checkStripe(): Promise<CheckResult> {
  return timed("stripe", async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY ausente");
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    }
  });
}

async function checkResend(): Promise<CheckResult> {
  return timed("resend", async () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY ausente");
    // endpoint leve — domains list
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    }
  });
}

async function alertDiscord(downChecks: CheckResult[]): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.warn(
      "[healthcheck] DISCORD_WEBHOOK_URL ausente; serviços down:",
      downChecks.map((c) => c.name).join(", ")
    );
    return;
  }
  const content =
    `**Sequência Viral · Healthcheck** — ${downChecks.length} serviço(s) down\n` +
    downChecks
      .map(
        (c) => `\`${c.name}\` (${c.latencyMs}ms) → ${c.error || "erro desconhecido"}`
      )
      .join("\n");
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    console.error("[healthcheck] Discord webhook falhou:", err);
  }
}

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("healthcheck")) return cronSkipped("healthcheck");

  const results = await Promise.all([
    checkSupabase(),
    checkGemini(),
    checkStripe(),
    checkResend(),
  ]);

  const down = results.filter((r) => !r.ok);
  if (down.length > 0) {
    await alertDiscord(down);
  }

  const allOk = down.length === 0;
  return Response.json(
    {
      ok: allOk,
      checkedAt: new Date().toISOString(),
      results,
    },
    { status: allOk ? 200 : 503 }
  );
}
