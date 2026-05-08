"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import type { Session } from "@supabase/supabase-js";

/**
 * Modal que abre busca mix Google Images (Serper) + Unsplash em paralelo,
 * com scroll + load more. Dedupe por URL no client pra evitar repetição
 * entre páginas. Unsplash dispara trigger de download quando user escolhe
 * uma foto dele (obrigação da API Unsplash).
 *
 * Histórico:
 * - v1 (2026-03): Google Images via Serper, 20 resultados fixos
 * - v2 (2026-04-23): subiu pra 40 resultados (cap Serper)
 * - v3 (2026-04-24): mix Serper + Unsplash paralelo + paginação load-more
 */

interface ImageResult {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  source?: string;
  link?: string;
  provider?: "serper" | "unsplash";
  author?: string;
  authorUrl?: string;
  /** Quando user escolhe uma foto Unsplash, disparar ping pra esse endpoint. */
  downloadLocation?: string;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const firedOnceRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(
    async (opts: { append: boolean; page: number }) => {
      const q = query.trim();
      if (!q) {
        setError("Digita algo pra buscar.");
        return;
      }
      if (opts.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            query: q,
            mode: "search",
            // 40 = cap do Serper free; Unsplash entra em paralelo (até 30).
            // 1 request Serper e 1 Unsplash por página, ambos baratos.
            count: 40,
            page: opts.page,
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
        const imgs = Array.isArray(body?.images)
          ? (body.images as ImageResult[])
          : [];
        const nextHasMore = Boolean(body?.hasMore);
        if (opts.append) {
          setResults((prev) => {
            const seen = new Set(prev.map((r) => r.url));
            const deduped = imgs.filter((r) => !seen.has(r.url));
            return [...prev, ...deduped];
          });
          if (imgs.length === 0) {
            setHasMore(false);
          } else {
            setHasMore(nextHasMore);
          }
        } else {
          if (imgs.length === 0) {
            setError(
              typeof body?.warning === "string"
                ? body.warning
                : "Nenhum resultado. Tenta outra query."
            );
            setResults([]);
            setHasMore(false);
          } else {
            setResults(imgs);
            setHasMore(nextHasMore);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro na busca.");
      } finally {
        if (opts.append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [query, session]
  );

  const doSearch = useCallback(async () => {
    setSelected(null);
    setPage(1);
    await runSearch({ append: false, page: 1 });
  }, [runSearch]);

  const loadMore = useCallback(async () => {
    const next = page + 1;
    setPage(next);
    await runSearch({ append: true, page: next });
  }, [page, runSearch]);

  // Primeira busca automática com o initialQuery.
  useEffect(() => {
    if (firedOnceRef.current) return;
    firedOnceRef.current = true;
    void doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll infinito: IntersectionObserver no sentinel final do grid.
  // Carrega mais automaticamente quando o sentinel entra na viewport do
  // container scrollável. User ainda pode clicar botão manualmente.
  useEffect(() => {
    if (!hasMore) return;
    if (loading || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

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

  const [confirming, setConfirming] = useState(false);
  async function confirmPick(urlOverride?: string) {
    const target = urlOverride ?? selected;
    if (!target) {
      toast.error("Clique numa imagem primeiro.");
      return;
    }
    if (confirming) return;
    setConfirming(true);
    // Cacheia a URL externa (Serper/Google/Unsplash) pro bucket Supabase
    // antes de devolver pro slide. URLs Serper expiram em horas — sem isso,
    // o download zip e o publish IG quebram (bug Sam Altman 08/05/2026).
    // Se cache falhar, mantemos URL original (não bloqueia escolha).
    let finalUrl = target;
    try {
      const res = await fetch("/api/images/cache", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({ url: target }),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { url?: string; cached?: boolean }
          | null;
        if (body?.url) finalUrl = body.url;
      }
    } catch (err) {
      console.warn(
        "[ImagePicker] cache call failed, usando URL externa:",
        err instanceof Error ? err.message : err
      );
    } finally {
      setConfirming(false);
    }
    onPick(finalUrl);
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
              Google Images + Unsplash
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
                const badge =
                  img.provider === "unsplash"
                    ? `Unsplash · ${img.author || "autor"}`
                    : img.source || "";
                return (
                  <button
                    key={`${img.url}-${i}`}
                    type="button"
                    onClick={() => setSelected(img.url)}
                    onDoubleClick={() => {
                      // Mesmo fluxo do botão "Usar essa" — passa pelo cache.
                      setSelected(img.url);
                      void confirmPick(img.url);
                    }}
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
                    title={img.title || badge || ""}
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
                    {badge && (
                      <div
                        className="uppercase"
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: "4px 6px",
                          background:
                            img.provider === "unsplash"
                              ? "rgba(20,40,60,0.82)"
                              : "rgba(10,10,10,0.72)",
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
                        {badge}
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Sentinel pro IntersectionObserver — dispara loadMore
                  quando chega no fim do grid com scroll. */}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  style={{
                    gridColumn: "1 / -1",
                    padding: "16px 0",
                    textAlign: "center",
                  }}
                >
                  {loadingMore ? (
                    <div
                      className="uppercase"
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        color: "var(--sv-muted)",
                      }}
                    >
                      <Loader2
                        size={12}
                        className="animate-spin inline-block mr-2"
                      />
                      Carregando mais...
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      className="sv-btn sv-btn-outline"
                      style={{ fontSize: 10, padding: "6px 14px" }}
                    >
                      Carregar mais imagens
                    </button>
                  )}
                </div>
              )}
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
                onClick={() => void confirmPick()}
                disabled={!selected || confirming}
                className="sv-btn sv-btn-primary"
                style={{
                  padding: "10px 18px",
                  fontSize: 11.5,
                  opacity: !selected || confirming ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {confirming ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Salvando…
                  </>
                ) : (
                  "Usar essa →"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
