"use client";

import { motion } from "framer-motion";
import { REVEAL, SectionHead } from "./shared";

function thStyle(): React.CSSProperties {
  return {
    padding: "14px 18px",
    textAlign: "left",
    borderBottom: "1px solid var(--sv-ink)",
    fontFamily: "var(--sv-display)",
    fontWeight: 400,
    fontSize: 18,
    letterSpacing: "-0.01em",
    background: "var(--sv-soft)",
  };
}

export interface CompareSectionProps {
  sub?: string;
  tag?: string;
  heading?: React.ReactNode;
  columns?: [string, string, string, string];
  rows?: string[][];
}

const DEFAULT_ROWS: string[][] = [
  ["Tempo por carrossel", "~ 60 segundos", "45–60 min", "20 min + edição", "2–3 horas"],
  ["Transcreve YouTube", "✦ Automático", "✕", "Copia/cola", "Manual"],
  ["Lê legenda de IG/X", "✦ Com OCR dos slides", "✕", "Parcial", "Manual"],
  ["Escreve com a SUA voz", "✦ Voz configurável por DNA", "✕", "Depende do prompt", "Precisa revisar"],
  ["Referências visuais da marca", "✦ 3 imagens → paleta/mood", "Manual", "✕", "Manual"],
  ["Imagem por slide", "✦ Cinemática contextual", "Stock photo", "✕", "Manual"],
  ["Export pronto pra postar", "✦ 1 clique", "Manual", "✕", "Manual"],
  ["Preview real (WYSIWYG)", "✦ Sim", "✓", "✕", "✓"],
  ["Preço pra postar todo dia", "R$ 99,90/mês", "R$ 70/mês", "R$ 100/mês", "Seu tempo"],
];

export function CompareSection(props: CompareSectionProps = {}) {
  const {
    sub = "Sem vs Com",
    tag = "Honesto",
    heading,
    columns = ["Sequência Viral", "Canva", "ChatGPT", "Manual"],
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={thStyle()} />
                <th
                  style={{
                    ...thStyle(),
                    background: "var(--sv-green)",
                  }}
                >
                  <em>{columns[0]}</em>
                </th>
                <th style={thStyle()}>{columns[1]}</th>
                <th style={thStyle()}>{columns[2]}</th>
                <th style={thStyle()}>{columns[3]}</th>
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
                  {r.map((c, j) => {
                    const isFirst = j === 0;
                    const isSV = j === 1;
                    const isMissing = c === "✕";
                    return (
                      <td
                        key={j}
                        style={{
                          padding: "14px 18px",
                          textAlign: isFirst || isSV ? "left" : "center",
                          borderBottom:
                            i < rows.length - 1 ? "1px solid var(--sv-ink)" : "none",
                          fontSize: 13,
                          fontFamily: isFirst ? "var(--sv-mono)" : undefined,
                          letterSpacing: isFirst ? "0.16em" : undefined,
                          textTransform: isFirst ? "uppercase" : undefined,
                          color: isFirst
                            ? "var(--sv-muted)"
                            : isMissing
                              ? "var(--sv-pink)"
                              : undefined,
                          fontWeight: isFirst ? 500 : isSV ? 600 : isMissing ? 700 : undefined,
                          background: isSV
                            ? "color-mix(in srgb, var(--sv-green) 22%, var(--sv-white))"
                            : undefined,
                        }}
                      >
                        {c}
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
