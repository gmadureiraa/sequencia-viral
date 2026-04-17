import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Roadmap | Sequência Viral — O que vem por aí",
  description:
    "O caminho do Sequência Viral: do MVP de geração manual até automações com RSS, publicação multi-rede, brand kits e repurpose com IA.",
  alternates: { canonical: "https://sequencia-viral.app/roadmap" },
  openGraph: {
    title: "Roadmap | Sequência Viral",
    description:
      "Do MVP ao motor de conteúdo autônomo — veja o que estamos construindo no Sequência Viral.",
    type: "website",
    url: "https://sequencia-viral.app/roadmap",
  },
};

type Status = "now" | "next" | "later";

type Item = {
  n: string;
  title: string;
  body: string;
  bullets: string[];
  status: Status;
  tag: string;
  rotate: string;
  color: string;
  pin: string;
};

const items: Item[] = [
  {
    n: "01",
    title: "MVP — Gerador Manual",
    body: "Hoje. Cole um link ou tema, escolha o brand kit e gere um carrossel pronto para postar.",
    bullets: [
      "Input por URL, texto ou tópico",
      "Editor visual com templates",
      "Export PNG / PDF / Instagram-ready",
    ],
    status: "now",
    tag: "MVP — rodando hoje",
    rotate: "-rotate-[2.2deg]",
    color: "#FFE8B0",
    pin: "#EC6000",
  },
  {
    n: "02",
    title: "RSS + Gatilhos Automáticos",
    body: "Conecte feeds, newsletters e sites. Cada novidade vira um rascunho de post seguindo sua voz.",
    bullets: [
      "Feeds RSS, Atom e newsletters",
      "Regras: 'se tópico X, gere carrossel Y'",
      "Rascunhos automáticos na fila",
    ],
    status: "next",
    tag: "Em desenvolvimento",
    rotate: "rotate-[1.8deg]",
    color: "#FFD4B0",
    pin: "#0A0A0A",
  },
  {
    n: "03",
    title: "Publicação Multi-Rede",
    body: "Publique direto em Instagram, LinkedIn, X e Threads. Agendamento, fila e re-publicação inteligente.",
    bullets: [
      "OAuth nativo das redes",
      "Calendário editorial drag-and-drop",
      "Best-time scheduler",
    ],
    status: "next",
    tag: "Em desenvolvimento",
    rotate: "-rotate-[1.4deg]",
    color: "#FFC79A",
    pin: "#EC6000",
  },
  {
    n: "04",
    title: "Brand Kits & Voz da Marca",
    body: "Cada cliente com suas cores, fontes, exemplos de posts e tom. A IA aprende como você escreve.",
    bullets: [
      "Múltiplos brand kits por workspace",
      "Treinamento com posts de referência",
      "Guardrails de tom e termos proibidos",
    ],
    status: "next",
    tag: "Próximo sprint",
    rotate: "rotate-[2.4deg]",
    color: "#F5E8D0",
    pin: "#0A0A0A",
  },
  {
    n: "05",
    title: "Repurpose Engine",
    body: "Um insight → thread no X → post no LinkedIn → carrossel no Insta → newsletter. Sem digitar duas vezes.",
    bullets: [
      "Grafo de conteúdo (pai → filhos)",
      "Tradução automática PT/EN",
      "Sugestões de cortes para reels",
    ],
    status: "later",
    tag: "Futuro",
    rotate: "-rotate-[2deg]",
    color: "#FFE0C2",
    pin: "#EC6000",
  },
  {
    n: "06",
    title: "Analytics & Learning Loop",
    body: "Entenda o que performa e feche o ciclo: a IA aprende com seus posts reais e ajusta sozinha.",
    bullets: [
      "Métricas nativas de cada rede no dashboard",
      "Alcance, salvamentos, engajamento e melhor horário",
      "Score de hook por post e recomendações automáticas",
    ],
    status: "later",
    tag: "Futuro",
    rotate: "rotate-[1.2deg]",
    color: "#FFD8A8",
    pin: "#0A0A0A",
  },
  {
    n: "07",
    title: "Team & Aprovação",
    body: "Workspace multi-usuário com papéis, revisão e aprovação antes da publicação. Feito para agências.",
    bullets: [
      "Roles: owner, editor, revisor, cliente",
      "Comentários em cada rascunho",
      "Link público de aprovação",
    ],
    status: "later",
    tag: "Futuro",
    rotate: "-rotate-[1.6deg]",
    color: "#FFE8B0",
    pin: "#EC6000",
  },
  {
    n: "08",
    title: "API & Integrações",
    body: "Webhooks, API pública e integração com n8n, Zapier e Make. Sequência Viral vira peça do seu stack.",
    bullets: [
      "REST + Webhooks",
      "n8n / Zapier / Make",
      "MCP server para agentes",
    ],
    status: "later",
    tag: "Futuro",
    rotate: "rotate-[2deg]",
    color: "#FFC79A",
    pin: "#0A0A0A",
  },
  {
    n: "09",
    title: "Múltiplos perfis",
    body: "Hoje: 1 perfil por usuário. Em breve: workspace multi-perfil pra quem gerencia várias marcas no mesmo login.",
    bullets: [
      "Switcher de perfil no header",
      "Brand kit separado por perfil",
      "Assinatura única cobre todos",
    ],
    status: "later",
    tag: "Em breve",
    rotate: "-rotate-[1.8deg]",
    color: "#FFE8B0",
    pin: "#EC6000",
  },
];

