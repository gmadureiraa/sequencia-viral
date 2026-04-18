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
    <EmailLayout preview="Volta rapidinho — 1 link vira 1 carrossel em 15s.">
      <EmailKicker>Faz tempo</EmailKicker>
      <EmailHeadline>
        {firstName}, cola qualquer link e sai com carrossel.
      </EmailHeadline>
      <EmailText>
        A gente notou que faz{" "}
        <strong>{daysSinceLastUse} dias</strong> que você não abre o estúdio.
        Sem cobrança, só um lembrete.
      </EmailText>
      <EmailText>
        O fluxo continua o mesmo: cola um YouTube, blog ou reel →
        escolhe uma variação → ajusta → exporta. Tudo em menos de 2 minutos.
      </EmailText>
      <EmailButton href={`${appUrl}/app/create`}>
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
