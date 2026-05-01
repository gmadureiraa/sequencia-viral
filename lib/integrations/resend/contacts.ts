/**
 * Helpers de Audience/Contacts do Resend para o Sequência Viral.
 *
 * Por que existe: o lifecycle drip (welcome → onboarding → upgrade →
 * re-engagement) é uma Resend Automation que dispara em `contact.created`
 * dentro da audience "Sequência Viral". Pra cada signup novo a gente precisa
 * adicionar o contato na audience — depois disso o Resend toca a sequência
 * inteira sozinho.
 *
 * Audience id: vem de `RESEND_VIRAL_AUDIENCE_ID` (env var). Sem ela,
 * `addContactToAudience` vira no-op (warn, sem throw) — o transactional
 * `sendWelcome` continua funcionando independente.
 *
 * Endpoint Resend: `POST /audiences/{id}/contacts` — idempotente para o mesmo
 * email (Resend retorna o contact existente, não cria duplicado).
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

export type AudienceContact = {
  email: string;
  /** Nome completo (Resend separa em first_name/last_name automaticamente). */
  name?: string;
  /** Se o user opted-out, passar true e a automation pula esse contato. */
  unsubscribed?: boolean;
};

/**
 * Adiciona o contato na audience "Sequência Viral".
 * Nunca lança — falha silenciosa não pode bloquear o fluxo de signup.
 *
 * Retorno: contact id em sucesso, null se desconfigurado/falhou.
 */
export async function addContactToAudience(
  contact: AudienceContact
): Promise<string | null> {
  const resend = client();
  if (!resend) {
    console.warn(
      "[resend.contacts] RESEND_API_KEY ausente — contato não adicionado",
      { email: contact.email }
    );
    return null;
  }
  if (!VIRAL_AUDIENCE_ID) {
    console.warn(
      "[resend.contacts] RESEND_VIRAL_AUDIENCE_ID ausente — contato não adicionado",
      { email: contact.email }
    );
    return null;
  }

  const fullName = (contact.name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ") || undefined;

  try {
    const result = await resend.contacts.create({
      email: contact.email,
      firstName: firstName || undefined,
      lastName,
      unsubscribed: contact.unsubscribed ?? false,
      audienceId: VIRAL_AUDIENCE_ID,
    });
    if (result.error) {
      console.error("[resend.contacts] Erro ao adicionar contato", result.error, {
        email: contact.email,
      });
      return null;
    }
    return result.data?.id ?? null;
  } catch (err) {
    console.error("[resend.contacts] Falha ao adicionar contato", err, {
      email: contact.email,
    });
    return null;
  }
}
