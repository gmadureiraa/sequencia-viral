import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

export function PlanLimitEmail({
  name,
  used,
  limit,
  appUrl,
}: {
  name?: string;
  used: number;
  limit: number;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "você";
  const remaining = Math.max(limit - used, 0);
  const atLimit = remaining === 0;
  return (
    <EmailLayout
      preview={
        atLimit
          ? "Você atingiu o limite mensal. Upgrade libera mais geração."
          : `Faltam ${remaining} carrosséis no seu plano atual.`
      }
    >
      <EmailKicker>{atLimit ? "Limite atingido" : "Quase lá"}</EmailKicker>
      <EmailHeadline>
        {atLimit
          ? `${firstName}, você usou seus ${limit} carrosséis do mês.`
          : `${firstName}, só ${remaining} ${remaining === 1 ? "carrossel" : "carrosséis"} até o fim do ciclo.`}
      </EmailHeadline>
      <EmailText>
        O plano <strong>Pro</strong> (US$ 9,99/mês) libera 30 carrosséis e
        remove a marca d&apos;água. O <strong>Business</strong> (US$ 29,99) é
        ilimitado — pensado pra quem publica todo dia.
      </EmailText>
      <EmailButton href={`${appUrl}/app/checkout?plan=pro`}>
        Assinar Pro e continuar publicando
      </EmailButton>
      <EmailText>
        Prefere esperar o próximo ciclo? Sem problema. O limite reseta
        automaticamente.
      </EmailText>
    </EmailLayout>
  );
}

export default PlanLimitEmail;
