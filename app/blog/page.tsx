import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog Sequência Viral — Carrosseis com IA, Estrategias de Conteudo e Instagram",
  description:
    "Aprenda a criar carrosseis virais, dominar o algoritmo do Instagram em 2026, usar IA para conteudo e tecnicas de copywriting para redes sociais. Guias praticos do Sequência Viral.",
  alternates: {
    canonical: "https://sequencia-viral.app/blog",
  },
  openGraph: {
    title: "Blog Sequência Viral — Carrosseis com IA, Estrategias de Conteudo e Instagram",
    description:
      "Guias praticos sobre carrosseis, IA, copywriting e algoritmo do Instagram. Tudo que voce precisa pra criar conteudo de alto engajamento.",
    type: "website",
    url: "https://sequencia-viral.app/blog",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog Sequência Viral — Carrosseis, IA e Redes Sociais",
    description: "Guias praticos sobre carrosseis, IA, copywriting e algoritmo do Instagram.",
  },
};

const posts = [
  {
    slug: "sequencia-viral-novidades-abril-2026-image-picker-pdf-export",
    title: "Sequência Viral: Novidades de Abril 2026 — Image Picker, PDF Export e Mais",
    excerpt:
      "Confira as ultimas atualizacoes do Sequência Viral. Novo seletor de imagens, export PDF corrigido, limites do plano free e melhorias de UX.",
    date: "2026-04-15",
    readTime: "4 min",
    category: "Sequência Viral",
  },
  {
    slug: "algoritmo-instagram-2026-como-funciona-o-que-mudou",
    title: "Algoritmo do Instagram em 2026: Como Funciona e O Que Mudou",
    excerpt:
      "Entenda como o algoritmo do Instagram prioriza conteudo em 2026. Feed, Explore, Reels e carrosseis — o que importa de verdade para alcance organico.",
    date: "2026-04-14",
    readTime: "11 min",
    category: "Instagram",
  },
  {
    slug: "12-hooks-primeiro-slide-carrossel-parar-scroll",
    title: "12 Hooks de Primeiro Slide que Param o Scroll Instantaneamente",
    excerpt:
      "O primeiro slide decide se alguem vai consumir seu carrossel ou continuar rolando. 12 padroes de hook comprovados com dados reais.",
    date: "2026-04-12",
    readTime: "10 min",
    category: "Estrategia",
  },
  {
    slug: "como-criar-carrosseis-virais-instagram-2026",
    title: "Como Criar Carrosseis Virais no Instagram em 2026",
    excerpt:
      "Descubra as estrategias que os maiores criadores de conteudo usam para criar carrosseis que viralizam no Instagram.",
    date: "2026-04-10",
    readTime: "7 min",
    category: "Instagram",
  },
  {
    slug: "storytelling-em-carrosseis-como-contar-historias-que-engajam",
    title: "Storytelling em Carrosseis: Como Contar Historias que Engajam",
    excerpt:
      "Tecnicas de storytelling profissional aplicadas a carrosseis. Arcos narrativos, micro-stories e exemplos praticos que geram 4x mais compartilhamentos.",
    date: "2026-04-09",
    readTime: "9 min",
    category: "Estrategia",
  },
  {
    slug: "5-formatos-carrossel-mais-engajamento",
    title: "5 Formatos de Carrossel que Geram Mais Engajamento",
    excerpt:
      "Nem todo carrossel e igual. Conheca os 5 formatos que consistentemente geram mais curtidas, comentarios e compartilhamentos.",
    date: "2026-04-08",
    readTime: "6 min",
    category: "Estrategia",
  },
  {
    slug: "copywriting-para-redes-sociais-guia-definitivo-2026",
    title: "Copywriting para Redes Sociais: O Guia Definitivo para 2026",
    excerpt:
      "Tecnicas avancadas de copywriting para Instagram, Twitter/X e LinkedIn. 7 formulas testadas com exemplos reais que voce pode aplicar hoje.",
    date: "2026-04-07",
    readTime: "12 min",
    category: "Copywriting",
  },
  {
    slug: "thread-vs-carrossel-qual-funciona-melhor",
    title: "Thread vs Carrossel: Qual Funciona Melhor?",
    excerpt:
      "Threads no Twitter/X ou carrosseis no Instagram? Analisamos dados reais de 500 criadores para responder essa pergunta.",
    date: "2026-04-05",
    readTime: "8 min",
    category: "Analise",
  },
  {
    slug: "como-transformar-artigos-em-carrosseis-repurposing",
    title: "Como Transformar Artigos e Links em Carrosseis: O Guia de Repurposing",
    excerpt:
      "Aprenda a pegar qualquer artigo, thread ou video e transformar em carrossel de alto engajamento. Tecnicas com e sem IA.",
    date: "2026-04-03",
    readTime: "8 min",
    category: "Produtividade",
  },
  {
    slug: "como-usar-ia-criar-conteudo-redes-sociais",
    title: "Como Usar IA para Criar Conteudo de Redes Sociais",
    excerpt:
      "Um guia pratico de como integrar inteligencia artificial no seu fluxo de producao de conteudo sem perder autenticidade.",
    date: "2026-04-02",
    readTime: "9 min",
    category: "IA",
  },
  {
    slug: "guia-completo-tamanhos-instagram-twitter-linkedin",
    title:
      "O Guia Completo de Tamanhos para Instagram, Twitter e LinkedIn",
    excerpt:
      "Todos os tamanhos de imagem e video atualizados para 2026. Salve este guia e nunca mais erre uma dimensao.",
    date: "2026-03-28",
    readTime: "5 min",
    category: "Referencia",
  },
];

