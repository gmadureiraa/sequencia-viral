"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Send, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * <ScheduleZernioModal> — agenda carrossel via Zernio.
 *
 * Fluxo:
 *  1. Lista profiles do admin (GET /api/zernio/profiles).
 *  2. Quando user escolhe profile, lista contas active daquele profile.
 *  3. User escolhe quais contas, modo (schedule/publishNow/draft), data/hora.
 *  4. Se `getSlidePngs` provido + houver pelo menos 1 conta IG/FB/etc. que
 *     PRECISA de mídia, captura PNGs → POST /api/zernio/upload-slides → URLs.
 *  5. POST /api/zernio/posts com { profileId, accountIds, content, mediaUrls,
 *     mode, scheduledFor, timezone, carouselId }.
 *
 * Twitter/Bluesky/Threads aceitam só texto. IG/FB/YT/Pinterest exigem mídia
 * — UI valida antes de submeter.
 */

interface ZernioProfileLite {
  id: string;
  name: string;
  description: string | null;
}

interface ZernioAccountLite {
  id: string;
  zernio_account_id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  status: string;
}

export type SlidePng = { index: number; dataUrl: string };

export interface ScheduleZernioModalProps {
  open: boolean;
  onClose: () => void;
  session: Session;
  /** Carousel ID (DB) — liga o post agendado ao carrossel SV. Required. */
  carouselId: string;
  /** Caption inicial — pré-preenche o textarea. */
  initialContent?: string;
  /**
   * Callback que captura os PNGs dos slides on-demand. Se null/omitido,
   * o modal só permite posts text-only (Twitter/Bluesky/Threads).
   */
  getSlidePngs?: () => Promise<SlidePng[]>;
  onScheduled?: (post: { id?: string; zernio_post_id?: string }) => void;
}

const PLATFORMS_REQUIRING_MEDIA = new Set([
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "pinterest",
  "snapchat",
]);

/** Plataformas focadas no produto (carrossel + IG/LinkedIn). Mostradas
 *  primeiro na lista de seleção. Outras viram "extras" colapsadas. */
const PRIMARY_PLATFORMS = new Set(["instagram", "linkedin"]);

