import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

export function ReferralConvertedEmail({
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
      preview={`Você ganhou +${carouselsBonus} carrosséis no Sequência Viral`}
    >
      <EmailKicker>Indique e ganhe</EmailKicker>
      <EmailHeadline>
        {firstName}, você ganhou +{carouselsBonus} carrosséis.
      </EmailHeadline>
      <EmailText>
        Um amigo seu acabou de assinar o Sequência Viral usando seu link de
        indicação. Como combinado, <strong>+{carouselsBonus} carrosséis</strong>{" "}
        já entraram no seu plano agora — pode usar esse mês mesmo. {limitLabel}
      </EmailText>
      <EmailButton href={`${appUrl}/app`}>
        Gerar carrossel agora
      </EmailButton>
      <EmailText>
        Continua valendo: cada amigo novo que assinar com seu link te dá{" "}
        <strong>+{carouselsBonus} carrosséis no plano</strong>. Sem limite de
        indicações, e os bônus se somam.
      </EmailText>
    </EmailLayout>
  );
}

export default ReferralConvertedEmail;
