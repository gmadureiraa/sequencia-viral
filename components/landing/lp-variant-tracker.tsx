"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Dispara evento `lp_viewed` no PostHog com o variant (velocidade/voz/anti-canva)
 * pra tracking A/B de ads. Também persiste em sessionStorage pra herdar no
 * signup + checkout events depois.
 */
export function LpVariantTracker({ variant }: { variant: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage?.setItem("lp_variant", variant);
    } catch {
      /* storage bloqueado — OK, só captura event */
    }
    try {
      posthog.capture("lp_viewed", { lp_variant: variant });
    } catch {
      /* posthog não inicializou ainda — silencioso */
    }
  }, [variant]);
  return null;
}
