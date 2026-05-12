import Link from "next/link";

const VARIANTS = [
  { href: "/", name: "Home — canonical", note: "Landing principal em uso" },
  { href: "/v2", name: "/v2 — Autopilot", note: "Narrativa Posttar-like: piloto automático em 5min (teste tráfego pago)" },
  { href: "/landing/v2", name: "v2 — Brillance (legado)", note: "SaaS limpo, espaçamento generoso, prova social suave" },
];

export default function LandingVariantsIndex() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Sequência Viral</p>
        <h1 className="mt-2 font-[family-name:var(--font-serif)] text-4xl font-normal">Variantes de landing</h1>
        <p className="mt-4 text-zinc-600 leading-relaxed">
          A home principal continua em <Link className="font-semibold text-orange-600 underline" href="/">/</Link>.
          Variantes descontinuadas (v3, v4, v5, v5-neobrutal, chatsheet) foram removidas.
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
