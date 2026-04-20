"use client";

import Link from "next/link";

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          marginBottom: 14,
        }}
      >
        {title}
      </h4>
      <ul className="flex flex-col gap-2" style={{ listStyle: "none" }}>
        {links.map((l) => {
          const external = l.href.startsWith("http") || l.href.startsWith("mailto:");
          const Comp: React.ElementType = external ? "a" : Link;
          const extraProps = external
            ? {
                href: l.href,
                target: l.href.startsWith("http") ? "_blank" : undefined,
                rel: "noreferrer",
              }
            : { href: l.href };
          return (
            <li key={l.label}>
              <Comp
                {...extraProps}
                className="transition-colors hover:bg-[var(--sv-green)]"
              >
                {l.label}
              </Comp>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer
      style={{
        background: "var(--sv-paper)",
        borderTop: "1.5px solid var(--sv-ink)",
        padding: "56px 0 24px",
        fontSize: 12.5,
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr" }}
        >
          <div>
            <div className="mb-[14px] flex items-center gap-[10px]">
              <span
                className="sv-anim-float-slow inline-flex h-[36px] w-[36px] items-center justify-center rounded-full"
                style={{
                  border: "1.5px solid var(--sv-ink)",
                  background: "var(--sv-green)",
                }}
                aria-hidden
              >
                <span
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontStyle: "italic",
                    fontSize: 16,
                    color: "var(--sv-ink)",
                    lineHeight: 1,
                  }}
                >
                  SV
                </span>
              </span>
              <span
                className="sv-display"
                style={{ fontSize: 18, letterSpacing: "-0.01em" }}
              >
                Sequência <em>Viral</em>
              </span>
            </div>
            <p
              style={{
                maxWidth: 300,
                color: "var(--sv-muted)",
                fontSize: 12.5,
              }}
            >
              Cole um link. Publique um carrossel. Em minutos, não em horas. Um
              braço da Kaleidos Digital.
            </p>
          </div>
          <FooterCol
            title="Produto"
            links={[
              { label: "Criar carrossel", href: "/app/login" },
              { label: "Pricing", href: "#pricing" },
              { label: "Roadmap", href: "/roadmap" },
              { label: "Blog", href: "/blog" },
            ]}
          />
          <FooterCol
            title="Kaleidos"
            links={[
              { label: "kaleidos.com.br", href: "https://kaleidos.com.br" },
              { label: "Manifesto", href: "#manifesto" },
              {
                label: "WhatsApp suporte",
                href: "https://wa.me/5512936180547",
              },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Privacidade", href: "/privacy" },
              { label: "Termos", href: "/terms" },
              {
                label: "WhatsApp suporte",
                href: "https://wa.me/5512936180547",
              },
            ]}
          />
        </div>

        <div
          className="mt-11 flex flex-wrap justify-between gap-3 pt-5"
          style={{
            borderTop: "1px solid var(--sv-ink)",
            color: "var(--sv-muted)",
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          <span>© MMXXVI · Sequência Viral · Todos os direitos reservados</span>
          <span className="flex items-center gap-[10px]">
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Feito por
            </span>
            <a
              href="https://kaleidos.com.br"
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "var(--sv-display)",
                textTransform: "none",
                letterSpacing: "-0.01em",
                fontSize: 13,
                fontStyle: "italic",
                color: "var(--sv-ink)",
              }}
            >
              Kaleidos Digital
            </a>
          </span>
        </div>
      </div>
      <style>{`
        @media (max-width: 700px) {
          footer > div > div:first-of-type { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
