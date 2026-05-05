import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import { fireResendEvent } from "@/lib/integrations/resend/events";

export const maxDuration = 60;

const BATCH = 200;

/**
 * idle-5d — dispara `sv.idle_5d` pra users que ficaram sem login entre
 * 5 e 10 dias.
 *
 * Critérios:
 *   - `auth.users.last_sign_in_at` entre `[now-10d, now-5d]`
 *   - `profiles.last_idle_5d_email_at` é null OU anterior ao `last_sign_in_at - 5d`
 *     (ou seja: user já voltou e ficou idle de novo desde o último envio).
 *
 * `last_sign_in_at` mora em `auth.users` (Supabase). Pra evitar JOIN privilegiado
 * em SQL custom, listamos auth users via admin SDK e cruzamos com profiles em
 * memória. O batch é pequeno (BATCH=200 perPage) e roda diário.
 *
 * Schedule diário — ver vercel.json.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("idle-5d")) return cronSkipped("idle-5d");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const now = Date.now();
  const tenDaysAgo = new Date(now - 10 * 86400_000);
  const fiveDaysAgo = new Date(now - 5 * 86400_000);

  // Lista até BATCH auth users (1 página). Pra populações maiores, paginar
  // adicionando page=2... mas pra MVP isso cobre rotação do dia.
  const { data: usersList, error: listErr } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: BATCH,
  });
  if (listErr) {
    console.error("[cron/idle-5d] listUsers falhou:", listErr.message);
    return Response.json({ error: listErr.message }, { status: 500 });
  }

  const eligibleAuth = (usersList?.users ?? []).filter((u) => {
    if (!u.last_sign_in_at || !u.email) return false;
    const t = new Date(u.last_sign_in_at).getTime();
    return t >= tenDaysAgo.getTime() && t <= fiveDaysAgo.getTime();
  });

  if (eligibleAuth.length === 0) {
    return Response.json({ ok: true, scanned: usersList?.users?.length ?? 0, dispatched: 0 });
  }

  const ids = eligibleAuth.map((u) => u.id);
  const { data: profiles, error: profErr } = await sb
    .from("profiles")
    .select("id,email,last_idle_5d_email_at")
    .in("id", ids);
  if (profErr) {
    console.error("[cron/idle-5d] profiles fetch falhou:", profErr.message);
    return Response.json({ error: profErr.message }, { status: 500 });
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p])
  );

  let dispatched = 0;
  let skipped = 0;

  for (const u of eligibleAuth) {
    const p = profileById.get(u.id);
    if (!p) {
      skipped += 1;
      continue;
    }
    const email = p.email || u.email;
    if (!email) {
      skipped += 1;
      continue;
    }
    const lastSignIn = new Date(u.last_sign_in_at!).getTime();
    const last = p.last_idle_5d_email_at
      ? new Date(p.last_idle_5d_email_at as string).getTime()
      : 0;
    // Só dispara se nunca enviamos OU o user voltou (sign-in) e ficou idle de novo.
    // Threshold: last_sign_in - 5d > last (envio anterior antecede o ciclo atual).
    if (last > 0 && lastSignIn - 5 * 86400_000 <= last) {
      skipped += 1;
      continue;
    }

    await fireResendEvent("sv.idle_5d", {
      email,
      user_id: u.id,
      last_sign_in_at: u.last_sign_in_at,
      days_since_login: Math.floor((now - lastSignIn) / 86400_000),
    });

    const { error: upErr } = await sb
      .from("profiles")
      .update({ last_idle_5d_email_at: new Date().toISOString() })
      .eq("id", u.id);
    if (upErr) {
      console.warn("[cron/idle-5d] update falhou:", u.id, upErr.message);
    }
    dispatched += 1;
  }

  return Response.json({
    ok: true,
    scanned: usersList?.users?.length ?? 0,
    eligible: eligibleAuth.length,
    dispatched,
    skipped,
  });
}
