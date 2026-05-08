/**
 * Helpers de manipulação de audience Resend para o lifecycle do Sequência Viral.
 *
 * Por que existe (separado de `lib/integrations/resend/contacts.ts`): aquele
 * arquivo lida com **adicionar** contatos na audience no fluxo de signup.
 * Este aqui lida com **remover** contatos quando o lead vira cliente pago,
 * pra interromper a Resend Automation `SV — Onboarding completo`. Manter
 * separado deixa explícito o lado da API que estamos manipulando (audience
 * membership), em contraste com envio transacional (`lib/email/dispatch.ts`).
 *
 * Filosofia: NUNCA lança. Falha em remoção não pode quebrar o webhook Stripe.
 * Loga warn e segue — pattern idêntico ao `sendOwnerSubscriptionAlert`.
 */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const VIRAL_AUDIENCE_ID = process.env.RESEND_VIRAL_AUDIENCE_ID;

let _resend: Resend | null = null;

function client(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

export type RemoveOnboardingArgs = {
  /** Email do user que acabou de virar pagante. Case-insensitive no Resend. */
  email: string | null | undefined;
};

export type RemoveOnboardingResult =
  | { ok: true; deleted: boolean }
  | { ok: false; reason: "no-config" | "no-email" | "not-found" | "error" };

/**
 * Remove o contato da audience "Sequência Viral" pra interromper a automation
 * de onboarding (`SV — Onboarding completo`, id `019df835-834b-7426-9a26-49d0371281f2`).
 *
 * Importante: NÃO deleta o contact globalmente. O Resend `contacts.remove`
 * com `audienceId` no payload remove a membership só dessa audience —
 * outras audiences (Kaleidos Leads, Madureira Newsletter) ficam intactas.
 *
 * Idempotente: se o contact não existe na audience (já removido, ou nunca
 * foi adicionado porque o user pulou o flow padrão), o Resend retorna 404.
 * Tratamos como sucesso silencioso (`deleted: false`) — não é erro.
 */
export async function removeFromOnboardingAudience(
  args: RemoveOnboardingArgs
): Promise<RemoveOnboardingResult> {
  const email = (args.email || "").trim().toLowerCase();

  if (!email) {
    console.warn(
      "[resend.audience] removeFromOnboardingAudience: email vazio — skip"
    );
    return { ok: false, reason: "no-email" };
  }

  const resend = client();
  if (!resend) {
    console.warn(
      "[resend.audience] RESEND_API_KEY ausente — contato não removido",
      { email }
    );
    return { ok: false, reason: "no-config" };
  }
  if (!VIRAL_AUDIENCE_ID) {
    console.warn(
      "[resend.audience] RESEND_VIRAL_AUDIENCE_ID ausente — contato não removido",
      { email }
    );
    return { ok: false, reason: "no-config" };
  }

  try {
    const result = await resend.contacts.remove({
      email,
      audienceId: VIRAL_AUDIENCE_ID,
    });

    if (result.error) {
      // Resend retorna 404 quando o contact não existe na audience.
      // O SDK normaliza isso em `result.error` com `name: 'not_found'`
      // (ou `statusCode: 404`). Tratamos como no-op: lead nunca passou
      // pelo flow padrão de signup ou já foi removido antes — não é erro.
      const name = (result.error as { name?: string }).name;
      const statusCode = (result.error as { statusCode?: number }).statusCode;
      if (name === "not_found" || statusCode === 404) {
        console.info(
          "[resend.audience] contact não existe na audience SV — skip silencioso",
          { email }
        );
        return { ok: true, deleted: false };
      }
      console.warn("[resend.audience] erro ao remover contato:", result.error, {
        email,
      });
      return { ok: false, reason: "error" };
    }

    const deleted = Boolean(result.data?.deleted);
    console.info(
      `[stripe-webhook] removed ${email} from audience SV onboarding`,
      { deleted }
    );
    return { ok: true, deleted };
  } catch (err) {
    console.warn("[resend.audience] exceção ao remover contato:", err, {
      email,
    });
    return { ok: false, reason: "error" };
  }
}
