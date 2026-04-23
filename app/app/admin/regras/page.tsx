"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { isAdminEmail, ADMIN_EMAILS } from "@/lib/admin-emails";
import {
  PLANS,
  FREE_PLAN_USAGE_LIMIT,
  AUTOPUBLISH_BUMP,
  formatBrl,
  annualDiscountPct,
} from "@/lib/pricing";

/**
 * Admin Regras — renderiza o conteúdo canônico de `docs/VIRAL.md` em HTML.
 * Puxa preços e flags direto de `lib/pricing.ts` pra nunca divergir.
 *
 * Gate admin: `isAdminEmail(user?.email)`. Server-side gate continua em
 * `lib/server/auth.ts::requireAdmin` quando a rota for protegida por APIs.
 */
export default function AdminRegrasPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isAdmin = useMemo(() => isAdminEmail(user?.email), [user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[600px] py-12 text-center">
        <p
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          Carregando sessão
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[600px] py-12">
        <p style={{ fontFamily: "var(--sv-mono)", color: "var(--sv-muted)" }}>
          Acesso negado.
        </p>
      </div>
    );
  }

  // Preços derivados de lib/pricing.ts (fonte única).
  const creatorAnnualMonthlyEq = PLANS.pro.priceAnnual / 12;
  const proAnnualMonthlyEq = PLANS.business.priceAnnual / 12;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1080, paddingBottom: 80 }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="sv-eyebrow">
            <span className="sv-dot" /> Nº 00 · Admin · Regras
          </span>
          <h1
            className="sv-display mt-3"
            style={{
              fontSize: "clamp(26px, 4vw, 42px)",
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
            }}
          >
            Regras · <em>Sequência Viral</em>.
          </h1>
          <p className="mt-2" style={{ color: "var(--sv-muted)", fontSize: 13.5 }}>
            Documento canônico do produto. Preços e limites vêm direto de
            `lib/pricing.ts`. Atualizado 2026-04-22.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/app/admin")}
            className="sv-btn sv-btn-outline"
            style={{
              padding: "10px 14px",
              fontSize: 10.5,
              textDecoration: "none",
            }}
          >
            ← Admin
          </button>
          <a
            href="https://github.com/gmadureiraa/postflow/blob/main/docs/VIRAL.md"
            target="_blank"
            rel="noreferrer"
            className="sv-btn sv-btn-outline"
            style={{
              padding: "10px 14px",
              fontSize: 10.5,
              textDecoration: "none",
            }}
          >
            Ver no GitHub →
          </a>
        </div>
      </div>

      {/* Sections */}
      <Section num="01" title="Resumo executivo">
        <P>
          Sequência Viral é um estúdio de carrosséis editoriais com IA. O user
          cola um link (YouTube, blog, Instagram, X) ou escreve uma ideia; a IA
          devolve 3 variações (data, story, provocative) em ~60 segundos, cada
          uma com slides editoriais + imagens + export PNG/PDF/ZIP.
        </P>
        <P>
          Stack: Next.js 16 (Turbopack) + Supabase + Gemini 2.5 Pro/Flash +
          Imagen 4 + Gemini 3.1 Flash Image + Claude Sonnet 4.6 + Stripe BRL +
          Resend + Apify + Serper. Pacote: Bun. Prod:{" "}
          <code>viral.kaleidos.com.br</code>. GitHub:{" "}
          <code>gmadureiraa/postflow</code>.
        </P>
      </Section>

      <Section num="02" title="Planos e preços">
        <Table
          head={[
            "Plano",
            "Mensal",
            "Anual (eq/mês)",
            "Anchor",
            "Carrosséis/mês",
            "Marca d'água",
            "DB key",
          ]}
          rows={[
            [
              "Free",
              "R$ 0",
              "—",
              "—",
              String(FREE_PLAN_USAGE_LIMIT),
              <Badge key="free-w" kind="warn">Sim</Badge>,
              <Code key="free-k">free</Code>,
            ],
            [
              <b key="c">Creator</b>,
              formatBrl(PLANS.pro.priceMonthly),
              `${formatBrl(creatorAnnualMonthlyEq)} (-${annualDiscountPct("pro")}%)`,
              formatBrl(PLANS.pro.priceAnchor),
              String(PLANS.pro.carouselsPerMonth),
              <Badge key="c-w" kind="ok">Não</Badge>,
              <Code key="c-k">pro</Code>,
            ],
            [
              <b key="p">Pro</b>,
              formatBrl(PLANS.business.priceMonthly),
              `${formatBrl(proAnnualMonthlyEq)} (-${annualDiscountPct("business")}%)`,
              formatBrl(PLANS.business.priceAnchor),
              String(PLANS.business.carouselsPerMonth),
              <Badge key="p-w" kind="ok">Não</Badge>,
              <Code key="p-k">business</Code>,
            ],
          ]}
        />
        <P>
          Stripe product IDs: <Code>{PLANS.pro.stripeProductId}</Code> (Creator)
          · <Code>{PLANS.business.stripeProductId}</Code> (Pro). DB keys{" "}
          <Code>pro</Code> e <Code>business</Code> são legadas — não renomear.
          Plano "Agência" foi removido na migração 2026-04-22.
        </P>
        <P>
          Order bump <Code>{AUTOPUBLISH_BUMP.id}</Code> (
          {formatBrl(AUTOPUBLISH_BUMP.priceMonthly)}) existe em pricing.ts mas
          está <Badge kind="neutral">desativado</Badge> no checkout.
        </P>
      </Section>

      <Section num="03" title="Cupons ativos">
        <Table
          head={[
            "Código",
            "% off",
            "Max uses",
            "Plan scope",
            "Expira",
            "Status prod",
            "Distribuição",
          ]}
          rows={[
            [
              <b key="v">VIRAL50</b>,
              "50%",
              "10",
              "qualquer plano pago",
              "Nunca",
              <Badge key="v-s" kind="ok">Ativo</Badge>,
              "Cron last-chance + popup app + popup landing",
            ],
            [
              "BETA50",
              "50%",
              "100",
              "qualquer",
              "2026-06-30",
              <Badge key="b-s" kind="warn">Não aplicado</Badge>,
              "—",
            ],
            [
              "BEMVINDO30",
              "30%",
              "10.000",
              "qualquer",
              "2026-07-31",
              <Badge key="m-s" kind="danger">Aposentado</Badge>,
              "Substituído por VIRAL50",
            ],
          ]}
        />
        <P>
          Copy nunca expõe <Code>max_uses=10</Code> — usar "limitado aos
          primeiros assinantes". Atomicidade do uso via RPC{" "}
          <Code>increment_coupon_use(coupon_id)</Code>.
        </P>
      </Section>

      <Section num="04" title="Pipeline de criação">
        <OrderedList
          items={[
            "Input: URL (YouTube / blog / IG / X) ou texto livre.",
            "Source detection: detectSource() decide extrator.",
            "Extração: YouTube transcript (Supadata fallback) · Blog HTML scrape · IG Apify + ScrapeCreators fallback · X scrape · texto → skip.",
            "NER pre-processing (Gemini 2.5 Flash thinkingBudget:0) — summary, keyPoints, entities, dataPoints, quotes, arguments. Custo ~$0.0005.",
            "Writer (Gemini 2.5 Pro) — persona BrandsDecoded/Morning Brew/Paul Graham, 3 variações (data/story/provocative) de 6-10 slides. Custo ~$0.02.",
            "Image decider por slide (Gemini 2.5 Flash) — mode=search (Serper) ou generate (Imagen 4 / Flash Image). Custo ~$0.0003/slide.",
            "Editor WYSIWYG: troca texto, regenera imagem isolada, alterna variante.",
            "Export PNG / PDF / ZIP.",
            "Feedback modal pós-download: classifier Gemini Flash extrai regras → grava em carousel_feedback + atualiza profiles.brand_analysis.__generation_memory.",
          ]}
        />
        <P>
          Custo total médio: <b>$0.03-0.07 USD (≈ R$ 0,15-0,35)</b> por
          carrossel de 8 slides.
        </P>
      </Section>

      <Section num="05" title="Regras do writer (resumo)">
        <SubHead>Persona</SubHead>
        <P>
          Senior editorial director of BrandsDecoded meets Morning Brew meets
          Paul Graham. Every slide is a scene that earns the next swipe.
        </P>
        <SubHead>Linguagem</SubHead>
        <P>
          Frases ≤18 palavras. Zero jargão corporativo. Proibido "ecossistema",
          "narrativa", "ruptura", "paradigma", "sinergia", "disrupção".
        </P>
        <SubHead>Antídoto a genérico (dura)</SubHead>
        <UL
          items={[
            "Proibido abrir slide 1 com pergunta retórica.",
            "Proibido verbos-zumbi: descubra, entenda, aprenda, domine, desvende, revelado.",
            "Proibido fechamento clichê: 'o céu é o limite', 'o resto é história', 'tudo mudou'.",
            "Cada slide 2+ CONTRADIZ o anterior — tensão, não expansão.",
          ]}
        />
        <SubHead>Capa (slide 1)</SubHead>
        <P>
          "Afirmação contraintuitiva + pergunta de aprofundamento". 12-25
          palavras CAIXA ALTA (ou 8 se arquétipo compacto). Dispositivos:
          hipérbole, paradoxo, contraste extremo.
        </P>
        <SubHead>Estrutura 3 atos</SubHead>
        <UL
          items={[
            "Slide 2: setup (cenário antigo).",
            "Slide 3: ruptura (o que mudou).",
            "Slides 4+: consequências, evidências, aplicação.",
            "Slide final: CTA específico.",
          ]}
        />
        <SubHead>CM5.4 — 4 pilares</SubHead>
        <OrderedList
          items={[
            "Triagem narrativa (transformação + fricção + ângulo + 3-6 âncoras observáveis).",
            "Headline como mecanismo (interrupção + relevância + clareza + tensão).",
            "10 naturezas de abordagem (3 variações = 3 naturezas diferentes).",
            "Espinha dorsal em 6 partes: hook · mecanismo · prova · aplicação · implicação · direção.",
          ]}
        />
        <SubHead>Specificity gradient (slides 2-3)</SubHead>
        <P>
          Obrigatório: 1 dado numérico + 1 nome próprio em cada slide 2 e 3.
          Puxar primeiro de NER facts, depois grounding, só depois knowledge
          geral.
        </P>
        <SubHead>Story arc check</SubHead>
        <P>
          Se removo o slide N e o próximo ainda faz sentido, slide N é
          desperdício — reescrever pra carregar peso (contradição, exceção,
          dado novo).
        </P>
        <SubHead>Closing ritual (CTA)</SubHead>
        <P>
          Fecha o loop do slide 1 + ação específica que SÓ faz sentido depois
          de ler ESSE carrossel. Proibido genérico ("salva", "me siga",
          "comenta aqui").
        </P>
        <SubHead>15 quality gates</SubHead>
        <P style={{ color: "var(--sv-muted)", fontSize: 12 }}>
          Escada · remoção · especificidade 2-3 · invenção · CTA específico ·
          arquétipos+naturezas · slide 2 contradiz 1 · variants · voz · jargão
          · fricção · 6 papéis CM5.4 · headline não-genérica · abstração fria
          · burocratês.
        </P>
      </Section>

      <Section num="06" title="Regras de imagens">
        <SubHead>Search (Serper)</SubHead>
        <P>Entidade nomeada famosa, evento real, pessoa pública, produto físico específico.</P>
        <SubHead>Generate (Imagen 4 / Flash Image)</SubHead>
        <P>
          Conceito abstrato, metáfora, princípio, emoção, cena hipotética.
          Capa (slide 1) SEMPRE generate. Aspect ratio sempre 1:1.
        </P>
        <SubHead>StructuredImagePrompt</SubHead>
        <P style={{ fontFamily: "var(--sv-mono)", fontSize: 11.5 }}>
          subject · composition · lighting · mood · palette · camera · textures
          · negative · aspectRatio=1:1
        </P>
        <SubHead>Negative padrão</SubHead>
        <P style={{ fontFamily: "var(--sv-mono)", fontSize: 11.5 }}>
          "no text, no letters, no readable UI, no chart numbers, no stock
          photo cliches"
        </P>
      </Section>

      <Section num="07" title="Templates visuais">
        <Table
          head={["DB ID", "Nome UI", "Arquivo", "Status"]}
          rows={[
            [
              <Code key="m">manifesto</Code>,
              <b key="mn">Futurista</b>,
              "template-manifesto.tsx",
              <Badge key="ms" kind="ok">Ativo</Badge>,
            ],
            [
              <Code key="t">twitter</Code>,
              <b key="tn">Twitter v2</b>,
              "template-twitter.tsx",
              <Badge key="ts" kind="ok">Ativo</Badge>,
            ],
            [
              <Code key="f">futurista</Code>,
              "Futurista (arquivo)",
              "template-futurista.tsx",
              <Badge key="fs" kind="danger">Legacy</Badge>,
            ],
            [
              <Code key="a">autoral</Code>,
              "Autoral",
              "template-autoral.tsx",
              <Badge key="as" kind="danger">Legacy</Badge>,
            ],
          ]}
        />
        <P>
          Confusão legada: ID <Code>manifesto</Code> renderiza o template que
          chamamos de <b>Futurista</b> na UI. Não renomear (quebraria
          carrosséis salvos).
        </P>
        <SubHead>Variantes por slide (Futurista)</SubHead>
        <UL
          items={[
            "cover — full-bleed image + handle pill + título CAPS inferior. Slide 1 sempre.",
            "solid-brand — cor sólida + título CAPS topo + imagem quadrada + body bottom.",
            "full-photo-bottom — full-bleed + gradient bottom + título + body inferior.",
            "text-only — bg escuro + kicker mono + parágrafos com divisória. Máx 1× por carrossel.",
            "cta — último slide, accent button + handle.",
          ]}
        />
      </Section>

      <Section num="08" title="Emails transacionais (11)">
        <Table
          head={["#", "Email", "Trigger", "Endpoint", "Flag idempotência"]}
          rows={[
            ["1", "Welcome", "D+0 signup", "client call", "welcome_sent_at"],
            ["2", "Activation Nudge", "D+2 sem gerar", "cron 15 UTC", "activation_nudge_sent_at"],
            ["3", "First Carousel", "Pós 1ª gen", "/api/generate inline", "first_carousel_sent_at"],
            ["4", "Onboarding HowItWorks", "D+1", "cron drip 14 UTC", "onboarding_how_it_works_sent_at"],
            ["5", "Onboarding First Case", "D+3", "cron drip", "onboarding_first_case_sent_at"],
            ["6", "Onboarding Why Upgrade", "D+7 (só free)", "cron drip", "onboarding_why_upgrade_sent_at"],
            ["7", "Plan Limit", "≥80% (só free)", "cron 16 UTC", "plan_limit_sent_at:YYYY-MM"],
            ["8", "Re-Engagement", "Dormente 7+d", "cron terça 17 UTC", "re_engagement_sent_at"],
            ["9", "Payment Success", "checkout.completed", "/api/stripe/webhook", "—"],
            ["10", "Payment Failed", "invoice.failed", "/api/stripe/webhook", "—"],
            ["11", "Last Chance Coupon", "free + limite + D+7", "cron 18 UTC", "last_chance_coupon_sent_at"],
          ]}
        />
        <P>
          Layout base em <Code>lib/email/templates/_layout.tsx</Code>. Domínio:{" "}
          <Code>EMAIL_FROM</Code> env var — fallback sandbox Resend se não
          setado (risco spam, ver §14).
        </P>
      </Section>

      <Section num="09" title="Sistema de feedback + memória IA">
        <P>
          Tabela <Code>carousel_feedback</Code>: raw_text (user livre) +
          classified_buckets (text/image/both) + text_rules + image_rules.
        </P>
        <P>
          Classifier Gemini 2.5 Flash (thinkingBudget:0) — 0-3 regras por
          bucket, imperativas, PT-BR, ≤120 chars. Custo ~$0.0003.
        </P>
        <P>
          Memória injetada em <Code>profiles.brand_analysis.__generation_memory</Code>{" "}
          (text_rules[] + image_rules[], cap 20, FIFO case-insensitive). Peso
          alto no writer (regra vence genérica) e no image decider.
        </P>
        <P>
          Admin view: <Link href="/app/admin/feedback" style={{ textDecoration: "underline" }}>/app/admin/feedback</Link>
        </P>
      </Section>

      <Section num="10" title="Crons + schedules">
        <Table
          head={["Path", "Schedule UTC", "maxDuration", "Função"]}
          rows={[
            [<Code key="an">/api/cron/activation-nudge</Code>, "0 15 * * *", "60s", "Email #2"],
            [<Code key="pl">/api/cron/plan-limit</Code>, "0 16 * * *", "60s", "Email #7"],
            [<Code key="re">/api/cron/re-engagement</Code>, "0 17 * * 2", "60s", "Email #8"],
            [<Code key="od">/api/cron/onboarding-drip</Code>, "0 14 * * *", "60s", "Emails #4/5/6"],
            [<Code key="lc">/api/cron/last-chance-coupon</Code>, "0 18 * * *", "60s", "Email #11"],
            [<Code key="ur">/api/cron/usage-reset</Code>, "0 0 1 * *", "60s", "Reset mensal usage_count"],
            [<Code key="hc">/api/cron/healthcheck</Code>, "0 12 * * *", "30s", "Ping monitoria"],
          ]}
        />
        <P>
          Autenticados via <Code>CRON_SECRET</Code> (header{" "}
          <Code>Authorization: Bearer</Code>). Check em{" "}
          <Code>lib/server/cron-auth.ts</Code>.
        </P>
      </Section>

      <Section num="11" title="Env vars obrigatórias (produção)">
        <UL
          items={[
            "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL",
            "GEMINI_API_KEY, ANTHROPIC_API_KEY",
            "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_PRO_{MONTHLY,YEARLY}, STRIPE_PRICE_ID_BUSINESS_{MONTHLY,YEARLY}",
            "RESEND_API_KEY, EMAIL_FROM",
            "SERPER_API_KEY, APIFY_API_TOKEN (ou APIFY_API_KEY), SCRAPECREATORS_API_TOKEN, SUPADATA_API_KEY",
            "META_APP_ID, CRON_SECRET",
            "NEXT_PUBLIC_GA_MEASUREMENT_ID (opcional), GEMINI_IMAGE_MODEL (override opcional)",
          ]}
        />
      </Section>

      <Section num="12" title="Domínios e deploys">
        <UL
          items={[
            "Prod: viral.kaleidos.com.br (alias sequencia-viral.vercel.app)",
            "Projeto Vercel que importa: sequencia-viral (ignorar postflow legado)",
            "Branch main → auto-deploy. Manual: vercel --prod --yes",
            "GitHub: gmadureiraa/postflow",
          ]}
        />
      </Section>

      <Section num="13" title="Admin emails autorizados">
        <Table
          head={["Email", "Gate UX", "Gate server"]}
          rows={ADMIN_EMAILS.map((email) => [
            <Code key={email}>{email}</Code>,
            <Badge key={`${email}-ux`} kind="ok">isAdminEmail()</Badge>,
            <Badge key={`${email}-s`} kind="ok">requireAdmin()</Badge>,
          ])}
        />
        <P>
          Fonte única: <Code>lib/admin-emails.ts</Code>. Server-side gate em{" "}
          <Code>lib/server/auth.ts::requireAdmin</Code>.
        </P>
      </Section>

      <Section num="14" title="Inconsistências conhecidas (auditoria cross-env)">
        <SubHead>P0 (bloqueante)</SubHead>
        <UL
          items={[
            "[CORRIGIDO] app/app/onboarding/page.tsx: R$ 97 hardcoded → R$ 199,90.",
            "[CORRIGIDO] tests/stripe-plans.test.ts atualizado: agora expecta PLANS.pro.priceMonthly=9990, business=19990, usageLimitForPaidPlan('business')=30, stripePaymentAmount=99.90/199.90.",
          ]}
        />
        <SubHead>P1 (alto)</SubHead>
        <UL
          items={[
            "[CORRIGIDO] Tempo de promessa padronizado em ~60s em toda copy pública (landing v2, activation-nudge subject, re-engagement, login, onboarding, blog posts).",
            "[CORRIGIDO] app/app/login/page.tsx agora lê ?coupon=VIRAL50.",
            "[CORRIGIDO] app/app/checkout/page.tsx mostra VIRAL50 como placeholder.",
            "Migrations não aplicadas em prod: welcome_coupon.sql (BEMVINDO30) + BETA50 seed + stripe_events_processed + carousel_images + user_images + brand_image_refs (tabelas ausentes).",
          ]}
        />
        <SubHead>P2 (médio)</SubHead>
        <UL
          items={[
            "EMAIL_FROM fallback = onboarding@resend.dev. Garantir viral@kaleidos.com.br na Vercel.",
            "Modelo Claude Sonnet 4.6 hardcoded em generation-log.ts — confirmar ou upgradar.",
            "AUTOPUBLISH_BUMP em pricing.ts é dead code enquanto feature não voltar.",
            "Arquivos template-futurista.tsx e template-autoral.tsx marcados LEGACY mas ainda importados — cleanup quando DB não tiver mais refs.",
            "docs/audit/* e docs/planning/* têm preços antigos (R$ 49 / R$ 97). Docs históricos.",
          ]}
        />
        <P>
          <b>Saudáveis</b>: JSON-LD SoftwareApplication, pricing-section,
          compare-section, checkout, terms, emails com preço, crons, DB coupons
          (VIRAL50).
        </P>
      </Section>
    </motion.div>
  );
}

