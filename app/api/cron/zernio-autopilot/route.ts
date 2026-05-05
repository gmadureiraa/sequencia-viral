/**
 * GET /api/cron/zernio-autopilot
 *
 * Cron diário (Vercel Hobby) que processa 2 tipos de triggers:
 *
 * 1. SCHEDULE: triggers cujo next_run_at está dentro das próximas 24h
 *    (lookahead window). Cada um dispara processTrigger() e atualiza
 *    next_run_at baseado em cadência (computeNextRunAt).
 *
 * 2. RSS: triggers cujo rss_last_checked_at + check_interval expirou.
 *    Fetch URL → parse RSS → compara guids com rss_processed_guids.
 *    Pra cada item novo (até max_items_per_check), dispara processTrigger
 *    com explicitTheme=item.title.
 *
 * Webhook triggers NÃO rodam aqui — disparo via /api/zernio/triggers/[id]/fire.
 *
 * Auth: cron-auth padrão (Vercel header / shared secret).
 *
 * Failure isolation: erro num trigger NÃO bloqueia os outros.
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import {
  processTrigger,
  type Trigger,
} from "@/lib/server/zernio-trigger-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

// 24h lookahead pra schedule (Hobby = cron diário; processa tudo do dia
// de uma vez). scheduledFor enviado ao Zernio é o horário correto.
const SCHEDULE_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("zernio-autopilot")) return cronSkipped("zernio-autopilot");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const results: { triggerId: string; status: string; detail?: string }[] = [];

  // ────────── 1. SCHEDULE TRIGGERS ──────────
  const scheduleCutoff = new Date(Date.now() + SCHEDULE_LOOKAHEAD_MS).toISOString();
  const { data: scheduleTriggers, error: sErr } = await sb
    .from("zernio_autopilot_triggers")
    .select("*")
    .eq("is_active", true)
    .eq("trigger_type", "schedule")
    .lte("next_run_at", scheduleCutoff)
    .limit(50);
  if (sErr) console.error("[cron-autopilot] schedule query err:", sErr);

  for (const trigger of (scheduleTriggers as Trigger[]) ?? []) {
    try {
      const r = await processTrigger({ trigger, firedBy: "cron" });
      results.push({ triggerId: trigger.id, status: r.status, detail: r.detail });
      // Avança next_run_at se sucesso
      if (r.status === "scheduled") {
        const next = computeNextRunAt(trigger);
        await sb
          .from("zernio_autopilot_triggers")
          .update({ next_run_at: next.toISOString() })
          .eq("id", trigger.id);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ triggerId: trigger.id, status: "fatal", detail });
      console.error(`[cron-autopilot] schedule ${trigger.id} FAIL:`, err);
    }
  }

  // ────────── 2. RSS TRIGGERS ──────────
  const { data: rssTriggers, error: rErr } = await sb
    .from("zernio_autopilot_triggers")
    .select("*")
    .eq("is_active", true)
    .eq("trigger_type", "rss")
    .limit(50);
  if (rErr) console.error("[cron-autopilot] rss query err:", rErr);

  for (const trigger of (rssTriggers as Trigger[]) ?? []) {
    try {
      const lastChecked = trigger.rss_last_checked_at
        ? new Date(trigger.rss_last_checked_at).getTime()
        : 0;
      const intervalMs = (trigger.rss_check_interval_minutes || 60) * 60 * 1000;
      if (Date.now() - lastChecked < intervalMs) {
        // Ainda dentro do interval — pula.
        results.push({
          triggerId: trigger.id,
          status: "rss_skipped",
          detail: "interval not elapsed",
        });
        continue;
      }
      const items = await fetchAndParseRss(trigger.rss_url!);
      const seenGuids = new Set(trigger.rss_processed_guids ?? []);
      const newItems = items.filter((it) => !seenGuids.has(it.guid));
      const limited = newItems.slice(0, trigger.rss_max_items_per_check);

      if (limited.length === 0) {
        // Sem itens novos — só atualiza last_checked_at.
        await sb
          .from("zernio_autopilot_triggers")
          .update({ rss_last_checked_at: new Date().toISOString() })
          .eq("id", trigger.id);
        results.push({
          triggerId: trigger.id,
          status: "rss_no_new",
        });
        continue;
      }

      // Dispara processTrigger pra cada novo item (sequencial pra não
      // sobrecarregar Zernio API).
      for (const item of limited) {
        const r = await processTrigger({
          trigger,
          firedBy: "rss",
          explicitTheme: item.title,
          payload: { guid: item.guid, title: item.title, link: item.link },
        });
        results.push({
          triggerId: trigger.id,
          status: `rss_${r.status}`,
          detail: r.detail,
        });
      }

      // Atualiza processed_guids (mantém últimos 200 pra não crescer infinito)
      const updatedGuids = [
        ...limited.map((it) => it.guid),
        ...(trigger.rss_processed_guids ?? []),
      ].slice(0, 200);
      await sb
        .from("zernio_autopilot_triggers")
        .update({
          rss_last_checked_at: new Date().toISOString(),
          rss_processed_guids: updatedGuids,
        })
        .eq("id", trigger.id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ triggerId: trigger.id, status: "rss_fatal", detail });
      console.error(`[cron-autopilot] rss ${trigger.id} FAIL:`, err);
      await sb
        .from("zernio_autopilot_triggers")
        .update({
          last_error: detail.slice(0, 500),
          rss_last_checked_at: new Date().toISOString(),
        })
        .eq("id", trigger.id);
    }
  }

  return Response.json({
    ok: true,
    processed: results.length,
    results,
    checkedAt: new Date().toISOString(),
  });
}

// ────────── computeNextRunAt (espelha v1 — mantém a mesma lógica) ──────────

function computeNextRunAt(trigger: Trigger): Date {
  const now = new Date();
  const tzOffsetMin = 180; // Sao_Paulo UTC-3
  const tzMs = -1 * tzOffsetMin * 60 * 1000;

  function nextOnDay(daysAhead: number): Date {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + daysAhead);
    d.setUTCHours(trigger.publish_hour, trigger.publish_minute, 0, 0);
    return new Date(d.getTime() - tzMs);
  }

  if (trigger.cadence_type === "daily") {
    let d = nextOnDay(0);
    if (d.getTime() <= now.getTime()) d = nextOnDay(1);
    return d;
  }
  if (trigger.cadence_type === "every_n_days" && trigger.interval_days) {
    let d = nextOnDay(0);
    if (d.getTime() <= now.getTime()) d = nextOnDay(trigger.interval_days);
    return d;
  }
  if (
    trigger.cadence_type === "weekly_dow" &&
    trigger.days_of_week &&
    trigger.days_of_week.length > 0
  ) {
    const today = now.getUTCDay();
    for (let i = 0; i < 8; i++) {
      const dow = (today + i) % 7;
      if (trigger.days_of_week.includes(dow)) {
        const candidate = nextOnDay(i);
        if (candidate.getTime() > now.getTime()) return candidate;
      }
    }
    return nextOnDay(7);
  }
  if (
    trigger.cadence_type === "specific_dates" &&
    trigger.specific_dates &&
    trigger.specific_dates.length > 0
  ) {
    const future = trigger.specific_dates
      .map((s) => {
        const [y, m, d] = s.split("-").map(Number);
        const dt = new Date(
          Date.UTC(y, m - 1, d, trigger.publish_hour, trigger.publish_minute)
        );
        return new Date(dt.getTime() - tzMs);
      })
      .filter((dt) => dt.getTime() > now.getTime())
      .sort((a, b) => a.getTime() - b.getTime());
    if (future.length > 0) return future[0];
    const far = new Date(now);
    far.setUTCFullYear(far.getUTCFullYear() + 1);
    return far;
  }
  return new Date(now.getTime() + 60 * 60 * 1000);
}

// ────────── RSS parsing (lightweight, sem deps) ──────────

interface RssItem {
  guid: string;
  title: string;
  link?: string;
}

/**
 * Fetch + parse de RSS 2.0 / Atom mínimo. Não tenta cobrir 100% do spec —
 * só extrai (guid OU link) + title de cada `<item>` ou `<entry>`.
 *
 * Retorna lista de items na ordem do feed (mais recente primeiro). O caller
 * filtra por guid pra pegar só os novos.
 */
async function fetchAndParseRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent": "SequenciaViral-AutopilotRSS/1.0",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();

  const items: RssItem[] = [];

  // RSS 2.0 <item>
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title") || "";
    const guid = extractTag(block, "guid") || extractTag(block, "link") || title;
    const link = extractTag(block, "link") || undefined;
    if (title) items.push({ guid: guid.trim(), title: title.trim(), link });
  }

  // Atom <entry> (se for Atom em vez de RSS)
  if (items.length === 0) {
    const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    let m2;
    while ((m2 = entryRegex.exec(xml)) !== null) {
      const block = m2[1];
      const title = extractTag(block, "title") || "";
      const id = extractTag(block, "id") || "";
      // Atom <link href="..."/>
      const linkMatch = block.match(/<link[^>]*href="([^"]+)"/i);
      const link = linkMatch ? linkMatch[1] : undefined;
      const guid = id || link || title;
      if (title) items.push({ guid: guid.trim(), title: title.trim(), link });
    }
  }

  return items;
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return null;
  let value = m[1].trim();
  // Strip CDATA
  const cdataMatch = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdataMatch) value = cdataMatch[1].trim();
  // Strip HTML tags básicos
  value = value.replace(/<[^>]+>/g, "").trim();
  return value || null;
}
