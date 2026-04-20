import { TopNav } from "@/components/landing/top-nav";
import { Hero } from "@/components/landing/hero";
import { Ticker } from "@/components/landing/shared";
import { PainSection, type PainCard } from "@/components/landing/pain-section";
import { HowItWorks, type HowItWorksStep } from "@/components/landing/how-it-works";
import { DemoSection } from "@/components/landing/demo-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CompareSection } from "@/components/landing/compare-section";
import { PricingSection } from "@/components/landing/pricing-section";
import {
  TestimonialsSection,
  type TestimonialTweet,
} from "@/components/landing/testimonials-section";
import { FAQSection, type FAQItem } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { LpVariantTracker } from "@/components/landing/lp-variant-tracker";

/**
 * Variante /landing/v3 — ANGLE: VOZ / AUTENTICIDADE
 * Target: creator com marca já estabelecida (alguns milhares de seguidores),
 *         cuida do tom, teme usar ferramentas que "diluem".
 * Hipótese: converte melhor quem lê ChatGPT e reconhece na primeira frase —
 *           e se orgulha da própria escrita.
 * Evento PostHog: lp_viewed { lp_variant: "voz" }
 */

const PAINS_VOZ: PainCard[] = [
  {
    tag: "Diagnóstico 01",
    title: (
      <>
        Seus últimos 5 posts podem ter sido escritos por <em>qualquer um</em>.
      </>
    ),
    body: "Tira o seu @ da bio. Dá pra adivinhar que é seu? Quando a IA escreve no seu lugar sem ler você primeiro, a autoria evapora. Vira conteúdo que podia estar em qualquer feed.",
    cross: "Autoria evaporada",
  },
  {
    tag: "Diagnóstico 02",
    title: (
      <>
        O ChatGPT <em>responde</em>. Só não responde como você.
      </>
    ),
    body: "O modelo genérico não sabe que você começa parágrafo com frase curta. Não sabe que você nunca usa 'você sabia que'. Não sabe do exemplo do seu cliente da semana passada. Escreve bem, mas sem DNA.",
    cross: "Sem DNA",
  },
  {
    tag: "Diagnóstico 03",
    title: (
      <>
        Você lê um post e <em>reconhece</em> o ChatGPT na primeira frase.
      </>
    ),
    body: "Os travessões no meio. O 'não apenas X, mas também Y'. O bullet point com emoji no início. A conclusão em três adjetivos. Se você reconhece no feed dos outros, seu público reconhece no seu.",
    cross: "Cheiro de IA",
  },
  {
    tag: "Diagnóstico 04",
    title: (
      <>
        Marca <em>invisível</em> é marca fraca.
      </>
    ),
    body: "Quem construiu voz ao longo de anos não pode terceirizar pra um modelo que fala igual pra todo mundo. No momento em que você dilui, o algoritmo deixa de te distinguir. O feed premia quem soa inconfundível.",
    cross: "Diluição silenciosa",
  },
];

const HOW_STEPS_VOZ: HowItWorksStep[] = [
  {
    n: "01",
    img: "hero-ear.png",
    title: (
      <>
        A IA <em>lê</em> você.
      </>
    ),
    body: "Cola seu @ ou 3 posts que você acha que representam você bem. A IA destila vocabulário, ritmo, tipo de abertura, fechamentos favoritos, tabus. Seu DNA vira restrição no prompt.",
  },
  {
    n: "02",
    img: "step-typewriter.png",
    title: (
      <>
        A IA <em>escreve</em> no seu tom.
      </>
    ),
    body: "Cola a fonte (vídeo, artigo, nota). A IA extrai o conteúdo e redige dentro das suas regras. Seus tiques, sua cadência, seus exemplos recorrentes. Não é a voz do modelo: é a sua.",
  },
  {
    n: "03",
    img: "hero-megaphone.png",
    title: (
      <>
        Você <em>relê</em> e reconhece.
      </>
    ),
    body: "O carrossel sai pronto. Você lê, ajusta duas vírgulas, talvez troca uma palavra. Posta. Ninguém no feed desconfia que teve IA no meio, porque a assinatura continua sua.",
  },
];

