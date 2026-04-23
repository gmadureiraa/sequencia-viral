import Link from "next/link";
import type { Metadata } from "next";
import {
  PlusCircle,
  Mic,
  Layers,
  ImageIcon,
  Download,
  Sparkles,
  ArrowRight,
  FileText,
  Brain,
  MessageSquare,
  Palette,
  Lightbulb,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Guia · Sequência Viral",
  description:
    "Tutorial prático do produto — como criar, treinar voz, usar modo avançado, escolher template e exportar.",
};

interface GuideCard {
  step: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  accent?: "green" | "pink" | "ink" | "paper";
}

const CARDS: GuideCard[] = [
  {
    step: "01",
    icon: <PlusCircle size={18} strokeWidth={2} />,
    title: "Criar seu primeiro carrossel",
    body:
      "No menu, clique em Criar. Cola um link (YouTube, artigo, post do Instagram), um texto solto, ou escreve a ideia direto. Escolhe o template visual (Futurista ou Twitter) e clica gerar. A IA devolve um carrossel completo em ~15-25s.",
    actionLabel: "Criar agora",
    actionHref: "/app/create/new",
    accent: "green",
  },
  {
    step: "02",
    icon: <Lightbulb size={18} strokeWidth={2} />,
    title: "Ideias sugeridas pra desbloquear",
    body:
      "Sem ideia do que postar? No Criar, o painel de sugestões mostra 6 conceitos baseados no seu nicho, voz e posts recentes. Clica numa e vai direto pro briefing preenchido. Pra puxar 6 novas, clica Regerar.",
    accent: "paper",
  },
  {
    step: "03",
    icon: <Brain size={18} strokeWidth={2} />,
    title: "Writer vs Layout-only",
    body:
      "Dois modos. Writer: IA usa seu briefing como inspiração e escreve do zero (hooks, escada, CTA). Layout-only: você já escreveu o texto, ela só quebra em slides sem reescrever. Escolhe no topo do Criar antes de gerar.",
    accent: "paper",
  },
  {
    step: "04",
    icon: <Mic size={18} strokeWidth={2} />,
    title: "Treinar a IA com sua voz",
    body:
      "Em Ajustes → Voz da IA, cola 3 links de posts seus (ou de referência). A IA lê legenda + OCR dos slides e extrai o DNA: hook, estrutura, CTA, vocabulário. Também dá pra listar tabus (palavras banidas) e regras fixas — tipo 'sem emoji em título'.",
    actionLabel: "Configurar voz",
    actionHref: "/app/settings?tab=voice",
    accent: "pink",
  },
  {
    step: "05",
    icon: <Palette size={18} strokeWidth={2} />,
    title: "Referências visuais da marca",
    body:
      "Em Ajustes → Branding padrão, sobe até 3 imagens que representam a estética da sua marca (paleta, iluminação, mood). O Gemini Vision lê e persiste a descrição — todas as imagens geradas depois seguem essa linha. Economia real de tempo de edição.",
    actionLabel: "Subir refs",
    actionHref: "/app/settings?tab=branding",
    accent: "paper",
  },
  {
    step: "06",
    icon: <Layers size={18} strokeWidth={2} />,
    title: "Modo avançado (briefing cirúrgico)",
    body:
      "No Criar, ativa Modo avançado e destrava: direcionamento do gancho, CTA customizado, número exato de slides (6-12), travar estilo (data / story / provocative), contexto extra, upload de fotos suas. Tudo opcional — deixa desligado pra geração rápida.",
    accent: "paper",
  },
  {
    step: "07",
    icon: <MessageSquare size={18} strokeWidth={2} />,
    title: "Perguntar antes de gerar",
    body:
      "Dentro do Modo avançado, o toggle Perguntar antes de gerar faz a IA ler seu briefing e devolver 1-2 perguntas cirúrgicas — tipo 'qual foi o resultado exato?' ou 'é pra qual público?'. Você responde, ela gera. Output fica MUITO mais específico.",
    accent: "paper",
  },
  {
    step: "08",
    icon: <Sparkles size={18} strokeWidth={2} />,
    title: "Escolher template visual",
    body:
      "Dois templates disponíveis. Futurista: editorial cinematográfico, tipografia dramática, imagens IA tema-específicas — ideal pra conteúdo editorial denso. Twitter: screenshot de tweet, visual minimalista, ideal pra linha conversacional/thread.",
    accent: "paper",
  },
  {
    step: "09",
    icon: <ImageIcon size={18} strokeWidth={2} />,
    title: "Como as imagens são geradas",
    body:
      "Capa: Gemini 3.1 Flash Image (IA cinematográfica). Slides internos: alternam entre Flash Image e stock do Google Images (via Serper). No editor você pode trocar qualquer uma por: Buscar (stock), Gerar IA (imagem única) ou Upload (sua foto). Cada slide é independente.",
    accent: "paper",
  },
  {
    step: "10",
    icon: <Download size={18} strokeWidth={2} />,
    title: "Exportar e publicar",
    body:
      "Quando o carrossel tá pronto, clica Exportar. Três opções: PNG por slide (pack de arquivos 1080×1350), PDF único com todos os slides, ou ZIP com tudo junto + legenda em .txt. Pronto pra Instagram e LinkedIn.",
    accent: "ink",
  },
  {
    step: "11",
    icon: <FileText size={18} strokeWidth={2} />,
    title: "Feedback que treina a IA",
    body:
      "Na biblioteca, cada carrossel tem polegar pra cima / pra baixo + campo de comentário. A IA lê o feedback e, na próxima geração, reforça o que você gostou e evita o que rejeitou. Quanto mais feedback, mais a IA cola no seu estilo.",
    actionLabel: "Ver biblioteca",
    actionHref: "/app/carousels",
    accent: "paper",
  },
];

