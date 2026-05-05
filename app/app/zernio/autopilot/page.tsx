"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
// useRouter removido — gating moved pro layout
import {
  ArrowLeft,
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
import { RequireBusiness } from "@/components/app/zernio/require-business";

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
  cadence_type: CadenceType | null;
  interval_days: number | null;
  days_of_week: number[] | null;
  specific_dates: string[] | null;
  publish_hour: number;
  publish_minute: number;
  timezone: string;
  next_run_at: string | null;
  rss_url: string | null;
  rss_check_interval_minutes: number;
  rss_last_checked_at: string | null;
  rss_max_items_per_check: number;
  webhook_secret: string | null;
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

const TRIGGER_TYPE_META: Record<
  TriggerType,
  { label: string; icon: typeof Clock; desc: string; cardBg: string; iconBg: string }
> = {
  schedule: {
    label: "Agendado",
    icon: Clock,
    desc: "Cadência fixa de tempo (diário, semanal, datas específicas)",
    cardBg: "var(--sv-white)",
    iconBg: "var(--sv-green)",
  },
  rss: {
    label: "RSS Feed",
    icon: Rss,
    desc: "Toda vez que aparece item novo num feed RSS",
    cardBg: "var(--sv-white)",
    iconBg: "var(--sv-yellow)",
  },
  webhook: {
    label: "Webhook",
    icon: Webhook,
    desc: "Endpoint público pra Zapier / Make / n8n disparar",
    cardBg: "var(--sv-white)",
    iconBg: "var(--sv-pink)",
  },
};

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "var(--sv-pink, #D262B2)",
  linkedin: "var(--sv-yellow, #F5C518)",
};

