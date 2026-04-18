import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidade — Sequência Viral",
  description: "Como tratamos dados no Sequência Viral.",
  alternates: { canonical: "https://viral.kaleidos.com.br/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] px-5 py-16 text-[#0A0A0A]">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">
          Legal
        </p>
        <h1 className="editorial-serif mt-2 text-4xl">Privacidade</h1>
        <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">
          Esta página resume o compromisso do Sequência Viral com a privacidade. Para detalhes contratuais
          completos, entre em contato em{" "}
          <a href="mailto:madureira@kaleidosdigital.com" className="font-semibold text-[var(--accent)] underline">
            madureira@kaleidosdigital.com
          </a>
          .
        </p>
        <ul className="mt-8 list-disc space-y-3 pl-5 text-sm leading-relaxed text-[var(--muted)]">
          <li>
            Coletamos apenas o necessário para autenticação, billing e geração de conteúdo (perfil,
            uso de API e logs técnicos).
          </li>
          <li>
            Conteúdo que você cola ou envia para gerar carrosséis é processado para entrega do
            serviço; revise as políticas do seu provedor de IA quando aplicável.
          </li>
          <li>
            Você pode solicitar exportação ou exclusão de dados de conta conforme LGPD/GDPR, via
            e-mail acima.
          </li>
        </ul>
        <p className="mt-10 text-xs text-[var(--muted)]">Última atualização: 15 de abril de 2026.</p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm font-bold text-[var(--accent)] underline underline-offset-4"
        >
          ← Voltar ao site
        </Link>
      </div>
    </div>
  );
}
