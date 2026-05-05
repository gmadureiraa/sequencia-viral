/**
 * POST /api/zernio/webhook
 *
 * Recebe eventos do Zernio (post.published, post.failed, post.partial,
 * post.scheduled, post.cancelled) e atualiza zernio_scheduled_posts.status.
 *
 * Sem isso, o calendário e a UI mostram "scheduled" pra sempre, mesmo após
 * o post ter ido pro ar — admin não tem confirmação de que rodou.
 *
 * Setup no dashboard Zernio:
 *  1. Criar webhook → URL: https://viral.kaleidos.com.br/api/zernio/webhook
 *  2. Eventos: post.published, post.failed, post.partial, post.cancelled
 *  3. Copiar o secret e setar como ZERNIO_WEBHOOK_SECRET no Vercel.
 *
 * Verificação: HMAC-SHA256 do raw body com secret = header X-Zernio-Signature.
 *
 * Idempotência: Zernio entrega at-least-once. Usamos `payload.id` (X-Zernio-Event-Id)
 * + tabela `zernio_webhook_events` (criada lazy se ainda não existe — ou
 * via migration follow-up). Pra V1, idempotência leve via `zernio_post_id`
 * + status — se já está no estado-alvo, ignoramos.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";

export const runtime = "nodejs";

interface WebhookPayload {
  id?: string;
  event?: string;
  data?: {
    post?: {
      _id?: string;
      status?: string;
      publishedAt?: string;
      error?: string;
      results?: Array<{ platform: string; status: string; error?: string }>;
    };
  };
}

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  // Comparison resistente a timing attacks
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Mapeia evento Zernio → status local que persistimos em zernio_scheduled_posts. */
function mapEventToStatus(event: string): string | null {
  switch (event) {
    case "post.published":
      return "published";
    case "post.failed":
      return "failed";
    case "post.partial":
      // Algumas plataformas publicaram, outras falharam. Marcar como partial
      // permite o admin ver detalhes em raw e decidir.
      return "partial";
    case "post.cancelled":
      return "cancelled";
    case "post.scheduled":
      return "scheduled";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  const rawBody = await request.text();

  // Aceita 2 modos de auth:
  //  1. Sem secret configurado: aceita qualquer request (DEV-mode). Loga warning.
  //  2. Com secret: valida assinatura.
  if (secret) {
    const sig =
      request.headers.get("x-zernio-signature") ||
      request.headers.get("x-late-signature");
    if (!verifySignature(rawBody, sig, secret)) {
      return new Response("invalid signature", { status: 401 });
    }
  } else {
    console.warn(
      "[zernio/webhook] ZERNIO_WEBHOOK_SECRET ausente — aceitando sem validar (DEV)"
    );
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const event = payload.event ?? "";
  const post = payload.data?.post;
  const zernioPostId = post?._id;
  if (!zernioPostId) {
    // Evento não-post (ex: account.connected) — só ack 200 sem fazer nada.
    return Response.json({ ok: true, ignored: "no post id" });
  }

  const newStatus = mapEventToStatus(event);
  if (!newStatus) {
    return Response.json({ ok: true, ignored: `unknown event: ${event}` });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) {
    // Falha silenciosa pra não causar retry storm; loga pra investigação manual.
    console.error("[zernio/webhook] DB client null, dropping event", {
      zernioPostId,
      event,
    });
    return Response.json({ ok: true, dropped: "db unavailable" });
  }

  // Idempotência: se já está no estado-alvo, no-op.
  const { data: existing } = await sb
    .from("zernio_scheduled_posts")
    .select("id, status")
    .eq("zernio_post_id", zernioPostId)
    .maybeSingle();

  if (!existing) {
    // Post não está no nosso DB — pode ter sido criado fora do SV (manual no
    // Zernio dashboard). Não é erro, só ignora.
    return Response.json({ ok: true, ignored: "post não rastreado" });
  }

  if (existing.status === newStatus) {
    return Response.json({ ok: true, idempotent: true });
  }

  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "published" && post?.publishedAt) {
    update.published_at = post.publishedAt;
  }
  if (newStatus === "failed" || newStatus === "partial") {
    const errSummary =
      post?.error ||
      post?.results
        ?.filter((r) => r.status !== "success" && r.error)
        .map((r) => `${r.platform}: ${r.error}`)
        .join(" | ");
    if (errSummary) update.failure_reason = errSummary.slice(0, 500);
  }

  const { error } = await sb
    .from("zernio_scheduled_posts")
    .update(update)
    .eq("id", existing.id);

  if (error) {
    console.error("[zernio/webhook] update err:", error.message);
    // 5xx faz Zernio retentar — tudo bem porque idempotente.
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, postId: existing.id, newStatus });
}
