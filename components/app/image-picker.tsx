"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import type { Session } from "@supabase/supabase-js";

/**
 * Modal que abre uma busca no Google Images (via Serper) com grid clicável.
 * Usuário digita query custom, vê 20 resultados, clica na que quiser →
 * retorna a URL pro caller aplicar no slide.
 *
 * Foi requisitado porque a busca automática embutida em /api/images
 * escolhia uma das 5 primeiras sem dar controle ao usuário — as
 * escolhas eram frequentemente não ideais pra carrossel editorial.
 */

interface ImageResult {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  source?: string;
  link?: string;
}

export function ImagePicker({
  initialQuery,
  session,
  onPick,
  onClose,
}: {
  initialQuery: string;
  session: Session | null;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery.slice(0, 200));
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const firedOnceRef = useRef(false);

  async function doSearch() {
    const q = query.trim();
    if (!q) {
      setError("Digita algo pra buscar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          query: q,
          mode: "search",
          count: 24,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Falha ao buscar imagens."
        );
      }
      const imgs = Array.isArray(body?.images) ? (body.images as ImageResult[]) : [];
      if (imgs.length === 0) {
        setError(
          typeof body?.warning === "string"
            ? body.warning
            : "Nenhum resultado. Tenta outra query."
        );
        setResults([]);
      } else {
        setResults(imgs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na busca.");
    } finally {
      setLoading(false);
    }
  }

  // Primeira busca automática com o initialQuery.
  useEffect(() => {
    if (firedOnceRef.current) return;
    firedOnceRef.current = true;
    void doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function confirmPick() {
    if (!selected) {
      toast.error("Clique numa imagem primeiro.");
      return;
    }
    onPick(selected);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,10,0.65)",
        zIndex: 120,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "32px 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 960,
          background: "var(--sv-white)",
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "6px 6px 0 0 var(--sv-ink)",
          padding: 22,
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div
              className="uppercase mb-1"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "var(--sv-muted)",
                fontWeight: 700,
              }}
            >
              Google Images · Serper
            </div>
            <h2
              className="sv-display"
              style={{
                fontSize: 24,
                lineHeight: 1.1,
                letterSpacing: "-0.015em",
              }}
            >
              Escolha a imagem
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sv-btn sv-btn-outline"
            style={{ padding: "6px 10px", fontSize: 10 }}
          >
            ✕ Fechar
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                e.preventDefault();
                void doSearch();
              }
            }}
            placeholder="Ex: algoritmo instagram 2026, founder typing laptop, red dramatic lighting..."
            className="sv-input flex-1"
            style={{
              padding: "10px 12px",
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={() => void doSearch()}
            disabled={loading || !query.trim()}
            className="sv-btn sv-btn-primary"
            style={{
              padding: "10px 16px",
              fontSize: 11,
              opacity: loading || !query.trim() ? 0.5 : 1,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Buscando
              </>
            ) : (
              "Buscar"
            )}
          </button>
        </div>

        {error && (
          <div
            className="mb-3 p-3"
            style={{
              border: "1.5px solid #c94f3b",
              background: "#fdf0ed",
              color: "#7a2a1a",
              fontFamily: "var(--sv-sans)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {loading && results.length === 0 && (
          <div
            className="py-16 text-center"
            style={{ color: "var(--sv-muted)" }}
          >
            <Loader2
              size={20}
              className="animate-spin inline-block"
              style={{ color: "var(--sv-ink)" }}
            />
            <div
              className="mt-3 uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
              }}
            >
              Buscando no Google...
            </div>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div
              className="grid gap-2 mb-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                maxHeight: "60vh",
                overflowY: "auto",
              }}
            >
              {results.map((img, i) => {
                const isSelected = selected === img.url;
                return (
                  <button
                    key={`${img.url}-${i}`}
                    type="button"
                    onClick={() => setSelected(img.url)}
                    onDoubleClick={() => onPick(img.url)}
                    style={{
                      position: "relative",
                      aspectRatio: "1/1",
                      border: isSelected
                        ? "2.5px solid var(--sv-green)"
                        : "1.5px solid var(--sv-ink)",
                      boxShadow: isSelected
                        ? "4px 4px 0 0 var(--sv-green)"
                        : "2px 2px 0 0 var(--sv-ink)",
                      background: `url(${img.thumbnailUrl || img.url}) center/cover`,
                      cursor: "pointer",
                      transform: isSelected ? "translate(-2px,-2px)" : "none",
                      transition: "transform .1s",
                      padding: 0,
                      overflow: "hidden",
                    }}
                    title={img.title || img.source || ""}
                  >
                    {isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "var(--sv-green)",
                          border: "1.5px solid var(--sv-ink)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--sv-display)",
                          fontSize: 16,
                          fontWeight: 700,
                          color: "var(--sv-ink)",
                        }}
                      >
                        ✓
                      </div>
                    )}
                    {img.source && (
                      <div
                        className="uppercase"
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: "4px 6px",
                          background: "rgba(10,10,10,0.72)",
                          color: "var(--sv-white)",
                          fontFamily: "var(--sv-mono)",
                          fontSize: 8.5,
                          letterSpacing: "0.12em",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {img.source}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div
                className="uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "var(--sv-muted)",
                }}
              >
                {selected
                  ? "1 selecionada · duplo-clique aplica direto"
                  : `${results.length} resultados · clique para selecionar`}
              </div>
              <button
                type="button"
                onClick={confirmPick}
                disabled={!selected}
                className="sv-btn sv-btn-primary"
                style={{
                  padding: "10px 18px",
                  fontSize: 11.5,
                  opacity: !selected ? 0.5 : 1,
                }}
              >
                Usar essa →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