const TWEETS_VOZ: TestimonialTweet[] = [
  {
    av: "J",
    avClass: "",
    name: "Julia Cortez",
    handle: "@juliaescreve",
    role: "Ensaísta · 38k seguidores",
    body: (
      <>
        Meu texto tem um vício: começo frase com verbo. Nunca falei isso pra
        ninguém, é tique.{" "}
        <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
          Colei 5 ensaios meus na Sequência Viral e o primeiro carrossel saiu começando
          3 slides com verbo.
        </b>{" "}
        Não pedi. Ela leu. É a primeira IA que não me força a reescrever o output pra
        soar como eu.
      </>
    ),
  },
  {
    av: "R",
    avClass: "pink",
    name: "Raul Pires",
    handle: "@raul.pensa",
    role: "Ensino de filosofia · 12k",
    body: (
      <>
        Testei com um texto meu de 2022 que nem eu lembrava mais. A IA recuperou uma
        expressão que eu usava na época ("isso é capaz de...") e colocou num slide.{" "}
        <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
          Li três vezes porque parecia coisa que eu escreveria hoje sobre aquele
          tópico antigo.
        </b>{" "}
        É reverente com o autor. Coisa rara.
      </>
    ),
  },
  {
    av: "S",
    avClass: "ink",
    name: "Sofia Tanaka",
    handle: "@sofia.design",
    role: "Design editorial · consultora",
    body: (
      <>
        Escrevo pra marca de cliente há 11 anos. Cada cliente tem voz, regras, tabus.{" "}
        <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
          Configurei 4 perfis de voz na SV, cada um com suas amostras e restrições.
        </b>{" "}
        Agora entrego 3x mais carrossel sem cliente desconfiar que mudei de processo.
        A voz continua a deles, só a execução ficou rápida.
      </>
    ),
  },
];

const FAQ_VOZ: FAQItem[] = [
  {
    q: (
      <>
        Como a IA <em>aprende</em> minha voz?
      </>
    ),
    a: (
      <>
        Três entradas combinadas. Primeiro, você cola até 10 posts que representam
        você bem (Twitter, LinkedIn, legenda). Segundo, você lista tabus e regras
        explícitas (&quot;nunca começo com pergunta retórica&quot;, &quot;não uso
        emoji&quot;, &quot;evito travessão&quot;). Terceiro, você adiciona 3 exemplos
        de aberturas favoritas. A IA extrai padrões estatísticos (frequência de
        vocabulário, comprimento médio de frase, conectivos preferidos, estrutura de
        abertura e fechamento) e usa isso como restrição rígida no prompt. Toda vez
        que você ajusta um carrossel de saída, esse feedback volta pro modelo da sua
        voz. Quanto mais você usa, mais fina fica.
      </>
    ),
  },
  {
    q: (
      <>
        A IA vai <em>copiar</em> meu texto literal?
      </>
    ),
    a: "Não. A IA aprende padrões, não frases. Ela pode repetir um tique estrutural (frase curta abrindo, verbo no início), mas o conteúdo de cada slide vem da fonte que você colou — um vídeo novo, um artigo novo, uma ideia nova. O que se repete é o como, não o quê. Se quiser forçar uma assinatura exata (sua frase de fechamento, por exemplo), você adiciona como regra fixa.",
  },
  {
    q: (
      <>
        E se eu quiser <em>mudar o tom</em> depois?
      </>
    ),
    a: "Você tem perfis de voz ilimitados. Um mais ensaístico, um mais direto, um pra cliente. Troca com um clique antes de gerar. Também dá pra editar qualquer perfil a qualquer momento: sobe novas amostras, ajusta regras, tira os tabus antigos. O modelo reaprende em segundos. Nada é fixo — a voz acompanha o autor.",
  },
  {
    q: (
      <>
        E se minha voz <em>ainda não está clara</em> pra mim?
      </>
    ),
    a: "Esse é o caso mais útil. Você cola 10 posts que sente que são 'você' e a IA devolve um relatório da sua voz — vocabulário dominante, estrutura recorrente, tabus invisíveis. Já ouvimos de creator: 'não sabia que começava 40% dos posts com verbo imperativo'. Vira uma ferramenta de diagnóstico antes de ser ferramenta de geração.",
  },
  {
    q: (
      <>
        A IA vai <em>alucinar</em> um fato meu?
      </>
    ),
    a: "Não. A voz controla o como. O conteúdo factual vem exclusivamente da fonte que você colou (transcrição, artigo, nota). Se não estiver na fonte, não entra. No modo avançado, você revisa os ângulos propostos antes da IA escrever. Duas camadas. Sua voz sem risco de colocar coisa na sua boca.",
  },
  {
    q: (
      <>
        Dá pra usar com <em>cliente</em> ou só no meu @?
      </>
    ),
    a: (
      <>
        Um dos casos de uso mais fortes. Você configura um perfil de voz por cliente
        (amostras do @ dele, regras específicas, tabus). Gera em nome dele sem
        precisar contratar redator. O conteúdo continua com a assinatura do cliente.
        Você cobra pela execução, não pela escrita — e ninguém do outro lado
        desconfia que houve IA.
      </>
    ),
  },
  {
    q: (
      <>
        Os <em>slides</em> e a estética seguem minha marca também?
      </>
    ),
    a: "Sim. A voz cuida do texto; as referências visuais cuidam da estética. Você sobe 3 imagens que representam sua marca (post antigo, moodboard, foto). A IA destila paleta, textura, densidade e aplica em toda imagem gerada. A consistência é total: linha editorial + linha visual, sob a mesma assinatura.",
  },
  {
    q: (
      <>
        Posso <em>cancelar</em> quando quiser?
      </>
    ),
    a: "Sem fidelidade. Cancela pelo painel em 2 cliques. Seus perfis de voz, amostras e regras ficam salvos por 90 dias após o cancelamento — se voltar, continua de onde parou. Se cancelar no mesmo mês que assinou, devolvemos integral.",
  },
  {
    q: (
      <>
        Quem tá por <em>trás</em> do Sequência Viral?
      </>
    ),
    a: (
      <>
        Sequência Viral é um produto da <b>Kaleidos Digital</b>, agência brasileira
        de marketing de conteúdo. A gente trabalha com creators, fundadores e marcas
        com voz forte — e cansou de ver ferramenta de IA que achatava autoria.
        Construímos o que queríamos usar com nossos clientes.
      </>
    ),
  },
];

