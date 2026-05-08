import crypto from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";

// Webhook Resend — captura email events (delivered, bounced, complained, opened, clicked).
// Hospedado aqui porque SV já tem infra de webhooks Stripe deployada. O endpoint
// não é específico de SV: recebe events de TODOS os domínios da conta Resend
// (madureira.xyz + news.kaleidos.com.br). Pode mover pra outro projeto depois.
//
// Uso primário: auto-suppress de hard bounce + complained (proteção de reputation).
// Logging em DB é best-effort (tabela email_events opcional).
//
// Defesas anti-replay (P2-3 audit 2026-05-08):
//  1. Janela de tolerância de 5min em `svix-timestamp` — request com timestamp
//     fora da janela é rejeitado com 400 (mesmo se o HMAC for válido).
//  2. Dedup persistente via `webhook_events_processed (provider, event_id)`.
//     Replay com mesmo `svix-id` retorna 200 idempotente sem reprocessar
//     (proteção contra retry storm + atacante que replay dentro da janela).

const TIMESTAMP_TOLERANCE_SEC = 5 * 60; // 5 minutos

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    [k: string]: unknown;
  };
};

function verifySvixSignature(
  payload: string,
  headers: Headers,
  secret: string
): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;

  // Resend usa secret no formato whsec_<base64>. O HMAC é sobre <id>.<timestamp>.<payload>
  const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(cleanSecret, "base64");
  } catch {
    return false;
  }

  const signedContent = `${id}.${timestamp}.${payload}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // Header pode trazer múltiplas signatures (versionadas: "v1,<sig> v1,<sig2>")
  const sigs = signature.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
  return sigs.some((s) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

async function suppressContact(email: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const audienceIds = [
    process.env.RESEND_VIRAL_AUDIENCE_ID,
    process.env.RESEND_REELS_AUDIENCE_ID,
    process.env.RESEND_RADAR_AUDIENCE_ID,
    process.env.RESEND_MADUREIRA_AUDIENCE_ID,
    process.env.RESEND_KALEIDOS_AUDIENCE_ID,
  ].filter(Boolean) as string[];

  for (const aid of audienceIds) {
    try {
      await fetch(
        `https://api.resend.com/audiences/${aid}/contacts/${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ unsubscribed: true }),
        }
      );
    } catch (e) {
      console.warn("[resend webhook] suppress falhou em audience", aid, e);
    }
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !secret) {
    console.error("[resend webhook] RESEND_WEBHOOK_SECRET ausente em produção");
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  if (secret && !verifySvixSignature(body, request.headers, secret)) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  // Replay window: rejeitar timestamps muito antigos/futuros mesmo com HMAC
  // válido. Sem isso, atacante captura request (MITM, log leak) e replay
  // infinito porque o HMAC continua válido.
  const tsHeader = request.headers.get("svix-timestamp");
  if (tsHeader) {
    const ts = Number(tsHeader);
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(ts) ||
      Math.abs(nowSec - ts) > TIMESTAMP_TOLERANCE_SEC
    ) {
      return Response.json(
        { error: "timestamp out of window" },
        { status: 400 }
      );
    }
  } else if (secret) {
    // Secret configurado implica Svix headers presentes. Header ausente
    // num webhook validado = request anômala.
    return Response.json(
      { error: "missing svix-timestamp" },
      { status: 400 }
    );
  }

  // Dedup: mesmo `svix-id` já processado vira no-op idempotente.
  const eventId = request.headers.get("svix-id");
  if (eventId) {
    const adminEarly = createServiceRoleSupabaseClient();
    if (adminEarly) {
      const { error: insErr } = await adminEarly
        .from("webhook_events_processed")
        .insert({ provider: "resend", event_id: eventId });
      if (insErr && insErr.code === "23505") {
        // duplicate key → replay
        return Response.json({ received: true, deduped: true });
      }
      // outros erros (tabela ausente em ambiente novo) → seguem
    }
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const recipients = Array.isArray(event.data?.to)
    ? event.data?.to
    : event.data?.to
      ? [event.data.to]
      : [];

  // Hard bounce ou complained → suppress contato em todas as audiences
  // (proteção de reputation: se Gmail/Yahoo marcaram como spam ou rejeitaram,
  // não mandar mais nada pra esse endereço).
  if (
    event.type === "email.complained" ||
    (event.type === "email.bounced" &&
      (event.data?.bounce?.type === "Permanent" ||
        event.data?.bounce?.type === "hard"))
  ) {
    for (const email of recipients) {
      if (typeof email === "string" && email.includes("@")) {
        await suppressContact(email);
      }
    }
    console.warn(
      `[resend webhook] suppressed ${recipients.length} contact(s) — type=${event.type}`
    );
  }

  // Best-effort log no DB (tabela opcional — não bloqueia se não existir)
  try {
    const admin = createServiceRoleSupabaseClient();
    if (admin) {
      await admin.from("email_events").insert({
        event_type: event.type,
        email_id: event.data?.email_id,
        recipient: recipients[0] || null,
        subject: event.data?.subject,
        data: event.data,
      });
    }
  } catch (e) {
    // Tabela pode não existir — ignorar silenciosamente.
    if (process.env.NODE_ENV !== "production") {
      console.debug("[resend webhook] email_events insert skip:", e);
    }
  }

  return Response.json({ received: true });
}
