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
    <EmailLayout preview="Bem-vindo ao Sequência Viral — 5 carrosséis grátis pra você começar.">
      <EmailKicker>Bem-vindo</EmailKicker>
      <EmailHeadline>
        Oi, {firstName}. Seu estúdio de carrosséis já tá pronto.
      </EmailHeadline>
      <EmailText>
        Você tem 5 carrosséis grátis por mês. Cola um link de YouTube, um
        artigo, um reel do Instagram ou escreve uma ideia — a IA gera 3
        variações (dados, história, provocação) em uns 15 segundos.
      </EmailText>
      <EmailButton href={`${appUrl}/app/create`}>
        Criar meu primeiro carrossel
      </EmailButton>
      <EmailText>
        Dica: se você completar seu <strong>perfil de marca</strong> em{" "}
        <a href={`${appUrl}/app/settings`} style={{ color: "#0A0A0A" }}>
          /app/settings
        </a>
        , a IA usa seu tom e nicho pra escrever. O output muda de genérico
        pra &quot;soa como eu&quot;.
      </EmailText>
      <EmailText>
        Qualquer dúvida, responde este e-mail. A gente lê.
      </EmailText>
    </EmailLayout>
  );
}

export default WelcomeEmail;
