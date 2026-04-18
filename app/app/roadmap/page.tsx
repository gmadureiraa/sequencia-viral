"use client";

import { motion } from "framer-motion";
import RoadmapBoard, { LegendDot } from "@/components/app/roadmap-board";

/**
 * Roadmap dentro do app — renderiza o mesmo sticky-notes board da página pública
 * mas dentro do shell do /app (sidebar continua visível).
 */
export default function AppRoadmapPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="tag-pill mb-6">
          <span className="font-mono">§</span> Roadmap público
        </span>
        <h1 className="editorial-serif text-[3rem] sm:text-[4.5rem] md:text-[5.5rem] text-[var(--foreground)] leading-[0.95]">
          O caminho do{" "}
          <span className="italic text-[var(--accent)]">Sequência Viral.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Começamos hoje com um gerador manual que já resolve o dia a dia. Daqui
          a alguns meses, o Sequência Viral vira um motor autônomo que lê o mundo,
          entende sua marca e publica por você.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <LegendDot color="#EC6000" label="Agora" />
          <LegendDot color="#FF8534" label="Próximo" />
          <LegendDot color="#F5C38A" label="Futuro" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-12"
      >
        <RoadmapBoard />
      </motion.div>

      {/* CTA section inline */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-16 rounded-[28px] border border-[color:var(--border)] bg-white/60 p-10 text-center backdrop-blur"
      >
        <h2 className="editorial-serif text-3xl text-[var(--foreground)] md:text-4xl">
          Quer pedir algo?
        </h2>
        <p className="mt-3 text-[color:var(--muted)]">
          O roadmap muda com base em quem usa. Me manda o que você precisa e eu
          priorizo.
        </p>
        <div className="mt-6">
          <a
            href="mailto:madureira@kaleidosdigital.com?subject=Roadmap%20feedback"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-dark)]"
          >
            Mandar sugestão →
          </a>
        </div>
      </motion.section>
    </div>
  );
}
