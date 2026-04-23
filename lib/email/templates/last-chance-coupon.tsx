import { Section, Text } from "@react-email/components";
import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
  BRAND,
} from "./_layout";

/**
 * Last chance coupon — user free que gastou os 5 carrosséis e já tem 7+
 * dias de conta. Cupom VIRAL50 (50% off primeiro mês Creator), limitado
 * aos primeiros 10 assinantes — copy não expõe o número, só escassez.
 */
export function LastChanceCouponEmail({
  name,
  appUrl,
  couponCode,
}: {
  name?: string;
  appUrl: string;
  couponCode: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "creator";
  const checkoutUrl = `${appUrl}/app/checkout?plan=pro&coupon=${encodeURIComponent(
    couponCode,
  )}`;

  return (
    <EmailLayout preview="50% off no primeiro mês do Creator — cupom limitado aos primeiros assinantes.">
      <EmailKicker>Cupom limitado</EmailKicker>
      <EmailHeadline>
        {firstName}, o que tá te segurando?
      </EmailHeadline>
      <EmailText>
        Você gastou os 5 carrosséis grátis do mês. Sinal de que a ferramenta
        tá funcionando pra você.
      </EmailText>
      <EmailText>
        Pra facilitar a decisão, liberei um cupom de <strong>50% off</strong>{" "}
        no primeiro mês do Creator — R$ 49,90 → <strong>R$ 24,95</strong>.
      </EmailText>
      <EmailText>
        Cupom é limitado aos primeiros assinantes e expira em 48h. Quando
        esgotar, esgotou — volta o preço cheio.
      </EmailText>

      <Section
        style={{
          margin: "24px 0 16px",
          padding: "22px 20px",
          backgroundColor: "#FFF4F0",
          border: `2px solid ${BRAND.fg}`,
          borderRadius: 16,
          textAlign: "center",
          boxShadow: `4px 4px 0 0 ${BRAND.fg}`,
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: BRAND.accent,
            fontWeight: 700,
          }}
        >
          Seu código
        </Text>
        <Text
          style={{
            margin: "6px 0 0",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: 4,
            color: BRAND.fg,
          }}
        >
          {couponCode}
        </Text>
        <Text
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: BRAND.mutedFg,
          }}
        >
          50% off · primeiro mês Creator · 48h · limitado
        </Text>
      </Section>

      <EmailButton href={checkoutUrl}>Aplicar cupom e assinar</EmailButton>

      <EmailText>
        Se o mês foi pouco, esperar o próximo ciclo grátis também é uma
        escolha válida — sem drama.
      </EmailText>
    </EmailLayout>
  );
}

export default LastChanceCouponEmail;