const statusLabel: Record<Status, string> = {
  now: "Agora",
  next: "Próximo",
  later: "Futuro",
};

export default function RoadmapPage() {
  return (
    <main
      className="min-h-screen pb-32 pt-28"
      style={{
        background:
          "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(236,96,0,0.06) 0%, transparent 60%), #FAFAF8",
      }}
    >
      {/* Nav back */}
      <div className="mx-auto max-w-6xl px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--accent)] transition"
        >
          ← Voltar para Sequência Viral
        </Link>
      </div>

      {/* Hero */}
      <header className="mx-auto mt-10 max-w-4xl px-6 text-center">
        <span className="badge-accent">Roadmap público</span>
        <h1 className="font-display mt-6 text-5xl leading-[1.05] tracking-tight text-[color:var(--foreground)] md:text-7xl">
          O caminho do <span className="text-gradient">Sequência Viral</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[color:var(--muted)]">
          Começamos hoje com um gerador manual que já resolve o dia a dia. Daqui
          a alguns meses, o Sequência Viral vira um motor autônomo que lê o mundo,
          entende sua marca e publica por você.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <LegendDot color="#EC6000" label="Agora" />
          <LegendDot color="#FF8534" label="Próximo" />
          <LegendDot color="#F5C38A" label="Futuro" />
        </div>
      </header>

      {/* Cork board */}
      <section className="relative mx-auto mt-20 max-w-7xl px-6">
        <div
          className="relative rounded-[36px] border border-[color:var(--border)] p-8 md:p-16"
          style={{
            background:
              "repeating-linear-gradient(-45deg, rgba(236,96,0,0.02) 0 2px, transparent 2px 14px), #FFFDF9",
            boxShadow:
              "0 40px 120px rgba(10,10,10,0.06), inset 0 0 0 1px rgba(236,96,0,0.04)",
          }}
        >
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
            {items.map((item) => (
              <StickyCard key={item.n} item={item} />
            ))}
          </div>
        </div>

        {/* Dashed arrow decor */}
        <svg
          className="pointer-events-none absolute -left-6 top-1/3 hidden opacity-30 md:block"
          width="60"
          height="120"
          viewBox="0 0 60 120"
          fill="none"
        >
          <path
            d="M10 10 C 40 40, 10 80, 50 110"
            stroke="#EC6000"
            strokeWidth="2"
            strokeDasharray="4 6"
            fill="none"
          />
        </svg>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-24 max-w-3xl px-6 text-center">
        <h2 className="font-display text-4xl text-[color:var(--foreground)] md:text-5xl">
          Quer ajudar a decidir o próximo passo?
        </h2>
        <p className="mt-4 text-[color:var(--muted)]">
          O roadmap muda com base em quem usa. Entre no beta e vote no que vem
          primeiro.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/app" className="btn-primary">
            Começar agora →
          </Link>
          <a
            href="mailto:hi@sequencia-viral.app?subject=Roadmap%20feedback"
            className="btn-secondary"
          >
            Mandar sugestão
          </a>
        </div>
      </section>
    </main>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)]">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}80` }}
      />
      {label}
    </span>
  );
}

function StickyCard({ item }: { item: Item }) {
  return (
    <article
      className={`group relative ${item.rotate} transition-transform duration-500 hover:rotate-0 hover:-translate-y-1`}
    >
      {/* Push pin */}
      <span
        className="absolute left-1/2 top-0 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, #fff 0%, ${item.pin} 60%, rgba(0,0,0,0.4) 100%)`,
          boxShadow:
            "0 4px 10px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.6)",
        }}
      />
      {/* Pin shadow on paper */}
      <span
        className="absolute left-1/2 top-[6px] z-0 h-1.5 w-6 -translate-x-1/2 rounded-full opacity-40 blur-[2px]"
        style={{ background: "rgba(0,0,0,0.25)" }}
      />

      <div
        className="relative rounded-[22px] p-7"
        style={{
          background: item.color,
          boxShadow:
            "0 14px 40px rgba(10,10,10,0.08), 0 2px 6px rgba(10,10,10,0.05), inset 0 0 0 1px rgba(255,255,255,0.4)",
        }}
      >
        <div className="flex items-start justify-between">
          <span
            className="font-display text-5xl leading-none text-[color:var(--accent-dark)]"
            style={{ letterSpacing: "-0.03em" }}
          >
            {item.n}
          </span>
          <span
            className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: "rgba(10,10,10,0.08)",
              color: "#0A0A0A",
            }}
          >
            {statusLabel[item.status]}
          </span>
        </div>

        <h3 className="font-display mt-5 text-2xl leading-tight text-[#0A0A0A]">
          {item.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#0A0A0A]/75">
          {item.body}
        </p>

        <ul className="mt-5 space-y-2">
          {item.bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-[13px] text-[#0A0A0A]/85"
            >
              <span
                className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full"
                style={{ background: "#EC6000" }}
              />
              {b}
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-[#0A0A0A]/10 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]/60">
            {item.tag}
          </span>
        </div>
      </div>
    </article>
  );
}
