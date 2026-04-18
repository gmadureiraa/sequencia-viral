import { Resend } from "resend";
import type { ReactElement } from "react";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM =
  process.env.EMAIL_FROM || "Sequência Viral <onboarding@resend.dev>";
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

let _resend: Resend | null = null;

function client(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  from?: string;
  replyTo?: string;
  /** Tags opcionais para filtrar no dashboard do Resend. */
  tags?: { name: string; value: string }[];
};

/**
 * Envia e-mail transacional via Resend. Nunca lança: falhas viram warn no log.
 * Retorna o `id` do Resend em sucesso, ou `null` se desconfigurado/falhou.
 */
export async function sendEmail(args: SendEmailArgs): Promise<string | null> {
  const resend = client();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY ausente — email não enviado.",
      { to: args.to, subject: args.subject }
    );
    return null;
  }
  try {
    const result = await resend.emails.send({
      from: args.from || DEFAULT_FROM,
      to: args.to,
      subject: args.subject,
      react: args.react,
      replyTo: args.replyTo || DEFAULT_REPLY_TO,
      tags: args.tags,
    });
    if (result.error) {
      console.error("[email] Resend retornou erro:", result.error, { subject: args.subject });
      return null;
    }
    return result.data?.id ?? null;
  } catch (err) {
    console.error("[email] Falha no envio:", err, { subject: args.subject });
    return null;
  }
}
