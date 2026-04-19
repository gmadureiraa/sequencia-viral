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

  // Carrega ideias sugeridas reais (cache 24h via backend)
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setIdeasLoading(true);
      try {
        const res = await fetch("/api/suggestions", {
          headers: jsonWithAuth(session),
        });
        const data = (await res.json().catch(() => ({}))) as {
          items?: RemoteIdea[];
          error?: string;
        };
        if (!cancelled && res.ok && Array.isArray(data.items) && data.items.length > 0) {
          setRemoteIdeas(data.items.slice(0, 6));
        }
      } catch (err) {
        console.warn("[dashboard] suggestions failed:", err);
      } finally {
        if (!cancelled) setIdeasLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

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
      }));
    }
    if (!firstNiche) return IDEA_DECK;
    const upper = firstNiche.toUpperCase();
    return IDEA_DECK.map((i, idx) => ({
      ...i,
      theme: idx === 0 ? upper : i.theme,
    }));
  }, [firstNiche, remoteIdeas]);
  void ideasLoading; // reservado para spinner futuro

  const totalCarousels = carousels.length;

  return (
    <div
      className="mx-auto px-4 sm:px-6"
      style={{ maxWidth: CONTAINER_MAX, paddingTop: 8, paddingBottom: 96 }}
    >
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
              <b style={{ color: "var(--sv-ink)" }}>{drafts.length}</b>{" "}
              {drafts.length === 1 ? "rascunho" : "rascunhos"} em aberto.
            </>
          ) : (
            <>
              Você tem{" "}
              <b style={{ color: "var(--sv-ink)" }}>
                {usageCount}/{usageLimit}
              </b>{" "}
              carrosséis neste ciclo.{" "}
              <b style={{ color: "var(--sv-ink)" }}>{drafts.length}</b>{" "}
              {drafts.length === 1 ? "rascunho" : "rascunhos"} em aberto.
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

            {/* Rascunhos */}
            <StatTile
              variant="paper"
              kicker="RASCUNHOS"
              big={String(drafts.length)}
              sub={`última: ${lastDraftRel}`}
            />
          </motion.section>

          {/* ──────────────────────────────────────────────────────────────────
               3. RASCUNHOS
             ────────────────────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 64 }}
          >
            <SectionHead
              kicker="● Nº 02 · EM ABERTO"
              title={<>Seus <em>rascunhos</em>.</>}
              sub={
                drafts.length > 0
                  ? `Continue de onde parou · ${drafts.length} em aberto`
                  : "Nenhum rascunho no momento"
              }
              action={
                drafts.length > 4 ? (
                  <Link href="/app/carousels" className="sv-btn sv-btn-outline">
                    Ver tudo →
                  </Link>
                ) : null
              }
            />

            {carouselLoading ? (
              <CarouselListSkeleton count={4} />
            ) : carouselError ? (
              <ErrorBanner message={carouselError} onRetry={() => void loadCarousels()} />
            ) : recentDrafts.length === 0 ? (
              <EmptyInline
                title="Nenhum rascunho em aberto."
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
                {recentDrafts.map((c, i) => (
                  <CarouselTile
                    key={c.id}
                    carousel={c}
                    index={i}
                    badgeColor="var(--sv-pink)"
                    badgeLabel="RASCUNHO"
                  />
                ))}
              </div>
            )}
          </motion.section>

          {/* ──────────────────────────────────────────────────────────────────
               4. PUBLICADOS RECENTES
             ────────────────────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 64 }}
          >
            <SectionHead
              kicker="● Nº 03 · NO AR"
              title={<>Publicados <em>recentes</em>.</>}
              sub={
                published.length > 0
                  ? `Últimos publicados · ${published.length} no total`
                  : "Ainda sem publicações"
              }
              action={
                published.length > 4 ? (
                  <Link href="/app/carousels" className="sv-btn sv-btn-outline">
                    Ver biblioteca →
                  </Link>
                ) : null
              }
            />

            {carouselLoading ? null : recentPublished.length === 0 ? (
              <EmptyInline
                title="Você ainda não publicou nenhum carrossel."
                cta={
                  <Link href="/app/create/new" className="sv-btn sv-btn-ink">
                    Criar e publicar →
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
                {recentPublished.map((c, i) => (
                  <CarouselTile
                    key={c.id}
                    carousel={c}
                    index={i}
                    badgeColor="var(--sv-green)"
                    badgeLabel="♥ PUBLICADO"
                  />
                ))}
              </div>
            )}
          </motion.section>

          {/* ──────────────────────────────────────────────────────────────────
               5. IDEIAS SUGERIDAS
             ────────────────────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5 }}
          >
            <SectionHead
              kicker="● Nº 04 · PARA HOJE"
              title={<>Ideias <em>sugeridas</em>.</>}
              sub="Baseadas no seu nicho e nos últimos dias"
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              {ideas.map((idea, i) => (
                <motion.div
                  key={idea.n}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: i * 0.06 }}
                  className="sv-card"
                  style={{
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <span className="sv-kicker">
                    ● Nº {idea.n} · {idea.theme}
                  </span>
                  <h3
                    style={{
                      fontFamily: "var(--sv-display)",
                      fontStyle: "italic",
                      fontSize: 22,
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
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "var(--sv-muted)",
                      margin: 0,
                    }}
                  >
                    {idea.body}
                  </p>
                  <hr className="sv-divider" style={{ margin: "4px 0" }} />
                  <Link
                    href={`/app/create?idea=${encodeURIComponent(idea.title)}`}
                    className="sv-kicker"
                    style={{
                      color: "var(--sv-ink)",
                      textDecoration: "none",
                      letterSpacing: "0.16em",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
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
                  </Link>
                </motion.div>
              ))}
            </div>
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
  const firstSlide = carousel.slides[0];
  const title =
    carousel.title || firstSlide?.heading?.trim() || "Sem título";
  const rel = formatRelative(carousel.savedAt);
  const isDark = carousel.style === "dark";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: index * 0.05 }}
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
        {/* Preview 4:5 do primeiro slide — slide escalado pra ocupar
             ~94% do container e deixar o card apertado em volta. */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 5",
            background: isDark ? "var(--sv-ink)" : "var(--sv-soft)",
            borderBottom: "1.5px solid var(--sv-ink)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
          }}
        >
          {firstSlide ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: 1080 * 0.22,
                  height: 1350 * 0.22,
                }}
              >
                <EditorialSlide
                  heading={firstSlide.heading}
                  body={firstSlide.body}
                  imageUrl={firstSlide.imageUrl}
                  slideNumber={1}
                  totalSlides={carousel.slides.length}
                  profile={{
                    name: "Sequência Viral",
                    handle: "@sequenciaviral",
                    photoUrl: "",
                  }}
                  style={isDark ? "dark" : "white"}
                  scale={0.22}
                />
              </div>
            </div>
          ) : (
            <span
              className="sv-kicker"
              style={{ color: "var(--sv-muted)" }}
            >
              SEM PREVIEW
            </span>
          )}
        </div>

        {/* Meta */}
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <h3
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 17,
              lineHeight: 1.2,
              color: "var(--sv-ink)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {title}
          </h3>
          <div
            className="sv-kicker"
            style={{
              color: "var(--sv-ink)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 9.5,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: badgeColor,
                border: "1px solid var(--sv-ink)",
                display: "inline-block",
              }}
            />
            {badgeLabel} · {rel}
          </div>
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
