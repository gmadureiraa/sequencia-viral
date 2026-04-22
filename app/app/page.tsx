"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { fetchUserCarousels, type SavedCarousel } from "@/lib/carousel-storage";
import EditorialSlide from "@/components/app/editorial-slide";
import { CarouselListSkeleton } from "@/components/app/carousel-skeleton";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { DiscountPopup } from "@/components/app/discount-popup";

/* ============================================================================
 *  Dashboard · Sequência Viral (brutalist editorial Kaleidos)
 * ============================================================================
 *  Ref: design_handoff_sequencia_viral/03-app.html → #v-dashboard
 *  Grid com stat row (4 cols), rascunhos, publicados, ideias sugeridas.
 * ========================================================================= */

const CONTAINER_MAX = 1180;

// Temas pra ideias sugeridas (variam por nicho do profile.niche[0])
const IDEA_DECK: Array<{ n: string; theme: string; title: string; body: string }> = [
  {
    n: "01",
    theme: "MARKETING",
    title: "O método dos três zeros da Coca-Cola pra posts virais.",
    body: "Sem açúcar, sem cafeína, sem calorias. A ausência virou ativo — e o princípio funciona pra qualquer post que precise quebrar padrão.",
  },
  {
    n: "02",
    theme: "CONTEÚDO",
    title: "Por que threads com 3 bullets ranqueiam mais que textões.",
    body: "Um estudo interno mostrou que posts com densidade numérica convertem 2,7× mais saves. Um carrossel sobre densidade explica tudo.",
  },
  {
    n: "03",
    theme: "ESTRATÉGIA",
    title: "A regra do ‘slide 02’ — o hook real mora no segundo frame.",
    body: "A capa só compra 1,5s de atenção. O que prende é o que acontece no swipe — transforme isso num carrossel editorial.",
  },
];

