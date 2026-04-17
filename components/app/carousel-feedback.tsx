"use client";

import { useCallback, useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, Loader2 } from "lucide-react";
import type { CarouselFeedback } from "@/lib/carousel-storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertCarouselFeedback } from "@/lib/carousel-storage";
import { toast } from "sonner";

type Props = {
  carouselId: string | null;
  userId: string | undefined;
  supabase: SupabaseClient | null;
  initial?: CarouselFeedback | null;
  /** Chamado após persistir (ex.: recarregar lista na biblioteca) */
  onSaved?: (f: CarouselFeedback) => void;
  /** Versão compacta para cards na biblioteca */
  compact?: boolean;
};

export default function CarouselFeedbackPanel({
  carouselId,
  userId,
  supabase,
  initial,
  onSaved,
  compact = false,
}: Props) {
  const [sentiment, setSentiment] = useState<"up" | "down" | null>(initial?.sentiment ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSentiment(initial?.sentiment ?? null);
    setComment(initial?.comment ?? "");
  }, [carouselId, initial?.sentiment, initial?.comment, initial?.updatedAt]);

  const dirty =
    sentiment !== (initial?.sentiment ?? null) || comment.trim() !== (initial?.comment ?? "").trim();

  const save = useCallback(async () => {
    if (!carouselId || !userId || !supabase) {
      toast.error("Salve o carrossel na nuvem antes de enviar feedback.");
      return;
    }
    setSaving(true);
    try {
      await upsertCarouselFeedback(supabase, userId, carouselId, {
        sentiment,
        comment: comment.trim(),
      });
      const next: CarouselFeedback = {
        sentiment,
        comment: comment.trim(),
        updatedAt: new Date().toISOString(),
      };
      onSaved?.(next);
      toast.success("Feedback salvo.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar o feedback.");
    } finally {
      setSaving(false);
    }
  }, [carouselId, userId, supabase, sentiment, comment, onSaved]);

  if (!carouselId) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 text-[var(--muted)] ${
          compact ? "px-3 py-2 text-[11px]" : "px-4 py-3 text-sm"
        }`}
      >
        Salve o carrossel para avaliar e comentar.
      </div>
    );
  }

  const btnBase =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border-2 font-semibold transition-colors disabled:opacity-50";
  const activeUp = sentiment === "up";
  const activeDown = sentiment === "down";

  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={compact ? 14 : 16} className="text-[var(--accent)] shrink-0" />
        <span className={`font-bold text-[var(--foreground)] ${compact ? "text-xs" : "text-sm"}`}>
          Como foi esta criação?
        </span>
      </div>
      <p className={`text-[var(--muted)] mb-3 ${compact ? "text-[10px] leading-snug" : "text-[11px]"}`}>
        Seu feedback fica salvo neste carrossel e ajuda a evoluir o produto.
      </p>

      <div className={`flex flex-wrap items-center gap-2 ${compact ? "mb-2" : "mb-3"}`}>
        <button
          type="button"
          disabled={saving}
          onClick={() => setSentiment((s) => (s === "up" ? null : "up"))}
          className={`${btnBase} ${compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"} ${
            activeUp
              ? "border-[var(--accent)] bg-orange-50 text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-zinc-300"
          }`}
          aria-pressed={activeUp}
        >
          <ThumbsUp size={compact ? 14 : 16} />
          Bom
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setSentiment((s) => (s === "down" ? null : "down"))}
          className={`${btnBase} ${compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"} ${
            activeDown
              ? "border-red-400 bg-red-50 text-red-700"
              : "border-[var(--border)] text-[var(--muted)] hover:border-zinc-300"
          }`}
          aria-pressed={activeDown}
        >
          <ThumbsDown size={compact ? 14 : 16} />
          Ruim
        </button>
      </div>

      <label className="sr-only" htmlFor={compact ? "cf-comment-c" : "cf-comment"}>
        Comentário opcional
      </label>
      <textarea
        id={compact ? "cf-comment-c" : "cf-comment"}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={saving}
        maxLength={2000}
        placeholder="Comentário opcional (o que faltou, bug, ideia…)"
        rows={compact ? 2 : 3}
        className={`w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15 resize-y ${
          compact ? "text-[11px]" : "text-sm"
        }`}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        {initial?.updatedAt && !dirty && (
          <span className="text-[10px] text-[var(--muted)]">
            Salvo em{" "}
            {new Date(initial.updatedAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Salvar feedback
        </button>
      </div>
    </div>
  );
}
