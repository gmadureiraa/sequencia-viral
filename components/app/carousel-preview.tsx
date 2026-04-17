"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import EditorialSlide from "./editorial-slide";
import type { EditorialBodyFontId, EditorialTitleFontId } from "@/lib/editorial-fonts";
import type { DesignTemplateId } from "@/lib/carousel-templates";

interface Slide {
  heading: string;
  body: string;
  imageUrl?: string;
  imageQuery: string;
}

interface CarouselPreviewProps {
  slides: Slide[];
  profile: { name: string; handle: string; photoUrl: string };
  style: "white" | "dark";
  slideRefs?: React.MutableRefObject<(HTMLDivElement | null)[]>;
  showBranding?: boolean;
  scale?: number;
  /** Currently active slide index (synced from editor) */
  activeSlideIndex?: number;
  /** Callback when a thumbnail or slide is clicked */
  onSlideSelect?: (index: number) => void;
  /** Show thumbnail strip below preview */
  showThumbnails?: boolean;
  /** Tipografia editorial (template futurista) */
  titleFontId?: EditorialTitleFontId;
  bodyFontId?: EditorialBodyFontId;
  /** Composição visual do slide (preview). */
  designTemplate?: DesignTemplateId;
}

export default function CarouselPreview({
  slides,
  profile,
  style,
  slideRefs,
  showBranding = true,
  scale,
  activeSlideIndex = 0,
  onSlideSelect,
  showThumbnails = false,
  titleFontId,
  bodyFontId,
  designTemplate = "editorial",
}: CarouselPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [internalActive, setInternalActive] = useState(0);
  const activeIdx = activeSlideIndex ?? internalActive;
  const isScrollingRef = useRef(false);

  const effectiveScale = scale ?? 0.38;
  const slideWidth = 1080 * effectiveScale;
  const slideStep = slideWidth + 24;

  // Scroll to active slide when activeSlideIndex changes externally
  useEffect(() => {
    if (activeSlideIndex === undefined || !scrollRef.current) return;
    isScrollingRef.current = true;
    scrollRef.current.scrollTo({
      left: activeSlideIndex * slideStep,
      behavior: "smooth",
    });
    // Reset scroll flag after animation
    const t = setTimeout(() => { isScrollingRef.current = false; }, 500);
    return () => clearTimeout(t);
  }, [activeSlideIndex, slideStep]);

  const scrollTo = (direction: "left" | "right") => {
    const newIdx = direction === "left"
      ? Math.max(0, activeIdx - 1)
      : Math.min(slides.length - 1, activeIdx + 1);
    if (onSlideSelect) {
      onSlideSelect(newIdx);
    } else {
      setInternalActive(newIdx);
      scrollRef.current?.scrollTo({
        left: newIdx * slideStep,
        behavior: "smooth",
      });
    }
  };

  // Track active slide on scroll (only for internal scroll, not programmatic)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (isScrollingRef.current) return;
      const idx = Math.round(el.scrollLeft / slideStep);
      const clampedIdx = Math.max(0, Math.min(slides.length - 1, idx));
      setInternalActive(clampedIdx);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [slideStep, slides.length]);

  const handleThumbnailClick = useCallback((index: number) => {
    if (onSlideSelect) {
      onSlideSelect(index);
    } else {
      setInternalActive(index);
      scrollRef.current?.scrollTo({
        left: index * slideStep,
        behavior: "smooth",
      });
    }
  }, [onSlideSelect, slideStep]);

  return (
    <div className="relative">
      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollTo("left")}
            disabled={activeIdx === 0}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-9 h-9 rounded-full bg-white border border-[var(--border)] shadow-md flex items-center justify-center hover:bg-gray-50 hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Slide anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollTo("right")}
            disabled={activeIdx === slides.length - 1}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-9 h-9 rounded-full bg-white border border-[var(--border)] shadow-md flex items-center justify-center hover:bg-gray-50 hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Proximo slide"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory preview-scroll"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#d1d5db transparent",
        }}
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            className="snap-start cursor-pointer"
            onClick={() => handleThumbnailClick(index)}
          >
            <motion.div
              animate={{
                opacity: index === activeIdx ? 1 : 0.6,
                scale: index === activeIdx ? 1 : 0.97,
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <EditorialSlide
                ref={(el) => {
                  if (slideRefs) {
                    slideRefs.current[index] = el;
                  }
                }}
                heading={slide.heading}
                body={slide.body}
                imageUrl={slide.imageUrl}
                slideNumber={index + 1}
                totalSlides={slides.length}
                profile={profile}
                style={style}
                isLastSlide={index === slides.length - 1}
                showFooter={showBranding}
                scale={scale}
                titleFontId={titleFontId}
                bodyFontId={bodyFontId}
                designTemplate={designTemplate}
              />
            </motion.div>
          </div>
        ))}
      </div>

      {/* Thumbnail strip */}
      {showThumbnails && slides.length > 1 ? (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 preview-scroll">
          {slides.map((slide, i) => (
            <button
              type="button"
              key={i}
              onClick={() => handleThumbnailClick(i)}
              className={`group relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                i === activeIdx
                  ? "ring-2 ring-[var(--accent)] ring-offset-1 shadow-md shadow-orange-500/10"
                  : "ring-1 ring-[var(--border)] opacity-60 hover:opacity-90"
              }`}
              style={{ width: 56, height: 70 }}
              aria-label={`Ir para o slide ${i + 1}`}
            >
              <div
                className={`w-full h-full flex flex-col items-center justify-center p-1.5 text-center ${
                  style === "dark" ? "bg-zinc-900 text-zinc-300" : "bg-white text-zinc-600"
                }`}
              >
                <span className="text-[7px] font-bold leading-tight line-clamp-2 mb-0.5">
                  {slide.heading}
                </span>
                <span className="text-[6px] leading-tight opacity-60 line-clamp-2">
                  {slide.body}
                </span>
              </div>
              {/* Active indicator bar */}
              {i === activeIdx && (
                <motion.div
                  layoutId="thumbnail-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      ) : slides.length > 1 ? (
        /* Pill-style indicator dots (fallback when thumbnails disabled) */
        <div className="flex justify-center gap-1.5 mt-3">
          {slides.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => handleThumbnailClick(i)}
              className={`rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                i === activeIdx
                  ? "w-6 h-2 bg-[var(--accent)]"
                  : "w-2 h-2 bg-zinc-200 hover:bg-zinc-300"
              }`}
              aria-label={`Ir para o slide ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
