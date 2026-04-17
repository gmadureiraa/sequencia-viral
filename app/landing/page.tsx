import Link from "next/link";

const VARIANTS = [
  { href: "/", name: "Home — fluxo Chatsheet (hero isométrico)", note: "Ícones → hub Sequência Viral → cards de post; partículas nos paths (SVG)" },
  { href: "/landing/chatsheet", name: "Alias do mesmo layout", note: "Mesmo bundle que / — útil para linkar sem confundir canonical" },
  { href: "/landing/v2", name: "v2 — Brillance", note: "SaaS limpo, espaçamento generoso, prova social suave" },
  { href: "/landing/v3", name: "v3 — Optimus", note: "Hero forte, grid técnico, sensação de plataforma" },
  { href: "/landing/v4", name: "v4 — Neo-brutal", note: "Mesma estética do menu do app (doc em docs/design/neo-brutal-app-shell)" },
  { href: "/landing/v5", name: "v5 — Nexus", note: "Dark, glows, vibe plataforma IA" },
];

export default function LandingVariantsIndex() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Sequência Viral</p>
        <h1 className="mt-2 font-[family-name:var(--font-serif)] text-4xl font-normal">Variantes de landing</h1>
        <p className="mt-4 text-zinc-600 leading-relaxed">
          A home principal continua em <Link className="font-semibold text-orange-600 underline" href="/">/</Link>.
          Use as rotas abaixo para comparar estilos. Templates v0 citados são inspiração — implementação própria no código.
        </p>
        <ul className="mt-10 space-y-4">
          {VARIANTS.map((v) => (
            <li key={v.href}>
              <Link
                href={v.href}
                className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
              >
                <span className="font-semibold text-zinc-900">{v.name}</span>
                <p className="mt-1 text-sm text-zinc-500">{v.note}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