// ───────────────────────────────── bits ─────────────────────────────────

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div
        className="uppercase mb-3 flex items-center gap-2"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 10.5,
          letterSpacing: "0.2em",
          color: "var(--sv-muted)",
          fontWeight: 700,
        }}
      >
        <span style={{ color: "var(--sv-ink)" }}>Nº {num}</span>
        <span>·</span>
        <span>{title}</span>
      </div>
      <div
        className="italic"
        style={{
          fontFamily: "var(--sv-display)",
          fontSize: 28,
          letterSpacing: "-0.02em",
          color: "var(--sv-ink)",
          marginBottom: 14,
          lineHeight: 1.08,
        }}
      >
        {title}.
      </div>
      {children}
    </section>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase mt-5 mb-2"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 10,
        letterSpacing: "0.18em",
        color: "var(--sv-ink)",
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function P({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        fontFamily: "var(--sv-sans)",
        fontSize: 13.5,
        lineHeight: 1.6,
        color: "var(--sv-ink)",
        margin: "8px 0",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul
      style={{
        fontFamily: "var(--sv-sans)",
        fontSize: 13.5,
        lineHeight: 1.6,
        color: "var(--sv-ink)",
        paddingLeft: 18,
        listStyle: "disc",
        margin: "8px 0",
      }}
    >
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: 4 }}>
          {it}
        </li>
      ))}
    </ul>
  );
}

