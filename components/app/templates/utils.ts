/**
 * Helpers compartilhados pelos templates do Sequência Viral.
 *
 * - `resolveImgSrc`: roteia imagens externas pelo proxy same-origin quando
 *   em modo export (senão `html-to-image` gera canvas tainted).
 * - `renderRichText`: suporta `**bold**` inline para ênfase dentro do body.
 */

import * as React from "react";

export function resolveImgSrc(
  url: string | undefined,
  exportMode: boolean
): string | undefined {
  if (!url) return undefined;
  if (!exportMode) return url;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/"))
    return url;
  try {
    const u = new URL(url);
    if (typeof window !== "undefined" && u.origin === window.location.origin) {
      return url;
    }
    return `/api/img-proxy?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

export function renderRichText(
  text: string,
  accent?: string
): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return React.createElement(
        "strong",
        {
          key: i,
          style: { fontWeight: 800, color: accent },
        },
        part.slice(2, -2)
      );
    }
    return React.createElement("span", { key: i }, part);
  });
}

/** Dimensões reais do canvas Instagram 4:5 usado por todos os templates. */
export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

/** Stack mono reutilizável. Gridlite é carregada via @font-face em globals.css. */
export const MONO_STACK =
  '"Gridlite", "JetBrains Mono", "Courier New", ui-monospace, monospace';

/**
 * Heurística simples pra decidir se uma cor de fundo é "escura" — usado por
 * templates pra escolher contraste de texto quando o user troca `bgColor`.
 * Aceita hex `#rgb`/`#rrggbb`, `rgb(...)`, `rgba(...)` e `var(--sv-*)` (nesse
 * caso faz lookup pelos valores conhecidos da paleta Kaleidos).
 */
export function isColorDark(color: string | undefined): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();

  const varMap: Record<string, boolean> = {
    "var(--sv-ink)": true,
    "var(--sv-navy)": true,
    "var(--sv-pink)": true,
    "var(--sv-green)": false,
    "var(--sv-yellow)": false,
    "var(--sv-white)": false,
    "var(--sv-paper)": false,
    "var(--sv-soft)": false,
  };
  if (c in varMap) return varMap[c];

  let r = 0, g = 0, b = 0;
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    }
  } else {
    const rgb = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
      r = Number(rgb[1]);
      g = Number(rgb[2]);
      b = Number(rgb[3]);
    } else {
      return false;
    }
  }
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55;
}
