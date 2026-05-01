/**
 * Renderiza todos os templates React Email do SV em HTML estático para
 * publicação no Resend (audience + automation).
 *
 * Uso: cd code/sequencia-viral && npx tsx scripts/render-emails-for-resend.ts
 *
 * Outputs:
 *   /tmp/sv-templates/<nome>.html   — HTML pronto pra POST /templates
 *   /tmp/sv-templates/_index.json   — mapa nome → { subject, file }
 *
 * Esses HTMLs NÃO são usados pelos transactional sends (dispatch.ts continua
 * renderizando React em runtime). São apenas pra automation Resend.
 */

import fs from "node:fs";
import path from "node:path";
import { render } from "@react-email/render";

import { WelcomeEmail } from "../lib/email/templates/welcome";
import { ActivationNudgeEmail } from "../lib/email/templates/activation-nudge";
import { FirstCarouselEmail } from "../lib/email/templates/first-carousel";
import { PaymentSuccessEmail } from "../lib/email/templates/payment-success";
import { PlanLimitEmail } from "../lib/email/templates/plan-limit";
import { ReEngagementEmail } from "../lib/email/templates/re-engagement";
import { OnboardingHowItWorksEmail } from "../lib/email/templates/onboarding-how-it-works";
import { OnboardingFirstCaseEmail } from "../lib/email/templates/onboarding-first-case";
import { OnboardingWhyUpgradeEmail } from "../lib/email/templates/onboarding-why-upgrade";
import { PaymentFailedEmail } from "../lib/email/templates/payment-failed";
import { LastChanceCouponEmail } from "../lib/email/templates/last-chance-coupon";

const APP_URL = "https://viral.kaleidos.com.br";
const OUT_DIR = "/tmp/sv-templates";

type Entry = {
  name: string;
  subject: string;
  element: any;
};

const TEMPLATES: Entry[] = [
  {
    name: "sv-welcome",
    subject: "Bem-vindo. Que tal o primeiro carrossel agora?",
    element: WelcomeEmail({ name: "", appUrl: APP_URL }),
  },
  {
    name: "sv-activation-nudge",
    subject: "Tá faltando 60 segundos pro seu primeiro carrossel",
    element: ActivationNudgeEmail({ name: "", appUrl: APP_URL }),
  },
  {
    name: "sv-first-carousel",
    subject: "Você gerou o primeiro carrossel (próximos passos)",
    element: FirstCarouselEmail({
      name: "",
      carouselTitle: "Seu carrossel",
      appUrl: APP_URL,
    }),
  },
  {
    name: "sv-payment-success",
    subject: "Pagamento confirmado — bora gerar",
    element: PaymentSuccessEmail({
      name: "",
      planName: "Creator",
      carouselsPerMonth: 30,
      appUrl: APP_URL,
    }),
  },
  {
    name: "sv-plan-limit",
    subject: "Você atingiu o limite do plano grátis",
    element: PlanLimitEmail({
      name: "",
      used: 5,
      limit: 5,
      appUrl: APP_URL,
    }),
  },
  {
    name: "sv-re-engagement",
    subject: "Continua querendo gerar carrossel?",
    element: ReEngagementEmail({
      name: "",
      appUrl: APP_URL,
      daysSinceLastUse: 14,
    }),
  },
  {
    name: "sv-onboarding-how-it-works",
    subject: "Como o Sequência Viral funciona em 90 segundos",
    element: OnboardingHowItWorksEmail({ name: "", appUrl: APP_URL }),
  },
  {
    name: "sv-onboarding-first-case",
    subject: "Caso real: 1 link → carrossel pronto em 1 minuto",
    element: OnboardingFirstCaseEmail({ name: "", appUrl: APP_URL }),
  },
  {
    name: "sv-onboarding-why-upgrade",
    subject: "Vale a pena fazer upgrade? Aqui está o cálculo",
    element: OnboardingWhyUpgradeEmail({ name: "", appUrl: APP_URL }),
  },
  {
    name: "sv-payment-failed",
    subject: "Falha no pagamento (dá pra resolver agora)",
    element: PaymentFailedEmail({
      name: "",
      planName: "Creator",
      amountUsd: null,
      portalUrl: `${APP_URL}/app/settings/billing`,
      appUrl: APP_URL,
    }),
  },
  {
    name: "sv-last-chance-coupon",
    subject: "Última chance: cupom -25% expira hoje",
    element: LastChanceCouponEmail({
      name: "",
      appUrl: APP_URL,
      couponCode: "VIRAL50",
    }),
  },
];

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const index: Record<
    string,
    { subject: string; file: string; chars: number }
  > = {};

  for (const t of TEMPLATES) {
    const html = await render(t.element, { pretty: false });
    const file = path.join(OUT_DIR, `${t.name}.html`);
    fs.writeFileSync(file, html, "utf8");
    index[t.name] = {
      subject: t.subject,
      file,
      chars: html.length,
    };
    console.log(
      `[ok] ${t.name.padEnd(32)}  ${html.length.toString().padStart(6)} chars  → ${file}`
    );
    console.log(`     subject: ${t.subject}`);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "_index.json"),
    JSON.stringify(index, null, 2)
  );
  console.log(
    `\n${TEMPLATES.length} templates renderizados em ${OUT_DIR}/`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
