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
  return (
    <EmailLayout
      preview={`Você acabou de ganhar ${reward} em crédito no Sequência Viral`}
    >
      <EmailKicker>Indique e ganhe</EmailKicker>
      <EmailHeadline>
        {firstName}, você acabou de ganhar {reward} em crédito.
      </EmailHeadline>
      <EmailText>
        Um amigo seu acabou de assinar o Sequência Viral usando seu link de
        indicação. Como combinado, <strong>{reward}</strong> entraram no seu
        saldo agora.
      </EmailText>
      <EmailText>
        Crédito total acumulado: <strong>{total}</strong>. Vai abater
        automaticamente na sua próxima fatura — sem precisar fazer nada.
      </EmailText>
      <EmailButton href={`${appUrl}/app/settings/referrals`}>
        Ver minhas indicações
      </EmailButton>
      <EmailText>
        Continua valendo: cada amigo novo que assinar com seu link te dá{" "}
        <strong>{formatBrl(rewardCents)}</strong> de crédito. Sem limite de
        indicações, e os créditos acumulam.
      </EmailText>
    </EmailLayout>
  );
}

export default ReferralConvertedEmail;