const categories = Array.from(new Set(posts.map((p) => p.category)));

export default function BlogIndex() {
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <nav className="border-b border-[#0A0A0A]/10 bg-[#FAFAF8]">
        <div className="mx-auto max-w-5xl px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="font-[family-name:var(--font-serif)] text-xl tracking-tight text-[#0A0A0A]"
          >
            Sequência Viral<span className="text-[var(--accent)]">.</span>
          </Link>
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-[#0A0A0A]/70">Blog</span>
            <Link
              href="/"
              className="text-sm text-[#0A0A0A]/50 hover:text-[#0A0A0A] transition-colors"
            >
              Voltar ao site
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-12 md:py-20">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl tracking-tight text-[#0A0A0A] mb-3">
            Blog
          </h1>
          <p className="text-lg text-[#0A0A0A]/50 max-w-xl">
            Estrategias de carrossel, IA para conteudo, copywriting e tudo sobre crescer nas redes sociais.
          </p>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <span
              key={cat}
              className="text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]/50 bg-white border border-[#0A0A0A]/8 px-3 py-1.5 rounded-full"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Featured post */}
        <Link
          href={`/blog/${featured.slug}`}
          className="group block mb-12 rounded-2xl border border-[#0A0A0A]/8 bg-white p-6 sm:p-8 hover:border-[var(--accent)]/30 transition-all"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-[var(--accent)] px-2.5 py-1 rounded-full">
              Mais recente
            </span>
            <span className="text-[11px] font-medium text-[var(--accent)] bg-orange-50 px-2 py-1 rounded-full">
              {featured.category}
            </span>
            <span className="text-xs text-[#0A0A0A]/40">{featured.date}</span>
            <span className="text-xs text-[#0A0A0A]/40">{featured.readTime}</span>
          </div>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl sm:text-3xl tracking-tight text-[#0A0A0A] mb-3 group-hover:text-[var(--accent)] transition-colors">
            {featured.title}
          </h2>
          <p className="text-[#0A0A0A]/55 leading-relaxed max-w-2xl">
            {featured.excerpt}
          </p>
          <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-[var(--accent)]">
            Ler artigo →
          </span>
        </Link>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((post) => (
            <article key={post.slug} className="group">
              <Link
                href={`/blog/${post.slug}`}
                className="block rounded-xl border border-[#0A0A0A]/6 bg-white p-5 h-full hover:border-[var(--accent)]/25 transition-all"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="text-[11px] font-medium text-[var(--accent)] bg-orange-50 px-2 py-0.5 rounded-full">
                    {post.category}
                  </span>
                  <span className="text-[11px] text-[#0A0A0A]/35">
                    {post.readTime}
                  </span>
                </div>
                <h3 className="font-[family-name:var(--font-serif)] text-lg tracking-tight text-[#0A0A0A] leading-snug mb-2 group-hover:text-[var(--accent)] transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-[#0A0A0A]/50 leading-relaxed line-clamp-2">
                  {post.excerpt}
                </p>
                <span className="inline-block mt-3 text-xs font-semibold text-[#0A0A0A]/40">{post.date}</span>
              </Link>
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center rounded-2xl border border-[#0A0A0A]/8 bg-white p-8 sm:p-10">
          <h3 className="font-[family-name:var(--font-serif)] text-2xl tracking-tight text-[#0A0A0A] mb-2">
            Crie seu primeiro carrossel com IA
          </h3>
          <p className="text-[#0A0A0A]/50 mb-5">
            Gratis. Sem cartao. Pronto em 30 segundos.
          </p>
          <Link
            href="/app/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] transition-colors"
          >
            Criar carrossel gratis →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#0A0A0A]/8 py-8 bg-[#FAFAF8]">
        <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[#0A0A0A]/40">
            &copy; {new Date().getFullYear()} Sequência Viral. Todos os direitos reservados.
          </p>
          <a
            href="https://kaleidos.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#0A0A0A]/40 hover:text-[#0A0A0A]/60 transition-colors"
          >
            Powered by <span className="font-semibold">Kaleidos</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