export default function ZernioAutopilotPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningNowFor, setRunningNowFor] = useState<string | null>(null);

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
  const [fCadence, setFCadence] = useState<CadenceType>("every_n_days");
  const [fInterval, setFInterval] = useState(3);
  const [fDays, setFDays] = useState<number[]>([1, 3, 5]);
  const [fSpecificDates, setFSpecificDates] = useState("");
  const [fHour, setFHour] = useState(9);
  const [fMinute, setFMinute] = useState(0);
  const [fRssUrl, setFRssUrl] = useState("");
  const [fRssIntervalMin, setFRssIntervalMin] = useState(60);
  const [fRssMaxItems, setFRssMaxItems] = useState(1);

  const [openRunsFor, setOpenRunsFor] = useState<string | null>(null);
  const [runsByTrigger, setRunsByTrigger] = useState<Record<string, Run[]>>({});
  const [loadingRunsFor, setLoadingRunsFor] = useState<string | null>(null);

  const fetchTriggers = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/zernio/triggers", {
        headers: jsonWithAuth(session),
      });
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
    const themesList = fThemes.split("\n").map((s) => s.trim()).filter(Boolean);
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
        const patch: Record<string, unknown> = {
          name: payload.name,
          themes: payload.themes,
          editorial_line: payload.editorialLine,
          niche: payload.niche,
          target_platforms: payload.targetPlatforms,
          publish_mode: payload.publishMode,
        };
        if (fType === "schedule") {
          patch.cadence_type = payload.cadenceType;
          patch.interval_days = payload.intervalDays;
          patch.days_of_week = payload.daysOfWeek;
          patch.specific_dates = payload.specificDates;
          patch.publish_hour = payload.publishHour;
          patch.publish_minute = payload.publishMinute;
        } else if (fType === "rss") {
          patch.rss_url = payload.rssUrl;
          patch.rss_check_interval_minutes = payload.rssCheckIntervalMinutes;
          patch.rss_max_items_per_check = payload.rssMaxItemsPerCheck;
        }
        res = await fetch(`/api/zernio/triggers/${editingId}`, {
          method: "PATCH",
          headers: jsonWithAuth(session),
          body: JSON.stringify(patch),
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
      toast.success(
        `"${data.trigger.name}" ${editingId ? "atualizado" : "criado"}.`
      );
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
      if (!confirm("Deletar esse gatilho?")) return;
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
      if (!confirm("Disparar AGORA? Vai gerar carrossel + agendar/postar."))
        return;
      setRunningNowFor(id);
      try {
        const res = await fetch(`/api/zernio/triggers/${id}/run-now`, {
          method: "POST",
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        if (data.status === "scheduled") toast.success("Agendado.");
        else
          toast.warning(
            `${data.status}${data.detail ? `: ${data.detail}` : ""}`
          );
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

  const focused = useMemo(() => triggers.filter((t) => t.is_active), [triggers]);
  const inactive = useMemo(
    () => triggers.filter((t) => !t.is_active),
    [triggers]
  );

  if (authLoading || !user) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "60vh" }}
      >
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <RequireBusiness
      feature="Piloto Auto"
      description="Configure gatilhos (tempo, RSS, webhook) que geram carrossel + postam sozinho. Disponível só pro plano Business."
    >
    <div
      className="mx-auto px-6 py-8 lg:px-10 lg:py-12"
      style={{ maxWidth: 1100 }}
    >
      <Link
        href="/app/zernio"
        className="inline-flex items-center gap-1 mb-4"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 10.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--sv-muted, #6b6b6b)",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={12} /> Voltar
      </Link>

      {/* HERO */}
      <header className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div style={{ flex: 1, minWidth: 280 }}>
          <span className="sv-eyebrow">
            <span className="sv-dot" /> Nº 04 · Piloto Auto · Gatilhos
          </span>
          <h1
            className="sv-display mt-3"
            style={{ fontSize: "clamp(34px, 5.2vw, 52px)", lineHeight: 1.02 }}
          >
            Postar no <em>automático</em>.
          </h1>
          <p
            className="mt-2"
            style={{
              color: "var(--sv-muted, #555)",
              fontSize: 13.5,
              maxWidth: 540,
            }}
          >
            Configure um gatilho — tempo, RSS feed ou webhook. A IA gera o
            carrossel no seu DNA e posta no Instagram + LinkedIn sem você
            levantar um dedo.
          </p>
        </div>
        <button
          onClick={fetchTriggers}
          className="sv-btn sv-btn-outline"
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </header>

      {/* TIPOS DE GATILHO */}
      {!showForm && (
        <section
          className="grid gap-4 mb-8"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
        >
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
                className="sv-card text-left flex flex-col gap-3"
                style={{ cursor: "pointer", padding: 22, fontFamily: "inherit" }}
              >
                <div
                  style={{
                    ...iconWrapStyle,
                    background: meta.iconBg,
                  }}
                >
                  <Icon size={20} color="var(--sv-ink)" />
                </div>
                <h3
                  className="sv-display"
                  style={{ fontSize: 22, lineHeight: 1.05, margin: 0 }}
                >
                  {meta.label}
                </h3>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--sv-muted, #555)",
                    margin: 0,
                    lineHeight: 1.45,
                    minHeight: 36,
                  }}
                >
                  {meta.desc}
                </p>
                <div
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9.5,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginTop: "auto",
                    color: "var(--sv-ink)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Plus size={10} /> Criar gatilho
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* FORM */}
      {showForm && (
        <section className="sv-card mb-6" data-trigger-form style={{ padding: 24 }}>
          <div className="flex justify-between items-center mb-5">
            <div>
              <span
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--sv-muted, #888)",
                }}
              >
                {editingId ? "Editar gatilho" : "Novo gatilho"}
              </span>
              <h2
                className="sv-display"
                style={{ fontSize: 26, margin: "4px 0 0", lineHeight: 1.04 }}
              >
                {TRIGGER_TYPE_META[fType].label}
              </h2>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="sv-btn sv-btn-outline"
            >
              Cancelar
            </button>
          </div>

          {!editingId && (
            <div style={{ marginBottom: 16 }}>
              <Label>Tipo</Label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(TRIGGER_TYPE_META) as TriggerType[]).map((t) => {
                  const meta = TRIGGER_TYPE_META[t];
                  const Icon = meta.icon;
                  const on = fType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFType(t)}
                      style={{
                        ...typeChipStyle,
                        background: on ? meta.iconBg : "var(--sv-white)",
                        color: "var(--sv-ink)",
                        boxShadow: on ? "2px 2px 0 0 var(--sv-ink)" : "none",
                      }}
                    >
                      <Icon size={11} /> {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4">
            <Field label="Nome do gatilho">
              <input
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="Ex: Posts diários sobre marketing"
                style={inputStyle}
              />
            </Field>

            <Field
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
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "var(--sv-sans)",
                }}
              />
            </Field>

            <Field label="Linha editorial / voz (opcional)">
              <textarea
                value={fEditorial}
                onChange={(e) => setFEditorial(e.target.value)}
                rows={3}
                placeholder="Ex: tom direto, exemplos concretos, primeira pessoa"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "var(--sv-sans)",
                }}
              />
            </Field>

            <Field label="Nicho (opcional)">
              <input
                value={fNiche}
                onChange={(e) => setFNiche(e.target.value)}
                placeholder="Ex: marketing, cripto, finance"
                style={inputStyle}
              />
            </Field>

            <Field label={`Plataformas alvo (${fPlatforms.size})`}>
              <div className="flex gap-2">
                {(["instagram", "linkedin"] as const).map((p) => {
                  const on = fPlatforms.has(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setFPlatforms((prev) => {
                          const next = new Set(prev);
                          if (next.has(p)) next.delete(p);
                          else next.add(p);
                          return next;
                        })
                      }
                      style={{
                        ...platformChipBigStyle,
                        background: on ? PLATFORM_COLORS[p] : "var(--sv-white)",
                        boxShadow: on ? "2px 2px 0 0 var(--sv-ink)" : "none",
                      }}
                    >
                      {p === "instagram" ? "Instagram" : "LinkedIn"}
                    </button>
                  );
                })}
              </div>
            </Field>

            {fType === "schedule" && (
              <>
                <Field label="Cadência">
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
                </Field>

                {fCadence === "every_n_days" && (
                  <Field label="Intervalo (dias)">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={fInterval}
                      onChange={(e) => setFInterval(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </Field>
                )}

                {fCadence === "weekly_dow" && (
                  <Field label="Dias da semana">
                    <div className="flex gap-1 flex-wrap">
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
                              ...dowBtnStyle,
                              background: on ? "var(--sv-ink)" : "var(--sv-white)",
                              color: on ? "var(--sv-paper)" : "var(--sv-ink)",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}

                {fCadence === "specific_dates" && (
                  <Field label="Datas (YYYY-MM-DD, vírgula)">
                    <textarea
                      value={fSpecificDates}
                      onChange={(e) => setFSpecificDates(e.target.value)}
                      rows={2}
                      placeholder="2026-05-15, 2026-05-22"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </Field>
                )}

                <div className="flex gap-2">
                  <Field label="Hora">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={fHour}
                      onChange={(e) => setFHour(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Minuto">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={fMinute}
                      onChange={(e) => setFMinute(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Timezone">
                    <input value="America/Sao_Paulo" disabled style={inputStyle} />
                  </Field>
                </div>
              </>
            )}

            {fType === "rss" && (
              <>
                <Field label="URL do RSS feed">
                  <input
                    type="url"
                    value={fRssUrl}
                    onChange={(e) => setFRssUrl(e.target.value)}
                    placeholder="https://exemplo.com/feed.xml"
                    style={inputStyle}
                  />
                </Field>
                <div className="flex gap-2">
                  <Field label="Verificar a cada (min)">
                    <input
                      type="number"
                      min={15}
                      max={1440}
                      value={fRssIntervalMin}
                      onChange={(e) => setFRssIntervalMin(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Itens novos por check">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={fRssMaxItems}
                      onChange={(e) => setFRssMaxItems(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <InfoBox icon={Rss}>
                  Quando aparecer item novo no feed, o título vira o tema do
                  carrossel. No Hobby tier, cron diário — mín 60min entre checks.
                </InfoBox>
              </>
            )}

            {fType === "webhook" && !editingId && (
              <InfoBox icon={Webhook}>
                Após criar, vamos gerar uma URL única com secret pra você
                colar no Zapier / Make / n8n. Toda chamada POST nessa URL
                dispara geração + post imediato.
              </InfoBox>
            )}

            {fType !== "webhook" && (
              <Field label="Modo de publicação">
                <div className="flex gap-2">
                  {(["scheduled", "draft"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFPublishMode(m)}
                      style={{
                        ...modeBtnStyle,
                        background:
                          fPublishMode === m ? "var(--sv-ink)" : "var(--sv-white)",
                        color:
                          fPublishMode === m ? "var(--sv-paper)" : "var(--sv-ink)",
                      }}
                    >
                      {m === "scheduled" ? "Agendar e publicar" : "Salvar rascunho"}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="sv-btn sv-btn-outline"
              >
                Cancelar
              </button>
              <button
                onClick={onSubmit}
                disabled={creating}
                className="sv-btn sv-btn-primary"
              >
                {creating ? (
                  <Loader2 className="animate-spin" size={13} />
                ) : editingId ? (
                  <Save size={13} />
                ) : (
                  <Plus size={13} />
                )}
                {editingId ? "Salvar" : "Criar gatilho"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* LISTA DE TRIGGERS */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="sv-display" style={{ fontSize: 22, margin: 0 }}>
            Gatilhos <em>ativos</em>
          </h2>
          <span
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--sv-muted, #888)",
            }}
          >
            {focused.length} ativo{focused.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : focused.length === 0 ? (
          <div
            className="text-center py-10"
            style={{
              border: "1.5px dashed var(--sv-ink)",
              background: "var(--sv-paper)",
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--sv-muted, #888)",
            }}
          >
            <Rocket
              size={22}
              style={{ opacity: 0.4, marginBottom: 6, display: "inline" }}
            />
            <div>Nenhum gatilho ativo</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>
              Crie um nos cards acima
            </div>
          </div>
        ) : (
          <ul
            className="flex flex-col gap-3"
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {focused.map((t) =>
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
        )}

        {inactive.length > 0 && (
          <details className="mt-6">
            <summary
              style={{
                cursor: "pointer",
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--sv-muted, #888)",
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Pausados ({inactive.length})
            </summary>
            <ul
              className="flex flex-col gap-3"
              style={{ listStyle: "none", padding: 0, margin: 0 }}
            >
              {inactive.map((t) =>
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
    </RequireBusiness>
  );
}

// ────────────────────────── COMPONENTES ──────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontFamily: "var(--sv-mono)",
        fontSize: 9.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        marginBottom: 6,
        color: "var(--sv-ink)",
      }}
    >
      {children}
    </label>
  );
}

function InfoBox({
  icon: Icon,
  children,
}: {
  icon: typeof Rss;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-2"
      style={{
        padding: 12,
        background: "var(--sv-paper)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
        fontSize: 12,
        fontFamily: "var(--sv-sans)",
        lineHeight: 1.45,
      }}
    >
      <Icon size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
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
      cadenceLabel = (t.days_of_week ?? []).map((d) => DOW_LABELS[d]).join(" / ");
    else if (t.cadence_type === "specific_dates")
      cadenceLabel = `${(t.specific_dates ?? []).length} datas`;
  } else if (t.trigger_type === "rss")
    cadenceLabel = `RSS · check a cada ${t.rss_check_interval_minutes}min`;
  else cadenceLabel = "Disparo via webhook";

  return (
    <li key={t.id} className="sv-card" style={{ padding: 16 }}>
      <div className="flex items-start gap-3">
        <div style={{ ...iconWrapStyle, background: meta.iconBg, flexShrink: 0 }}>
          <Icon size={16} color="var(--sv-ink)" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <strong
              className="sv-display"
              style={{ fontSize: 18, lineHeight: 1.2 }}
            >
              {t.name}
            </strong>
            <span
              style={{
                ...miniBadgeStyle,
                background: meta.iconBg,
              }}
            >
              {meta.label}
            </span>
            {!t.is_active && (
              <span
                style={{ ...miniBadgeStyle, background: "var(--sv-muted, #888)", color: "#fff" }}
              >
                Pausado
              </span>
            )}
            {t.target_platforms.map((pf) => (
              <span
                key={pf}
                style={{
                  ...miniBadgeStyle,
                  background: PLATFORM_COLORS[pf] || "var(--sv-paper)",
                }}
              >
                {pf === "instagram" ? "IG" : "LI"}
              </span>
            ))}
          </div>

          <div style={metaLineStyle}>{cadenceLabel}</div>
          <div style={metaLineStyle}>
            {t.next_run_at && (
              <>
                Próximo:{" "}
                <strong style={{ color: "var(--sv-ink)" }}>
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
              <>
                Último: {new Date(t.last_fired_at).toLocaleString("pt-BR")}
              </>
            )}
            {!t.next_run_at && !t.last_fired_at && (
              <span style={{ fontStyle: "italic" }}>Nunca disparado</span>
            )}
          </div>

          {t.trigger_type === "webhook" && t.webhook_secret && (
            <WebhookUrlBox url={h.webhookUrl(t)} />
          )}

          {t.last_error && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: "rgba(201, 79, 59, 0.08)",
                border: "1.5px solid #C94F3B",
                fontSize: 11,
                color: "#7a2a1a",
                fontFamily: "var(--sv-sans)",
              }}
            >
              Último erro: {t.last_error}
            </div>
          )}

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
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--sv-muted, #888)",
                    fontFamily: "var(--sv-mono)",
                    letterSpacing: "0.06em",
                    margin: 0,
                  }}
                >
                  Nenhum run ainda.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {runs.map((r) => (
                    <li key={r.id} style={runItemStyle}>
                      <span style={runStatusBadge(r.status)}>{r.status}</span>
                      <span
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 10,
                          color: "var(--sv-muted, #888)",
                        }}
                      >
                        {new Date(r.fired_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 9,
                          color: "var(--sv-muted, #888)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        ({r.fired_by})
                      </span>
                      {r.theme_chosen && (
                        <span
                          style={{
                            fontSize: 11,
                            fontStyle: "italic",
                            fontFamily: "var(--sv-display)",
                          }}
                        >
                          {r.theme_chosen.slice(0, 60)}
                        </span>
                      )}
                      {r.error && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "#7a2a1a",
                          }}
                        >
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

        <div className="flex flex-col gap-1.5" style={{ flexShrink: 0 }}>
          <button
            onClick={() => h.onRunNow(t.id)}
            style={iconBtnStyle}
            disabled={h.runningNowFor === t.id}
            title="Disparar agora"
          >
            {h.runningNowFor === t.id ? (
              <Loader2 className="animate-spin" size={12} />
            ) : (
              <Play size={12} />
            )}
          </button>
          <button onClick={() => h.onEdit(t)} style={iconBtnStyle} title="Editar">
            <Pencil size={12} />
          </button>
          <button
            onClick={() => h.onToggle(t)}
            style={iconBtnStyle}
            title={t.is_active ? "Pausar" : "Ativar"}
          >
            {t.is_active ? <PowerOff size={12} /> : <Power size={12} />}
          </button>
          <button onClick={() => h.onDelete(t.id)} style={iconBtnStyle} title="Deletar">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </li>
  );
}

function WebhookUrlBox({ url }: { url: string }) {
  return (
    <div
      className="flex items-center gap-2 mt-2"
      style={{
        padding: 8,
        background: "var(--sv-pink, #D262B2)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "2px 2px 0 0 var(--sv-ink)",
      }}
    >
      <Webhook size={11} />
      <code
        style={{
          flex: 1,
          fontSize: 10,
          fontFamily: "var(--sv-mono)",
          wordBreak: "break-all",
          color: "var(--sv-ink)",
        }}
      >
        {url}
      </code>
      <button
        type="button"
        style={miniBtnSquareStyle}
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast.success("URL copiada.");
        }}
      >
        <Copy size={10} />
      </button>
    </div>
  );
}

function runStatusBadge(status: string): React.CSSProperties {
  const colors: Record<string, string> = {
    pending: "var(--sv-muted, #888)",
    generating: "var(--sv-yellow)",
    scheduled: "var(--sv-green)",
    failed: "#C94F3B",
    skipped: "var(--sv-muted, #888)",
  };
  return {
    fontFamily: "var(--sv-mono)",
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: "0.12em",
    padding: "2px 6px",
    background: colors[status] ?? "var(--sv-muted, #888)",
    color: "var(--sv-ink)",
    textTransform: "uppercase",
    border: "1px solid var(--sv-ink)",
  };
}

// ────────────────────────── STYLES ──────────────────────────

const iconWrapStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "2px 2px 0 0 var(--sv-ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  border: "1.5px solid var(--sv-ink)",
  fontSize: 13,
  fontFamily: "var(--sv-sans)",
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
};

const typeChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "8px 12px",
  fontFamily: "var(--sv-mono)",
  fontSize: 9.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
  border: "1.5px solid var(--sv-ink)",
  cursor: "pointer",
};

const platformChipBigStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  border: "1.5px solid var(--sv-ink)",
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
  cursor: "pointer",
  color: "var(--sv-ink)",
  transition: "transform 0.12s, box-shadow 0.12s",
};

const dowBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1.5px solid var(--sv-ink)",
  fontFamily: "var(--sv-mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 700,
  cursor: "pointer",
};

const modeBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  border: "1.5px solid var(--sv-ink)",
  fontFamily: "var(--sv-mono)",
  fontSize: 10.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
  cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "2px 2px 0 0 var(--sv-ink)",
  transition: "transform 0.1s",
};

const miniBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  fontFamily: "var(--sv-mono)",
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  border: "1px solid var(--sv-ink)",
  color: "var(--sv-ink)",
};

const metaLineStyle: React.CSSProperties = {
  fontFamily: "var(--sv-mono)",
  fontSize: 11,
  letterSpacing: "0.04em",
  color: "var(--sv-muted, #6b6b6b)",
  marginTop: 4,
};

const runsToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginTop: 10,
  padding: "5px 10px",
  border: "1.5px solid var(--sv-ink)",
  background: "var(--sv-paper)",
  fontFamily: "var(--sv-mono)",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
  color: "var(--sv-ink)",
};

const runsBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  background: "var(--sv-paper)",
  border: "1.5px solid var(--sv-ink)",
  maxHeight: 240,
  overflowY: "auto",
};

const runItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 0",
  flexWrap: "wrap",
  borderBottom: "1px dashed var(--sv-muted, #ccc)",
};

const miniBtnSquareStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: 6,
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  cursor: "pointer",
};
