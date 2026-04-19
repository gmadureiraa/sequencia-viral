"use client";

import { motion } from "framer-motion";
import { REVEAL, SectionHead } from "./shared";

const TWEETS: {
  av: string;
  avClass: "" | "pink" | "ink";
  name: string;
  handle: string;
  role: string;
  body: React.ReactNode;
}[] = [
  {
    av: "A",
    avClass: "",
    name: "Ana Escala",
    handle: "@ana.escala",
    role: "Criadora solo · SaaS",
    body: (
      <>
        Testei 6 ferramentas de carrossel com IA.{" "}
        <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
          Sequência Viral é a única que não devolve copy cheirando a ChatGPT.
        </b>{" "}
        Colei uma transcrição de 40 min de podcast e saiu um carrossel que parecia
        escrito por mim, num domingo, com café.
      </>
    ),
  },
  {
    av: "L",
    avClass: "pink",
    name: "Lucas Onchain",
    handle: "@lucas.onchain",
    role: "Analista cripto · 22k",
    body: (
      <>
        Cola o link do meu vídeo, recebe 3 ângulos editados. O insano é que a IA
        capturou as 2 gírias que eu mais uso (&quot;thesis off&quot;, &quot;alpha
        barato&quot;){" "}
        <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
          sem eu ter pedido.
        </b>{" "}
        Isso é que eu chamo de voz.
      </>
    ),
  },
  {
    av: "M",
    avClass: "ink",
    name: "Dra. Mariana",
    handle: "@dra.mariana.sono",
    role: "Medicina do sono · educadora",
    body: (
      <>
        Uso pra virar artigos científicos em carrossel pra leigos.{" "}
        <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
          Antes: 2h pra traduzir e diagramar. Agora: 6 minutos.
        </b>{" "}
        Triplicou meu ritmo sem precisar contratar social media.
      </>
    ),
  },
];

export function TestimonialsSection() {
  return (
    <section style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="09" sub="Feedback do beta" tag="Beta fechado">
          O que o <em>beta</em> está dizendo.{" "}
          <span style={{ color: "var(--sv-muted)" }}>
            Depoimentos ilustrativos dos primeiros testers.
          </span>
        </SectionHead>

        <div
          className="mb-6 inline-flex items-center gap-[10px]"
          style={{
            padding: "7px 14px",
            background: "var(--sv-pink)",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--sv-ink)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--sv-ink)",
              animation: "sv-pulse 1.3s infinite",
            }}
          />
          Ilustrativo · vídeos reais chegam após o open beta
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TWEETS.map((t) => {
            const avBg =
              t.avClass === "pink"
                ? "var(--sv-pink)"
                : t.avClass === "ink"
                  ? "var(--sv-ink)"
                  : "var(--sv-green)";
            const avColor = t.avClass === "ink" ? "var(--sv-paper)" : "var(--sv-ink)";
            return (
              <motion.article
                key={t.handle}
                {...REVEAL}
                className="flex flex-col gap-3"
                style={{
                  background: "var(--sv-white)",
                  border: "1.5px solid var(--sv-ink)",
                  padding: 22,
                  boxShadow: "4px 4px 0 0 var(--sv-ink)",
                }}
              >
                <div className="flex items-center gap-[10px]">
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      border: "1px solid var(--sv-ink)",
                      background: avBg,
                      color: avColor,
                      fontFamily: "var(--sv-display)",
                      fontSize: 17,
                      fontStyle: "italic",
                      fontWeight: 400,
                    }}
                  >
                    {t.av}
                  </span>
                  <div className="flex-1">
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.1em",
                        color: "var(--sv-muted)",
                      }}
                    >
                      {t.handle}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>{t.body}</p>
                <div
                  className="pt-2"
                  style={{
                    borderTop: "1px dashed var(--sv-ink)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--sv-muted)",
                  }}
                >
                  {t.role}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
