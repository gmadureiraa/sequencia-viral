"use client";

/**
 * <MediaTag> — wrapper unificado pra renderizar IMAGEM ou VÍDEO baseado
 * na URL recebida.
 *
 * Detecção: extensão da URL (.mp4/.mov/.webm/.m4v → vídeo).
 * Vídeo roda autoplay+loop+muted+playsInline pra preview no editor — sem
 * som, sem controles. Atributos necessários pro Safari/Chrome autoplay.
 *
 * Compartilhado entre todos os templates (Twitter, Manifesto, Futurista,
 * Autoral, Ambitious, Blank, Bohdan) pra que o suporte a vídeo seja
 * consistente. No export, html-to-image captura o frame ATUAL do vídeo;
 * o MP4 original é incluído separadamente no ZIP via lib/create/use-export.
 */

import * as React from "react";
import { isVideoUrl } from "./utils";

export interface MediaTagProps {
  src: string;
  alt: string;
  style: React.CSSProperties;
  /**
   * Quando true, vídeos exibem o primeiro frame (paused) em vez de
   * autoplay loop. Útil pra captura PNG do export, onde queremos que
   * o frame seja determinístico.
   */
  paused?: boolean;
}

export function MediaTag({ src, alt, style, paused }: MediaTagProps) {
  if (isVideoUrl(src)) {
    return (
      <video
        src={src}
        autoPlay={!paused}
        loop={!paused}
        muted
        playsInline
        crossOrigin="anonymous"
        style={style}
        aria-label={alt}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      crossOrigin="anonymous"
      alt={alt}
      style={style}
    />
  );
}
