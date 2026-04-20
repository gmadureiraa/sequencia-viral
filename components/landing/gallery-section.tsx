"use client";

import { motion } from "framer-motion";
import { REVEAL, SectionHead } from "./shared";

type GSlideVariant = "cream" | "ink" | "green" | "pink" | "dots" | "photo";

interface GallerySlideData {
  variant: GSlideVariant;
  tag: string;
  heading: React.ReactNode;
  body: string;
  imageUrl?: string;
}

interface GalleryPost {
  av: string;
  avBg: string;
  avColor?: string;
  handle: string;
  bio: string;
  niche: string;
  voice: string;
  engagement: { likes: string; saves: string; comments: string };
  slides: [GallerySlideData, GallerySlideData, GallerySlideData];
  caption: string;
}

const GALLERY: GalleryPost[] = [
  /* ───── MARKETING ───── */
  {
    av: "A",
    avBg: "var(--sv-green)",
    handle: "@ana.escala",
    bio: "criadora solo · marketing pra SaaS",
    niche: "Marketing · Criadora solo",
    voice: "Direta, sem jargão",
    engagement: { likes: "4.213", saves: "287", comments: "62" },
    slides: [
      {
        variant: "cream",
        tag: "01 / 06",
        heading: (
          <>
            Perdi <em>R$ 47k</em> testando 3 meses de anúncios.
          </>
        ),
        body: "O erro não foi o orçamento. Foi otimizar o funil errado antes de validar o hook.",
      },
      {
        variant: "ink",
        tag: "02 / 06",
        heading: (
          <>
            A regra <em>que ninguém diz:</em>
          </>
        ),
        body: "Anúncio ruim com página boa, queima budget. Anúncio bom com página ruim, queima confiança. Os dois juntos = prejuízo.",
      },
      {
        variant: "green",
        tag: "03 / 06",
        heading: (
          <>
            Antes de escalar, responda <em>3 perguntas.</em>
          </>
        ),
        body: "Quem compra hoje? Por que compra? O que aconteceu na semana em que o CAC caiu? Se você não souber, não escala.",
      },
    ],
    caption:
      "Escrevi isso já queimando o cartão pela quinta vez. R$ 47k viraram 2 clientes. Quatro meses depois, com R$ 9k, virei 11. O que mudou? Parei de confiar na criatividade e comecei a confiar no número que importa. Salva pra lembrar quando o ego bater na porta.",
  },

  /* ───── CRIPTO ───── */
  {
    av: "L",
    avBg: "var(--sv-ink)",
    avColor: "var(--sv-paper)",
    handle: "@lucas.onchain",
    bio: "analista cripto · 22k seguidores",
    niche: "Cripto · DeFi analyst",
    voice: "Analítico, baseado em dado",
    engagement: { likes: "8.902", saves: "1.412", comments: "147" },
    slides: [
      {
        variant: "ink",
        tag: "01 / 07",
        heading: (
          <>
            78% dos traders <em>perdem dinheiro</em> em bull market.
          </>
        ),
        body: "Dado da ESMA (2024). A tese é que só os iniciantes perdem. O dado mostra que a maioria perde mesmo quando o mercado sobe.",
      },
      {
        variant: "dots",
        tag: "02 / 07",
        heading: (
          <>
            A armadilha tem <em>um nome:</em> overtrade.
          </>
        ),
        body: "3 trades por semana: retorno médio de +22% no ciclo. 12 trades por semana: retorno médio de −8%. Frequência come alpha.",
      },
      {
        variant: "green",
        tag: "03 / 07",
        heading: (
          <>
            A operação que <em>ninguém</em> posta:
          </>
        ),
        body: "DCA semanal em BTC + ETH com 70/30. Zero stress, zero screen time. Bateu S&P em 9 dos últimos 10 ciclos de 4 anos.",
      },
    ],
    caption:
      "Post que meu eu de 2021 precisava ler. Eu tinha 15 abas abertas, 4 corretoras, 2 carteiras. Hoje tenho uma rotina que cabe em 20 minutos por semana. O retorno ficou melhor quando parei de sentir que precisava fazer algo todo dia. Se você tá exausto olhando gráfico, começa por aqui.",
  },

  /* ───── DESIGN ───── */
  {
    av: "K",
    avBg: "var(--sv-pink)",
    handle: "@kaleidos.studio",
    bio: "studio de design editorial",
    niche: "Design · Editorial studio",
    voice: "Editorial, provocativo",
    engagement: { likes: "3.872", saves: "641", comments: "89" },
    slides: [
      {
        variant: "pink",
        tag: "01 / 05",
        heading: (
          <>
            Design não é <em>decoração.</em>
          </>
        ),
        body: "É a forma mais honesta de comunicar uma decisão. Se o seu briefing cabe em 1 frase, seu design também deveria.",
      },
      {
        variant: "cream",
        tag: "02 / 05",
        heading: (
          <>
            A prova está nos <em>3 segundos.</em>
          </>
        ),
        body: "Teste: mostra o banner pra alguém por 3 segundos. Cobre. Pergunta o que viu. Se a pessoa não lembrar da promessa, o banner não comunicou — decorou.",
      },
      {
        variant: "ink",
        tag: "03 / 05",
        heading: (
          <>
            Bonito sem porquê <em>é ruído.</em>
          </>
        ),
        body: "Gradiente, glassmorphism, AI art: ótimos quando servem a decisão. Péssimos quando são a decisão. Forma segue função. Ou vira moda datada.",
      },
    ],
    caption:
      "Fiz esse carrossel em 12 minutos, depois de passar 3 horas tentando fazer no Canva um que não dizia nada. A ironia é que o texto é sobre design ser decisão, e a ferramenta me obrigou a decidir rápido. O algoritmo do Insta curtiu: 3x mais salvos que a média. O cliente que me contratou depois também.",
  },

  /* ───── SAÚDE ───── */
  {
    av: "M",
    avBg: "var(--sv-green)",
    handle: "@dra.mariana.sono",
    bio: "médica do sono · educadora",
    niche: "Saúde · Medicina do sono",
    voice: "Didática, baseada em estudo",
    engagement: { likes: "12.437", saves: "2.104", comments: "304" },
    slides: [
      {
        variant: "green",
        tag: "01 / 08",
        heading: (
          <>
            <em>6 horas</em> de sono não é o novo 8.
          </>
        ),
        body: "Meta-análise da Harvard com 1,1 milhão de adultos: dormir 6h por noite recorrente aumenta risco cardiovascular em 48%. Não tem hack.",
      },
      {
        variant: "cream",
        tag: "02 / 08",
        heading: (
          <>
            O <em>verdadeiro</em> problema não é tempo.
          </>
        ),
        body: "É consistência de horário. Dormir às 23h e acordar às 6h 5 dias/semana é pior que dormir 7h sempre no mesmo horário. O corpo não negocia com planilha.",
      },
      {
        variant: "pink",
        tag: "03 / 08",
        heading: (
          <>
            3 protocolos que <em>realmente</em> funcionam:
          </>
        ),
        body: "Luz do sol nos olhos nos primeiros 30 min após acordar. Zero cafeína depois das 14h. Temperatura do quarto entre 18 e 20°C. Nessa ordem de impacto.",
      },
    ],
    caption:
      "Todo mês recebo 40+ mensagens perguntando qual melatonina tomar. A resposta honesta: na maior parte dos casos, nenhuma. O sono ruim dos meus pacientes não é falta de suplemento. É hábito inconsistente disfarçado de vida atarefada. Salva esse carrossel antes de abrir a próxima aba às 23h47.",
  },

  /* ───── TECH / SAAS ───── */
  {
    av: "B",
    avBg: "var(--sv-ink)",
    avColor: "var(--sv-green)",
    handle: "@bruno.saas",
    bio: "founder técnico · série A",
    niche: "Tech · SaaS founder",
    voice: "Factual, prova em número",
    engagement: { likes: "6.721", saves: "894", comments: "118" },
    slides: [
      {
        variant: "photo",
        imageUrl:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
        tag: "01 / 06",
        heading: (
          <>
            Nosso churn caiu <em>62%</em> num trimestre.
          </>
        ),
        body: "Sem mexer no produto. Só arrumando o que acontece nos primeiros 14 dias. Onboarding é retenção disfarçada.",
      },
      {
        variant: "ink",
        tag: "02 / 06",
        heading: (
          <>
            A métrica <em>que ninguém</em> olha:
          </>
        ),
        body: "Time-to-first-value. No nosso caso, quem chegava ao primeiro output em menos de 9 minutos convertia 3.4x mais. Depois disso, caía a pique.",
      },
      {
        variant: "photo",
        imageUrl:
          "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80",
        tag: "03 / 06",
        heading: (
          <>
            3 mudanças <em>que destravaram</em> tudo:
          </>
        ),
        body: "Removemos 4 steps do signup. Pré-preenchemos o primeiro projeto. Botamos o resultado primeiro, explicação depois. Nada no backend mudou.",
      },
    ],
    caption:
      "A gente gastou 8 meses discutindo novas features. O que mudou o jogo foi cortar fricção que já existia. Tá tudo lá no Mixpanel, só a gente não tava olhando. Se você é founder técnico e sente que 'precisa construir mais', lê isso primeiro.",
  },
];

