import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de uso — Sequência Viral",
  description: "Termos de uso do Sequência Viral.",
  alternates: { canonical: "https://viral.kaleidos.com.br/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] px-5 py-16 text-[#0A0A0A]">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">
          Legal
        </p>
        <h1 className="editorial-serif mt-2 text-4xl">Termos de uso</h1>
        <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">
          Ao usar o Sequência Viral, você concorda em utilizar o serviço de forma lícita, respeitando
          direitos de terceiros e as regras das plataformas onde publicar conteúdo gerado. Planos,
          limites de uso e preços estão descritos na landing e no checkout.
        </p>
        <ul className="mt-8 list-disc space-y-3 pl-5 text-sm leading-relaxed text-[var(--muted)]">
          <li>O serviço é fornecido &quot;no estado em que se encontra&quot;; esforçamo-nos por uptime e qualidade, sem garantia absoluta.</li>
          <li>Você é responsável pelo conteúdo publicado e pela conformidade com leis de marketing e marcas.</li>
          <li>Podemos suspender contas em caso de abuso, fraude ou violação destes termos.</li>
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
