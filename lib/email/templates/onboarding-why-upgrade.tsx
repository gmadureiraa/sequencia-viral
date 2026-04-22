import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

/**
 * D+7 — Por que upgrade: mostra limitações do free e o valor do Creator/Pro.
 */
export function OnboardingWhyUpgradeEmail({
  name,
  appUrl,
}: {
  name?: string;
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "creator";
  return (
    <EmailLayout preview="Por que ir pro Creator: 10 carrosséis, zero marca d'água, até 12 slides.">
      <EmailKicker>Dia 7 · Upgrade</EmailKicker>
      <EmailHeadline>
        {firstName}, 1 semana de Sequência Viral. Vale um plano pago?
      </EmailHeadline>
      <EmailText>
        Depende. Se você publica 1 carrossel por semana, o grátis resolve.
        Se sua meta é <strong>crescer de verdade</strong>, o Creator foi feito
        pro seu ritmo.
      </EmailText>
      <EmailText>
        <strong>Comparativo honesto:</strong>
      </EmailText>
      <EmailText>
        <strong>Grátis</strong>: 5 carrosséis/mês, marca d&apos;água discreta,
        estilo branco.
        <br />
        <strong>Creator · R$ 49/mês</strong>: 10 carrosséis, até 12 slides,
        zero marca d&apos;água, claro+escuro, imagens com IA/busca, 1 perfil.
        <br />
        <strong>Pro · R$ 97/mês</strong>: 30 carrosséis, até 12 slides, imagens
        IA + stock, cache inteligente, suporte prioritário.
      </EmailText>
      <EmailText>
        Matemática simples: 1 carrossel postado = 1 oportunidade de
        aparecer. 10 carrosséis/mês = 10 chances vs 5. Não é sobre
        quantidade bruta, é sobre <strong>cadência</strong>.
      </EmailText>
      <EmailButton href={`${appUrl}/app/plans`}>
        Ver planos e cupom de lançamento
      </EmailButton>
      <EmailText>
        Garantia: 7 dias pra testar. Se não rolar, devolvemos. Sem drama.
      </EmailText>
    </EmailLayout>
  );
}

export default OnboardingWhyUpgradeEmail;
