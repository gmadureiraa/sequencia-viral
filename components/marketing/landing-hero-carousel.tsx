"use client";

import { motion } from "framer-motion";
import { Sparkles, Heart, MessageCircle, Send, Bookmark } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Iphone } from "@/components/magicui/iphone";
import EditorialSlide from "@/components/app/editorial-slide";

const DEMO_PROFILE = {
  name: "Sequência Viral",
  handle: "@sequencia-viral",
  photoUrl: "",
};

const DEMO_SLIDES = [
  {
    heading: "1. Cinco conceitos no modo rápido",
    body:
      "Cole link, ideia, YouTube ou Instagram.\n\nA IA devolve cinco ângulos — você escolhe qual história contar antes de gerar o carrossel completo.",
    imageUrl: "",
  },
  {
    heading: "2. Três variações no mesmo formato thread",
    body:
      "Dados, narrativa, provocação.\n\nO preview segue o formato screenshot de thread (Twitter/X) — tipografia fixa e layout único.",
    imageUrl: "",
  },
  {
    heading: "3. Modo avançado (opcional)",
    body:
      "Quer mais controle na copy? Use o modo avançado: triagem, headlines e espinha dorsal — sem misturar isso com o tipo de layout.",
    imageUrl: "",
  },
  {
    heading: "4. Edite e exporte em PNG 4:5",
    body:
      "Ajuste texto, imagens e ordem.\n\nExport em alta para Instagram, LinkedIn ou X — tudo no mesmo fluxo.",
    imageUrl: "",
  },
];

/**
 * Hero carousel mockup: iPhone frame com Instagram post simulado por dentro.
 * Usuário pode arrastar o carrossel pro lado (drag / swipe), como no app real.
 */
export default function LandingHeroCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const slideWidth = el.clientWidth;
      const idx = Math.round(el.scrollLeft / slideWidth);
      setActive(idx);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      {/* Floating chip top-right */}
      <motion.div
        initial={{ opacity: 0, y: -8, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: 6 }}
        transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -right-3 -top-2 z-30"
      >
        <div className="rounded-full border-2 border-[#0A0A0A] bg-[#FFFDF9] px-3 py-1.5 shadow-[3px_3px_0_0_#0A0A0A]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0A0A0A]">
            <Sparkles size={11} className="text-[var(--accent)]" />
            Conceitos + variações
          </div>
        </div>
      </motion.div>

      {/* iPhone frame */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <Iphone>
          {/* Instagram-style screen */}
          <div className="flex h-full flex-col bg-white">
            {/* Status bar space (dynamic island) */}
            <div className="h-11 shrink-0" />

            {/* IG header */}
            <div className="flex items-center justify-between px-3 pt-1 pb-2 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8534] to-[#EC6000] text-[10px] font-bold text-white ring-2 ring-[#FFB380]">
                  P
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] font-semibold text-zinc-900">
                    sequencia-viral
                  </span>
                  <span className="text-[8px] text-zinc-500">Patrocinado</span>
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-700">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </div>

            {/* Scrollable carousel */}
            <div
              ref={scrollRef}
              className="flex flex-1 snap-x snap-mandatory overflow-x-auto touch-pan-x"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {DEMO_SLIDES.map((slide, i) => (
                <div
                  key={i}
                  className="flex h-full w-full shrink-0 snap-center items-center justify-center p-2"
                >
                  <div style={{ transform: "scale(0.68)", transformOrigin: "center" }}>
                    <EditorialSlide
                      heading={slide.heading}
                      body={slide.body}
                      imageUrl={slide.imageUrl || undefined}
                      slideNumber={i + 1}
                      totalSlides={DEMO_SLIDES.length}
                      profile={DEMO_PROFILE}
                      style="white"
                      isLastSlide={i === DEMO_SLIDES.length - 1}
                      showFooter={i === 0}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* IG actions */}
            <div className="shrink-0 border-t border-zinc-100 px-3 pt-2 pb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-zinc-800">
                  <Heart size={15} />
                  <MessageCircle size={15} />
                  <Send size={15} />
                </div>
                <Bookmark size={15} className="text-zinc-800" />
              </div>
              {/* Slide dots */}
              <div className="mt-1.5 flex items-center justify-center gap-1">
                {DEMO_SLIDES.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === active ? "w-3 bg-[var(--accent)]" : "w-1 bg-zinc-300"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-1 text-[9px] font-semibold text-zinc-900">
                2.847 curtidas
              </div>
              <div className="text-[8px] text-zinc-500 line-clamp-1">
                <span className="font-semibold text-zinc-900">sequencia-viral</span> formato thread
                · modo rápido e avançado
              </div>
              <div className="mt-1 text-[8px] text-zinc-400">há 12 minutos</div>
            </div>
          </div>
        </Iphone>
      </motion.div>

      {/* Floating chip bottom-left */}
      <motion.div
        initial={{ opacity: 0, y: 8, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: -4 }}
        transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -bottom-2 -left-3 z-30"
      >
        <div className="rounded-full border-2 border-[#0A0A0A] bg-[#FFFDF9] px-3 py-1.5 shadow-[3px_3px_0_0_#0A0A0A]">
          <div className="text-[11px] font-bold text-[#0A0A0A]">
            Arraste pro lado <span className="text-[var(--accent)]">→</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
