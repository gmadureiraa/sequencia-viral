"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { SectionHead } from "./shared";

export interface FAQItem {
  q: React.ReactNode;
  a: React.ReactNode;
}

const DEFAULT_FAQ_ITEMS: FAQItem[] = [
  {
    q: (
      <>
        A IA <em>copia</em> o meu estilo?
      </>
    ),
    a: "Não copia. Aprende. Você cola seu @ e escolhe até 10 posts que representam sua voz. A IA extrai padrões (vocabulário, ritmo, tipo de abertura, tabus) e usa isso como restrição. Você pode ainda adicionar regras manuais tipo 'não uso hashtag', 'nunca começo com pergunta retórica', 'evito emoji'. O resultado é um carrossel que passa pelo teste do 'parece algo que eu escreveria'.",
  },
  {
    q: (
      <>
        A IA <em>inventa</em> coisas no carrossel?
      </>
    ),
    a: "Não. A IA trabalha exclusivamente em cima da fonte que você colou: transcrição de vídeo, artigo ou sua nota. Se não estiver na fonte, não entra no carrossel. No modo avançado você ainda revisa os ângulos antes da IA escrever — duas camadas de controle. Nada de alucinação.",
  },
  {
    q: (
      <>
        Posso usar os carrosséis <em>comercialmente</em>?
      </>
    ),
    a: "Sim, todo conteúdo gerado é seu. Textos, imagens geradas, PNGs exportados: uso pessoal, cliente, agência, venda, não importa. Não cobramos royalty e não reclamamos autoria. A única coisa que pedimos é não republicar a ferramenta em si como se fosse sua.",
  },
  {
    q: (
      <>
        E se eu <em>não gostar</em> da imagem gerada?
      </>
    ),
    a: "Três opções. Uma: regenera a imagem daquele slide específico (não re-gera o carrossel todo). Duas: troca pro modo 'sem imagem' — fica só texto editorial, e é rápido. Três: faz upload da sua própria foto/ilustração e a IA reajusta o layout em volta. Nenhuma dessas opções custa geração extra.",
  },
  {
    q: (
      <>
        Como as <em>referências visuais</em> funcionam?
      </>
    ),
    a: "Você sobe 3 imagens que representam a estética da sua marca (post antigo, moodboard, foto de produto). A IA extrai paleta, textura, densidade e linguagem visual. A partir disso, toda imagem gerada é uma extensão coerente — o carrossel de cripto do @lucas.onchain não parece o carrossel de design do @kaleidos.studio, mesmo usando o mesmo template.",
  },
  {
    q: (
      <>
        Funciona com qualquer <em>canal</em> do YouTube?
      </>
    ),
    a: "Qualquer vídeo público com áudio audível. Transcrevemos em português, inglês e espanhol. Vídeos acima de 2h podem levar alguns minutos extras. Lives e podcasts longos funcionam — rodamos transcrição em background enquanto você trabalha em outra coisa.",
  },
  {
    q: (
      <>
        Os carrosséis podem ser <em>editados</em> depois?
      </>
    ),
    a: "Sim, tudo é editável inline: texto, tamanho da fonte, cor, template, ordem dos slides, variante do layout (capa, headline, foto, quote, split, CTA). Você pode reutilizar um carrossel antigo como base pra um novo e só trocar a fonte de conteúdo. Rolê usado por agências pra padronizar entrega.",
  },
  {
    q: (
      <>
        Posso <em>cancelar</em> quando quiser?
      </>
    ),
    a: "Sem fidelidade. Cancela pelo painel em 2 cliques. Se cancelar no mesmo mês que assinou, devolvemos integral, sem perguntar. No plano Agência, rateio proporcional pros dias usados.",
  },
  {
    q: (
      <>
        Quem tá por <em>trás</em> do Sequência Viral?
      </>
    ),
    a: (
      <>
        Sequência Viral é um produto da <b>Kaleidos Digital</b>, agência brasileira
        de marketing de conteúdo que atende criadores, fintechs e projetos
        cripto/web3. A gente cansou de ver copy genérica dominando o feed e fez a
        ferramenta que queríamos usar com os nossos clientes.
      </>
    ),
  },
];

export interface FAQSectionProps {
  sub?: string;
  tag?: string;
  heading?: React.ReactNode;
  items?: FAQItem[];
}

export function FAQSection(props: FAQSectionProps = {}) {
  const {
    sub = "FAQ",
    tag = "Respostas rápidas",
    heading,
    items = DEFAULT_FAQ_ITEMS,
  } = props;
  const FAQ_ITEMS = items;
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section id="faq" style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="10" sub={sub} tag={tag}>
          {heading ?? (
            <>
              Perguntas <em>antes</em> de pagar.
            </>
          )}
        </SectionHead>

        <div
          className="flex flex-col"
          style={{
            maxWidth: 880,
            borderTop: "1.5px solid var(--sv-ink)",
            borderBottom: "1.5px solid var(--sv-ink)",
          }}
        >
          {FAQ_ITEMS.map((item, i) => {
            const open = openIdx === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpenIdx(open ? -1 : i)}
                className="w-full cursor-pointer text-left"
                style={{
                  padding: "22px 0",
                  borderBottom:
                    i < FAQ_ITEMS.length - 1 ? "1px solid var(--sv-ink)" : "none",
                  background: "transparent",
                }}
              >
                <div
                  className="flex items-center justify-between gap-5"
                  style={{
                    fontFamily: "var(--sv-display)",
                    fontSize: 22,
                    fontWeight: 400,
                    letterSpacing: "-0.012em",
                    lineHeight: 1.25,
                  }}
                >
                  <span className="flex-1">{item.q}</span>
                  <span
                    className="inline-flex flex-shrink-0 items-center justify-center"
                    style={{
                      width: 28,
                      height: 28,
                      border: "1px solid var(--sv-ink)",
                      fontFamily: "var(--sv-mono)",
                      fontSize: 16,
                      lineHeight: 1,
                      background: open ? "var(--sv-green)" : "transparent",
                      transform: open ? "rotate(45deg)" : undefined,
                      transition: "background .2s, transform .3s",
                    }}
                  >
                    +
                  </span>
                </div>
                <motion.div
                  initial={false}
                  animate={{ maxHeight: open ? 500 : 0, marginTop: open ? 12 : 0 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    overflow: "hidden",
                    color: "var(--sv-muted)",
                    fontSize: 14,
                    lineHeight: 1.6,
                    paddingRight: 48,
                  }}
                >
                  <div>{item.a}</div>
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