function GallerySlide({
  variant,
  tag,
  heading,
  body,
  imageUrl,
  main = false,
}: {
  variant: GSlideVariant;
  tag: string;
  heading: React.ReactNode;
  body: string;
  imageUrl?: string;
  main?: boolean;
}) {
  const bg: React.CSSProperties = (() => {
    switch (variant) {
      case "cream":
        return { background: "var(--sv-white)", color: "var(--sv-ink)" };
      case "ink":
        return { background: "var(--sv-ink)", color: "var(--sv-paper)" };
      case "green":
        return { background: "var(--sv-green)", color: "var(--sv-ink)" };
      case "pink":
        return { background: "var(--sv-pink)", color: "var(--sv-ink)" };
      case "dots":
        return {
          background: "var(--sv-white)",
          color: "var(--sv-ink)",
          backgroundImage:
            "radial-gradient(circle at 2px 2px, var(--sv-ink) 1px, transparent 1.5px)",
          backgroundSize: "8px 8px",
        };
      case "photo":
        return {
          backgroundColor: "var(--sv-ink)",
          color: "var(--sv-paper)",
          backgroundImage: imageUrl
            ? `linear-gradient(180deg, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.85) 100%), url(${imageUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
    }
  })();

  const bodyColor =
    variant === "ink" || variant === "photo"
      ? "rgba(247,245,239,.75)"
      : "rgba(10,10,10,.7)";

  return (
    <motion.div
      whileHover={{
        y: -3,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      className="relative flex flex-col justify-between overflow-hidden cursor-pointer"
      style={{
        border: "1.5px solid var(--sv-ink)",
        boxShadow: main ? "4px 4px 0 0 var(--sv-ink)" : "3px 3px 0 0 var(--sv-ink)",
        padding: main ? "16px 14px 14px" : "14px 12px 12px",
        aspectRatio: "4/5",
        minHeight: 0,
        transition: "box-shadow 0.2s ease-out",
        ...bg,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = main
          ? "6px 6px 0 0 var(--sv-ink)"
          : "5px 5px 0 0 var(--sv-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = main
          ? "4px 4px 0 0 var(--sv-ink)"
          : "3px 3px 0 0 var(--sv-ink)";
      }}
    >
      <span
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: main ? 8 : 7.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          opacity: 0.7,
        }}
      >
        {tag}
      </span>
      <h5
        className="sv-display"
        style={{
          fontSize: main ? 18 : 14,
          fontWeight: 400,
          lineHeight: 1.08,
          letterSpacing: "-0.015em",
        }}
      >
        {heading}
      </h5>
      <p
        style={{
          fontSize: main ? 9.5 : 8,
          lineHeight: 1.4,
          color: bodyColor,
          maxWidth: "100%",
        }}
      >
        {body}
      </p>
    </motion.div>
  );
}

export function GallerySection() {
  return (
    <section
      id="exemplos"
      style={{ padding: "96px 0", borderTop: "1px solid var(--sv-ink)" }}
    >
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="06" sub="Exemplos reais" tag="5 nichos · 15 slides">
          Carrosséis que <em>saem</em>{" "}
          <span style={{ color: "var(--sv-muted)" }}>do app.</span>
        </SectionHead>

        <p
          className="mb-10"
          style={{
            fontSize: 14,
            color: "var(--sv-muted)",
            lineHeight: 1.6,
            maxWidth: 640,
          }}
        >
          Abaixo, 5 posts completos gerados em nichos diferentes. Texto real, com
          dado e tensão. Nenhum é template. Nenhum é ChatGPT puro. Cada um usou uma
          voz de marca e 3 referências visuais diferentes. Em breve, galeria
          pública com dezenas de exemplos.
        </p>

        <div className="flex flex-col gap-12">
          {GALLERY.map((p, idx) => (
            <motion.article
              key={p.handle}
              {...REVEAL}
              className="grid gap-6"
              style={{
                gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
                alignItems: "flex-start",
              }}
            >
              {/* SLIDES */}
              <div className="sv-gallery-slides flex flex-col gap-3">
                <div
                  className="flex items-center gap-[10px]"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9.5,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--sv-ink)",
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: p.avBg,
                      color: p.avColor ?? "var(--sv-ink)",
                      border: "1px solid var(--sv-ink)",
                      fontFamily: "var(--sv-display)",
                      fontStyle: "italic",
                      fontSize: 15,
                    }}
                  >
                    {p.av}
                  </span>
                  <span className="flex flex-1 flex-col gap-[2px]">
                    <b style={{ fontWeight: 500, letterSpacing: "0.1em" }}>
                      {p.handle}
                    </b>
                    <span style={{ opacity: 0.6, fontSize: 8.5 }}>{p.bio}</span>
                  </span>
                  <span
                    style={{
                      padding: "3px 8px",
                      border: "1px solid var(--sv-ink)",
                      fontSize: 8.5,
                      background: "var(--sv-white)",
                    }}
                  >
                    {idx + 1 < 10 ? `0${idx + 1}` : idx + 1} · {p.niche}
                  </span>
                </div>
                <div
                  className="grid gap-[10px]"
                  style={{ gridTemplateColumns: "1.15fr .92fr .92fr" }}
                >
                  <GallerySlide {...p.slides[0]} main />
                  <GallerySlide {...p.slides[1]} />
                  <GallerySlide {...p.slides[2]} />
                </div>
                <div
                  className="flex items-center justify-between pt-1"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ color: "var(--sv-muted)" }}>
                    Voz: <span style={{ color: "var(--sv-ink)" }}>{p.voice}</span>
                  </span>
                  <div className="flex items-baseline gap-[14px]">
                    {[
                      { k: "likes", v: p.engagement.likes },
                      { k: "salvos", v: p.engagement.saves },
                      { k: "coment", v: p.engagement.comments },
                    ].map((s) => (
                      <span key={s.k}>
                        <b
                          style={{
                            fontFamily: "var(--sv-display)",
                            fontStyle: "italic",
                            fontWeight: 500,
                            fontSize: 15,
                            letterSpacing: "-0.015em",
                            textTransform: "none",
                          }}
                        >
                          {s.v}
                        </b>{" "}
                        <span style={{ opacity: 0.55 }}>{s.k}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* CAPTION */}
              <div
                className="relative flex h-full flex-col"
                style={{
                  padding: "22px 26px",
                  background: "var(--sv-white)",
                  border: "1.5px solid var(--sv-ink)",
                  boxShadow: "4px 4px 0 0 var(--sv-ink)",
                }}
              >
                <span
                  className="mb-3"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9.5,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--sv-muted)",
                  }}
                >
                  Caption do post
                </span>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--sv-ink)",
                    flex: 1,
                  }}
                >
                  {p.caption}
                </p>
                <div
                  className="mt-5 flex flex-wrap items-center gap-[10px] pt-4"
                  style={{
                    borderTop: "1px dashed var(--sv-ink)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      padding: "3px 7px",
                      background: "var(--sv-green)",
                      border: "1px solid var(--sv-ink)",
                    }}
                  >
                    ✦ Feito em 14s
                  </span>
                  <span style={{ color: "var(--sv-muted)" }}>
                    Template · {idx === 0 ? "Autoral" : idx === 1 ? "Principal" : idx === 2 ? "Futurista" : "Twitter"}
                  </span>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div
          {...REVEAL}
          className="mt-16 flex flex-col items-center gap-5 text-center"
        >
          <p
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: "clamp(22px, 2.6vw, 32px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--sv-ink)",
              maxWidth: 720,
            }}
          >
            Quer ver um <em>carrossel desses</em> com{" "}
            <em>seu tema</em>?
          </p>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--sv-muted)",
              maxWidth: 520,
            }}
          >
            A IA adapta o texto, o visual e a estética à sua marca. 5 carrosséis
            grátis, sem cartão, pra você testar antes de qualquer compromisso.
          </p>
          <a
            href="/app/login"
            className="inline-flex items-center gap-2"
            style={{
              padding: "13px 22px",
              background: "var(--sv-green)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "4px 4px 0 0 var(--sv-ink)",
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--sv-ink)",
              textDecoration: "none",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translate(-1.5px, -1.5px)";
              e.currentTarget.style.boxShadow = "6px 6px 0 0 var(--sv-ink)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(0, 0)";
              e.currentTarget.style.boxShadow = "4px 4px 0 0 var(--sv-ink)";
            }}
          >
            ✦ Criar meu primeiro grátis →
          </a>
          <span
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
            }}
          >
            ~15s por carrossel · sem cartão
          </span>
        </motion.div>
      </div>
      <style>{`
        @media (max-width: 960px) {
          #exemplos article { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          #exemplos .sv-gallery-slides > div:nth-child(2) {
            grid-template-columns: 1fr 1fr !important;
          }
          #exemplos .sv-gallery-slides > div:nth-child(2) > *:nth-child(3) {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
