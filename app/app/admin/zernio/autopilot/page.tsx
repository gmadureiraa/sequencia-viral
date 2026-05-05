"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Pencil,
  Play,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { isAdminEmail } from "@/lib/admin-emails";

/**
 * /app/admin/zernio/autopilot — gerencia Recipes do Piloto Auto.
 *
 * Recipe = "gere conteúdo sobre temas X, na cadência Y, pros profile Z +
 * accounts W, na hora HH:MM TZ". O cron `/api/cron/zernio-autopilot`
 * dispara recipes vencidos e cria post no Zernio.
 *
 * V1 limitação: só plataformas text-only (Twitter/Bluesky/LinkedIn/Threads/
 * Telegram). IG/FB/TikTok não rodam por autopilot — admin precisa agendar
 * manual no preview do carrossel.
 */

interface Profile {
  id: string;
  name: string;
}

interface Account {
  id: string;
  zernio_account_id: string;
  profile_id: string;
  platform: string;
  handle: string | null;
  status: string;
}

interface Recipe {
  id: string;
  profile_id: string;
  name: string;
  is_active: boolean;
  themes: string[];
  editorial_line: string;
  niche: string | null;
  tone: string;
  language: string;
  design_template: string;
  cadence_type: "daily" | "every_n_days" | "weekly_dow" | "specific_dates";
  interval_days: number | null;
  days_of_week: number[] | null;
  specific_dates: string[] | null;
  publish_hour: number;
  publish_minute: number;
  timezone: string;
  target_account_ids: string[];
  publish_mode: "scheduled" | "draft";
  next_run_at: string | null;
  last_run_at: string | null;
  last_error: string | null;
}

interface Run {
  id: string;
  recipe_id: string;
  run_date: string;
  status: string;
  theme_chosen: string | null;
  carousel_id: string | null;
  scheduled_post_id: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

/** Plataformas que o Piloto Auto suporta — carrosséis com mídia. */
const AUTOPILOT_PLATFORMS = new Set(["instagram", "linkedin"]);

export default function ZernioAutopilotPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  // Runs lazy-loaded por recipe (toggle "ver histórico")
  const [openRunsFor, setOpenRunsFor] = useState<string | null>(null);
  const [runsByRecipe, setRunsByRecipe] = useState<Record<string, Run[]>>({});
  const [loadingRunsFor, setLoadingRunsFor] = useState<string | null>(null);
  const [runningNowFor, setRunningNowFor] = useState<string | null>(null);

  // Form state — usado tanto pra criar quanto pra editar.
  // editingRecipeId !== null indica modo edição (PATCH); null = criar (POST).
  const [showForm, setShowForm] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [fProfileId, setFProfileId] = useState("");
  const [fName, setFName] = useState("");
  const [fThemes, setFThemes] = useState("");
  const [fEditorial, setFEditorial] = useState("");
  const [fNiche, setFNiche] = useState("");
  const [fCadence, setFCadence] = useState<Recipe["cadence_type"]>("every_n_days");
  const [fInterval, setFInterval] = useState(3);
  const [fDays, setFDays] = useState<number[]>([1, 3, 5]);
  const [fSpecificDates, setFSpecificDates] = useState("");
  const [fHour, setFHour] = useState(9);
  const [fMinute, setFMinute] = useState(0);
  const [fAccountIds, setFAccountIds] = useState<Set<string>>(new Set());
  const [fPublishMode, setFPublishMode] = useState<"scheduled" | "draft">("scheduled");

