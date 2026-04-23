import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

export function WelcomeEmail({
  name,
  appUrl,
}: {
  name?: string;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "creator";
  return (
    <EmailLayout preview="Oi! Que tal o primeiro carrossel agora? Leva uns 60 segundos.">
      <EmailKicker>Bem-vindo</EmailKicker>
      <EmailHeadline>
        Oi, {firstName}. Que tal o primeiro carrossel agora?
      </EmailHeadline>
      <EmailText>
        O que tá te segurando? Cola um link, testa, 60 segundos. Sem
        perfumaria. Você tem 5 carrosséis grátis por mês.
      </EmailText>
      <EmailText>
        Serve link de YouTube, artigo, reel do Instagram ou só uma ideia
        solta. A IA escreve no seu tom e monta os slides. É pra ser rápido
        mesmo.
      </EmailText>
      <EmailButton href={`${appUrl}/app/create/new`}>
        Criar meu primeiro agora
      </EmailButton>
      <EmailText>
        Dica honesta: se você completar seu <strong>perfil de marca</strong>{" "}
        em{" "}
        <a href={`${appUrl}/app/settings`} style={{ color: "#0A0A0A" }}>
          /app/settings
        </a>
        , a IA aprende seu tom e o output muda de genérico pra &quot;soa
        como eu&quot;. Mas isso é depois. Primeiro testa.
      </EmailText>
      <EmailText>
        Qualquer dúvida, responde este e-mail. A gente lê.
      </EmailText>
    </EmailLayout>
  );
}

export default WelcomeEmail;
