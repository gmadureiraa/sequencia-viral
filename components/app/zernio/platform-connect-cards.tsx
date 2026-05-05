"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Instagram,
  Linkedin,
  Loader2,
  Plug,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * <PlatformConnectCards>: cards de conexão Instagram + LinkedIn via Zernio.
 *
 * Fluxo:
 *   1. Lista contas active do user (auto-cria profile Zernio interno se
 *      não existe, no primeiro click "Conectar").
 *   2. Cada plataforma tem 1 card:
 *      - Conectado: mostra @handle, data, botão "Reconectar"
 *      - Não conectado: botão "Conectar X" → abre OAuth em nova aba
 *   3. Botão "Sincronizar" no header — puxa updates do Zernio (ex: usuário
 *      desconectou direto no Zernio, ou conta nova apareceu).
 *
 * Uso:
 *   <PlatformConnectCards session={session} />
 *
 * Plugado em 2 lugares:
 *   - /app/zernio (página principal Zernio)
 *   - /app/settings aba Redes (conexão inline)
 */

type AccountStatus = "active" | "disconnected" | "needs_reauth";

interface Account {
  id: string;
  zernio_account_id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  status: AccountStatus;
  connected_at: string;
}

const FOCUS_PLATFORMS = ["instagram", "linkedin"] as const;
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "var(--sv-pink, #D262B2)",
  linkedin: "var(--sv-yellow, #F5C518)",
};

export interface PlatformConnectCardsProps {
  session: Session;
  /** Tamanho dos cards. "lg" = página dedicada, "md" = inline em settings. */
  size?: "lg" | "md";
  /** Callback opcional após conexão bem-sucedida (refetch externo). */
  onChange?: () => void;
}

export function PlatformConnectCards({
  session,
  size = "lg",
  onChange,
}: PlatformConnectCardsProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zernio/accounts", {
        headers: jsonWithAuth(session),
      });
      if (res.ok) setAccounts((await res.json()).accounts || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const onConnect = useCallback(
    async (platform: string) => {
      setConnecting(platform);
      try {
        const res = await fetch(`/api/zernio/connect/${platform}`, {
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        window.open(data.authUrl, "_blank", "noopener,noreferrer");
        toast.info(
          "Autorize na nova aba. Volta aqui e clica Sincronizar quando terminar."
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setConnecting(null);
      }
    },
    [session]
  );

  const onSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/zernio/accounts/sync", {
        method: "POST",
        headers: jsonWithAuth(session),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      const synced = data.synced ?? 0;
      const disc = data.disconnected ?? 0;
      if (synced > 0) toast.success(`${synced} conta(s) sincronizada(s).`);
      else if (disc > 0) toast.warning(`${disc} conta(s) desconectada(s).`);
      else toast.info("Tudo já está atualizado.");
      await fetchAccounts();
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSyncing(false);
    }
  }, [session, fetchAccounts, onChange]);

  const accountByPlatform = (platform: string): Account | undefined =>
    accounts.find((a) => a.platform === platform && a.status === "active");

  const isMd = size === "md";

  return (
    <div>
      {/* Sync header — discreto */}
      <div
        className="flex items-center justify-between mb-3"
        style={{ gap: 8 }}
      >
        <span
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--sv-muted, #666)",
            fontWeight: 700,
          }}
        >
          {accounts.filter((a) => a.status === "active").length} conta(s)
          conectada(s)
        </span>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing || loading}
          className="sv-btn sv-btn-outline"
          style={{ padding: "6px 12px", fontSize: 9.5 }}
        >
          <RefreshCw
            size={11}
            className={syncing || loading ? "animate-spin" : ""}
          />
          Sincronizar
        </button>
      </div>

      {/* Grid de cards */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: isMd
            ? "repeat(auto-fit, minmax(240px, 1fr))"
            : "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        {FOCUS_PLATFORMS.map((platform) => {
          const account = accountByPlatform(platform);
          const isConnected = !!account;
          const Icon = platform === "instagram" ? Instagram : Linkedin;
          const accent = PLATFORM_COLORS[platform];
          const handle = account?.handle ?? account?.display_name ?? "—";
          return (
            <article
              key={platform}
              className="sv-card"
              style={{
                padding: isMd ? 16 : 22,
                background: isConnected ? accent : "var(--sv-white)",
              }}
            >
              <div
                className="flex items-center gap-3 mb-3"
                style={isMd ? { gap: 10 } : undefined}
              >
                <div
                  style={{
                    width: isMd ? 40 : 52,
                    height: isMd ? 40 : 52,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid var(--sv-ink)",
                    background: isConnected
                      ? "var(--sv-ink)"
                      : "var(--sv-paper)",
                    color: isConnected ? "var(--sv-paper)" : "var(--sv-ink)",
                    boxShadow: "2px 2px 0 0 var(--sv-ink)",
                  }}
                >
                  <Icon size={isMd ? 18 : 22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4
                    className="sv-display"
                    style={{
                      fontSize: isMd ? 18 : 24,
                      lineHeight: 1.05,
                      margin: 0,
                    }}
                  >
                    {platform === "instagram" ? "Instagram" : "LinkedIn"}
                  </h4>
                  {isConnected ? (
                    <div
                      className="inline-flex items-center gap-1"
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: isMd ? 10 : 11,
                        fontWeight: 700,
                        color: "var(--sv-ink)",
                        marginTop: 2,
                      }}
                    >
                      <CheckCircle2 size={isMd ? 10 : 11} />@
                      {handle}
                    </div>
                  ) : (
                    <div
                      className="inline-flex items-center gap-1"
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: isMd ? 10 : 11,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--sv-muted, #555)",
                        marginTop: 2,
                      }}
                    >
                      <Plug size={isMd ? 10 : 11} /> Não conectado
                    </div>
                  )}
                </div>
              </div>

              {isConnected ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 10,
                      color: "var(--sv-muted, #666)",
                    }}
                  >
                    Conectado em{" "}
                    {new Date(account!.connected_at).toLocaleDateString("pt-BR")}
                  </div>
                  <button
                    onClick={() => onConnect(platform)}
                    className="sv-btn sv-btn-outline"
                    disabled={connecting === platform}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: 9.5,
                    }}
                  >
                    {connecting === platform ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <RefreshCw size={11} />
                    )}
                    Reconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onConnect(platform)}
                  className="sv-btn sv-btn-ink"
                  disabled={connecting === platform}
                  style={{
                    width: "100%",
                    padding: isMd ? "10px 14px" : "12px 16px",
                    fontSize: isMd ? 10 : 11,
                  }}
                >
                  {connecting === platform ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Plug size={12} />
                  )}
                  Conectar {platform === "instagram" ? "Instagram" : "LinkedIn"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
