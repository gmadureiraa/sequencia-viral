"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  fetchUserCarousel,
  isCarouselUuid,
  upsertUserCarousel,
  type SavedCarousel,
} from "@/lib/carousel-storage";
import type { TemplateId as VisualTemplateId } from "@/components/app/templates/types";
import type { CreateSlide } from "./types";

/**
 * Hooks pra carregar e salvar rascunhos. Reaproveita `upsertUserCarousel` /
 * `fetchUserCarousel` do arquivo legado — lógica Supabase intacta.
 */

export interface DraftPayload {
  title: string;
  slides: CreateSlide[];
  slideStyle: "white" | "dark";
  visualTemplate?: VisualTemplateId;
  status?: "draft" | "published" | "archived";
  accentOverride?: string;
  displayFont?: string;
  textScale?: number;
}

export function useDraft(id: string | null) {
  const [draft, setDraft] = useState<SavedCarousel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !supabase) return;
    if (!isCarouselUuid(id)) {
      setError("Rascunho inválido.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const c = await fetchUserCarousel(supabase!, id);
        if (cancelled) return;
        if (!c) {
          setError("Rascunho não encontrado.");
          return;
        }
        setDraft(c);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro ao carregar rascunho.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { draft, setDraft, loading, error };
}

export function useSaveDraft(userId: string | null, _session: Session | null) {
  const saveNow = useCallback(
    async (
      id: string | null,
      payload: DraftPayload
    ): Promise<SavedCarousel | null> => {
      if (!userId || !supabase) return null;
      const { row, inserted } = await upsertUserCarousel(supabase, userId, {
        id,
        title: payload.title,
        slides: payload.slides,
        slideStyle: payload.slideStyle,
        status: payload.status ?? "draft",
        visualTemplate: payload.visualTemplate,
        accentOverride: payload.accentOverride,
        displayFont: payload.displayFont,
        textScale: payload.textScale,
      });
      // Fire-and-forget: dispara render server-side da thumb.
      // Endpoint é idempotente — se thumbnail_url já existe, no-op.
      // Só chama em INSERT (1ª vez) pra não re-renderizar a cada save.
      if (inserted && _session) {
        const accessToken = _session.access_token;
        // setTimeout 100ms pra não competir com a HTTP response do salvamento.
        setTimeout(() => {
          fetch(`/api/carousels/${row.id}/thumb`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }).catch(() => {
            /* silent — thumb é cosmético */
          });
        }, 100);
      }
      return {
        id: row.id,
        title: row.title ?? payload.title,
        slides: payload.slides,
        style: payload.slideStyle,
        savedAt: row.updated_at || row.created_at,
        status: payload.status ?? "draft",
        visualTemplate: payload.visualTemplate,
        _inserted: inserted,
      } as SavedCarousel & { _inserted: boolean };
    },
    [userId, _session]
  );
  return { saveNow };
}

/** Auto-save debounced (1200ms) — devolve estado idle/saving/saved. */
export function useAutoSaveDraft({
  userId,
  id,
  slides,
  title,
  slideStyle,
  visualTemplate,
  accentOverride,
  displayFont,
  textScale,
  enabled,
}: {
  userId: string | null;
  id: string | null;
  slides: CreateSlide[];
  title: string;
  slideStyle: "white" | "dark";
  visualTemplate?: VisualTemplateId;
  accentOverride?: string;
  displayFont?: string;
  textScale?: number;
  enabled: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastRef = useRef<string>("");
  // Marca o primeiro render pra evitar auto-save disparar antes da hidratação
  // do draft (slides ainda vazios + overrides undefined).
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || !id || !supabase) return;
    if (slides.length === 0) return;

    const serialized = JSON.stringify({
      slides,
      title,
      slideStyle,
      visualTemplate,
      accentOverride,
      displayFont,
      textScale,
    });

    // Primeiro ciclo: grava baseline sem disparar PATCH (evita escrever
    // overrides undefined em cima dos já salvos).
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      lastRef.current = serialized;
      return;
    }
    if (serialized === lastRef.current) return;

    const handle = window.setTimeout(async () => {
      setStatus("saving");
      try {
        await upsertUserCarousel(supabase!, userId, {
          id,
          title,
          slides,
          slideStyle,
          status: "draft",
          visualTemplate,
          accentOverride,
          displayFont,
          textScale,
        });
        lastRef.current = serialized;
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setStatus("idle");
      }
    }, 1200);

    return () => window.clearTimeout(handle);
  }, [
    enabled,
    userId,
    id,
    slides,
    title,
    slideStyle,
    visualTemplate,
    accentOverride,
    displayFont,
    textScale,
  ]);

  return { status };
}
