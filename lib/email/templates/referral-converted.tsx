import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

function formatBrl(cents: number): string {
  const v = cents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

export function ReferralConvertedEmail({
  name,
  rewardCents,
  totalCreditCents,
  appUrl,
}: {
  name?: string;
  rewardCents: number;
  totalCreditCents: number;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "você";
  const reward = formatBrl(rewardCents);
  const total = formatBrl(totalCreditCents);
  // Cada conversão = 1 mês de Pro (reward = 1× preço Pro mensal). totalMonths
  // arredonda pra número inteiro de meses acumulados.
  const totalMonths = rewardCents > 0
    ? Math.round(totalCreditCents / rewardCents)
    : 1;
  const monthsLabel = totalMonths === 1 ? "1 mês grátis" : `${totalMonths} meses grátis`;
  return (
    <EmailLayout
      preview={`Você ganhou 1 mês grátis de Pro no Sequência Viral`}
    >
      <EmailKicker>Indique e ganhe</EmailKicker>
      <EmailHeadline>
        {firstName}, você ganhou 1 mês grátis de Pro.
      </EmailHeadline>
      <EmailText>
        Um amigo seu acabou de assinar o Sequência Viral usando seu link de
        indicação. Como combinado, <strong>1 mês grátis de Pro</strong> ({reward})
        entrou no seu saldo agora — vai abater na sua próxima fatura.
      </EmailText>
      <EmailText>
        Total acumulado: <strong>{monthsLabel} de Pro</strong> ({total} em
        crédito Stripe). Sem ação sua — Stripe abate sozinho na próxima cobrança.
      </EmailText>
      <EmailButton href={`${appUrl}/app/settings/referrals`}>
        Ver minhas indicações
      </EmailButton>
      <EmailText>
        Continua valendo: cada amigo novo que assinar com seu link te dá{" "}
        <strong>+1 mês grátis de Pro</strong>. Sem limite de indicações, e os
        créditos acumulam.
      </EmailText>
    </EmailLayout>
  );
}

export default ReferralConvertedEmail;
