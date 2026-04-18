/**
 * Smoke test: envia 1 email de cada template pro seu próprio inbox.
 * Uso: bun run scripts/test-email.ts
 */
import { sendEmail } from "../lib/email/send";
import { WelcomeEmail } from "../lib/email/templates/welcome";
import { PaymentSuccessEmail } from "../lib/email/templates/payment-success";
import { PlanLimitEmail } from "../lib/email/templates/plan-limit";
import { ReEngagementEmail } from "../lib/email/templates/re-engagement";
import { ActivationNudgeEmail } from "../lib/email/templates/activation-nudge";
import { FirstCarouselEmail } from "../lib/email/templates/first-carousel";

const TO = process.env.TEST_USER_EMAIL || "gf.madureiraa@gmail.com";
const APP = "https://sequencia-viral.vercel.app";

async function main() {
  console.log(`📮 Enviando 6 emails de teste para ${TO}…\n`);

  const tests = [
    {
      label: "welcome",
      subject: "[TESTE] Bem-vindo ao Sequência Viral",
      react: WelcomeEmail({ name: "Gabriel", appUrl: APP }),
    },
    {
      label: "activation",
      subject: "[TESTE] Cola um link",
      react: ActivationNudgeEmail({ name: "Gabriel", appUrl: APP }),
    },
    {
      label: "first-carousel",
      subject: "[TESTE] Primeiro carrossel salvo",
      react: FirstCarouselEmail({
        name: "Gabriel",
        carouselTitle: "Como o Rickroll virou marketing viral",
        appUrl: APP,
      }),
    },
    {
      label: "plan-limit",
      subject: "[TESTE] Você atingiu o limite",
      react: PlanLimitEmail({ name: "Gabriel", used: 5, limit: 5, appUrl: APP }),
    },
    {
      label: "payment-success",
      subject: "[TESTE] Plano Pro ativo",
      react: PaymentSuccessEmail({
        name: "Gabriel",
        planName: "Pro",
        carouselsPerMonth: 30,
        appUrl: APP,
      }),
    },
    {
      label: "re-engagement",
      subject: "[TESTE] Faz tempo",
      react: ReEngagementEmail({
        name: "Gabriel",
        appUrl: APP,
        daysSinceLastUse: 12,
      }),
    },
  ];

  for (const t of tests) {
    const id = await sendEmail({
      to: TO,
      subject: t.subject,
      react: t.react,
      tags: [{ name: "test", value: t.label }],
    });
    console.log(`  ${id ? "✅" : "❌"} ${t.label.padEnd(18)} ${id || "FAIL"}`);
  }

  console.log("\nConfere seu inbox (e spam).");
}

main();
