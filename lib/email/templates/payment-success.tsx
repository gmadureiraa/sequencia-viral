import {
  EmailLayout,
  EmailHeadline,
  EmailText,
  EmailButton,
  EmailKicker,
} from "./_layout";

export function PaymentSuccessEmail({
  name,
  planName,
  carouselsPerMonth,
  appUrl,
}: {
  name?: string;
  planName: string;
  carouselsPerMonth: number | "ilimitado";
  appUrl: string;
}) {
  const firstName = (name || "").trim().split(" ")[0] || "você";
  return (
    <EmailLayout preview={`Plano ${planName} ativo. Bora criar?`}>
      <EmailKicker>Pagamento confirmado</EmailKicker>
      <EmailHeadline>
        {firstName}, seu plano {planName} tá ativo.
      </EmailHeadline>
      <EmailText>
        Limite mensal:{" "}
        <strong>
          {carouselsPerMonth === "ilimitado"
            ? "carrosséis ilimitados"
            : `${carouselsPerMonth} carrosséis por mês`}
        </strong>
        . Tudo liberado: sem marca d&apos;água, todos os templates, export PNG
        e PDF.
      </EmailText>
      <EmailButton href={`${appUrl}/app/create`}>Ir para o estúdio</EmailButton>
      <EmailText>
        Pode gerenciar cobrança, editar cartão ou baixar recibo em{" "}
        <a
          href={`${appUrl}/app/settings`}
          style={{ color: "#0A0A0A" }}
        >
          /app/settings → Gerenciar assinatura
        </a>
        .
      </EmailText>
      <EmailText>
        Se rolar qualquer problema na cobrança, responde este e-mail que eu
        resolvo pessoalmente.
      </EmailText>
    </EmailLayout>
  );
}

export default PaymentSuccessEmail;