function accentStyles(accent: GuideCard["accent"]) {
  switch (accent) {
    case "green":
      return {
        background: "var(--sv-green)",
        color: "var(--sv-ink)",
        shadow: "4px 4px 0 0 var(--sv-ink)",
      };
    case "pink":
      return {
        background: "var(--sv-pink)",
        color: "var(--sv-ink)",
        shadow: "4px 4px 0 0 var(--sv-ink)",
      };
    case "ink":
      return {
        background: "var(--sv-ink)",
        color: "var(--sv-paper)",
        shadow: "4px 4px 0 0 var(--sv-green)",
      };
    default:
      return {
        background: "var(--sv-white)",
        color: "var(--sv-ink)",
        shadow: "3px 3px 0 0 var(--sv-ink)",
      };
  }
}

export default function HelpPage() {
  return (
    <div
      className="mx-auto w-full px-4 sm:px-6"
      style={{ maxWidth: 1100, paddingBottom: 80 }}
    >
      <span className="sv-eyebrow">
        <span className="sv-dot" /> Guia prático
      </span>

      <h1
        className="sv-display mt-4"
        style={{
          fontSize: "clamp(40px, 6vw, 60px)",
          lineHeight: 0.98,
          letterSpacing: "-0.025em",
          fontWeight: 400,
        }}
      >
        Tudo que você precisa
        <br />
        pra <em style={{ color: "var(--sv-ink)" }}>postar direito</em>.
      </h1>

      <p
        className="mt-5"
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--sv-muted)",
          maxWidth: 620,
        }}
      >
        11 passos curtos. Sem jargão, sem rodeio. Cada card explica uma parte do produto — leia em ordem ou vai direto pro que você precisa agora.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/app/create/new"
          className="sv-btn sv-btn-primary"
          style={{ padding: "11px 18px", fontSize: 11 }}
        >
          <PlusCircle size={13} strokeWidth={2.5} />
          Criar carrossel
        </Link>
        <Link
          href="/app/settings"
          className="sv-btn sv-btn-outline"
          style={{ padding: "11px 18px", fontSize: 11 }}
        >
          Ajustes do perfil
        </Link>
      </div>

      <div
        className="mt-12 grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {CARDS.map((card) => {
          const ac = accentStyles(card.accent);
          return (
            <article
              key={card.step}
              className="flex flex-col"
              style={{
                background: ac.background,
                color: ac.color,
                border: "1.5px solid var(--sv-ink)",
                boxShadow: ac.shadow,
                padding: "22px 22px 20px",
                minHeight: 260,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    opacity: 0.7,
                  }}
                >
                  Nº {card.step}
                </span>
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 30,
                    height: 30,
                    border: "1.5px solid currentColor",
                    background: "transparent",
                  }}
                  aria-hidden
                >
                  {card.icon}
                </span>
              </div>

              <h3
                className="sv-display"
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  lineHeight: 1.1,
                  letterSpacing: "-0.015em",
                  marginTop: 16,
                }}
              >
                {card.title}
              </h3>

              <p
                className="mt-2 flex-1"
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  opacity: 0.8,
                }}
              >
                {card.body}
              </p>

              {card.actionLabel && card.actionHref && (
                <Link
                  href={card.actionHref}
                  className="mt-4 inline-flex items-center gap-1.5 self-start"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: ac.color,
                    borderBottom: "1.5px solid currentColor",
                    paddingBottom: 2,
                  }}
                >
                  {card.actionLabel}
                  <ArrowRight size={11} strokeWidth={2.5} />
                </Link>
              )}
            </article>
          );
        })}
      </div>

      {/* Créditos Kaleidos — pequeno, no fim */}
      <div
        className="mt-16 flex flex-wrap items-center justify-between gap-4 pt-8"
        style={{ borderTop: "1.5px solid var(--sv-ink)" }}
      >
        <div
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          O padrão editorial do Sequência Viral foi desenhado em anos de criação
          de conteúdo da Kaleidos — agência que move marcas por trás de posts,
          threads, newsletters e campanhas.
        </div>
        <a
          href="https://kaleidos.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "var(--sv-ink)",
          }}
        >
          kaleidos.com.br ↗
        </a>
      </div>
    </div>
  );
}