export function ScheduleZernioModal({
  open,
  onClose,
  session,
  carouselId,
  initialContent = "",
  getSlidePngs,
  onScheduled,
}: ScheduleZernioModalProps) {
  const [profiles, setProfiles] = useState<ZernioProfileLite[]>([]);
  const [accounts, setAccounts] = useState<ZernioAccountLite[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [profileId, setProfileId] = useState<string>("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<"schedule" | "publishNow" | "draft">("schedule");
  // Default 1h no futuro pra evitar "now" inválido em diferenças de relógio.
  const defaultScheduled = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return formatLocalDateTime(d);
  }, []);
  const [scheduledLocal, setScheduledLocal] = useState(defaultScheduled);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "scheduling">("idle");

  // Reset content when modal reopens with different initialContent.
  useEffect(() => {
    if (open) setContent(initialContent);
  }, [open, initialContent]);

  // Carrega profiles ao abrir.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProfiles(true);
    (async () => {
      try {
        const res = await fetch("/api/zernio/profiles", { headers: jsonWithAuth(session) });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Falha");
        // Filtra profiles placeholder (`zernio_profile_id` começa com "local-")
        // — esses só existem pra satisfazer FK em planejamento Pro sem Zernio
        // conectado, não devem ser oferecidos como destino de publicação real.
        type ProfileWithExtId = ZernioProfileLite & {
          zernio_profile_id?: string;
        };
        const real: ZernioProfileLite[] = (data.profiles || []).filter(
          (p: ProfileWithExtId) =>
            !p.zernio_profile_id || !/^local-/.test(p.zernio_profile_id)
        );
        setProfiles(real);
        if (real.length === 1) setProfileId(real[0].id);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, session]);

  // Carrega contas quando profile muda.
  useEffect(() => {
    if (!profileId) {
      setAccounts([]);
      setSelectedAccountIds(new Set());
      return;
    }
    let cancelled = false;
    setLoadingAccounts(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/zernio/accounts?profileId=${encodeURIComponent(profileId)}`,
          { headers: jsonWithAuth(session) }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Falha");
        const active = (data.accounts || []).filter(
          (a: ZernioAccountLite) => a.status === "active"
        );
        setAccounts(active);
        // UX 2026-05-06: auto-seleciona contas primárias (IG/LinkedIn) ativas.
        // User raramente quer postar só em 1 quando tem ambas conectadas.
        // Antes: setSelectedAccountIds(new Set()) — forçava clique e gerava
        // toast "Selecione ao menos 1 conta" pra quem só tinha 1 plataforma.
        const autoSelect = new Set<string>(
          active
            .filter((a: ZernioAccountLite) =>
              PRIMARY_PLATFORMS.has(a.platform)
            )
            .map((a: ZernioAccountLite) => a.id)
        );
        setSelectedAccountIds(autoSelect);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, session]);

  const toggleAccount = useCallback((id: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedAccountIds.has(a.id)),
    [accounts, selectedAccountIds]
  );

  const needsMedia = useMemo(
    () => selectedAccounts.some((a) => PLATFORMS_REQUIRING_MEDIA.has(a.platform)),
    [selectedAccounts]
  );

  const onSubmit = useCallback(async () => {
    if (!profileId) return toast.error("Escolhe um profile.");
    if (selectedAccountIds.size === 0) {
      // Erro com hint claro: se user não tem conta conectada, sugere
      // adicionar como planejado em vez de tentar agendar real.
      return toast.error(
        accounts.length === 0
          ? "Nenhuma conta conectada via Zernio. Conecte em Ajustes → Zernio ou use 'Adicionar ao calendário' (Planejado)."
          : "Marque qual(is) conta(s) você quer publicar (checkbox)."
      );
    }
    if (content.trim().length === 0) return toast.error("Caption vazia.");
    if (mode === "schedule" && !scheduledLocal)
      return toast.error("Defina data/hora pra agendar.");
    if (needsMedia && !getSlidePngs) {
      return toast.error(
        "Plataforma escolhida exige mídia (IG/FB/etc), mas o componente foi montado sem captura de slides."
      );
    }

    setSubmitting(true);
    try {
      let mediaUrls: string[] = [];

      if (needsMedia && getSlidePngs) {
        setPhase("uploading");
        const slides = await getSlidePngs();
        if (slides.length === 0) {
          throw new Error("Nenhum slide capturado.");
        }
        const upRes = await fetch("/api/zernio/upload-slides", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({ carouselId, slides }),
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error || "Upload falhou.");
        mediaUrls = upData.urls;
      }

      setPhase("scheduling");
      // scheduledFor: input type=datetime-local devolve "YYYY-MM-DDTHH:MM"
      // sem segundos nem TZ. Adicionamos ":00" pra ISO simples — o Zernio
      // aceita esse formato + timezone no campo separado.
      const scheduledFor =
        mode === "schedule" ? `${scheduledLocal}:00` : undefined;

      const res = await fetch("/api/zernio/posts", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          profileId,
          accountIds: Array.from(selectedAccountIds),
          content: content.trim(),
          mediaUrls,
          mode,
          scheduledFor,
          timezone: "America/Sao_Paulo",
          carouselId,
          source: "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao agendar.");

      const platformsLabel = selectedAccounts.map((a) => a.platform).join(", ");
      toast.success(
        mode === "draft"
          ? `Rascunho salvo (${platformsLabel}).`
          : mode === "publishNow"
            ? `Publicando agora em ${platformsLabel}.`
            : `Agendado pra ${new Date(scheduledLocal).toLocaleString("pt-BR")} em ${platformsLabel}.`
      );
      onScheduled?.(data.post ?? {});
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao agendar.");
    } finally {
      setSubmitting(false);
      setPhase("idle");
    }
  }, [
    profileId,
    selectedAccountIds,
    content,
    mode,
    scheduledLocal,
    needsMedia,
    getSlidePngs,
    session,
    carouselId,
    selectedAccounts,
    onScheduled,
    onClose,
  ]);

  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <header style={modalHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              Agendar via Zernio
            </h2>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontFamily: "var(--sv-mono)",
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: "2px 6px",
                background: "var(--sv-ink)",
                color: "var(--sv-paper)",
                border: "1px solid var(--sv-ink)",
              }}
              title="Esse modal publica de verdade na rede social. Pra só marcar data sem publicar, use 'Adicionar ao calendário'."
            >
              Publica auto
            </span>
          </div>
          <button onClick={onClose} style={btnIconStyle} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: 16, display: "grid", gap: 14 }}>
          {/* Profile selector */}
          <div>
            <label style={labelStyle}>Profile</label>
            {loadingProfiles ? (
              <Loader2 className="animate-spin" size={14} />
            ) : profiles.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--sv-soft)" }}>
                Nenhum profile criado.{" "}
                <a href="/app/admin/zernio" target="_blank" rel="noreferrer">
                  Criar profile →
                </a>
              </p>
            ) : (
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Escolha...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Accounts checkbox list — IG/LinkedIn primeiro, outras em details */}
          {profileId && (
            <div>
              <label style={labelStyle}>Contas ({selectedAccountIds.size} selecionada(s))</label>
              {loadingAccounts ? (
                <Loader2 className="animate-spin" size={14} />
              ) : accounts.length === 0 ? (
                <div
                  style={{
                    padding: 12,
                    border: "1.5px solid #f59e0b",
                    background: "rgba(252, 165, 41, 0.10)",
                    fontSize: 12,
                    color: "#7a2a1a",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 4 }}>
                    Nenhuma conta conectada via Zernio.
                  </strong>
                  Conecte Instagram/LinkedIn em{" "}
                  <a
                    href="/app/zernio"
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: "underline" }}
                  >
                    Ajustes → Zernio
                  </a>
                  . Enquanto isso, use{" "}
                  <strong>&quot;Adicionar ao calendário&quot;</strong> pra só
                  marcar data sem publicar.
                </div>
              ) : (
                <>
                  {/* Primary: IG + LinkedIn */}
                  <div style={{ display: "grid", gap: 6 }}>
                    {accounts
                      .filter((a) => PRIMARY_PLATFORMS.has(a.platform))
                      .map((a) => (
                        <label
                          key={a.id}
                          style={{
                            ...accountRowStyle,
                            borderColor: "var(--sv-ink)",
                            background: "var(--sv-paper, #faf7f2)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAccountIds.has(a.id)}
                            onChange={() => toggleAccount(a.id)}
                          />
                          <span style={{ textTransform: "capitalize", fontWeight: 700 }}>
                            {a.platform}
                          </span>
                          <span style={{ color: "var(--sv-soft)" }}>
                            · {a.handle ? `@${a.handle}` : a.display_name || "—"}
                          </span>
                        </label>
                      ))}
                  </div>

                  {/* Extras */}
                  {accounts.filter((a) => !PRIMARY_PLATFORMS.has(a.platform)).length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          fontSize: 11,
                          color: "var(--sv-soft)",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Outras plataformas
                      </summary>
                      <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                        {accounts
                          .filter((a) => !PRIMARY_PLATFORMS.has(a.platform))
                          .map((a) => (
                            <label key={a.id} style={accountRowStyle}>
                              <input
                                type="checkbox"
                                checked={selectedAccountIds.has(a.id)}
                                onChange={() => toggleAccount(a.id)}
                              />
                              <span style={{ textTransform: "capitalize" }}>
                                {a.platform}
                              </span>
                              <span style={{ color: "var(--sv-soft)" }}>
                                · {a.handle ? `@${a.handle}` : a.display_name || "—"}
                              </span>
                            </label>
                          ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>
          )}

          {/* Caption */}
          <div>
            <label style={labelStyle}>Legenda</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              style={{ ...inputStyle, fontFamily: "var(--sv-sans)", resize: "vertical" }}
              placeholder="Texto do post..."
            />
            <div style={{ fontSize: 11, color: "var(--sv-soft)", marginTop: 2 }}>
              {content.length} chars
            </div>
          </div>

          {/* Mode */}
          <div>
            <label style={labelStyle}>Modo</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["schedule", "publishNow", "draft"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={mode === m ? modeBtnActive : modeBtnStyle}
                >
                  {m === "schedule" && "Agendar"}
                  {m === "publishNow" && "Publicar agora"}
                  {m === "draft" && "Salvar rascunho"}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule datetime */}
          {mode === "schedule" && (
            <div>
              <label style={labelStyle}>Data e hora (America/Sao_Paulo)</label>
              <input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Media warning */}
          {needsMedia && !getSlidePngs && (
            <div style={warningStyle}>
              ⚠️ Plataformas selecionadas (IG/FB/etc) exigem imagem. Esse modal foi
              aberto sem captura de slide — só dá pra postar texto puro.
            </div>
          )}
          {needsMedia && getSlidePngs && (
            <div style={infoStyle}>
              ℹ️ Os slides serão capturados como PNG e enviados pro Zernio na hora
              do agendamento.
            </div>
          )}
        </div>

        <footer style={modalFooterStyle}>
          <button onClick={onClose} style={btnGhostStyle} disabled={submitting}>
            Cancelar
          </button>
          <button onClick={onSubmit} style={btnPrimaryStyle} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" size={14} />}
            {!submitting && mode === "draft" && <Save size={14} />}
            {!submitting && mode === "publishNow" && <Send size={14} />}
            {!submitting && mode === "schedule" && <CalendarClock size={14} />}
            {phase === "uploading"
              ? "Enviando slides..."
              : phase === "scheduling"
                ? "Criando post..."
                : mode === "draft"
                  ? "Salvar rascunho"
                  : mode === "publishNow"
                    ? "Publicar agora"
                    : "Agendar"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatLocalDateTime(d: Date): string {
  // Returns "YYYY-MM-DDTHH:MM" (local time, sem segundos) — formato esperado
  // por <input type="datetime-local">.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "5px 5px 0 0 var(--sv-ink)",
  width: "100%",
  maxWidth: 520,
  maxHeight: "90vh",
  overflowY: "auto",
  fontFamily: "var(--sv-sans)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1.5px solid var(--sv-ink)",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "12px 16px",
  borderTop: "1.5px solid var(--sv-ink)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 4,
  color: "var(--sv-ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  border: "1.5px solid var(--sv-ink)",
  fontSize: 14,
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
};

const accountRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  padding: 6,
  border: "1px solid var(--sv-soft)",
  cursor: "pointer",
};

const modeBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1.5px solid var(--sv-ink)",
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const modeBtnActive: React.CSSProperties = {
  ...modeBtnStyle,
  background: "var(--sv-ink)",
  color: "var(--sv-white)",
};

const btnPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 14px",
  background: "var(--sv-ink)",
  color: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const btnGhostStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const btnIconStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 4,
  color: "var(--sv-ink)",
};

const warningStyle: React.CSSProperties = {
  padding: 10,
  background: "rgba(252, 165, 41, 0.15)",
  border: "1.5px solid #f59e0b",
  fontSize: 12,
  color: "#92400e",
};

const infoStyle: React.CSSProperties = {
  padding: 10,
  background: "rgba(99, 102, 241, 0.08)",
  border: "1.5px solid var(--sv-ink)",
  fontSize: 12,
};
