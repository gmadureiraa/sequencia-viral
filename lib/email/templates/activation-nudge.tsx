import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

/**
 * Disparado D+2 quando o user criou conta mas ainda não gerou 1º carrossel.
 */
export function ActivationNudgeEmail({
  name,
  appUrl,
}: {
  name?: string;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "você";
  return (
    <EmailLayout preview="Cola 1 link — a IA faz o resto em 15s.">
      <EmailKicker>Dica rápida</EmailKicker>
      <EmailHeadline>
        {firstName}, experimenta colar um link no estúdio.
      </EmailHeadline>
      <EmailText>
        Não precisa escrever nada do zero. A IA funciona melhor quando você
        joga uma fonte real:
      </EmailText>
      <EmailText>
        • Um vídeo do YouTube que você gostou
        <br />
        • Um post do seu blog ou newsletter favorita
        <br />
        • Um reel do Instagram que viralizou
        <br />
        • Um link de notícia sobre o seu nicho
      </EmailText>
      <EmailButton href={`${appUrl}/app/create`}>
        Colar link e gerar
      </EmailButton>
      <EmailText>
        Você tem 5 carrosséis grátis esse mês. Usa 1 pra testar — o resultado
        costuma surpreender.
      </EmailText>
    </EmailLayout>
  );
}

export default ActivationNudgeEmail;
