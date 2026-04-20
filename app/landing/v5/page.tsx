import { TopNav } from "@/components/landing/top-nav";
import { Hero } from "@/components/landing/hero";
import { Ticker } from "@/components/landing/shared";
import { PainSection } from "@/components/landing/pain-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CompareSection } from "@/components/landing/compare-section";
import { DemoSection } from "@/components/landing/demo-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { LpVariantTracker } from "@/components/landing/lp-variant-tracker";

/**
 * Variante /landing/v5 — ANGLE: ANTI-CANVA
 * Target: creator que já usa Canva diariamente, sente o atrito do arrasta-e-solta,
 * quer sair mas não tem pra onde ir. Hipótese: converte melhor quem nomeia o
 * inimigo (Canva) e oferece uma saída direta sem hostilizar o usuário.
 * Evento PostHog: lp_viewed { lp_variant: "anti-canva" }
 *
 * Frame do ângulo:
 *   "Canva é ótimo pra identidade visual. Péssimo pra carrossel editorial."
 * Nunca fala mal do Canva em si — fala mal do processo de usar Canva pra
 * carrossel. A cura é uma categoria diferente de ferramenta, não um Canva melhor.
 */
export default function LandingAntiCanva() {
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
      <LpVariantTracker variant="anti-canva" />
      <TopNav />

      {/* HERO — nomeia o inimigo no primeiro segundo */}
      <Hero
        eyebrow="O Canva não foi feito pra carrossel"
        h1={
          <>
            <span className="block">Pare de arrastar</span>
            <span className="block">
              <span className="sv-splash">caixa de texto</span>.
            </span>
            <span className="block">
              Comece a <span className="sv-under">escrever</span>.
            </span>
          </>
        }
        subtitle={
          <>
            Canva é ótimo pra identidade visual. Péssimo pra carrossel editorial.{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
              3h arrastando caixinha, alinhando fonte, duplicando slide
            </b>{" "}
            — você achou que ia criar, tá só operando ferramenta. Aqui cola o link,
            a IA escreve. Em 15 segundos.
          </>
        }
        primaryCtaLabel="Sair do Canva grátis →"
        topBadge="✦ Zero arrasta-solta"
        bottomBadge="Fim do template 4521"
        trustPills={["Zero template", "Sem cartão", "5 grátis"]}
      />

      <Ticker />

      {/* PAIN — 4 cards 100% sobre o workflow Canva */}
      <PainSection
        sub="O que 3h no Canva deixa pra trás"
        tag="Canva fatigue"
        heading={
          <>
            200 <em>templates</em>. Mesmo atalho.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Mesmo feed genérico que todo mundo já descobriu.
            </span>
          </>
        }
        pains={[
          {
            tag: "Sintoma 01",
            title: (
              <>
                <em>3 horas</em> arrastando caixa pra 1 carrossel.
              </>
            ),
            body: "Abre o template. Duplica o slide. Arrasta o texto. Alinha no pixel. Troca a fonte. Volta. Corrige. Agora o slide 2. × 8. A tarde foi embora — você tem 6 slides e zero energia pra postar.",
            cross: "3h · 8 slides",
          },
          {
            tag: "Sintoma 02",
            title: (
              <>
                <em>200 templates</em>, mesmo feed.
              </>
            ),
            body: "Você reconhece o layout no explorar. Eu reconheço. O algoritmo reconhece. O template 4521 viral em março tá no feed de 30 mil creators em abril. Seu post some no meio.",
            cross: "Feed genérico",
          },
          {
            tag: "Sintoma 03",
            title: (
              <>
                Você tá operando ferramenta, <em>não criando</em>.
              </>
            ),
            body: "A ideia era escrever. A realidade é shift + arrastar, Ctrl+D, alinhar na guide, reselecionar grupo, trocar a cor porque o roxo não bateu. Cada clique é 3 segundos que não são texto.",
            cross: "Execução mata ideia",
          },
          {
            tag: "Sintoma 04",
            title: (
              <>
                Copiar, colar, ajustar fonte <em>× 8 slides</em>.
              </>
            ),
            body: "Todo carrossel vira o mesmo ritual: copia o texto do doc, cola, ajusta tamanho porque estourou a caixa, quebra linha na mão. No 5º slide a fonte ficou 2px diferente do slide 1. Só você percebe. Você ainda corrige.",
            cross: "Pixel pushing",
          },
        ]}
        plotTwist={{
          eyebrow: "O plot twist",
          title: (
            <>
              Canva foi feito pra <em>identidade visual</em>. Carrossel editorial
              pede{" "}
              <span
                style={{
                  background: "var(--sv-ink)",
                  color: "var(--sv-green)",
                  padding: "0 5px",
                  fontStyle: "italic",
                }}
              >
                outra categoria de ferramenta.
              </span>
            </>
          ),
          caption: (
            <>
              <span>Desliza pra baixo</span>
              <span style={{ opacity: 1 }}>— é a saída ↓</span>
            </>
          ),
        }}
      />

      {/* HOW IT WORKS — contraste explícito com Canva em cada passo */}
      <HowItWorks
        sub="O contrário do Canva"
        tag="Sem arrastar"
        heading={
          <>
            Três passos.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Zero caixa de texto pra arrastar.
            </span>{" "}
            Zero template pra escolher.
          </>
        }
        steps={[
          {
            n: "01",
            img: "hero-ear.png",
            title: (
              <>
                <em>Cole</em> o link. Nada mais.
              </>
            ),
            body: "No Canva: abre um template em branco. Aqui: cola o link do YouTube, do artigo, do Reel. Sem escolher formato, sem escolher template, sem abrir canvas vazio.",
          },
          {
            n: "02",
            img: "step-typewriter.png",
            title: (
              <>
                A IA <em>escreve</em>. Com a sua voz.
              </>
            ),
            body: "No Canva: você escreve, digita, quebra linha, dimensiona. Aqui: a IA lê a fonte, aplica seu tom (pilares, audiência, tabus) e devolve 3 carrosséis prontos. Você só escolhe o ângulo.",
          },
          {
            n: "03",
            img: "hero-megaphone.png",
            title: (
              <>
                Ajusta inline. <em>Exporta</em>. Posta.
              </>
            ),
            body: "No Canva: PNG incerto, fonte trocou no export, margem saiu errada. Aqui: preview é o PNG. 1080×1350 pixel-perfect, direto no celular. Acabou.",
          },
        ]}
      />

      {/* COMPARE — coração do ângulo, vem antes das features */}
      <CompareSection
        sub="Canva × Sequência Viral"
        tag="Lado a lado"
        heading={
          <>
            <em>Canva</em> serve pra muita coisa.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Carrossel editorial não é uma delas.
            </span>
          </>
        }
        columns={["Sequência Viral", "Canva Pro", "ChatGPT + Canva", "Agência freela"]}
        rows={[
          ["Tempo por carrossel", "~ 15 segundos", "2–3 horas", "1h (texto) + 1h30 (diagramar)", "48–72h de prazo"],
          ["Ponto de partida", "✦ Link do vídeo/post", "Template em branco", "Prompt vazio", "Brief por email"],
          ["Arrastar caixa de texto", "✦ Nenhum arrasta-e-solta", "Cada slide × 8", "Cada slide × 8", "Quem arrasta é outro"],
          ["Templates pra escolher", "✦ Zero. IA desenha.", "200+ iguais", "Depois do prompt, 200+", "Do portfolio da agência"],
          ["Usa o seu tom", "✦ Voz configurável (@seu-handle)", "Só tipografia", "Com prompt detalhado", "Depende do copywriter"],
          ["Imagem por slide", "✦ Contextual, na sua estética", "Stock photo genérico", "Stock + edição manual", "Banco de imagens"],
          ["Exportar pra Instagram", "✦ PNG 1080×1350, 1 clique", "Export manual por slide", "Export manual × 8", "WeTransfer do freela"],
          ["Feed não parece template 4521", "✦ Sim, cada slide único", "— Todos usam os mesmos", "— Template no final", "Depende"],
          ["Custo pra postar todo dia", "R$ 49/mês", "R$ 56/mês + 3h/dia", "R$ 40/mês + 2h/dia", "R$ 800–3000/mês"],
        ]}
      />

      {/* DEMO — visual de como é colar link */}
      <DemoSection />

      {/* FEATURES — features que o Canva NÃO tem */}
      <FeaturesSection
        sub="O que Canva não faz"
        tag="Não é template"
        heading={
          <>
            Não é um <em>Canva melhor</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              É uma ferramenta diferente, pro que Canva nunca foi.
            </span>
          </>
        }
        bigCard={{
          kicker: "Preview é o export",
          title: (
            <>
              Sem surpresa <em>no PNG</em>.
            </>
          ),
          body: (
            <>
              No Canva, o export dá fonte diferente, margem errada, cor mudou. Aqui
              o slide que você vê é o byte-a-byte do PNG. 1080×1350. Pixel-perfect.
            </>
          ),
          slideMeta: "Slide 01 / 04 · PNG real",
          slideHeadline: (
            <>
              Zero surpresa no export.{" "}
              <em style={{ color: "var(--sv-green)" }}>O que você vê sai.</em>
            </>
          ),
          slideHandle: "@sequencia-viral",
        }}
        aestheticCard={{
          badge: "Anti-feed-genérico",
          kicker: "Sua estética virou prompt",
          title: (
            <>
              Feed único. <em>Sem template 4521.</em>
            </>
          ),
          body: (
            <>
              No Canva todo mundo usa os mesmos 200 templates. Aqui você cola 3
              imagens de referência da sua marca. A IA destila paleta, textura e
              mood, replica em TODA imagem gerada. Ninguém mais tem esse feed.
            </>
          ),
          footer: "↓ Aplicado em 100% dos slides",
        }}
        voiceCard={{
          kicker: "Voice samples",
          title: (
            <>
              Seu tom, <em>não o do template.</em>
            </>
          ),
          body: (
            <>
              Canva copia a tipografia. Aqui a IA aprende sua voz com 10 posts reais
              seus e escreve dentro dela. Pilares, gírias, tabus, cadência.
            </>
          ),
          inputTitle: "Entrada",
          inputBody: "@seu-handle · 10 posts + regras",
          outputTitle: "Saída",
          outputBody: "Carrossel que parece seu",
        }}
        editorCard={{
          kicker: "Edit inline",
          title: (
            <>
              <em>Quer ajustar?</em> Ajusta aqui mesmo.
            </>
          ),
          body: (
            <>
              Sem exportar pro Canva, sem abrir outro software. Texto, fonte, layout,
              variante. Edita, re-exporta, posta. Nunca mais abriu um .fig.
            </>
          ),
        }}
        imageCard={{
          kicker: "YouTube → Carrossel",
          title: (
            <>
              Cola o link. <em>A IA transcreve.</em>
            </>
          ),
          body: (
            <>
              Canva não lê YouTube. ChatGPT não transcreve. Aqui é automático — link
              do vídeo vira transcrição vira ângulos vira carrossel. Sem copy/paste.
            </>
          ),
        }}
      />

      <PricingSection />

      {/* TESTIMONIALS — 3 creators que saíram do Canva */}
      <TestimonialsSection
        sub="Saíram do Canva"
        tag="Ex-usuárias"
        heading={
          <>
            Creators que <em>desinstalaram</em> o Canva.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Pelo menos pra carrossel.
            </span>
          </>
        }
        noticeLabel="Exemplos ilustrativos · depoimentos reais em breve"
        tweets={[
          {
            av: "A",
            avClass: "",
            name: "Ana Escala",
            handle: "@ana.escala",
            role: "Creator SaaS · 34k",
            body: (
              <>
                3 anos no Canva Pro. Pagava R$ 56/mês e gastava 3h por carrossel.
                Mudei pra Sequência Viral há 2 meses.{" "}
                <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
                  Cancelei o Pro. Posto 4× mais. Feed parou de parecer template.
                </b>{" "}
                Meu Canva virou só pra storie e capa de YouTube agora — que é pra
                onde ele sempre serviu mesmo.
              </>
            ),
          },
          {
            av: "L",
            avClass: "pink",
            name: "Lucas Onchain",
            handle: "@lucas.onchain",
            role: "Analista cripto · 22k",
            body: (
              <>
                Pagava freela R$ 400 por carrossel porque eu não aguentava mais
                Canva. 5 por mês = R$ 2.000.{" "}
                <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
                  Hoje pago R$ 49 e faço em 15s, no meu tom.
                </b>{" "}
                A IA pegou minhas gírias (&quot;thesis off&quot;, &quot;alpha
                barato&quot;) sem eu pedir. Nem o freela fazia isso.
              </>
            ),
          },
          {
            av: "M",
            avClass: "ink",
            name: "Dra. Mariana",
            handle: "@dra.mariana.sono",
            role: "Educadora médica",
            body: (
              <>
                Tentei Canva por 6 meses. Abria, olhava os 200 templates, fechava.
                Zero posts.{" "}
                <b style={{ background: "var(--sv-green)", padding: "0 3px", fontWeight: 500 }}>
                  Agora colo o link do meu artigo, sai carrossel em 2 min.
                </b>{" "}
                Em 3 semanas postei mais do que em 6 meses de Canva. Sem culpa de
                template.
              </>
            ),
          },
        ]}
      />

      {/* FAQ — responde exatamente as dúvidas do usuário ex-Canva */}
      <FAQSection
        sub="FAQ · ex-Canva"
        tag="Perguntas honestas"
        heading={
          <>
            Perguntas de quem <em>já abriu o Canva</em> hoje.
          </>
        }
        items={[
          {
            q: (
              <>
                Preciso <em>deletar</em> o Canva?
              </>
            ),
            a: "Não. Canva é ótimo pra identidade visual — capa de YouTube, storie, banner de site, apresentação, brand kit. Continue usando pra isso. Sequência Viral substitui Canva só pra carrossel editorial: o uso onde Canva exige 3h e devolve feed genérico. Muitos clientes ficam com os dois: Canva pra visual, SV pra carrossel.",
          },
          {
            q: (
              <>
                E se eu quiser <em>ajustar manualmente</em> depois?
              </>
            ),
            a: "Ajusta aqui mesmo, inline. Cada slide é editável: texto, fonte, variante de layout (capa, headline, quote, split, CTA), ordem. Você pode também trocar uma imagem específica sem regerar o carrossel todo. Se ainda assim quiser levar pro Canva, exporta o PNG e usa como base — funciona, mas 95% dos usuários descobrem que não precisa.",
          },
          {
            q: (
              <>
                Meu <em>brand kit</em> do Canva vai pra onde?
              </>
            ),
            a: "Você cola 3 imagens de referência (pode ser 3 prints do seu feed atual ou do seu brand kit Canva) e a IA extrai paleta, tipografia, textura e mood. É mais denso que um brand kit tradicional — captura a estética, não só as cores. Se você tem paleta em hex e quer subir manualmente, dá também. Em 2 minutos seu DNA visual tá dentro.",
          },
          {
            q: (
              <>
                E se a IA gerar <em>template igual</em> ao do Canva?
              </>
            ),
            a: "Não gera. Os slides são compostos em runtime com base na sua estética + texto do slide + arquétipo narrativo. Não existe template 4521 pra reutilizar. Cada carrossel é um layout único desenhado pro conteúdo específico. É o oposto de banco de templates.",
          },
          {
            q: (
              <>
                Faço carrossel pros meus <em>clientes</em> de agência. Dá pra usar?
              </>
            ),
            a: "Dá. Plano Agência suporta múltiplas 'vozes' (uma por cliente), múltiplos brand kits e exporta em lote. Agências que migraram relatam: reduzem 70% do tempo de produção, tiram o carrossel do Canva Pro compartilhado do time, libera o designer pra trabalho que não é pixel pushing de slide.",
          },
          {
            q: (
              <>
                A IA <em>inventa</em> coisas que não tão na fonte?
              </>
            ),
            a: "Não. A IA trabalha só em cima da fonte que você colou — transcrição, artigo, nota. Se não tá na fonte, não entra no carrossel. Modo avançado deixa você revisar os 3 ângulos antes da IA escrever. Duas camadas de controle. Nenhum risco de alucinação factual.",
          },
          {
            q: (
              <>
                Funciona com qualquer <em>vídeo</em> do YouTube?
              </>
            ),
            a: "Qualquer vídeo público com áudio audível. Transcrevemos em português, inglês e espanhol. Vídeos acima de 2h levam alguns minutos extras — a transcrição roda em background enquanto você trabalha em outra coisa. Lives e podcasts longos funcionam.",
          },
          {
            q: (
              <>
                Posso <em>cancelar</em> quando quiser?
              </>
            ),
            a: "Sem fidelidade. Cancela pelo painel em 2 cliques. Se cancelar no mesmo mês que assinou, devolvemos integral. Sem perguntar, sem formulário de retenção. No plano Agência, rateio proporcional.",
          },
          {
            q: (
              <>
                Quem tá <em>por trás</em> da Sequência Viral?
              </>
            ),
            a: (
              <>
                Produto da <b>Kaleidos Digital</b>, agência brasileira de marketing
                de conteúdo. A gente atende criadores, fintechs e projetos
                cripto/web3. Depois de 3 anos vendo clientes reclamando do Canva pra
                carrossel (e nosso time perdendo tarde inteira arrastando caixinha),
                construímos a ferramenta que queríamos pra nós mesmos.
              </>
            ),
          },
        ]}
      />

      {/* FINAL CTA — última chamada */}
      <FinalCTA
        eyebrow="Feche o Canva"
        heading={
          <>
            Que hoje seja seu{" "}
            <em style={{ color: "var(--sv-green)" }}>último carrossel</em>
            <br />
            no Canva.
          </>
        }
        subtitle="Cola um link do seu vídeo, artigo ou ideia. A IA devolve carrossel editorial pronto, na sua voz, com sua estética. Em 15 segundos. Seu Canva que desculpe."
        primaryCtaLabel="Fazer agora, grátis →"
      />

      <Footer />
    </main>
  );
}