  function resetForm() {
    setEditingRecipeId(null);
    setFProfileId("");
    setFName("");
    setFThemes("");
    setFEditorial("");
    setFNiche("");
    setFCadence("every_n_days");
    setFInterval(3);
    setFDays([1, 3, 5]);
    setFSpecificDates("");
    setFHour(9);
    setFMinute(0);
    setFAccountIds(new Set());
    setFPublishMode("scheduled");
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) router.replace("/app");
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [pRes, aRes, rRes] = await Promise.all([
        fetch("/api/zernio/profiles", { headers: jsonWithAuth(session) }),
        fetch("/api/zernio/accounts", { headers: jsonWithAuth(session) }),
        fetch("/api/zernio/autopilot/recipes", { headers: jsonWithAuth(session) }),
      ]);
      const pData = await pRes.json();
      const aData = await aRes.json();
      const rData = await rRes.json();
      if (!pRes.ok) throw new Error(pData.error || "profiles");
      if (!aRes.ok) throw new Error(aData.error || "accounts");
      if (!rRes.ok) throw new Error(rData.error || "recipes");
      setProfiles(pData.profiles || []);
      setAccounts(aData.accounts || []);
      setRecipes(rData.recipes || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchAll();
  }, [session, fetchAll]);

  // Contas IG/LinkedIn do profile selecionado — autopilot V1 produz carrossel
  // com imagens, então só essas duas plataformas são aceitas.
  const accountsForProfile = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.profile_id === fProfileId &&
          a.status === "active" &&
          AUTOPILOT_PLATFORMS.has(a.platform)
      ),
    [accounts, fProfileId]
  );

  // Reset selected accounts quando profile muda
  useEffect(() => {
    setFAccountIds(new Set());
  }, [fProfileId]);

  const onCreate = useCallback(async () => {
    if (!session) return;
    if (!fProfileId) return toast.error("Escolhe um profile.");
    if (!fName.trim()) return toast.error("Nome obrigatório.");
    const themesList = fThemes
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (themesList.length === 0) return toast.error("Adicione ao menos 1 tema.");
    if (fAccountIds.size === 0)
      return toast.error("Selecione ao menos 1 conta IG ou LinkedIn.");

    setCreating(true);
    try {
      const accountRows = accounts.filter((a) => fAccountIds.has(a.id));
      const targetAccountIds = accountRows.map((a) => a.zernio_account_id);

      // Edit: usa PATCH com whitelist de campos editáveis (não muda profile_id
      // — pra mover de profile, deletar e recriar). Não recalcula next_run_at
      // automaticamente — a próxima execução do cron pega.
      if (editingRecipeId) {
        const res = await fetch(`/api/zernio/autopilot/recipes/${editingRecipeId}`, {
          method: "PATCH",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            name: fName.trim(),
            themes: themesList,
            editorial_line: fEditorial.trim(),
            niche: fNiche.trim() || null,
            target_account_ids: targetAccountIds,
            publish_hour: fHour,
            publish_minute: fMinute,
            publish_mode: fPublishMode,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        toast.success(`Recipe "${data.recipe.name}" atualizada.`);
        setShowForm(false);
        resetForm();
        await fetchAll();
        return;
      }

      // Criar: POST
      const res = await fetch("/api/zernio/autopilot/recipes", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          profileId: fProfileId,
          name: fName.trim(),
          themes: themesList,
          editorialLine: fEditorial.trim(),
          niche: fNiche.trim() || undefined,
          tone: "editorial",
          language: "pt-br",
          designTemplate: "twitter",
          cadenceType: fCadence,
          intervalDays: fCadence === "every_n_days" || fCadence === "daily" ? fInterval : undefined,
          daysOfWeek: fCadence === "weekly_dow" ? fDays : undefined,
          specificDates:
            fCadence === "specific_dates"
              ? fSpecificDates
                  .split(/[,\s]+/)
                  .map((s) => s.trim())
                  .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
              : undefined,
          publishHour: fHour,
          publishMinute: fMinute,
          timezone: "America/Sao_Paulo",
          targetAccountIds,
          publishMode: fPublishMode,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      toast.success(`Recipe "${data.recipe.name}" criada.`);
      setShowForm(false);
      resetForm();
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setCreating(false);
    }
  }, [
    editingRecipeId,
    session,
    fProfileId,
    fName,
    fThemes,
    fEditorial,
    fNiche,
    fCadence,
    fInterval,
    fDays,
    fSpecificDates,
    fHour,
    fMinute,
    fAccountIds,
    fPublishMode,
    accounts,
    fetchAll,
  ]);

  const onToggle = useCallback(
    async (id: string, isActive: boolean) => {
      if (!session) return;
      try {
        const res = await fetch(`/api/zernio/autopilot/recipes/${id}`, {
          method: "PATCH",
          headers: jsonWithAuth(session),
          body: JSON.stringify({ is_active: !isActive }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        toast.success(isActive ? "Pausada." : "Ativada.");
        await fetchAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [session, fetchAll]
  );

  const onDelete = useCallback(
    async (id: string) => {
      if (!session) return;
      if (!confirm("Deletar essa recipe? O histórico de runs também vai junto.")) return;
      try {
        const res = await fetch(`/api/zernio/autopilot/recipes/${id}`, {
          method: "DELETE",
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        toast.success("Recipe deletada.");
        await fetchAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [session, fetchAll]
  );

  const onEdit = useCallback(
    (r: Recipe) => {
      setEditingRecipeId(r.id);
      setFProfileId(r.profile_id);
      setFName(r.name);
      setFThemes(r.themes.join("\n"));
      setFEditorial(r.editorial_line);
      setFNiche(r.niche ?? "");
      setFCadence(r.cadence_type);
      setFInterval(r.interval_days ?? 3);
      setFDays(r.days_of_week ?? [1, 3, 5]);
      setFSpecificDates((r.specific_dates ?? []).join(", "));
      setFHour(r.publish_hour);
      setFMinute(r.publish_minute);
      setFPublishMode(r.publish_mode);
      // Resolve targetAccountIds (zernio_account_id) → IDs locais (uuid).
      const localIds = new Set(
        accounts
          .filter((a) => r.target_account_ids.includes(a.zernio_account_id))
          .map((a) => a.id)
      );
      setFAccountIds(localIds);
      setShowForm(true);
      // Scroll pro form
      setTimeout(() => {
        document.querySelector("[data-recipe-form]")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    },
    [accounts]
  );

  const onRunNow = useCallback(
    async (recipeId: string) => {
      if (!session) return;
      if (!confirm("Rodar essa recipe AGORA? Vai gerar 1 carrossel + agendar via Zernio.")) return;
      setRunningNowFor(recipeId);
      try {
        const res = await fetch(`/api/zernio/autopilot/recipes/${recipeId}/run-now`, {
          method: "POST",
          headers: jsonWithAuth(session),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        if (data.status === "scheduled") {
          toast.success("Carrossel gerado e agendado.");
        } else if (data.status === "skipped") {
          toast.info(`Pulado: ${data.detail ?? "já rodou hoje"}`);
        } else {
          toast.warning(`Status: ${data.status}${data.detail ? ` — ${data.detail}` : ""}`);
        }
        // Invalida cache de runs e força reload
        setRunsByRecipe((prev) => {
          const next = { ...prev };
          delete next[recipeId];
          return next;
        });
        await fetchAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setRunningNowFor(null);
      }
    },
    [session, fetchAll]
  );

  const toggleRuns = useCallback(
    async (recipeId: string) => {
      if (openRunsFor === recipeId) {
        setOpenRunsFor(null);
        return;
      }
      setOpenRunsFor(recipeId);
      // Cache simples: já carregou? Não busca de novo.
      if (runsByRecipe[recipeId]) return;
      if (!session) return;
      setLoadingRunsFor(recipeId);
      try {
        const res = await fetch(
          `/api/zernio/autopilot/runs?recipeId=${encodeURIComponent(recipeId)}&limit=20`,
          { headers: jsonWithAuth(session) }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha");
        setRunsByRecipe((prev) => ({ ...prev, [recipeId]: data.runs || [] }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      } finally {
        setLoadingRunsFor(null);
      }
    },
    [session, openRunsFor, runsByRecipe]
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
        <ArrowLeft size={14} /> Profiles
      </Link>

      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Piloto Auto</h1>
          <p style={subtitleStyle}>
            Receitas geram carrosséis automaticamente na cadência definida, renderizam
            os slides como PNG server-side e agendam via Zernio. Suporta{" "}
            <strong>Instagram</strong> e <strong>LinkedIn</strong> (carrossel de até 10
            imagens 1080×1350).
          </p>
        </div>
        <button onClick={fetchAll} style={btnGhost} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </header>

      {!showForm && (
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          style={btnPrimary}
        >
          <Plus size={14} /> Nova receita
        </button>
      )}

      {showForm && (
        <section style={cardStyle} data-recipe-form>
          <h2 style={h2Style}>{editingRecipeId ? "Editar receita" : "Nova receita"}</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Profile</label>
              <select
                value={fProfileId}
                onChange={(e) => setFProfileId(e.target.value)}
                style={{
                  ...inputStyle,
                  opacity: editingRecipeId ? 0.6 : 1,
                  cursor: editingRecipeId ? "not-allowed" : "pointer",
                }}
                disabled={!!editingRecipeId}
              >
                <option value="">Escolha...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {editingRecipeId && (
                <p style={{ fontSize: 11, color: "var(--sv-soft)", marginTop: 4 }}>
                  Profile não pode ser alterado em edição. Pra mover, deletar e criar de novo.
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Nome da receita</label>
              <input
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="Ex: Tweet diário Madureira"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Temas (1 por linha — IA sorteia)</label>
              <textarea
                value={fThemes}
                onChange={(e) => setFThemes(e.target.value)}
                rows={5}
                placeholder={"Marketing pra agência B2B\nIA aplicada a redes sociais\nFunil de conteúdo orgânico"}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--sv-sans)" }}
              />
            </div>

            <div>
              <label style={labelStyle}>Linha editorial / voz</label>
              <textarea
                value={fEditorial}
                onChange={(e) => setFEditorial(e.target.value)}
                rows={3}
                placeholder="Ex: tom direto, exemplos concretos, sem guru, primeira pessoa"
                style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--sv-sans)" }}
              />
            </div>

            <div>
              <label style={labelStyle}>Nicho (opcional)</label>
              <input
                value={fNiche}
                onChange={(e) => setFNiche(e.target.value)}
                placeholder="Ex: marketing, cripto, finance"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Cadência</label>
              <select
                value={fCadence}
                onChange={(e) => setFCadence(e.target.value as Recipe["cadence_type"])}
                style={inputStyle}
              >
                <option value="daily">Todo dia</option>
                <option value="every_n_days">A cada N dias</option>
                <option value="weekly_dow">Dias da semana específicos</option>
                <option value="specific_dates">Datas específicas</option>
              </select>
            </div>

            {fCadence === "every_n_days" && (
              <div>
                <label style={labelStyle}>Intervalo (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={fInterval}
                  onChange={(e) => setFInterval(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
            )}

            {fCadence === "weekly_dow" && (
              <div>
                <label style={labelStyle}>Dias da semana</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, i) => {
                    const on = fDays.includes(i);
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() =>
                          setFDays((prev) =>
                            prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
                          )
                        }
                        style={on ? dowBtnActive : dowBtn}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {fCadence === "specific_dates" && (
              <div>
                <label style={labelStyle}>
                  Datas específicas (YYYY-MM-DD, separadas por vírgula)
                </label>
                <textarea
                  value={fSpecificDates}
                  onChange={(e) => setFSpecificDates(e.target.value)}
                  rows={2}
                  placeholder="2026-05-15, 2026-05-22, 2026-06-01"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Hora</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={fHour}
                  onChange={(e) => setFHour(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Minuto</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={fMinute}
                  onChange={(e) => setFMinute(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>TZ</label>
                <input value="America/Sao_Paulo" disabled style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                Contas alvo (IG/LinkedIn) ({fAccountIds.size})
              </label>
              {fProfileId === "" ? (
                <p style={{ fontSize: 12, color: "var(--sv-soft)" }}>
                  Escolha um profile primeiro.
                </p>
              ) : accountsForProfile.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--sv-soft)" }}>
                  Esse profile não tem Instagram nem LinkedIn ativo. Conecte uma das
                  duas plataformas no detalhe do profile antes de criar a receita.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 4 }}>
                  {accountsForProfile.map((a) => (
                    <label key={a.id} style={accountRow}>
                      <input
                        type="checkbox"
                        checked={fAccountIds.has(a.id)}
                        onChange={() =>
                          setFAccountIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(a.id)) next.delete(a.id);
                            else next.add(a.id);
                            return next;
                          })
                        }
                      />
                      <span style={{ textTransform: "capitalize" }}>{a.platform}</span>
                      <span style={{ color: "var(--sv-soft)" }}>
                        · {a.handle ? `@${a.handle}` : "—"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Modo de publicação</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setFPublishMode("scheduled")}
                  style={fPublishMode === "scheduled" ? modeBtnActive : modeBtn}
                >
                  Agendar e publicar
                </button>
                <button
                  type="button"
                  onClick={() => setFPublishMode("draft")}
                  style={fPublishMode === "draft" ? modeBtnActive : modeBtn}
                >
                  Salvar como rascunho (admin revisa)
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={btnGhost}
              >
                Cancelar
              </button>
              <button onClick={onCreate} disabled={creating} style={btnPrimary}>
                {creating ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : editingRecipeId ? (
                  <Save size={14} />
                ) : (
                  <Plus size={14} />
                )}
                {editingRecipeId ? "Salvar alterações" : "Criar receita"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={h2Style}>Receitas ({recipes.length})</h2>
        {loading ? (
          <Loader2 className="animate-spin" size={18} />
        ) : recipes.length === 0 ? (
          <p style={{ color: "var(--sv-soft)", marginTop: 8 }}>
            Nenhuma receita criada.
          </p>
        ) : (
          <ul style={listStyle}>
            {recipes.map((r) => {
              const profile = profiles.find((p) => p.id === r.profile_id);
              const nextRun = r.next_run_at
                ? new Date(r.next_run_at).toLocaleString("pt-BR")
                : "—";
              const lastRun = r.last_run_at
                ? new Date(r.last_run_at).toLocaleString("pt-BR")
                : "—";
              return (
                <li key={r.id} style={recipeCardStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{r.name}</strong>
                    {!r.is_active && (
                      <span style={pausedBadge}> PAUSADA </span>
                    )}
                    <div style={{ fontSize: 11, color: "var(--sv-soft)", marginTop: 2 }}>
                      {profile?.name ?? "?"} · {r.cadence_type} ·{" "}
                      {String(r.publish_hour).padStart(2, "0")}:
                      {String(r.publish_minute).padStart(2, "0")} {r.timezone}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      Próximo: <strong>{nextRun}</strong> · Último: {lastRun}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--sv-soft)", marginTop: 2 }}>
                      Temas: {r.themes.length} · Contas: {r.target_account_ids.length} ·
                      Modo: {r.publish_mode}
                    </div>
                    {r.last_error && (
                      <div style={errStyle}>Último erro: {r.last_error}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleRuns(r.id)}
                      style={runsToggleStyle}
                    >
                      <ChevronDown
                        size={12}
                        style={{
                          transform:
                            openRunsFor === r.id ? "rotate(180deg)" : "rotate(0)",
                          transition: "transform 0.15s",
                        }}
                      />
                      Histórico de runs
                    </button>
                    {openRunsFor === r.id && (
                      <div style={runsListStyle}>
                        {loadingRunsFor === r.id ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (runsByRecipe[r.id] ?? []).length === 0 ? (
                          <p style={{ fontSize: 11, color: "var(--sv-soft)" }}>
                            Nenhum run ainda. Próximo: {r.next_run_at ?? "—"}
                          </p>
                        ) : (
                          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {(runsByRecipe[r.id] ?? []).map((run) => (
                              <li key={run.id} style={runItemStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={runStatusBadge(run.status)}>{run.status}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700 }}>
                                    {run.run_date}
                                  </span>
                                  <span style={{ fontSize: 10, color: "var(--sv-soft)" }}>
                                    {new Date(run.started_at).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                {run.theme_chosen && (
                                  <div style={{ fontSize: 11, marginTop: 2 }}>
                                    Tema: <em>{run.theme_chosen}</em>
                                  </div>
                                )}
                                {run.error && (
                                  <div style={runErrStyle}>{run.error}</div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={() => onRunNow(r.id)}
                      style={btnIconStyle}
                      disabled={runningNowFor === r.id}
                      aria-label="Rodar agora"
                      title="Rodar agora (gera + agenda imediatamente)"
                    >
                      {runningNowFor === r.id ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => onEdit(r)}
                      style={btnIconStyle}
                      aria-label="Editar"
                      title="Editar receita"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onToggle(r.id, r.is_active)}
                      style={btnIconStyle}
                      aria-label={r.is_active ? "Pausar" : "Ativar"}
                      title={r.is_active ? "Pausar" : "Ativar"}
                    >
                      {r.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      style={btnIconStyle}
                      aria-label="Deletar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
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

const containerStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: 24,
  fontFamily: "var(--sv-sans)",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  color: "var(--sv-soft)",
  textDecoration: "none",
  marginBottom: 12,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 20,
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  margin: 0,
  letterSpacing: "-0.02em",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--sv-soft)",
  margin: "4px 0 0",
  maxWidth: 520,
};

const h2Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: 0,
};

const cardStyle: React.CSSProperties = {
  background: "var(--sv-white)",
  border: "1.5px solid var(--sv-ink)",
  boxShadow: "3px 3px 0 0 var(--sv-ink)",
  padding: 16,
  marginTop: 16,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
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
  fontSize: 13,
  background: "var(--sv-white)",
  color: "var(--sv-ink)",
  fontFamily: "var(--sv-sans)",
};

const btnPrimary: React.CSSProperties = {
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

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 14px",
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const btnIconStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--sv-ink)",
  border: "1.5px solid var(--sv-ink)",
  padding: 6,
  cursor: "pointer",
};

const dowBtn: React.CSSProperties = {
  padding: "6px 10px",
  border: "1.5px solid var(--sv-ink)",
  background: "var(--sv-white)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const dowBtnActive: React.CSSProperties = {
  ...dowBtn,
  background: "var(--sv-ink)",
  color: "var(--sv-white)",
};

const modeBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1.5px solid var(--sv-ink)",
  background: "var(--sv-white)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  flex: 1,
};

const modeBtnActive: React.CSSProperties = {
  ...modeBtn,
  background: "var(--sv-ink)",
  color: "var(--sv-white)",
};

const accountRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: 6,
  border: "1px solid var(--sv-soft)",
  fontSize: 13,
  cursor: "pointer",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const recipeCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: 12,
  border: "1px solid var(--sv-soft)",
  background: "var(--sv-paper, #faf7f2)",
};

const pausedBadge: React.CSSProperties = {
  marginLeft: 8,
  padding: "2px 6px",
  background: "#9ca3af",
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
};

const errStyle: React.CSSProperties = {
  marginTop: 6,
  padding: 6,
  background: "rgba(239, 68, 68, 0.1)",
  border: "1px solid #ef4444",
  fontSize: 11,
  color: "#7f1d1d",
};

const runsToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginTop: 6,
  padding: "3px 8px",
  border: "1px solid var(--sv-soft)",
  background: "transparent",
  fontSize: 10,
  fontWeight: 600,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const runsListStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  background: "var(--sv-white)",
  border: "1px solid var(--sv-soft)",
  maxHeight: 220,
  overflowY: "auto",
};

const runItemStyle: React.CSSProperties = {
  padding: "6px 0",
  borderBottom: "1px dashed var(--sv-soft)",
};

const runErrStyle: React.CSSProperties = {
  marginTop: 2,
  padding: 4,
  background: "rgba(239, 68, 68, 0.08)",
  fontSize: 10,
  color: "#7f1d1d",
};
