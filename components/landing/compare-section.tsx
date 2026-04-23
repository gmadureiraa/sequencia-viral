"use client";

import { motion } from "framer-motion";
import { REVEAL, SectionHead } from "./shared";

/**
 * Tabela comparativa 2 colunas — Com Sequência Viral vs Sem. 5 linhas
 * cobrindo os diferenciais mais concretos (tempo, transcricao, OCR, voz,
 * preco pra volume). Simplificou a versao 4 colunas antiga (SV × Canva ×
 * ChatGPT × Manual) que quebrava em mobile e conflitava com pricing.
 */

export interface CompareRow {
  topic: string;
  withSv: string;
  withoutSv: string;
}

export interface CompareSectionProps {
  sub?: string;
  tag?: string;
  heading?: React.ReactNode;
  rows?: CompareRow[];
}

const DEFAULT_ROWS: CompareRow[] = [
  {
    topic: "Tempo por carrossel",
    withSv: "~60s do input ao PNG pronto",
    withoutSv: "2 a 3 horas no Canva + ChatGPT",
  },
  {
    topic: "Transcreve YouTube",
    withSv: "Automático, PT · EN · ES",
    withoutSv: "Manual: copia, cola, revisa",
  },
  {
    topic: "Lê posts do Instagram",
    withSv: "Com OCR dos slides + legenda",
    withoutSv: "Nenhuma ferramenta faz direito",
  },
  {
    topic: "Escreve com a SUA voz",
    withSv: "Voz configurável pelo DNA das redes",
    withoutSv: "Genérico, cheiro de ChatGPT padrão",
  },
  {
    topic: "Preço pra postar todo dia",
    withSv: "R$ 49,90/mês (de lançamento, anchor R$ 99,90)",
    withoutSv: "Seu tempo, que custa mais caro",
  },
];

export function CompareSection(props: CompareSectionProps = {}) {
  const {
    sub = "Sem vs Com",
    tag = "Honesto",
    heading,
    rows = DEFAULT_ROWS,
  } = props;

  return (
    <section id="compare" style={{ padding: "0 0 96px" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <SectionHead num="04" sub={sub} tag={tag}>
          {heading ?? (
            <>
              Com <em>Sequência Viral</em> vs. sem.
            </>
          )}
        </SectionHead>

        <motion.div
          {...REVEAL}
          className="overflow-x-auto"
          style={{
            border: "1.5px solid var(--sv-ink)",
            background: "var(--sv-white)",
            boxShadow: "5px 5px 0 0 var(--sv-ink)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th
                  style={{
                    padding: "16px 20px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--sv-ink)",
                    fontFamily: "var(--sv-mono)",
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--sv-muted)",
                    background: "var(--sv-soft)",
                    width: "28%",
                  }}
                />
                <th
                  style={{
                    padding: "16px 20px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--sv-ink)",
                    fontFamily: "var(--sv-display)",
                    fontWeight: 400,
                    fontStyle: "italic",
                    fontSize: 20,
                    letterSpacing: "-0.01em",
                    background: "var(--sv-green)",
                    width: "36%",
                  }}
                >
                  Com Sequência Viral
                </th>
                <th
                  style={{
                    padding: "16px 20px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--sv-ink)",
                    fontFamily: "var(--sv-display)",
                    fontWeight: 400,
                    fontSize: 20,
                    letterSpacing: "-0.01em",
                    background: "var(--sv-soft)",
                    color: "var(--sv-muted)",
                    width: "36%",
                  }}
                >
                  Sem Sequência Viral
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: 0.05 * i, ease: "easeOut" }}
                >
                  <td
                    style={{
                      padding: "16px 20px",
                      textAlign: "left",
                      borderBottom:
                        i < rows.length - 1 ? "1px solid var(--sv-ink)" : "none",
                      fontSize: 12,
                      fontFamily: "var(--sv-mono)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--sv-muted)",
                      fontWeight: 500,
                      background: "var(--sv-soft)",
                    }}
                  >
                    {r.topic}
                  </td>
                  <td
                    style={{
                      padding: "16px 20px",
                      textAlign: "left",
                      borderBottom:
                        i < rows.length - 1 ? "1px solid var(--sv-ink)" : "none",
                      fontSize: 14,
                      color: "var(--sv-ink)",
                      fontWeight: 600,
                      background:
                        "color-mix(in srgb, var(--sv-green) 22%, var(--sv-white))",
                    }}
                  >
                    <span style={{ color: "var(--sv-pink)", marginRight: 6 }}>✦</span>
                    {r.withSv}
                  </td>
                  <td
                    style={{
                      padding: "16px 20px",
                      textAlign: "left",
                      borderBottom:
                        i < rows.length - 1 ? "1px solid var(--sv-ink)" : "none",
                      fontSize: 14,
                      color: "var(--sv-muted)",
                    }}
                  >
                    {r.withoutSv}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
