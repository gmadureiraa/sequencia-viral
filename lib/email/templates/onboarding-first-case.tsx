import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

/**
 * D+3 — Voz da Marca: a diferença entre IA genérica e IA que soa como você.
 */
export function OnboardingFirstCaseEmail({
  name,
  appUrl,
}: {
  name?: string;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "creator";
  return (
    <EmailLayout preview="A diferença entre IA genérica e IA que soa como você — 3 minutos.">
      <EmailKicker>Dia 3 · Voz da marca</EmailKicker>
      <EmailHeadline>
        {firstName}, 3 minutos pra IA soar como você.
      </EmailHeadline>
      <EmailText>
        Voz da marca é a diferença entre IA genérica e conteúdo que parece
        seu. Sem isso, o output sai correto, mas sem ritmo, sem tique, sem
        aquela palavra que só você usa.
      </EmailText>
      <EmailText>
        O Voz IA lê 3 posts seus e aprende: frases curtas ou longas,
        palavras favoritas, como você começa texto, como fecha. Depois
        disso, todo carrossel novo já sai no seu jeito.
      </EmailText>
      <EmailText>
        <strong>Como fazer agora:</strong>
      </EmailText>
      <EmailText>
        1. Abra{" "}
        <a href={`${appUrl}/app/settings`} style={{ color: "#0A0A0A" }}>
          /app/settings
        </a>{" "}
        → aba <strong>Voz IA</strong>
        <br />
        2. Cole 3 posts seus (Twitter, LinkedIn, blog, qualquer coisa)
        <br />
        3. Confirme nicho e tom
        <br />
        4. Gere um carrossel e compara com antes
      </EmailText>
      <EmailButton href={`${appUrl}/app/settings`}>
        Treinar Voz IA em 3 minutos
      </EmailButton>
      <EmailText>
        Que tal agora, antes do próximo carrossel?
      </EmailText>
    </EmailLayout>
  );
}

export default OnboardingFirstCaseEmail;
