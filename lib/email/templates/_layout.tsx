import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export const BRAND = {
  accent: "#FF5842",
  fg: "#0A0A0A",
  bg: "#FFFDF9",
  mutedFg: "#5F5C54",
  border: "#E9E4DA",
  serif: 'Georgia, "Instrument Serif", serif',
  sans: "-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', Segoe UI, Helvetica, Arial, sans-serif",
};

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: BRAND.bg,
          fontFamily: BRAND.sans,
          color: BRAND.fg,
          padding: "32px 0",
          margin: 0,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            backgroundColor: "#FFFFFF",
            border: `2px solid ${BRAND.fg}`,
            borderRadius: 20,
            padding: "40px 36px 32px",
            boxShadow: `6px 6px 0 0 ${BRAND.fg}`,
          }}
        >
          <Section style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontFamily: BRAND.serif,
                fontSize: 22,
                fontWeight: 500,
                margin: 0,
                lineHeight: 1.1,
                color: BRAND.fg,
              }}
            >
              Sequência Viral
            </Text>
            <Text
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 2,
                color: BRAND.mutedFg,
                fontWeight: 600,
              }}
            >
              Carrosséis com IA
            </Text>
          </Section>

          {children}

          <Hr
            style={{
              border: "none",
              borderTop: `1px solid ${BRAND.border}`,
              margin: "32px 0 16px",
            }}
          />
          <Text
            style={{
              fontSize: 12,
              color: BRAND.mutedFg,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Você recebeu este e-mail porque tem conta no Sequência Viral. Se
            não quiser mais receber comunicações sobre seu uso ou novidades,
            responda este e-mail com &quot;cancelar&quot;.
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: BRAND.mutedFg,
              margin: "12px 0 0",
            }}
          >
            Feito no Brasil por{" "}
            <a href="https://kaleidos.ag" style={{ color: BRAND.mutedFg }}>
              Kaleidos
            </a>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailHeadline({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: BRAND.serif,
        fontSize: 34,
        lineHeight: 1.05,
        margin: "0 0 16px",
        color: BRAND.fg,
        fontWeight: 400,
      }}
    >
      {children}
    </Text>
  );
}

export function EmailText({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 15,
        lineHeight: 1.65,
        color: BRAND.fg,
        margin: "0 0 16px",
      }}
    >
      {children}
    </Text>
  );
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section style={{ margin: "24px 0 12px" }}>
      <a
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: BRAND.accent,
          color: "#FFFFFF",
          padding: "12px 22px",
          borderRadius: 12,
          border: `2px solid ${BRAND.fg}`,
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: `4px 4px 0 0 ${BRAND.fg}`,
        }}
      >
        {children}
      </a>
    </Section>
  );
}

export function EmailKicker({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 11,
        color: BRAND.accent,
        letterSpacing: 2,
        textTransform: "uppercase",
        fontWeight: 700,
        margin: "0 0 10px",
      }}
    >
      {children}
    </Text>
  );
}
