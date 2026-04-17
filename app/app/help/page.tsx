import fs from "fs/promises";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { renderSimpleMarkdown } from "@/lib/render-simple-markdown";

export const metadata: Metadata = {
  title: "Guia do carrossel · Sequência Viral",
  description:
    "Como configurar perfil, tema, fontes de conteúdo, link como inspiração, edição e export de carrosséis no Sequência Viral.",
};

const GUIDE_PATH = path.join(
  process.cwd(),
  "docs/product/guia-carrossel-sequencia-viral.md"
);

export default async function HelpPage() {
  const md = await fs.readFile(GUIDE_PATH, "utf8");

  return (
    <div className="mx-auto max-w-3xl">
      <span className="tag-pill mb-6">Documentação</span>
      <h1 className="editorial-serif text-[2.75rem] sm:text-[3.5rem] text-[var(--foreground)] leading-[0.95]">
        Guia do <span className="italic text-[var(--accent)]">carrossel.</span>
      </h1>
      <p className="mt-4 text-lg text-[var(--muted)] mb-8">
        Tudo o que você precisa para gerar, editar e publicar com consistência de marca.
        O texto abaixo é o mesmo arquivo em{" "}
        <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-sm">
          docs/product/guia-carrossel-sequencia-viral.md
        </code>{" "}
        — útil para versionar e compartilhar com o time.
      </p>

      <div className="flex flex-wrap gap-3 mb-10">
        <Link
          href="/app/settings"
          className="inline-flex items-center rounded-xl border-2 border-[#0A0A0A] bg-white px-4 py-2 text-sm font-bold shadow-[3px_3px_0_0_#0A0A0A] transition hover:-translate-y-0.5"
        >
          Ajustar perfil →
        </Link>
        <Link
          href="/app/create"
          className="inline-flex items-center rounded-xl border-2 border-[#0A0A0A] bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_0_#0A0A0A] transition hover:-translate-y-0.5"
        >
          Criar carrossel →
        </Link>
        <Link
          href="/app/carousels"
          className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          Meus carrosséis →
        </Link>
      </div>

      <article className="pb-16">{renderSimpleMarkdown(md)}</article>
    </div>
  );
}
