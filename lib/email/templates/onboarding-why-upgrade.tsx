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
    <EmailLayout preview="Cupom VIRAL50 — 50% off no primeiro mês, limitado aos primeiros assinantes.">
      <EmailKicker>Dia 7 · Oferta limitada</EmailKicker>
      <EmailHeadline>
        {firstName}, o que tá te segurando?
      </EmailHeadline>
      <EmailText>
        Uma semana de Sequência Viral. Se você publica 1 carrossel por
        semana, o grátis resolve. Se a meta é <strong>crescer de
        verdade</strong>, o Creator foi feito pro seu ritmo.
      </EmailText>
      <EmailText>
        <strong>Comparativo honesto:</strong>
      </EmailText>
      <EmailText>
        <strong>Grátis</strong>: 5 carrosséis/mês, marca d&apos;água discreta.
        <br />
        <strong>Creator · R$ 99,90/mês</strong>: 10 carrosséis, até 12 slides,
        zero marca d&apos;água, claro+escuro, imagens IA/busca, 1 perfil.
      </EmailText>
      <EmailText>
        Pra quem tá chegando agora, liberei o cupom{" "}
        <strong>VIRAL50 → 50% off no 1º mês</strong> (R$ 99,90 → R$ 49,90).
        Limitado aos primeiros assinantes — quando esgotar, esgotou.
      </EmailText>
      <EmailButton href={`${appUrl}/app/checkout?plan=pro&coupon=VIRAL50`}>
        Aplicar 50% e assinar
      </EmailButton>
      <EmailText>
        Garantia: 7 dias pra testar. Se não rolar, devolvemos. Sem drama.
      </EmailText>
    </EmailLayout>
  );
}

export default OnboardingWhyUpgradeEmail;
