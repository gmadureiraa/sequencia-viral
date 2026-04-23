import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

export function ReEngagementEmail({
  name,
  appUrl,
  daysSinceLastUse,
}: {
  name?: string;
  appUrl: string;
  daysSinceLastUse: number;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "você";
  return (
    <EmailLayout preview="Tá faltando ideia ou falta de tempo? Qualquer link salvo vira carrossel.">
      <EmailKicker>Faz tempo</EmailKicker>
      <EmailHeadline>
        {firstName}, tá faltando ideia ou falta de tempo?
      </EmailHeadline>
      <EmailText>
        Faz <strong>{daysSinceLastUse} dias</strong> que você não abre o
        estúdio. Sem cobrança, só um atalho.
      </EmailText>
      <EmailText>
        Cola qualquer link que você salvou essa semana e a gente transforma
        em carrossel. 15 segundos.
      </EmailText>
      <EmailButton href={`${appUrl}/app/create/new`}>
        Gerar 1 carrossel agora
      </EmailButton>
      <EmailText>
        Se não é mais relevante, tranquilo. Responde este e-mail com
        &quot;cancelar&quot; que paramos de mandar.
      </EmailText>
    </EmailLayout>
  );
}

export default ReEngagementEmail;