function planLabel(plan?: string | null): string {
  const p = (plan ?? "free").toLowerCase();
  if (p === "free") return "Free";
  if (p === "pro") return "Pro";
  if (p === "team") return "Team";
  if (p === "enterprise") return "Enterprise";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function formatRelative(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `há ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months}mês${months > 1 ? "es" : ""}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatSince(iso?: string | null): string {
  if (!iso) return "desde o início";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "desde o início";
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

type RemoteIdea = {
  id: string;
  title: string;
  hook?: string;
  angle?: string;
  style?: string;
};

export default function DashboardPage() {
  const { profile, user, session } = useAuth();
  const [carousels, setCarousels] = useState<SavedCarousel[]>([]);
  const [carouselLoading, setCarouselLoading] = useState(true);
  const [carouselError, setCarouselError] = useState<string | null>(null);
  const [remoteIdeas, setRemoteIdeas] = useState<RemoteIdea[] | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);

  const loadCarousels = useCallback(async () => {
    setCarouselError(null);
    setCarouselLoading(true);
    try {
      if (user && supabase) {
        const list = await fetchUserCarousels(supabase);
        setCarousels(list);
      } else {
        setCarousels([]);
      }
    } catch (err) {
      console.error("[dashboard] Failed to load carousels:", err);
      setCarouselError("Não foi possível carregar seus carrosséis. Tente novamente.");
      setCarousels([]);
    } finally {
      setCarouselLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCarousels();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadCarousels]);

  // Carrega ideias sugeridas reais (cache 24h via backend). Se user clicar
  // 'Gerar mais ideias', chama com ?refresh=1 e substitui as atuais.
  const loadIdeas = useCallback(
    async (refresh = false) => {
      if (!session) return;
      setIdeasLoading(true);
      try {
        const url = refresh ? "/api/suggestions?refresh=1" : "/api/suggestions";
        const res = await fetch(url, { headers: jsonWithAuth(session) });
        const data = (await res.json().catch(() => ({}))) as {
          items?: RemoteIdea[];
          error?: string;
        };
        if (res.ok && Array.isArray(data.items) && data.items.length > 0) {
          setRemoteIdeas(data.items.slice(0, 6));
        }
      } catch (err) {
        console.warn("[dashboard] suggestions failed:", err);
      } finally {
        setIdeasLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    if (!session) return;
    void loadIdeas(false);
  }, [session, loadIdeas]);

  // ─── Derivações ────────────────────────────────────────────────────────────
  const firstName = useMemo(() => {
    const raw =
      profile?.name ||
      (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
      "Creator";
    return String(raw).split(" ")[0] || "Creator";
  }, [profile?.name, user?.user_metadata]);

  const usageCount = profile?.usage_count ?? 0;
  const usageLimit = profile?.usage_limit ?? 5;
  const isUnlimited = usageLimit >= 999000;
  const remaining = isUnlimited ? Infinity : Math.max(0, usageLimit - usageCount);

  const drafts = useMemo(
    () => carousels.filter((c) => (c.status ?? "draft") === "draft"),
    [carousels]
  );
  const published = useMemo(
    () => carousels.filter((c) => c.status === "published"),
    [carousels]
  );
  const recentDrafts = drafts.slice(0, 4);
  const recentPublished = published.slice(0, 4);

  const lastDraftRel = drafts[0]?.savedAt
    ? formatRelative(drafts[0]?.savedAt)
    : "nenhuma ainda";
  const memberSince = formatSince(
    (user?.created_at as string | undefined) ?? null
  );

  // Ideias sugeridas — prefere respostas reais da IA (cache 24h no backend),
  // cai no deck mock curado se ainda não carregou ou a IA está indisponível.
  const firstNiche =
    profile?.niche && profile.niche.length > 0 ? profile.niche[0] : null;
  const ideas = useMemo(() => {
    if (remoteIdeas && remoteIdeas.length > 0) {
      return remoteIdeas.map((it, idx) => ({
        n: String(idx + 1).padStart(2, "0"),
        theme:
          (it.style || firstNiche || "EDITORIAL").toString().toUpperCase(),
        title: it.title,
        body:
          it.angle ||
          (it.hook ? it.hook.replace(/\s*\|\s*/, " — ") : "Ideia sugerida pela IA."),
        // Preserva campos crus pro briefing completo em /app/create/new
        hook: it.hook ?? "",
        angle: it.angle ?? "",
        style: it.style ?? "",
      }));
    }
    if (!firstNiche)
      return IDEA_DECK.map((i) => ({ ...i, hook: "", angle: "", style: "" }));
    const upper = firstNiche.toUpperCase();
    return IDEA_DECK.map((i, idx) => ({
      ...i,
      theme: idx === 0 ? upper : i.theme,
      hook: "",
      angle: "",
      style: "",
    }));
  }, [firstNiche, remoteIdeas]);
  void ideasLoading; // reservado para spinner futuro

  const totalCarousels = carousels.length;

  return (
    <div
      className="mx-auto px-4 sm:px-6"
      style={{ maxWidth: CONTAINER_MAX, paddingTop: 8, paddingBottom: 96 }}
    >
      {/* Popup 30% off — só user free, após onboarding. 1x por trigger
          + cooldown global de 7 dias. */}
      <DiscountPopup trigger="post-onboarding" />

      {/* ──────────────────────────────────────────────────────────────────
           1. HEADER
         ────────────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: 56 }}
      >
        <span className="sv-eyebrow">
          <span className="sv-dot" />● BEM-VINDO · Ed. Nº 04
        </span>

        <h1
          className="sv-display"
          style={{
            fontSize: "clamp(40px, 6.2vw, 60px)",
            lineHeight: 0.98,
            marginTop: 20,
            letterSpacing: "-0.01em",
          }}
        >
          Bom te ver, <em>{firstName}.</em>
        </h1>

        <p
          style={{
            marginTop: 18,
            fontFamily: "var(--sv-sans)",
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--sv-muted)",
            maxWidth: 620,
          }}
        >
          {isUnlimited ? (
            <>
              Você tem <b style={{ color: "var(--sv-ink)" }}>uso ilimitado</b> neste ciclo.{" "}
              <b style={{ color: "var(--sv-ink)" }}>{carousels.length}</b>{" "}
              {carousels.length === 1 ? "carrossel criado" : "carrosséis criados"} até agora.
            </>
          ) : (
            <>
              Você tem{" "}
              <b style={{ color: "var(--sv-ink)" }}>
                {usageCount}/{usageLimit}
              </b>{" "}
              carrosséis criados neste ciclo.
            </>
          )}
        </p>
      </motion.header>

      {/* ──────────────────────────────────────────────────────────────────
           Empty state global — se zero carrosséis totais
         ────────────────────────────────────────────────────────────────── */}
      {!carouselLoading && !carouselError && totalCarousels === 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="sv-card-accent"
          style={{
            padding: "48px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 18,
          }}
        >
          <span className="sv-kicker" style={{ color: "var(--sv-ink)" }}>
            ● COMECE AQUI · Nº 01
          </span>
          <h2
            className="sv-display"
            style={{
              fontSize: "clamp(32px, 4.8vw, 48px)",
              lineHeight: 1,
              maxWidth: 720,
            }}
          >
            Seu estúdio está em <em>branco</em>.
          </h2>
          <p
            style={{
              fontFamily: "var(--sv-sans)",
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--sv-ink)",
              maxWidth: 540,
            }}
          >
            Cole uma ideia, um link, um tema solto. A Sequência estrutura em slides editoriais
            num piscar de olhos.
          </p>
          <Link
            href="/app/create/new"
            className="sv-btn sv-btn-ink"
            style={{ marginTop: 6 }}
          >
            + Criar primeiro carrossel
          </Link>
        </motion.section>
      ) : (
        <>
          {/* ──────────────────────────────────────────────────────────────────
               2. STAT ROW
             ────────────────────────────────────────────────────────────────── */}
          <motion.section
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.07 } },
            }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
              marginBottom: 64,
            }}
          >
            {/* Carrosséis criados — accent verde */}
            <StatTile
              variant="accent"
              kicker="CARROSSÉIS CRIADOS"
              big={
                isUnlimited ? (
                  <>
                    ∞<em style={{ fontSize: 28 }}>/mês</em>
                  </>
                ) : (
                  <>
                    {usageCount}
                    <em style={{ fontSize: 28 }}>/mês</em>
                  </>
                )
              }
              sub={`desde ${memberSince}`}
            />

            {/* Ciclo atual */}
            <StatTile
              variant="paper"
              kicker="CICLO ATUAL"
              big={isUnlimited ? "∞" : String(remaining)}
              sub={
                isUnlimited
                  ? "plano sem limites"
                  : `de ${usageLimit} disponíveis`
              }
            />

            {/* Plano — dark */}
            <StatTile
              variant="ink"
              kicker="PLANO ATIVO"
              big={planLabel(profile?.plan)}
              sub={
                <Link
                  href="/app/plans"
                  className="sv-kicker"
                  style={{
                    color: "var(--sv-green)",
                    textDecoration: "none",
                    letterSpacing: "0.16em",
                  }}
                >
                  Gerenciar →
                </Link>
              }
            />

            {/* Total de carrosséis — não existe mais "rascunho" no produto,
                todo carrossel que passou pela geração (e consumiu quota) é
                um carrossel criado. */}
            <StatTile
              variant="paper"
              kicker="CARROSSÉIS"
              big={String(carousels.length)}
              sub={`último: ${lastDraftRel}`}
            />
          </motion.section>

          {/* ──────────────────────────────────────────────────────────────────
               3. IDEIAS SUGERIDAS (MOVIDAS PRA ANTES DOS CARROSSEIS)
             ────────────────────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 56 }}
          >
            <SectionHead
              kicker="● Nº 02 · PARA HOJE"
              title={<>Ideias <em>sugeridas</em>.</>}
              sub="Baseadas no seu nicho · atualizadas diariamente · arraste pro lado pra ver mais"
              action={
                <button
                  type="button"
                  onClick={() => void loadIdeas(true)}
                  disabled={ideasLoading}
                  className="sv-btn sv-btn-outline"
                  style={{
                    opacity: ideasLoading ? 0.5 : 1,
                    cursor: ideasLoading ? "wait" : "pointer",
                  }}
                >
                  {ideasLoading ? "Gerando…" : "↻ Gerar mais ideias"}
                </button>
              }
            />

            {/* Row horizontal scrollavel: 3 visiveis no desktop, arrasta pra ver
                o resto. Mobile naturalmente scrolla 1 por vez. Snap pra
                centralizar nos cards. */}
            <div
              className="sv-ideas-strip"
              style={{
                display: "flex",
                overflowX: "auto",
                overflowY: "hidden",
                gap: 16,
                paddingBottom: 10,
                scrollSnapType: "x mandatory",
                scrollbarWidth: "thin",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {ideas.map((idea, i) => (
                <motion.button
                  key={idea.n}
                  type="button"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.45, delay: i * 0.05 }}
                  onClick={() => {
                    // Grava briefing completo na sessionStorage e navega.
                    // create/new le e pre-preenche form com hook + angle + style.
                    try {
                      sessionStorage.setItem(
                        "sv_active_idea",
                        JSON.stringify({
                          title: idea.title,
                          hook: idea.hook,
                          angle: idea.angle,
                          style: idea.style,
                          theme: idea.theme,
                          body: idea.body,
                        })
                      );
                    } catch {
                      /* ignore */
                    }
                    window.location.href = `/app/create/new?idea=${encodeURIComponent(idea.title)}`;
                  }}
                  className="sv-card text-left"
                  style={{
                    flex: "0 0 calc((100% - 32px) / 3)",
                    minWidth: 260,
                    scrollSnapAlign: "start",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    cursor: "pointer",
                    background: "var(--sv-white)",
                    border: "1.5px solid var(--sv-ink)",
                  }}
                >
                  <span className="sv-kicker">
                    ● Nº {idea.n} · {idea.theme.slice(0, 26)}
                  </span>
                  <h3
                    style={{
                      fontFamily: "var(--sv-display)",
                      fontStyle: "italic",
                      fontSize: 19,
                      lineHeight: 1.2,
                      color: "var(--sv-ink)",
                      margin: 0,
                    }}
                  >
                    {idea.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--sv-muted)",
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {idea.body}
                  </p>
                  <hr className="sv-divider" style={{ margin: "4px 0" }} />
                  <span
                    className="sv-kicker"
                    style={{
                      color: "var(--sv-ink)",
                      letterSpacing: "0.16em",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: "auto",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        background: "var(--sv-green)",
                        border: "1px solid var(--sv-ink)",
                        display: "inline-block",
                      }}
                    />
                    USAR IDEIA →
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.section>

          {/* ──────────────────────────────────────────────────────────────────
               4. SEUS CARROSSÉIS (abaixo das ideias agora)
             ────────────────────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 64 }}
          >
            <SectionHead
              kicker="● Nº 03 · RECENTES"
              title={<>Seus <em>carrosséis</em>.</>}
              sub={
                carousels.length > 0
                  ? `${carousels.length} criados · abra e continue de onde parou`
                  : "Nenhum carrossel criado ainda"
              }
              action={
                carousels.length > 8 ? (
                  <Link href="/app/carousels" className="sv-btn sv-btn-outline">
                    Ver biblioteca →
                  </Link>
                ) : null
              }
            />

            {carouselLoading ? (
              <CarouselListSkeleton count={4} />
            ) : carouselError ? (
              <ErrorBanner message={carouselError} onRetry={() => void loadCarousels()} />
            ) : carousels.length === 0 ? (
              <EmptyInline
                title="Você ainda não criou nenhum carrossel."
                cta={
                  <Link href="/app/create/new" className="sv-btn sv-btn-primary">
                    + Novo carrossel
                  </Link>
                }
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 20,
                }}
              >
                {carousels.slice(0, 8).map((c, i) => (
                  <CarouselTile
                    key={c.id}
                    carousel={c}
                    index={i}
                    badgeColor={
                      c.status === "published"
                        ? "var(--sv-green)"
                        : "var(--sv-ink)"
                    }
                    badgeLabel={
                      c.status === "published" ? "♥ PUBLICADO" : "CRIADO"
                    }
                  />
                ))}
              </div>
            )}
          </motion.section>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SUB-COMPONENTES
 * ──────────────────────────────────────────────────────────────────────────── */

type StatVariant = "accent" | "paper" | "ink";

function StatTile({
  variant,
  kicker,
  big,
  sub,
}: {
  variant: StatVariant;
  kicker: string;
  big: React.ReactNode;
  sub: React.ReactNode;
}) {
  const baseClass =
    variant === "accent"
      ? "sv-card-accent"
      : variant === "ink"
      ? "sv-card-ink"
      : "sv-card";

  const kickerColor =
    variant === "ink"
      ? "var(--sv-green)"
      : variant === "accent"
      ? "var(--sv-ink)"
      : "var(--sv-muted)";

  const bigColor =
    variant === "ink" ? "var(--sv-paper)" : "var(--sv-ink)";

  const subColor =
    variant === "ink"
      ? "rgba(247,245,239,0.72)"
      : variant === "accent"
      ? "var(--sv-ink)"
      : "var(--sv-muted)";

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
      }}
      className={baseClass}
      style={{
        minHeight: 180,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span
        className="sv-kicker"
        style={{ color: kickerColor, fontSize: 10 }}
      >
        {kicker}
      </span>
      <div
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 48,
          lineHeight: 1,
          color: bigColor,
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          letterSpacing: "-0.015em",
        }}
      >
        {big}
      </div>
      <div
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: subColor,
        }}
      >
        {sub}
      </div>
    </motion.div>
  );
}

function SectionHead({
  kicker,
  title,
  sub,
  action,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        marginBottom: 28,
      }}
    >
      <div>
        <span className="sv-kicker" style={{ color: "var(--sv-muted)" }}>
          {kicker}
        </span>
        <h2
          className="sv-display"
          style={{
            fontSize: "clamp(26px, 3.6vw, 34px)",
            lineHeight: 1.05,
            marginTop: 10,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
        {sub ? (
          <div
            className="sv-kicker"
            style={{ color: "var(--sv-muted)", marginTop: 8 }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// Paleta por template — hash simples do id pra estabilidade visual
// (mesmo carrossel sempre pega mesma cor).
const TILE_PALETTE = [
  { bg: "var(--sv-ink)", fg: "var(--sv-paper)", accent: "var(--sv-green)" },
  { bg: "var(--sv-green)", fg: "var(--sv-ink)", accent: "var(--sv-ink)" },
  { bg: "var(--sv-pink)", fg: "var(--sv-ink)", accent: "var(--sv-ink)" },
  { bg: "var(--sv-paper)", fg: "var(--sv-ink)", accent: "var(--sv-ink)", dotted: true },
];

function tilePaletteFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TILE_PALETTE[h % TILE_PALETTE.length];
}

function templateAbbrev(tpl: string | undefined): string {
  if (!tpl) return "SV";
  const map: Record<string, string> = {
    manifesto: "MANIFESTO",
    futurista: "FUTURISTA",
    autoral: "AUTORAL",
    twitter: "TWITTER",
  };
  return map[tpl] ?? tpl.toUpperCase();
}

function CarouselTile({
  carousel,
  index,
  badgeColor,
  badgeLabel,
}: {
  carousel: SavedCarousel;
  index: number;
  badgeColor: string;
  badgeLabel: string;
}) {
  const title = (carousel.title || "Sem título").trim();
  const rel = formatRelative(carousel.savedAt);
  const palette = tilePaletteFor(carousel.id);
  const tmpl = templateAbbrev(carousel.designTemplate);
  // Número sequencial "ED. 04" usa dia do mês + index pra dar variedade.
  const edN = String(index + 1).padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        href={`/app/create/${carousel.id}/edit`}
        className="sv-card"
        style={{
          padding: 0,
          display: "block",
          textDecoration: "none",
          overflow: "hidden",
        }}
      >
        {/* Card sólido colorido — sem render de slide. Carrega instantâneo. */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 5",
            background: palette.bg,
            borderBottom: "1.5px solid var(--sv-ink)",
            color: palette.fg,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundImage: palette.dotted
              ? "radial-gradient(circle at 2px 2px, var(--sv-ink) 1px, transparent 1.5px)"
              : undefined,
            backgroundSize: palette.dotted ? "10px 10px" : undefined,
          }}
        >
          {/* Top eyebrow: ● BD · ED. NN */}
          <div
            className="uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.2em",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: palette.fg,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: palette.accent,
                border: `1px solid ${palette.fg}`,
                display: "inline-block",
              }}
            />
            SV · ED. {edN}
          </div>

          {/* Título grande editorial. Em tiles com padrao dotted, envolve o
              titulo numa caixa semi-opaca pra legibilidade sem perder o padrao
              de fundo. */}
          <h3
            style={{
              fontFamily: "var(--sv-display)",
              fontStyle: "italic",
              fontSize: "clamp(17px, 2.2vw, 22px)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              color: palette.fg,
              ...(palette.dotted
                ? {
                    background: palette.bg,
                    padding: "10px 12px",
                    border: `1.5px solid ${palette.fg}`,
                    boxShadow: `3px 3px 0 0 ${palette.fg}`,
                    alignSelf: "flex-start",
                    maxWidth: "100%",
                  }
                : {}),
            }}
          >
            {title}
          </h3>

          {/* Bottom: template + arrow */}
          <div
            className="uppercase flex items-center justify-between"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: palette.fg,
              opacity: 0.85,
            }}
          >
            <span>{edN}/{String(Math.max(1, index + 1)).padStart(2, "0")} · {tmpl}</span>
            <span>→</span>
          </div>
        </div>

        {/* Meta footer: título curto + badge status */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "10px 14px",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--sv-sans)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--sv-ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {title}
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.15em",
              fontWeight: 700,
              padding: "3px 8px",
              border: "1px solid var(--sv-ink)",
              background: "var(--sv-paper)",
              color: "var(--sv-ink)",
              flexShrink: 0,
            }}
          >
            {badgeLabel.replace("♥ ", "")} · {rel}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function EmptyInline({
  title,
  cta,
}: {
  title: string;
  cta: React.ReactNode;
}) {
  return (
    <div
      className="sv-card"
      style={{
        padding: "36px 28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <span className="sv-kicker" style={{ color: "var(--sv-muted)" }}>
        ● VAZIO
      </span>
      <p
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 22,
          lineHeight: 1.2,
          color: "var(--sv-ink)",
          margin: 0,
        }}
      >
        {title}
      </p>
      {cta}
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="sv-card"
      style={{
        padding: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        background: "#FFE9E9",
      }}
    >
      <span
        style={{
          fontFamily: "var(--sv-sans)",
          fontSize: 14,
          color: "var(--sv-ink)",
        }}
      >
        {message}
      </span>
      <button onClick={onRetry} className="sv-btn sv-btn-outline">
        Tentar de novo
      </button>
    </div>
  );
}
