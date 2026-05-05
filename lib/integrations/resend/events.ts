/**
 * Helpers de Events do Resend para o lifecycle do Sequência Viral.
 *
 * Por que existe: além da audience (trigger inicial via `contact.created`),
 * a gente quer disparar Resend Automations específicas em pontos do lifecycle
 * (signup, upgrade, cancel, payment failed). O endpoint `POST /events` aceita
 * qualquer evento custom e a Automation no dashboard escuta por `name`.
 *
 * Filosofia: NUNCA lançar — falha em qualquer dispatch é silenciosa (warn),
 * porque webhooks Stripe e signup flow não podem quebrar por causa de email.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const VIRAL_AUDIENCE_ID = process.env.RESEND_VIRAL_AUDIENCE_ID;

/**
 * Dispara um evento custom no Resend pra triggar Automations.
 *
 * @param name nome do evento (ex: `sv.signup`, `sv.upgraded`, `sv.canceled`,
 *             `sv.payment.failed`). Usar dot.notation pra agrupar.
 * @param data payload livre — vira variáveis disponíveis na Automation.
 *
 * Retorno: void. Erros são logados e engolidos.
 */
export async function fireResendEvent(
  name: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const res = await fetch("https://api.resend.com/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, data }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[resend event] non-2xx", name, res.status, text);
    }
  } catch (e) {
    console.warn("[resend event] failed:", name, e);
  }
}

/**
 * Atualiza o contato na audience Sequência Viral. Resend não tem campo "tag"
 * embutido em contacts, então a estratégia mais limpa que dá pra fazer via API
 * pública é re-PATCH no contato com firstName/lastName/unsubscribed.
 *
 * NOTE: o plan tag em si não tem destino persistente em audiences. A
 * segmentação por plano é feita no lado das Automations escutando os events
 * `sv.upgraded` / `sv.canceled` (preferred path). Mantemos esse helper só
 * pra eventual uso futuro caso Resend adicione metadata em contacts — hoje
 * é basicamente um no-op defensivo que garante que o contato existe.
 */
export async function updateResendContactPlan(
  email: string,
  plan: "free" | "pro" | "business"
): Promise<void> {
  if (!RESEND_API_KEY || !VIRAL_AUDIENCE_ID) return;
  try {
    // PATCH no contato pelo email (Resend aceita email no path como identifier).
    // Hoje só re-confirma unsubscribed=false; se Resend lançar metadata, dá pra
    // estender daqui sem mexer no caller.
    const res = await fetch(
      `https://api.resend.com/audiences/${VIRAL_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ unsubscribed: false }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[resend contact update] non-2xx",
        email,
        plan,
        res.status,
        text
      );
    }
  } catch (e) {
    console.warn("[resend contact update] failed:", email, plan, e);
  }
}