function OrderedList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol
      style={{
        fontFamily: "var(--sv-sans)",
        fontSize: 13.5,
        lineHeight: 1.6,
        color: "var(--sv-ink)",
        paddingLeft: 22,
        listStyle: "decimal",
        margin: "8px 0",
      }}
    >
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: 4 }}>
          {it}
        </li>
      ))}
    </ol>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 11.5,
        background: "var(--sv-soft)",
        padding: "1.5px 5px",
        border: "1px solid var(--sv-ink)",
        color: "var(--sv-ink)",
      }}
    >
      {children}
    </code>
  );
}

type BadgeKind = "ok" | "warn" | "danger" | "neutral";
function Badge({
  children,
  kind = "neutral",
}: {
  children: React.ReactNode;
  kind?: BadgeKind;
}) {
  const bg =
    kind === "ok"
      ? "var(--sv-green)"
      : kind === "warn"
        ? "var(--sv-yellow)"
        : kind === "danger"
          ? "var(--sv-pink)"
          : "var(--sv-soft)";
  return (
    <span
      className="uppercase"
      style={{
        fontFamily: "var(--sv-mono)",
        fontSize: 9,
        letterSpacing: "0.14em",
        fontWeight: 700,
        padding: "2px 7px",
        background: bg,
        color: "var(--sv-ink)",
        border: "1px solid var(--sv-ink)",
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div
      style={{
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "3px 3px 0 0 var(--sv-ink)",
        overflow: "auto",
        margin: "12px 0",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--sv-sans)",
          fontSize: 12.5,
        }}
      >
        <thead style={{ background: "var(--sv-paper)" }}>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--sv-muted)",
                  fontWeight: 700,
                  borderBottom: "1.5px solid var(--sv-ink)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderTop: "1px solid rgba(10,10,10,0.08)" }}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "10px 12px",
                    color: "var(--sv-ink)",
                    verticalAlign: "top",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
