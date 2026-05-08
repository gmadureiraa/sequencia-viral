import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

export function ReferralActivationEmail({
  name,
  carouselsBonus,
  newUsageLimit,
  appUrl,
}: {
  name?: string;
  carouselsBonus: number;
  newUsageLimit: number | null;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "você";
  const limitLabel =
    typeof newUsageLimit === "number" && newUsageLimit > 0
      ? `Seu novo limite mensal: ${newUsageLimit} carrosséis.`
      : "";
  return (
    <EmailLayout
      preview={`Você ganhou +${carouselsBonus} carrosséis — seu amigo ativou`}
    >
      <EmailKicker>Indique e ganhe</EmailKicker>
      <EmailHeadline>
        {firstName}, seu amigo criou o primeiro carrossel.
      </EmailHeadline>
      <EmailText>
        Ele(a) entrou pelo seu link e acabou de gerar o primeiro carrossel
        no Sequência Viral. Como combinado, <strong>+{carouselsBonus} carrosséis
        de bônus</strong> entraram no seu plano agora — pode usar nesse mês
        mesmo. {limitLabel}
      </EmailText>
      <EmailButton href={`${appUrl}/app`}>
        Gerar carrossel agora
      </EmailButton>
      <EmailText>
        E se ele assinar, vem mais bônus: <strong>+20 carrosséis</strong>{" "}
        adicionais quando o pagamento dele cair. Ativação + assinatura =
        25 carrosséis seus, por amigo.
      </EmailText>
    </EmailLayout>
  );
}

export default ReferralActivationEmail;
