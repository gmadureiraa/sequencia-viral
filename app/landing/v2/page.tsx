import { TopNav } from "@/components/landing/top-nav";
import { Hero } from "@/components/landing/hero";
import { Ticker } from "@/components/landing/shared";
import { PainSection } from "@/components/landing/pain-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { DemoSection } from "@/components/landing/demo-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CompareSection } from "@/components/landing/compare-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { LpVariantTracker } from "@/components/landing/lp-variant-tracker";

/**
 * Variante /landing/v2 — ANGLE: VELOCIDADE
 * Target: criador solo exausto, posta 2x/semana, 3h por carrossel no Canva.
 * Promessa: 15 segundos de briefing → carrossel pronto pra postar.
 * Evento PostHog: lp_viewed { lp_variant: "velocidade" }
 */
export default function LandingVelocidade() {
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
      <LpVariantTracker variant="velocidade" />
      <TopNav />

      <Hero
        eyebrow="3h no Canva · 15s aqui"
        h1={
          <>
            <span className="block">3 horas pra fazer</span>
            <span className="block">
              <span className="sv-splash">1 carrossel</span>.
            </span>
            <span className="block">
              Tá na <span className="sv-under">hora</span> de parar.
            </span>
          </>
        }
        subtitle={
          <>
            Quem tem agenda cheia não tem 3 horas pra arrastar caixinha no Canva.
            Cola um link,{" "}
            <b style={{ color: "var(--sv-ink)", fontWeight: 600 }}>
              a IA escreve e monta em 15 segundos
            </b>
            . Você revisa, ajusta, posta. Ganhou a tarde.
          </>
        }
        primaryCtaLabel="Testar 5 grátis →"
        topBadge="✦ Em 15 seg"
        bottomBadge="Sua tarde de volta"
        trustPills={["~15s por carrossel", "Sem cartão", "Cancele quando quiser"]}
      />

      <Ticker />

      <PainSection
        sub="A conta que ninguém faz"
        tag="Faz as contas"
        heading={
          <>
            Você tem <em>ideia</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              E 3 horas por carrossel que não voltam mais.
            </span>
          </>
        }
        pains={[
          {
            tag: "Sintoma 01",
            title: (
              <>
                Você posta <em>2x por semana</em> e se sente devendo.
              </>
            ),
            body: "A meta era 5. Saiu 2. Não é falta de ideia, é falta de tempo pra diagramar. O algoritmo esquece quem some, e domingo à noite você já tá pagando o boleto da próxima semana.",
            cross: "Meta real: 2/7",
          },
          {
            tag: "Sintoma 02",
            title: (
              <>
                A ideia <em>esfria</em> antes do slide 5.
              </>
            ),
            body: "Bateu insight no banho, abriu o Canva às 20h. Às 22h você tá escolhendo entre Poppins 600 e Poppins 700 e a ideia que era urgente virou um rascunho esquecido no celular.",
            cross: "Urgência perdida",
          },
          {
            tag: "Sintoma 03",
            title: (
              <>
                Seu <em>domingo</em> virou dia de Canva.
              </>
            ),
            body: "3h pra fazer 1 carrossel. 4 posts na semana = 12h. É meio turno de trabalho todo domingo só pra alimentar feed. Quem posta diário conhece esse cálculo na pele.",
            cross: "12h de fim de semana",
          },
          {
            tag: "Sintoma 04",
            title: (
              <>
                O post bom sai <em>quando você já desistiu</em>.
              </>
            ),
            body: "O primeiro carrossel leva 3h. O segundo, 4h (já tá cansado). O terceiro não sai. E o que posta geralmente é o medíocre de 40 minutos, porque o bom ficou no rascunho esperando um domingo que nunca chega.",
            cross: "Qualidade refém do prazo",
          },
        ]}
        plotTwist={{
          eyebrow: "A matemática nova",
          title: (
            <>
              3 horas caíram pra <em>15 segundos</em>. O resto é teu{" "}
              <span
                style={{
                  background: "var(--sv-ink)",
                  color: "var(--sv-green)",
                  padding: "0 5px",
                  fontStyle: "italic",
                }}
              >
                tempo de volta.
              </span>
            </>
          ),
          caption: (
            <>
              <span>Rolêzinho da velocidade</span>
              <span style={{ opacity: 1 }}>— veja o passo a passo ↓</span>
            </>
          ),
        }}
      />

      <HowItWorks
        sub="Fluxo de 15 segundos"
        tag="Cronometrado"
        heading={
          <>
            Três passos.{" "}
            <span style={{ color: "var(--sv-muted)" }}>Somados,</span>{" "}
            <em>15 segundos</em> de trabalho seu.
          </>
        }
        steps={[
          {
            n: "01",
            img: "hero-ear.png",
            title: (
              <>
                <em>Cola</em> o link. <span style={{ color: "var(--sv-muted)" }}>5s.</span>
              </>
            ),
            body: "Link de YouTube, artigo, tweet ou uma frase no campo. Ctrl+V e enter. Acabou sua parte no briefing. A IA já tá transcrevendo em background.",
          },
          {
            n: "02",
            img: "step-typewriter.png",
            title: (
              <>
                A IA <em>escreve</em> e monta. <span style={{ color: "var(--sv-muted)" }}>~12s.</span>
              </>
            ),
            body: "Texto editorial com a sua voz, imagem por slide, capa + CTA. Tudo diagramado em 1080×1350. Você não abre Canva, não abre Figma, não abre ChatGPT.",
          },
          {
            n: "03",
            img: "hero-megaphone.png",
            title: (
              <>
                Revisa e <em>exporta</em>. <span style={{ color: "var(--sv-muted)" }}>depende de você.</span>
              </>
            ),
            body: "Dá uma olhada, troca duas palavras se quiser. PNG pronto pra Instagram no celular. O tempo aqui é SEU — dá 30 segundos ou dá 3 minutos, não existe obrigação.",
          },
        ]}
      />

      <DemoSection
        sub="15 segundos na tela"
        tag="Tempo real"
        heading={
          <>
            Link colado às <em>20:04:00</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>Carrossel pronto às</span>{" "}
            <em>20:04:15</em>.
          </>
        }
      />

      <FeaturesSection
        sub="O que corta 3h pra 15s"
        tag="Produto"
        heading={
          <>
            Cada feature existe por <em>um motivo</em>:{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              tirar um passo do seu domingo.
            </span>
          </>
        }
        bigCard={{
          kicker: "Preview ao vivo",
          title: (
            <>
              O que você vê
              <br />é o que <em>sai</em>.
            </>
          ),
          body: (
            <>
              Zero &quot;vamos ajustar no Canva depois&quot;. Tipografia, espaço, cor:
              o PNG que exporta é idêntico ao preview. Sem retoque final.
            </>
          ),
          slideMeta: "Slide 01 / 04 · Exportado em 0,4s",
          slideHeadline: (
            <>
              15 segundos,{" "}
              <em style={{ color: "var(--sv-green)" }}>3 carrosséis.</em>
            </>
          ),
          slideHandle: "@voce · agora",
        }}
        aestheticCard={{
          badge: "–20s",
          kicker: "Estética salva, uma vez",
          title: (
            <>
              Cola 3 refs. <em>Nunca mais</em> escolhe cor.
            </>
          ),
          body: (
            <>
              Subiu as referências na primeira vez. Pronto: todo carrossel futuro já sai com a sua paleta, textura e tipografia. Zero decisão visual na hora do post.
            </>
          ),
          footer: "↓ Aplicado em 100% dos slides",
        }}
        voiceCard={{
          kicker: "Voz em 1 clique",
          title: (
            <>
              Seu tom, <em>sem</em> prompt.
            </>
          ),
          body: (
            <>
              Conecta o @, a IA aprende em 10 posts. Você para de escrever prompt de 2 parágrafos no ChatGPT pra sair algo parecido com você.
            </>
          ),
          inputTitle: "Entrada · 10s",
          inputBody: "Cola link. Só isso.",
          outputTitle: "Saída · 15s",
          outputBody: "Carrossel com o seu tom já aplicado",
        }}
        editorCard={{
          kicker: "Variantes em 1 clique",
          title: (
            <>
              Layout <em>novo</em> em 2 segundos.
            </>
          ),
          body: (
            <>
              Não gostou do slide 3? Clica e troca entre 6 layouts prontos. Não volta pro Canva, não redesenha. 2 segundos por ajuste, limite são os seus dedos.
            </>
          ),
        }}
        imageCard={{
          kicker: "Imagem pronta",
          title: (
            <>
              Zero <em>stock photo</em>. Zero busca.
            </>
          ),
          body: (
            <>
              Uma ilustração por slide, gerada no tema do texto. Não abre Unsplash, não paga Shutterstock, não perde 15 min escolhendo foto.
            </>
          ),
        }}
      />

      <CompareSection
        sub="Cronômetro não mente"
        tag="Tempo real"
        heading={
          <>
            <em>15 segundos</em> aqui.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              O resto do mundo cobra sua tarde.
            </span>
          </>
        }
        columns={["Sequência Viral", "Canva", "ChatGPT + Canva", "Manual"]}
        rows={[
          [
            "Tempo total por carrossel",
            "✦ ~15 segundos",
            "45–60 min",
            "20 min prompt + 40 min design",
            "2–3 horas",
          ],
          [
            "Tempo pra 4 posts na semana",
            "✦ 1 min",
            "~4 horas",
            "~4 horas",
            "~12 horas",
          ],
          [
            "Transcrever vídeo de YouTube",
            "✦ Automático · 3s",
            "—",
            "Copia/cola manual · 10min",
            "Escuta na mão · 30min",
          ],
          [
            "Diagramar 6 slides",
            "✦ Automático",
            "~20 min arrastando",
            "Nada — precisa outro app",
            "Do zero no Figma · 1h",
          ],
          [
            "Trocar layout de 1 slide",
            "✦ 2s (1 clique)",
            "~3 min",
            "Não aplicável",
            "~5 min",
          ],
          [
            "Exportar pronto pra postar",
            "✦ 1 clique · PNG 1080×1350",
            "Export manual",
            "Não exporta",
            "Export + ajuste tamanho",
          ],
          [
            "Custo pra postar todo dia",
            "$9.90/mês",
            "$15/mês + seu tempo",
            "$20/mês + seu tempo",
            "Seu fim de semana inteiro",
          ],
        ]}
      />

      <PricingSection />

      <TestimonialsSection
        sub="Tempo recuperado"
        tag="Números reais"
        heading={
          <>
            Mesmo criador, <em>3 vezes mais posts</em>.{" "}
            <span style={{ color: "var(--sv-muted)" }}>
              Só mudou o tempo por carrossel.
            </span>
          </>
        }
        noticeLabel="Exemplos ilustrativos · depoimentos reais chegam em breve"
        tweets={[
          {
            av: "R",
            avClass: "",
            name: "Rafael Porto",
            handle: "@rafa.porto",
            role: "Creator solo · growth · 18k",
            body: (
              <>
                Contei os minutos. Do link colado até o PNG exportado:{" "}
                <b
                  style={{
                    background: "var(--sv-green)",
                    padding: "0 3px",
                    fontWeight: 500,
                  }}
                >
                  18 segundos. O Canva sozinho me levava 48 minutos.
                </b>{" "}
                Passei de 2 posts por semana pra 6. A tarde de domingo voltou pra mim.
              </>
            ),
          },
          {
            av: "L",
            avClass: "pink",
            name: "Lívia Amaral",
            handle: "@livia.copy",
            role: "Copywriter freelancer · 11k",
            body: (
              <>
                Eu cobrava 3h por carrossel pra cliente. Agora faço 4 versões no tempo que fazia 1.{" "}
                <b
                  style={{
                    background: "var(--sv-green)",
                    padding: "0 3px",
                    fontWeight: 500,
                  }}
                >
                  Faturei R$ 7.200 no mês passado com o tempo que antes ia pra Canva.
                </b>{" "}
                Nenhum cliente percebeu que o bottleneck deixou de existir.
              </>
            ),
          },
          {
            av: "M",
            avClass: "ink",
            name: "Dra. Mariana",
            handle: "@dra.mariana.sono",
            role: "Medicina do sono · educadora",
            body: (
              <>
                Antes: 2h pra transformar um artigo em carrossel pra leigos.{" "}
                <b
                  style={{
                    background: "var(--sv-green)",
                    padding: "0 3px",
                    fontWeight: 500,
                  }}
                >
                  Agora: 6 minutos, incluindo a revisão médica.
                </b>{" "}
                Postei 14 dias seguidos pela primeira vez em 3 anos de perfil. Não precisei contratar social media.
              </>
            ),
          },
        ]}
      />

      <FAQSection
        sub="Perguntas de quem ainda tá na dúvida"
        tag="Direto ao ponto"
        heading={
          <>
            As dúvidas que <em>custam tempo</em>.
          </>
        }
        items={[
          {
            q: (
              <>
                15 segundos é <em>real</em> ou é marketing?
              </>
            ),
            a: "Cronometrado. Link colado no campo, botão 'gerar', carrossel pronto no preview em 12 a 18 segundos. Varia pela duração do vídeo (se for fonte YouTube) e carga dos servidores. Em nenhum teste interno passou de 22s. O que leva tempo é a sua revisão — e esse tempo é seu, não da ferramenta.",
          },
          {
            q: (
              <>
                E se a IA <em>errar</em>, não perco tempo corrigindo?
              </>
            ),
            a: "Editor inline, 2 cliques por correção. Troca texto direto no slide, regenera só o que não ficou bom, muda de layout em 1 toque. A correção média dos nossos usuários é 40 a 90 segundos — ainda assim você sai com 2 minutos totais, contra 3 horas no fluxo antigo. Se a IA errar feio, você refaz o carrossel inteiro em mais 15s. Sem perda.",
          },
          {
            q: (
              <>
                Vale pra quem posta <em>só 1x por semana</em>?
              </>
            ),
            a: "Vale mais ainda. Se você posta pouco é porque cada post custa 2–3h. Tirando esse custo, você não fica limitado à janela de domingo: grava o vídeo na terça, faz o carrossel na terça mesmo em 15s, posta na quarta. Uma pessoa que postava 4x por mês vira alguém que posta 12x sem trabalhar mais.",
          },
          {
            q: (
              <>
                Preciso saber <em>design</em>?
              </>
            ),
            a: "Não. A IA já entrega tipografia, hierarquia, espaçamento e cor resolvidos. Você não escolhe fonte, não alinha caixa, não decide paleta. O que chega no preview é a versão final. Quem quer customizar tem acesso a 6 layouts por slide — um clique, sem edição.",
          },
          {
            q: (
              <>
                E se eu quiser só <em>inspiração</em>, não o post inteiro?
              </>
            ),
            a: "Dá pra usar como gerador de rascunhos também. Cola a fonte, pega os 3 conceitos que a IA propõe em 4 segundos, usa só o que te interessar. Muita gente usa o Sequência Viral pra destravar bloqueio: em vez de olhar a página em branco por 20 minutos, você vê 3 ângulos em 4 segundos e escolhe um.",
          },
          {
            q: (
              <>
                Posso usar <em>comercialmente</em>? (Agência, cliente, etc.)
              </>
            ),
            a: "Sim. Todo conteúdo gerado é seu: texto, imagens, PNGs. Uso pessoal, cliente, revenda — sem royalty, sem pedir autoria. Agências que entregam 4 posts/semana por cliente costumam recuperar 12+ horas por conta. A única regra: não republicar a ferramenta em si.",
          },
          {
            q: (
              <>
                Quanto tempo leva pra <em>começar</em>?
              </>
            ),
            a: "Signup em 20s (Google ou email). Primeiro carrossel sai em 15s depois disso. Total: menos de 1 minuto do momento que você clica o botão até o primeiro PNG exportado. Sem cartão, 5 carrosséis grátis.",
          },
          {
            q: (
              <>
                Posso <em>cancelar</em> quando quiser?
              </>
            ),
            a: "Sem fidelidade. Cancela em 2 cliques pelo painel. Cancelou no mesmo mês que assinou, devolvemos integral. No plano Agência, rateio proporcional. A gente cobra pela velocidade — se não entregou velocidade, não fica com seu dinheiro.",
          },
        ]}
      />

      <FinalCTA
        eyebrow="Pronto pra ganhar a tarde de volta?"
        heading={
          <>
            Seu próximo carrossel
            <br />
            <em style={{ color: "var(--sv-green)" }}>em 15 segundos.</em>
          </>
        }
        subtitle="Cola um link. A IA escreve, monta, arte inclusa. Você revisa em 1 min e posta. O resto do domingo é seu."
        primaryCtaLabel="Testar 5 grátis — 15s →"
      />

      <Footer />
    </main>
  );
}