export default function LandingVoz() {
  return (
    <main
      style={{
        background: "var(--sv-paper)",
        color: "var(--sv-ink)",
        fontFamily: "var(--sv-sans)",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <LpVariantTracker variant="voz" />
      <TopNav />
      <Hero
        eyebrow="Sua voz · não ChatGPT"
        h1={
          <>
            <span className="block">Seu carrossel.</span>
            <span className="block">
              Sem cara de <span className="sv-splash">IA</span>.
            </span>
            <span className="block">
              Com a <span className="sv-under">sua voz</span>.
            </span>
          </>
        }
        subtitle={
          <>
            A IA lê 3 posts seus antes de escrever qualquer coisa. Ela aprende seus
            tiques, sua cadência, seus exemplos —{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
              e escreve dentro dessas regras em cada slide
            </b>
            . Você relê e reconhece como seu.
          </>
        }
        primaryCtaLabel="Testar com minha voz →"
        topBadge="✦ DNA editorial"
        bottomBadge="Sua voz · não template"
        trustPills={["Aprende em 3 posts", "Sem cartão", "5 carrosséis grátis"]}
      />
      <Ticker />
      <PainSection
        sub="A diluição silenciosa"
        tag="Diagnóstico"
        heading={
          <>
            <em>ChatGPT</em> é ótimo.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Mas todo mundo usa. Dá pra reconhecer no primeiro parágrafo.
            </span>
          </>
        }
        pains={PAINS_VOZ}
        plotTwist={{
          eyebrow: "A tese",
          title: (
            <>
              Você passou anos construindo uma voz.{" "}
              <span
                style={{
                  background: "var(--sv-ink)",
                  color: "var(--sv-green)",
                  padding: "0 5px",
                  fontStyle: "italic",
                }}
              >
                Não faz sentido
              </span>{" "}
              terceirizar isso pra um modelo que fala igual pra todo mundo.
            </>
          ),
          caption: (
            <>
              <span>A cura</span>
              <span style={{ opacity: 1 }}>— IA lendo você ↓</span>
            </>
          ),
        }}
      />
      <HowItWorks
        sub="Como a IA aprende você"
        tag="Três atos"
        heading={
          <>
            A IA lê, escreve, você reconhece.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Nenhum desses passos envolve diluir sua assinatura.
            </span>
          </>
        }
        steps={HOW_STEPS_VOZ}
      />
      <DemoSection
        sub="Sua voz, aplicada"
        tag="~15 segundos"
        heading={
          <>
            Cola uma <em>fonte</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Sai um carrossel que passa no teste do &quot;parece coisa que eu
              escreveria&quot;.
            </span>
          </>
        }
      />
      <FeaturesSection
        sub="Arquitetura de voz"
        tag="Produto"
        heading={
          <>
            Engenharia de <em>autoria</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Não preenchimento de template.
            </span>
          </>
        }
        bigCard={{
          kicker: "Voice samples",
          title: (
            <>
              3 posts seus viram
              <br />
              <em>restrição rígida</em>.
            </>
          ),
          body: "Cola seu @ ou 10 posts favoritos. A IA extrai padrões de abertura, cadência, vocabulário e tabus — e nunca mais escreve fora disso. Seu DNA vira o prompt.",
          slideMeta: "Amostra · post 03",
          slideHeadline: (
            <>
              Começo com verbo. Corto onde outros alongariam.{" "}
              <em style={{ color: "var(--sv-green)" }}>A IA aprendeu isso.</em>
            </>
          ),
          slideHandle: "@seuhandle · tique detectado",
        }}
        aestheticCard={{
          badge: "Essencial",
          kicker: "Brand aesthetic",
          title: (
            <>
              Sua <em>assinatura visual</em> também não é ChatGPT.
            </>
          ),
          body: "3 imagens suas ensinam paleta, textura, densidade e mood. Toda imagem gerada é extensão coerente da sua marca — nunca stock photo, nunca visual que podia ser de qualquer um.",
          footer: "↓ Sua estética em cada slide",
        }}
        voiceCard={{
          kicker: "Tabus e regras",
          title: (
            <>
              Lista do que você <em>nunca</em> escreve.
            </>
          ),
          body: "'Não uso hashtag.' 'Evito emoji.' 'Nunca começo com pergunta retórica.' A IA respeita como limite duro. O que é seu permanece seu.",
          inputTitle: "Voz",
          inputBody: "@meuperfil · 10 amostras · 6 tabus",
          outputTitle: "Saída",
          outputBody: "Carrossel com seu DNA, sem emoji, sem hashtag",
        }}
        editorCard={{
          kicker: "Perfis de voz",
          title: (
            <>
              Múltiplas <em>vozes</em> salvas.
            </>
          ),
          body: "Uma voz pra você, uma pra cada cliente. Troca com um clique antes de gerar. A IA aplica as regras certas no contexto certo.",
        }}
        imageCard={{
          kicker: "Content rules",
          title: (
            <>
              Regras que <em>sobrevivem</em> ao tempo.
            </>
          ),
          body: "Sua voz evolui. Edita as amostras, ajusta os tabus, o modelo reaprende em segundos. Nenhuma regra é eterna — a sua autoria continua a mesma.",
        }}
      />
      <CompareSection
        sub="Voz vs ferramenta genérica"
        tag="Honesto"
        heading={
          <>
            Três caminhos. <em>Uma</em> voz.
          </>
        }
        columns={["Sequência Viral", "Canva", "ChatGPT", "Redator freela"]}
        rows={[
          [
            "Lê seus posts antes de escrever",
            "✦ 3 posts · 10 amostras",
            "—",
            "—",
            "Se você orientar",
          ],
          [
            "Respeita seus tabus de linguagem",
            "✦ Lista explícita",
            "—",
            "Com prompt longo",
            "Se você orientar",
          ],
          [
            "Captura seus tiques sem você pedir",
            "✦ Detecção estatística",
            "—",
            "—",
            "Só depois de muitos posts",
          ],
          [
            "Múltiplos perfis de voz salvos",
            "✦ Ilimitado",
            "—",
            "Sem memória",
            "Um redator por voz",
          ],
          [
            "Estética visual consistente",
            "✦ 3 imagens de referência",
            "Manual",
            "—",
            "Designer separado",
          ],
          [
            "Reconhecível como seu",
            "✦ Passa no teste",
            "Template genérico",
            "Cheiro de IA",
            "Depende do redator",
          ],
          ["Tempo por carrossel", "~15 seg", "45–60 min", "20 min + edição", "2–3 dias"],
          ["Custo mensal", "$9.90", "$15", "$20", "$800+"],
        ]}
      />
      <PricingSection />
      <TestimonialsSection
        sub="Creators que mantiveram voz"
        tag="Autoria"
        heading={
          <>
            <em>Autores</em>. Não operadores.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Gente que cuida do próprio tom usando a ferramenta.
            </span>
          </>
        }
        tweets={TWEETS_VOZ}
      />
      <FAQSection
        sub="FAQ"
        tag="Sobre voz"
        heading={
          <>
            O que toda marca com voz <em>pergunta primeiro</em>.
          </>
        }
        items={FAQ_VOZ}
      />
      <FinalCTA
        eyebrow="Seu primeiro carrossel com sua voz"
        heading={
          <>
            Posta algo
            <br />
            <em style={{ color: "var(--sv-green)" }}>que é seu.</em>
          </>
        }
        subtitle="Ninguém no feed precisa saber que teve IA no meio. A única assinatura visível é a sua."
        primaryCtaLabel="Treinar a IA com minha voz →"
      />
      <Footer />
    </main>
  );
}
