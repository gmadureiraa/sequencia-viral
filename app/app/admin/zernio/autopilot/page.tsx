"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  Pencil,
  Play,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Rocket,
  Rss,
  Save,
  Trash2,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio/autopilot — Piloto Auto v2.
 *
 * Triggers (gatilhos) que disparam geração de carrossel + post automático.
 *
 * 3 tipos:
 *  - schedule: cadência baseada em tempo (daily, every_n_days, etc).
 *  - rss:      poll URL RSS, dispara quando aparece nova entrada.
 *  - webhook:  endpoint público com secret pra Zapier/Make/n8n disparar.
 *
 * Plataformas: IG + LinkedIn (multi-checkbox, default ambas).
 */

type TriggerType = "schedule" | "rss" | "webhook";
type CadenceType = "daily" | "every_n_days" | "weekly_dow" | "specific_dates";
type PublishMode = "scheduled" | "draft" | "publish_now";

interface Trigger {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: TriggerType;
  themes: string[];
  editorial_line: string;
  niche: string | null;
  target_platforms: string[];
  publish_mode: PublishMode;
  // schedule
  cadence_type: CadenceType | null;
  interval_days: number | null;
  days_of_week: number[] | null;
  specific_dates: string[] | null;
  publish_hour: number;
  publish_minute: number;
  timezone: string;
  next_run_at: string | null;
  // rss
  rss_url: string | null;
  rss_check_interval_minutes: number;
  rss_last_checked_at: string | null;
  rss_max_items_per_check: number;
  // webhook
  webhook_secret: string | null;
  // meta
  last_fired_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface Run {
  id: string;
  trigger_id: string;
  fired_at: string;
  fired_by: string;
  status: string;
  theme_chosen: string | null;
  error: string | null;
}

const TRIGGER_TYPE_META: Record<TriggerType, { label: string; icon: typeof Clock; desc: string; color: string }> = {
  schedule: {
    label: "Agendado",
    icon: Clock,
    desc: "Dispara em cadência fixa (todo dia, semanal, datas específicas)",
    color: "#3b82f6",
  },
  rss: {
    label: "RSS Feed",
    icon: Rss,
    desc: "Toda vez que aparece um item novo num feed RSS",
    color: "#f97316",
  },
  webhook: {
    label: "Webhook",
    icon: Webhook,
    desc: "Endpoint público pra Zapier / Make / n8n disparar manualmente",
    color: "#a855f7",
  },
};

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ZernioAutopilotPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningNowFor, setRunningNowFor] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [fType, setFType] = useState<TriggerType>("schedule");
  const [fName, setFName] = useState("");
  const [fThemes, setFThemes] = useState("");
  const [fEditorial, setFEditorial] = useState("");
  const [fNiche, setFNiche] = useState("");
  const [fPlatforms, setFPlatforms] = useState<Set<string>>(
    new Set(["instagram", "linkedin"])
  );
  const [fPublishMode, setFPublishMode] = useState<PublishMode>("scheduled");
  // schedule
  const [fCadence, setFCadence] = useState<CadenceType>("every_n_days");
  const [fInterval, setFInterval] = useState(3);
  const [fDays, setFDays] = useState<number[]>([1, 3, 5]);
  const [fSpecificDates, setFSpecificDates] = useState("");
  const [fHour, setFHour] = useState(9);
  const [fMinute, setFMinute] = useState(0);
  // rss
  const [fRssUrl, setFRssUrl] = useState("");
  const [fRssIntervalMin, setFRssIntervalMin] = useState(60);
  const [fRssMaxItems, setFRssMaxItems] = useState(1);

  // Runs (lazy)
  const [openRunsFor, setOpenRunsFor] = useState<string | null>(null);
  const [runsByTrigger, setRunsByTrigger] = useState<Record<string, Run[]>>({});
  const [loadingRunsFor, setLoadingRunsFor] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) router.replace("/app");
  }, [user, authLoading, router]);

  const fetchTriggers = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/zernio/triggers", { headers: jsonWithAuth(session) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      setTriggers(data.triggers || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchTriggers();
  }, [session, fetchTriggers]);

  function resetForm() {
    setEditingId(null);
    setFType("schedule");
    setFName("");
    setFThemes("");
    setFEditorial("");
    setFNiche("");
    setFPlatforms(new Set(["instagram", "linkedin"]));
    setFPublishMode("scheduled");
    setFCadence("every_n_days");
    setFInterval(3);
    setFDays([1, 3, 5]);
    setFSpecificDates("");
    setFHour(9);
    setFMinute(0);
    setFRssUrl("");
    setFRssIntervalMin(60);
    setFRssMaxItems(1);
  }

  function openEdit(t: Trigger) {
    setEditingId(t.id);
    setFType(t.trigger_type);
    setFName(t.name);
    setFThemes(t.themes.join("\n"));
    setFEditorial(t.editorial_line);
    setFNiche(t.niche ?? "");
    setFPlatforms(new Set(t.target_platforms));
    setFPublishMode(t.publish_mode);
    if (t.trigger_type === "schedule") {
      setFCadence(t.cadence_type || "every_n_days");
      setFInterval(t.interval_days ?? 3);
      setFDays(t.days_of_week ?? [1, 3, 5]);
      setFSpecificDates((t.specific_dates ?? []).join(", "));
      setFHour(t.publish_hour);
      setFMinute(t.publish_minute);
    } else if (t.trigger_type === "rss") {
      setFRssUrl(t.rss_url ?? "");
      setFRssIntervalMin(t.rss_check_interval_minutes);
      setFRssMaxItems(t.rss_max_items_per_check);
    }
    setShowForm(true);
    setTimeout(() => {
      document.querySelector("[data-trigger-form]")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  const onSubmit = useCallback(async () => {
    if (!session) return;
    if (!fName.trim()) return toast.error("Nome obrigatório.");
    if (fPlatforms.size === 0)
      return toast.error("Escolha pelo menos 1 plataforma.");
    const themesList = fThemes
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (fType !== "rss" && themesList.length === 0) {
      return toast.error("Adicione pelo menos 1 tema.");
    }
    if (fType === "rss" && !fRssUrl.trim()) {
      return toast.error("RSS URL obrigatório.");
    }

    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: fName.trim(),
        triggerType: fType,
        themes: themesList,
        editorialLine: fEditorial.trim(),
        niche: fNiche.trim() || undefined,
        tone: "editorial",
        language: "pt-br",
        designTemplate: "twitter",
        targetPlatforms: Array.from(fPlatforms),
        publishMode: fPublishMode,
      };

      if (fType === "schedule") {
        payload.cadenceType = fCadence;
        if (fCadence === "every_n_days") payload.intervalDays = fInterval;
        if (fCadence === "weekly_dow") payload.daysOfWeek = fDays;
        if (fCadence === "specific_dates") {
          payload.specificDates = fSpecificDates
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
        }
        payload.publishHour = fHour;
        payload.publishMinute = fMinute;
        payload.timezone = "America/Sao_Paulo";
      } else if (fType === "rss") {
        payload.rssUrl = fRssUrl.trim();
        payload.rssCheckIntervalMinutes = fRssIntervalMin;
        payload.rssMaxItemsPerCheck = fRssMaxItems;
      }

      let res;
      if (editingId) {
        // PATCH usa snake_case (DB column names)
        const patchPayload: Record<string, unknown> = {
          name: payload.name,
          themes: payload.themes,
          editorial_line: payload.editorialLine,
          niche: payload.niche,
          target_platforms: payload.targetPlatforms,
          publish_mode: payload.publishMode,
        };
        if (fType === "schedule") {
          patchPayload.cadence_type = payload.cadenceType;
          patchPayload.interval_days = payload.intervalDays;
          patchPayload.days_of_week = payload.daysOfWeek;
          patchPayload.specific_dates = payload.specificDates;
          patchPayload.publish_hour = payload.publishHour;
          patchPayload.publish_minute = payload.publishMinute;
        } else if (fType === "rss") {
          patchPayload.rss_url = payload.rssUrl;
          patchPayload.rss_check_interval_minutes = payload.rssCheckIntervalMinutes;
          patchPayload.rss_max_items_per_check = payload.rssMaxItemsPerCheck;
        }
        res = await fetch(`/api/zernio/triggers/${editingId}`, {
          method: "PATCH",
          headers: jsonWithAuth(session),
          body: JSON.stringify(patchPayload),
        });
      } else {
        res = await fetch("/api/zernio/triggers", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      toast.success(`Trigger "${data.trigger.name}" ${editingId ? "atualizado" : "criado"}.`);
      setShowForm(false);
      resetForm();
      await fetchTriggers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setCreating(false);
    }
  }, [
    session,
    editingId,
    fName,
    fType,
    fThemes,
    fEditorial,
    fNiche,
    fPlatforms,
    fPublishMode,
    fCadence,
    fInterval,
    fDays,
    fSpecificDates,
    fHour,
    fMinute,
    fRssUrl,
    fRssIntervalMin,
    fRssMaxItems,
    fetchTriggers,
  ]);

  const onToggle = useCallback(
    async (t: Trigger) => {
      if (!session) return;
      try {
        const res = await fetch(`/api/zernio/triggers/${t.id}`, {
          method: "PATCH",
          headers: jsonWithAuth(session),
          body: JSON.stringify({ is_active: !t.is_active }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Falha");
        toast.success(t.is_active ? "Pausado." : "Ativado.");
        await fetchTriggers();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [session, fetchTriggers]
  );

  const onDelete = useCallback(
    async (id: string) => {
      if (!session) return;
      if (!confirm("Deletar esse gatilho? Histórico de runs vai junto.")) return;
      try {
        const res = await fetch(`/api/zernio/triggers/${id}`, {
          method: "DELETE",
          headers: jsonWithAuth(session),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Falha");
        toast.success("Deletado.");
        await fetchTriggers();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [session, fetchTriggers]
  );

  const onRunNow = useCallback(
    async (id: string) => {
      if (!session) return;
      if (!confirm("Disparar AGORA? Vai gerar carrossel + agendar/postar.")) return;
      setRunningNowFor(id);
      try {
        const res = await fetch(`/api/zernio/triggers/${id}/run-now`, {
          method: "POST",
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        if (data.status === "scheduled") toast.success("Agendado.");
        else toast.warning(`${data.status}${data.detail ? `: ${data.detail}` : ""}`);
        setRunsByTrigger((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await fetchTriggers();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setRunningNowFor(null);
      }
    },
    [session, fetchTriggers]
  );

  const toggleRuns = useCallback(
    async (id: string) => {
      if (openRunsFor === id) {
        setOpenRunsFor(null);
        return;
      }
      setOpenRunsFor(id);
      if (runsByTrigger[id] || !session) return;
      setLoadingRunsFor(id);
      try {
        const res = await fetch(
          `/api/zernio/autopilot/runs?triggerId=${encodeURIComponent(id)}&limit=20`,
          { headers: jsonWithAuth(session) }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        setRunsByTrigger((prev) => ({ ...prev, [id]: data.runs || [] }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setLoadingRunsFor(null);
      }
    },
    [session, openRunsFor, runsByTrigger]
  );

  const webhookUrl = useCallback(
    (t: Trigger) =>
      typeof window !== "undefined" && t.webhook_secret
        ? `${window.location.origin}/api/zernio/triggers/${t.id}/fire?secret=${t.webhook_secret}`
        : "",
    []
  );

  const focusedTriggers = useMemo(
    () => triggers.filter((t) => t.is_active),
    [triggers]
  );
  const inactiveTriggers = useMemo(
    () => triggers.filter((t) => !t.is_active),
    [triggers]
  );

  if (authLoading || !user) {
    return (
      <div style={containerStyle}>
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Link href="/app/admin/zernio" style={backLinkStyle}>
        <ArrowLeft size={14} /> Voltar
      </Link>

      <header style={heroStyle}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <span style={kickerStyle}>
            <Rocket size={11} /> Piloto Auto · Gatilhos
          </span>
          <h1 style={titleStyle}>
            Postar no <em>automático</em>.
          </h1>
          <p style={subtitleStyle}>
            Configure um gatilho (tempo, RSS feed ou webhook). A IA gera o
            carrossel no seu DNA e posta no Instagram + LinkedIn sem você
            levantar um dedo.
          </p>
        </div>
        <button onClick={fetchTriggers} style={btnGhost} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </header>

      {/* TIPOS DE GATILHO */}
      {!showForm && (
        <section style={typeCardsGridStyle}>
          {(Object.keys(TRIGGER_TYPE_META) as TriggerType[]).map((type) => {
            const meta = TRIGGER_TYPE_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                onClick={() => {
                  resetForm();
                  setFType(type);
                  setShowForm(true);
                }}
                style={{ ...typeCardStyle, borderColor: meta.color }}
              >
                <div
                  style={{
                    ...typeCardIcon,
                    background: meta.color,
                    color: "#fff",
                  }}
                >
                  <Icon size={22} />
                </div>
                <div style={typeCardTitle}>{meta.label}</div>
                <div style={typeCardDesc}>{meta.desc}</div>
                <div style={typeCardCTA}>
                  <Plus size={12} /> Criar gatilho
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* FORM */}
      {showForm && (
        <section style={formCardStyle} data-trigger-form>
          <div style={formHeaderStyle}>
            <h2 style={h2Style}>
              {editingId ? "Editar gatilho" : "Novo gatilho"} —{" "}
              <span style={{ color: TRIGGER_TYPE_META[fType].color }}>
                {TRIGGER_TYPE_META[fType].label}
              </span>
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              style={btnGhost}
            >
              Cancelar
            </button>
          </div>

          {/* Tipo (só na criação) */}
          {!editingId && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tipo</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(Object.keys(TRIGGER_TYPE_META) as TriggerType[]).map((t) => {
                  const meta = TRIGGER_TYPE_META[t];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFType(t)}
                      style={{
                        ...typeChipStyle,
                        background: fType === t ? meta.color : "transparent",
                        color: fType === t ? "#fff" : "var(--sv-ink)",
                        borderColor: meta.color,
                      }}
                    >
                      <Icon size={12} /> {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            <FormField label="Nome do gatilho">
              <input
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="Ex: Posts diários sobre marketing"
                style={inputStyle}
              />
            </FormField>

            <FormField
              label={
                fType === "rss"
                  ? "Temas fallback (opcional — se RSS estiver vazio, sorteia daqui)"
                  : "Temas (1 por linha — IA sorteia um a cada disparo)"
              }
            >
              <textarea
                value={fThemes}
                onChange={(e) => setFThemes(e.target.value)}
                rows={4}
                placeholder={
                  "Marketing pra agência B2B\nIA aplicada a redes sociais\nFunil de conteúdo orgânico"
                }
                style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--sv-sans)" }}
              />
            </FormField>

            <FormField label="Linha editorial / voz (opcional)">
              <textarea
                value={fEditorial}
                onChange={(e) => setFEditorial(e.target.value)}
                rows={3}
                placeholder="Ex: tom direto, exemplos concretos, primeira pessoa"
                style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--sv-sans)" }}
              />
            </FormField>

            <FormField label="Nicho (opcional)">
              <input
                value={fNiche}
                onChange={(e) => setFNiche(e.target.value)}
                placeholder="Ex: marketing, cripto, finance"
                style={inputStyle}
              />
            </FormField>

            <FormField label={`Plataformas alvo (${fPlatforms.size})`}>
              <div style={{ display: "flex", gap: 8 }}>
                {(["instagram", "linkedin"] as const).map((p) => {
                  const active = fPlatforms.has(p);
                  const accent = p === "instagram" ? "#E4405F" : "#0A66C2";
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setFPlatforms((prev) => {
                          const next = new Set(prev);
                          if (next.has(p)) next.delete(p);
                          else next.add(p);
                          return next;
                        });
                      }}
                      style={{
                        ...platformChipStyle,
                        background: active ? accent : "transparent",
                        color: active ? "#fff" : "var(--sv-ink)",
                        borderColor: accent,
                      }}
                    >
                      {p === "instagram" ? "Instagram" : "LinkedIn"}
                    </button>
                  );
                })}
              </div>
            </FormField>

            {/* SCHEDULE specific */}
            {fType === "schedule" && (
              <>
                <FormField label="Cadência">
                  <select
                    value={fCadence}
                    onChange={(e) => setFCadence(e.target.value as CadenceType)}
                    style={inputStyle}
                  >
                    <option value="daily">Todo dia</option>
                    <option value="every_n_days">A cada N dias</option>
                    <option value="weekly_dow">Dias da semana específicos</option>
                    <option value="specific_dates">Datas específicas</option>
                  </select>
                </FormField>

                {fCadence === "every_n_days" && (
                  <FormField label="Intervalo (dias)">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={fInterval}
                      onChange={(e) => setFInterval(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </FormField>
                )}

                {fCadence === "weekly_dow" && (
                  <FormField label="Dias da semana">
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {DOW_LABELS.map((label, i) => {
                        const on = fDays.includes(i);
                        return (
                          <button
                            type="button"
                            key={i}
                            onClick={() =>
                              setFDays((prev) =>
                                prev.includes(i)
                                  ? prev.filter((d) => d !== i)
                                  : [...prev, i]
                              )
                            }
                            style={{
                              ...dowBtn,
                              background: on ? "var(--sv-ink)" : "transparent",
                              color: on ? "#fff" : "var(--sv-ink)",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </FormField>
                )}

                {fCadence === "specific_dates" && (
                  <FormField label="Datas (YYYY-MM-DD, separadas por vírgula)">
                    <textarea
                      value={fSpecificDates}
                      onChange={(e) => setFSpecificDates(e.target.value)}
                      rows={2}
                      placeholder="2026-05-15, 2026-05-22, 2026-06-01"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </FormField>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <FormField label="Hora">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={fHour}
                      onChange={(e) => setFHour(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Minuto">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={fMinute}
                      onChange={(e) => setFMinute(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Timezone">
                    <input value="America/Sao_Paulo" disabled style={inputStyle} />
                  </FormField>
                </div>
              </>
            )}

            {/* RSS specific */}
            {fType === "rss" && (
              <>
                <FormField label="URL do RSS feed">
                  <input
                    type="url"
                    value={fRssUrl}
                    onChange={(e) => setFRssUrl(e.target.value)}
                    placeholder="https://exemplo.com/feed.xml"
                    style={inputStyle}
                  />
                </FormField>
                <div style={{ display: "flex", gap: 8 }}>
                  <FormField label="Verificar a cada (min)">
                    <input
                      type="number"
                      min={15}
                      max={1440}
                      value={fRssIntervalMin}
                      onChange={(e) => setFRssIntervalMin(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Itens novos por check">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={fRssMaxItems}
                      onChange={(e) => setFRssMaxItems(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </FormField>
                </div>
                <div style={infoBoxStyle}>
                  <Rss size={13} />
                  <span>
                    Quando aparecer item novo no feed, o título vira o tema do
                    carrossel. Limite Hobby: cron diário, então mín 60min entre
                    checks.
                  </span>
                </div>
              </>
            )}

            {/* WEBHOOK specific */}
            {fType === "webhook" && !editingId && (
              <div style={infoBoxStyle}>
                <Webhook size={13} />
                <span>
                  Após criar, vamos gerar uma URL única com secret pra você usar
                  no Zapier / Make / n8n. Toda chamada POST nessa URL dispara
                  geração + post imediato.
                </span>
              </div>
            )}

            {/* Modo de publicação */}
            {fType !== "webhook" && (
              <FormField label="Modo de publicação">
                <div style={{ display: "flex", gap: 8 }}>
                  {(["scheduled", "draft"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFPublishMode(m)}
                      style={{
                        ...modeBtn,
                        background: fPublishMode === m ? "var(--sv-ink)" : "transparent",
                        color: fPublishMode === m ? "#fff" : "var(--sv-ink)",
                      }}
                    >
                      {m === "scheduled" ? "Agendar e publicar" : "Salvar rascunho"}
                    </button>
                  ))}
                </div>
              </FormField>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={btnGhost}
              >
                Cancelar
              </button>
              <button onClick={onSubmit} disabled={creating} style={btnPrimary}>
                {creating ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : editingId ? (
                  <Save size={14} />
                ) : (
                  <Plus size={14} />
                )}
                {editingId ? "Salvar" : "Criar gatilho"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* LISTA DE TRIGGERS */}
      <section style={{ marginTop: 24 }}>
        <h2 style={h2Style}>
          Gatilhos ativos ({focusedTriggers.length})
        </h2>
        {loading ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : focusedTriggers.length === 0 ? (
          <p style={emptyStateStyle}>
            Nenhum gatilho ativo. Crie um nos cards acima pra começar.
          </p>
        ) : (
          <ul style={triggerListStyle}>
            {focusedTriggers.map((t) =>
              renderTriggerCard(
                t,
                {
                  webhookUrl,
                  onEdit: openEdit,
                  onToggle,
                  onDelete,
                  onRunNow,
                  toggleRuns,
                  runningNowFor,
                  openRunsFor,
                  runsByTrigger,
                  loadingRunsFor,
                }
              )
            )}
          </ul>
        )}

        {inactiveTriggers.length > 0 && (
          <details style={{ marginTop: 18 }}>
            <summary style={historyToggleStyle}>
              Pausados ({inactiveTriggers.length})
            </summary>
            <ul style={triggerListStyle}>
              {inactiveTriggers.map((t) =>
                renderTriggerCard(t, {
                  webhookUrl,
                  onEdit: openEdit,
                  onToggle,
                  onDelete,
                  onRunNow,
                  toggleRuns,
                  runningNowFor,
                  openRunsFor,
                  runsByTrigger,
                  loadingRunsFor,
                })
              )}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

interface CardHandlers {
  webhookUrl: (t: Trigger) => string;
  onEdit: (t: Trigger) => void;
  onToggle: (t: Trigger) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRunNow: (id: string) => Promise<void>;
  toggleRuns: (id: string) => Promise<void>;
  runningNowFor: string | null;
  openRunsFor: string | null;
  runsByTrigger: Record<string, Run[]>;
  loadingRunsFor: string | null;
}

function renderTriggerCard(t: Trigger, h: CardHandlers): React.ReactNode {
  const meta = TRIGGER_TYPE_META[t.trigger_type];
  const Icon = meta.icon;
  const isOpen = h.openRunsFor === t.id;
  const runs = h.runsByTrigger[t.id] ?? [];

  let cadenceLabel = "";
  if (t.trigger_type === "schedule") {
    if (t.cadence_type === "daily") cadenceLabel = "Diário";
    else if (t.cadence_type === "every_n_days")
      cadenceLabel = `A cada ${t.interval_days} dias`;
    else if (t.cadence_type === "weekly_dow")
      cadenceLabel = (t.days_of_week ?? [])
        .map((d) => DOW_LABELS[d])
        .join("/");
    else if (t.cadence_type === "specific_dates")
      cadenceLabel = `${(t.specific_dates ?? []).length} datas específicas`;
  } else if (t.trigger_type === "rss") {
    cadenceLabel = `RSS check a cada ${t.rss_check_interval_minutes}min`;
  } else if (t.trigger_type === "webhook") {
    cadenceLabel = "Disparo via webhook";
  }

  return (
    <li key={t.id} style={triggerCardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            ...triggerIconStyle,
            background: meta.color,
          }}
        >
          <Icon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15 }}>{t.name}</strong>
            <span style={{ ...miniBadge, background: meta.color, color: "#fff" }}>
              {meta.label}
            </span>
            {!t.is_active && (
              <span style={{ ...miniBadge, background: "#9ca3af", color: "#fff" }}>
                Pausado
              </span>
            )}
            <span style={{ ...miniBadge, background: "#f3f4f6", color: "#374151" }}>
              {t.target_platforms.join(" + ")}
            </span>
          </div>
          <div style={metaLineStyle}>{cadenceLabel}</div>
          <div style={metaLineStyle}>
            {t.next_run_at && (
              <>
                Próximo:{" "}
                <strong>
                  {new Date(t.next_run_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                {" · "}
              </>
            )}
            {t.last_fired_at && (
              <>Último disparo: {new Date(t.last_fired_at).toLocaleString("pt-BR")}</>
            )}
            {!t.next_run_at && !t.last_fired_at && (
              <span style={{ fontStyle: "italic" }}>Nunca disparado</span>
            )}
          </div>

          {/* Webhook URL display */}
          {t.trigger_type === "webhook" && t.webhook_secret && (
            <WebhookUrlBox url={h.webhookUrl(t)} />
          )}

          {t.last_error && <div style={errorBoxStyle}>Último erro: {t.last_error}</div>}

          <button
            type="button"
            onClick={() => h.toggleRuns(t.id)}
            style={runsToggleStyle}
          >
            <ChevronDown
              size={11}
              style={{
                transform: isOpen ? "rotate(180deg)" : "rotate(0)",
                transition: "transform 0.15s",
              }}
            />
            Histórico de runs
          </button>
          {isOpen && (
            <div style={runsBoxStyle}>
              {h.loadingRunsFor === t.id ? (
                <Loader2 className="animate-spin" size={12} />
              ) : runs.length === 0 ? (
                <p style={{ fontSize: 11, color: "var(--sv-soft, #888)" }}>
                  Nenhum run ainda.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {runs.map((r) => (
                    <li key={r.id} style={runItemStyle}>
                      <span style={runStatusBadge(r.status)}>{r.status}</span>
                      <span style={{ fontSize: 11, color: "var(--sv-soft, #888)" }}>
                        {new Date(r.fired_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--sv-soft, #888)" }}>
                        ({r.fired_by})
                      </span>
                      {r.theme_chosen && (
                        <span style={{ fontSize: 11, fontStyle: "italic" }}>
                          {r.theme_chosen.slice(0, 60)}
                        </span>
                      )}
                      {r.error && (
                        <span style={{ fontSize: 10, color: "#7f1d1d" }}>
                          {r.error.slice(0, 80)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <button
            onClick={() => h.onRunNow(t.id)}
            style={btnIconStyle}
            disabled={h.runningNowFor === t.id}
            title="Disparar agora"
          >
            {h.runningNowFor === t.id ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Play size={14} />
            )}
          </button>
          <button onClick={() => h.onEdit(t)} style={btnIconStyle} title="Editar">
            <Pencil size={14} />
          </button>
          <button
            onClick={() => h.onToggle(t)}
            style={btnIconStyle}
            title={t.is_active ? "Pausar" : "Ativar"}
          >
            {t.is_active ? <PowerOff size={14} /> : <Power size={14} />}
          </button>
          <button onClick={() => h.onDelete(t.id)} style={btnIconStyle} title="Deletar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </li>
  );
}

function WebhookUrlBox({ url }: { url: string }) {
  return (
    <div style={webhookBoxStyle}>
      <Webhook size={11} />
      <code style={{ flex: 1, fontSize: 10, fontFamily: "monospace", wordBreak: "break-all" }}>
        {url}
      </code>
      <button
        type="button"
        style={btnGhostMini}
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast.success("URL copiada.");
        }}
      >
        <Copy size={10} /> Copiar
      </button>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function runStatusBadge(status: string): React.CSSProperties {
  const colors: Record<string, string> = {
    pending: "#9ca3af",
    generating: "#f59e0b",
    scheduled: "#3b82f6",
    failed: "#ef4444",
    skipped: "#6b7280",
  };
  return {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "1px 5px",
    background: colors[status] ?? "#9ca3af",
    color: "#fff",
    textTransform: "uppercase",
  };
}

// ────────────────────────────── STYLES ──────────────────────────────

const containerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: 24,
  fontFamily: "var(--sv-sans)",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  color: "var(--sv-soft, #6b6b6b)",
  textDecoration: "none",
  marginBottom: 12,
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 24,
  flexWrap: "wrap",
};

const kickerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--sv-mono)",
  fontSize: 9.5,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#a855f7",
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  fontSize: "clamp(34px, 5.5vw, 50px)",
  fontWeight: 800,
  margin: "8px 0 4px",
  letterSpacing: "-0.025em",
  lineHeight: 1.02,
  fontFamily: "var(--sv-display, Georgia, serif)",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--sv-muted, #555)",
  margin: 0,
  maxWidth: 520,
};

const h2Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: 0,
  letterSpacing: "-0.01em",
};

const typeCardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginBottom: 24,
};

const typeCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 10,
  padding: 18,
  background: "var(--sv-white)",
  border: "1.5px solid",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  cursor: "pointer",
  textAlign: "left",
  transition: "transform 0.12s, box-shadow 0.12s",
  fontFamily: "inherit",
  color: "inherit",
};

const typeCardIcon: React.CSSProperties = {
  width: 46,
  height: 46,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1.5px solid var(--sv-ink)",
};

const typeCardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: "-0.01em",
};

const typeCardDesc: React.CSSProperties = {
  fontSize: 12,
  color: "var(--sv-soft, #6b6b6b)",
  lineHeight: 1.4,
};

const typeCardCTA: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--sv-ink)",
  marginTop: "auto",
};

const formCardStyle: React.CSSProperties = {
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "5px 5px 0 0 var(--sv-ink)",
  padding: 22,
};

const formHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 18,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 5,
  color: "var(--sv-ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  border: "1.5px solid var(--sv-ink)",
  fontSize: 13,
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  fontFamily: "var(--sv-sans)",
};

const typeChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 12px",
  border: "1.5px solid",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const platformChipStyle: React.CSSProperties = {
  padding: "8px 14px",
  border: "1.5px solid",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  flex: 1,
};

const dowBtn: React.CSSProperties = {
  padding: "6px 10px",
  border: "1.5px solid var(--sv-ink)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const modeBtn: React.CSSProperties = {
  padding: "8px 14px",
  border: "1.5px solid var(--sv-ink)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  flex: 1,
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 14px",
  background: "var(--sv-ink)",
  color: "#fff",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const btnGhostMini: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "3px 6px",
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  border: "1px solid var(--sv-ink)",
  fontWeight: 600,
  fontSize: 9,
  cursor: "pointer",
};

const btnIconStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1px solid var(--sv-ink)",
  padding: 5,
  cursor: "pointer",
};

const triggerListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const triggerCardStyle: React.CSSProperties = {
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  padding: 14,
};

const triggerIconStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1.5px solid var(--sv-ink)",
  color: "#fff",
  flexShrink: 0,
};

const miniBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const metaLineStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--sv-soft, #6b6b6b)",
  marginTop: 3,
};

const webhookBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: 8,
  background: "rgba(168, 85, 247, 0.08)",
  border: "1px solid #a855f7",
  marginTop: 8,
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 6,
  padding: 6,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1px solid #ef4444",
  fontSize: 11,
  color: "#7f1d1d",
};

const runsToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginTop: 8,
  padding: "3px 8px",
  border: "1px solid var(--sv-soft, #d0d0d0)",
  background: "transparent",
  fontSize: 10,
  fontWeight: 600,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const runsBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  background: "var(--sv-paper, #faf7f2)",
  border: "1px solid var(--sv-soft, #e0e0e0)",
  maxHeight: 200,
  overflowY: "auto",
};

const runItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 0",
  flexWrap: "wrap",
};

const historyToggleStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--sv-soft, #6b6b6b)",
  marginBottom: 8,
};

const infoBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 10,
  background: "rgba(99, 102, 241, 0.06)",
  border: "1.5px solid var(--sv-ink)",
  fontSize: 12,
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--sv-soft, #6b6b6b)",
  textAlign: "center",
  padding: "30px 20px",
  background: "var(--sv-paper, #faf7f2)",
  border: "1px dashed var(--sv-soft, #d0d0d0)",
  marginTop: 12,
};

// suppress unused imports warning
void Calendar;
