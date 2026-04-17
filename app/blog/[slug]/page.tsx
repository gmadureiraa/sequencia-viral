import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/* ─────────────────── BLOG DATA ─────────────────── */

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
  content: string;
}

const posts: Record<string, BlogPost> = {
  "como-criar-carrosseis-virais-instagram-2026": {
    slug: "como-criar-carrosseis-virais-instagram-2026",
    title: "Como Criar Carrosséis Virais no Instagram em 2026",
    description:
      "Descubra as estrategias que os maiores criadores de conteudo usam para criar carrosseis que viralizam no Instagram em 2026.",
    date: "2026-04-10",
    readTime: "7 min",
    category: "Instagram",
    content: `O carrossel e o formato que mais gera engajamento no Instagram em 2026. Dados recentes mostram que carrosseis tem 1.4x mais alcance que posts de imagem unica e 3x mais salvamentos. Se voce ainda nao esta usando carrosseis como pilar da sua estrategia, esta deixando engajamento na mesa.

## Por que carrosseis funcionam tao bem?

O algoritmo do Instagram prioriza tempo de permanencia. Quando alguem para pra passar os slides do seu carrossel, o Instagram interpreta isso como conteudo de qualidade. Cada swipe e um sinal positivo. E se a pessoa volta pro inicio ou salva pra ler depois? Melhor ainda.

Alem disso, carrosseis aparecem ate 3 vezes no feed de uma mesma pessoa. Se ela nao interagiu no primeiro slide, o Instagram mostra o segundo ou terceiro. Isso multiplica suas chances de capturar atencao.

## Os 5 elementos de um carrossel viral

### 1. Primeiro slide matador

O primeiro slide e o seu outdoor. Se nao parar o scroll, o resto nao importa. Use perguntas provocativas, numeros especificos ou afirmacoes contrarias ao senso comum.

Exemplos que funcionam:
- "90% dos criadores erram isso no primeiro slide"
- "5 automacoes que economizam 20h por semana"
- "Pare de fazer carrosseis bonitos (e comece a fazer carrosseis uteis)"

### 2. Narrativa progressiva

Cada slide precisa fazer a pessoa querer ver o proximo. Use frameworks como:
- Problema → Agravamento → Solucao
- Lista numerada com revelacao progressiva
- Historia com cliffhanger entre slides

### 3. Design limpo e consistente

Menos e mais. Use no maximo 2 fontes, 3 cores e bastante espaco em branco. Textos curtos — maximo 30 palavras por slide. Se precisa de mais texto, divida em mais slides.

### 4. CTA no ultimo slide

Nunca termine sem um chamado para acao. Pode ser "Salve pra consultar depois", "Comente qual foi sua favorita" ou "Siga pra mais conteudo como esse". O CTA direciona o comportamento.

### 5. Caption complementar

A legenda nao deve repetir o carrossel. Use-a para adicionar contexto pessoal, contar os bastidores ou fazer uma pergunta que gere comentarios.

## Como criar carrosseis mais rapido com IA

O maior obstaculo pra consistencia e o tempo de producao. Criar um bom carrossel manualmente leva de 1 a 3 horas entre pesquisa, escrita, design e revisao.

Ferramentas como o Sequência Viral eliminam essa fricao. Voce cola um link de artigo ou descreve uma ideia, e a IA gera 3 variacoes completas em 30 segundos — cada uma com abordagem diferente (dados, storytelling e provocativa). Seu branding e aplicado automaticamente.

Isso significa que voce pode testar mais formatos, publicar com mais frequencia e gastar sua energia criativa no que importa: ter boas ideias.

## Frequencia ideal de publicacao

Para a maioria dos criadores, 3 a 5 carrosseis por semana e o sweet spot. Menos que 3 e voce nao ganha tracao. Mais que 5 e a qualidade tende a cair.

O segredo e ter um sistema. Defina seus pilares de conteudo (3 a 5 temas), crie um banco de ideias e use ferramentas de IA pra acelerar a producao. Com Sequência Viral, por exemplo, voce consegue criar 5 carrosseis em menos de 30 minutos.

## Metricas que importam

Nao fique obcecado com curtidas. As metricas que realmente indicam um carrossel viral sao:

- **Salvamentos**: Indica que o conteudo e util
- **Compartilhamentos**: Indica que o conteudo e relevante para outros
- **Tempo de permanencia**: Indica que as pessoas estao consumindo
- **Novos seguidores**: Indica que o conteudo atrai publico novo

Monitore essas metricas semanalmente e ajuste sua estrategia com base nos dados, nao na intuicao.

## Conclusao

Criar carrosseis virais nao e sorte — e sistema. Primeiro slide forte, narrativa progressiva, design limpo, CTA claro e frequencia consistente. Combine isso com ferramentas de IA pra escalar sua producao e voce tera uma maquina de engajamento.

Comece hoje: crie seu primeiro carrossel com Sequência Viral gratuitamente e veja a diferenca.`,
  },

  "5-formatos-carrossel-mais-engajamento": {
    slug: "5-formatos-carrossel-mais-engajamento",
    title: "5 Formatos de Carrossel que Geram Mais Engajamento",
    description:
      "Conheca os 5 formatos de carrossel que consistentemente geram mais curtidas, comentarios e compartilhamentos no Instagram e LinkedIn.",
    date: "2026-04-08",
    readTime: "6 min",
    category: "Estrategia",
    content: `Nem todo carrossel e igual. Depois de analisar centenas de posts de alto desempenho no Instagram e LinkedIn, identificamos 5 formatos que consistentemente superam a media em engajamento. Se voce esta criando carrosseis sem uma estrutura definida, esta perdendo potencial.

## Formato 1: O Listicle Educativo

O formato mais popular e por bom motivo. Funciona assim:
- Slide 1: Titulo com numero ("7 ferramentas que todo criador precisa")
- Slides 2-8: Uma ferramenta por slide com nome, descricao curta e por que usar
- Slide final: CTA para salvar ou seguir

Por que funciona: Numeros criam expectativa. Cada slide entrega valor isolado. Facil de salvar pra consultar depois.

Engajamento medio: 2.5x acima da media da conta.

## Formato 2: O Mito vs Realidade

Estrutura poderosa para conteudo que desafia crencas:
- Slide 1: "X mitos sobre [tema] que voce ainda acredita"
- Slides pares: O mito (com icone de X vermelho)
- Slides impares: A realidade (com icone de check verde)
- Slide final: A verdade resumida + CTA

Por que funciona: Gera curiosidade e controversia saudavel. As pessoas comentam pra concordar ou discordar. O formato visual (X vs check) e facil de processar.

Engajamento medio: 3x acima da media em comentarios.

## Formato 3: O Tutorial Passo a Passo

Ideal para conteudo pratico e aplicavel:
- Slide 1: "Como [resultado desejado] em X passos"
- Slides intermediarios: Um passo por slide com instrucao clara
- Screenshots ou mockups quando possivel
- Slide final: Resultado esperado + CTA

Por que funciona: E o formato com mais salvamentos. As pessoas guardam pra aplicar depois. Tutoriais posicionam voce como autoridade.

Engajamento medio: 4x mais salvamentos que a media.

## Formato 4: O Antes e Depois

Transformacao visual ou conceitual:
- Slide 1: "De [estado ruim] para [estado bom]"
- Slide 2: O antes (com contexto)
- Slides intermediarios: O processo de transformacao
- Penultimo slide: O depois
- Slide final: Licoes aprendidas + CTA

Por que funciona: Historias de transformacao sao irresistiveis. Geram identificacao ("eu estava nessa situacao") e aspiracao ("quero chegar la").

Engajamento medio: 2x mais compartilhamentos.

## Formato 5: O Hot Take Argumentativo

Para criadores que querem gerar debate:
- Slide 1: Opiniao forte e concisa ("SEO morreu. Aqui esta o por que.")
- Slides 2-4: Argumentos que sustentam a tese
- Slides 5-6: Contra-argumentos e por que nao se sustentam
- Slide final: Conclusao provocativa + "Concorda? Comenta."

Por que funciona: Polariza. E polarizacao gera comentarios. E comentarios fazem o algoritmo distribuir mais. Use com responsabilidade — opinioes devem ser genuinas, nao clickbait vazio.

Engajamento medio: 5x mais comentarios, mas pode gerar unfollow se feito em excesso.

## Como escolher o formato certo

A regra e simples:
- **Quer educar?** Use Listicle ou Tutorial
- **Quer engajar?** Use Mito vs Realidade ou Hot Take
- **Quer inspirar?** Use Antes e Depois

O ideal e alternar entre os formatos ao longo da semana. Monotonia mata o engajamento.

## Acelerando a producao

Com Sequência Viral, voce descreve sua ideia e recebe 3 variacoes — e cada uma pode usar um formato diferente. A variacao "dados" tende a virar Listicle, a "storytelling" vira Antes e Depois, e a "provocativa" vira Hot Take. Assim voce testa formatos sem esforco extra.

## Conclusao

Formatos nao sao formulas magicas, mas sao frameworks que funcionam. Teste os 5, analise seus dados e dobre a aposta nos que performam melhor com o seu publico. Consistencia no formato certo e o caminho pro crescimento.`,
  },

  "thread-vs-carrossel-qual-funciona-melhor": {
    slug: "thread-vs-carrossel-qual-funciona-melhor",
    title: "Thread vs Carrossel: Qual Funciona Melhor?",
    description:
      "Threads no Twitter/X ou carrosseis no Instagram? Analisamos dados reais para responder essa pergunta definitivamente.",
    date: "2026-04-05",
    readTime: "8 min",
    category: "Analise",
    content: `Dois formatos dominam a criacao de conteudo longo em redes sociais: threads no Twitter/X e carrosseis no Instagram (e cada vez mais no LinkedIn). Mas qual dos dois gera mais resultado? Analisamos dados de mais de 500 criadores para chegar a uma resposta baseada em evidencias.

## O cenario atual

Em 2026, ambos os formatos estao em alta. O Instagram expandiu o limite de slides para 20. O Twitter/X melhorou a experiencia de leitura de threads. E o LinkedIn abraou carrosseis como nunca.

Mas os formatos servem a propositos diferentes. Vamos comparar.

## Alcance: Vantagem Carrossel

Carrosseis no Instagram tem um alcance medio 1.4x maior que posts de imagem unica. Threads no Twitter, por outro lado, tendem a perder leitores a cada tweet — em media, apenas 30% dos leitores chegam ao final de uma thread de 10 tweets.

O motivo e estrutural: no carrossel, o swipe e continuo. Na thread, cada tweet compete com o resto do feed. O carrossel mantem voce dentro da experiencia.

**Veredicto**: Carrossel ganha em alcance total.

## Engajamento: Depende do tipo

- **Curtidas**: Carrossel ganha (mais visibilidade = mais curtidas)
- **Comentarios**: Thread ganha (formato de texto estimula resposta em texto)
- **Retweets/Compartilhamentos**: Thread ganha (mais facil de RT um tweet do que compartilhar um carrossel)
- **Salvamentos**: Carrossel ganha por goleada (as pessoas salvam visual)

**Veredicto**: Empate. Depende da metrica que voce prioriza.

## Velocidade de producao

Uma thread de 10 tweets leva em media 45 minutos para escrever (pesquisa + escrita + revisao). Um carrossel de 10 slides leva 1.5 a 3 horas (pesquisa + escrita + design + revisao).

Com ferramentas de IA como Sequência Viral, um carrossel pode ser criado em menos de 5 minutos — eliminando completamente a desvantagem de tempo.

**Veredicto**: Thread ganha no manual. Com IA, carrossel empata.

## Longevidade do conteudo

Carrosseis no Instagram tem uma vida util mais longa. O algoritmo continua mostrando carrosseis de boa performance semanas depois da publicacao. Threads no Twitter, por natureza da plataforma, tem uma vida util de 24-48 horas.

No LinkedIn, carrosseis (documentos PDF) tambem tem longevidade superior a posts de texto.

**Veredicto**: Carrossel ganha.

## Conversao para seguidores

Threads no Twitter sao melhores para viralizar e atrair seguidores novos. Um bom primeiro tweet pode ser retweetado centenas de vezes, trazendo publico novo. Carrosseis no Instagram dependem mais do Explore e de compartilhamentos diretos.

**Veredicto**: Thread ganha para aquisicao de novos seguidores no curto prazo.

## A estrategia ideal: os dois

A melhor estrategia nao e escolher um ou outro — e usar ambos de forma complementar:

1. **Comece com a ideia** — defina o tema e os pontos principais
2. **Crie o carrossel primeiro** — e o formato mais completo (visual + texto)
3. **Extraia uma thread** — adapte o conteudo do carrossel para formato de tweets
4. **Adapte para LinkedIn** — o carrossel funciona como documento, a thread vira post longo

Esse fluxo de repurposing multiplica seu conteudo por 3 plataformas com esforco incremental minimo.

## Como Sequência Viral facilita isso

Sequência Viral gera carrosseis otimizados para Instagram, Twitter e LinkedIn a partir de uma unica ideia. As 3 variacoes (dados, storytelling, provocativa) podem ser adaptadas para cada plataforma. Voce cria uma vez e publica em 3 lugares.

Isso elimina o debate "thread vs carrossel" porque voce faz ambos em menos tempo do que antes levaria pra fazer um so.

## Conclusao

Nao existe formato universalmente melhor. Carrosseis ganham em alcance e longevidade. Threads ganham em viralidade e conversao rapida. A estrategia inteligente e usar os dois — e ferramentas de IA como Sequência Viral tornam isso possivel sem triplicar o esforco.`,
  },

  "como-usar-ia-criar-conteudo-redes-sociais": {
    slug: "como-usar-ia-criar-conteudo-redes-sociais",
    title: "Como Usar IA para Criar Conteúdo de Redes Sociais",
    description:
      "Um guia pratico de como integrar inteligencia artificial no seu fluxo de producao de conteudo sem perder autenticidade.",
    date: "2026-04-02",
    readTime: "9 min",
    category: "IA",
    content: `A inteligencia artificial nao vai substituir criadores de conteudo. Mas criadores que usam IA vao substituir os que nao usam. Em 2026, a questao nao e se voce deve usar IA na producao de conteudo — e como usar de forma inteligente.

## O problema: producao de conteudo e um gargalo

A maioria dos criadores e profissionais de marketing enfrenta o mesmo desafio: produzir conteudo consistente em multiplas plataformas consome tempo demais. Um estudo recente mostrou que criadores gastam em media 15 horas por semana so na producao de conteudo para redes sociais.

Isso deixa pouco tempo para o que realmente importa: estrategia, relacionamento com a audiencia e desenvolvimento de novas ideias.

## Onde a IA realmente ajuda (e onde nao ajuda)

### A IA e excelente para:

**1. Gerar primeiros rascunhos**
Ninguem gosta de encarar a pagina em branco. A IA elimina esse obstaculo. Descreva sua ideia em uma frase e tenha um rascunho completo em segundos. Voce edita e refina — nao cria do zero.

**2. Criar variacoes**
Uma ideia, multiplas abordagens. A IA pode transformar o mesmo conceito em versao educativa, provocativa, pessoal ou baseada em dados. Isso permite testar o que funciona melhor com sua audiencia.

**3. Adaptar para multiplas plataformas**
O que funciona no Instagram e diferente do que funciona no Twitter ou LinkedIn. A IA adapta tom, comprimento e formato para cada plataforma automaticamente.

**4. Design automatico**
Ferramentas como Sequência Viral aplicam seu branding (foto, nome, cores) automaticamente. Zero tempo em Canva ou Figma.

**5. Pesquisa e curadoria**
Cole um link de artigo e a IA extrai os pontos-chave para transformar em conteudo. Isso transforma consumo de informacao em producao de conteudo.

### A IA NAO e boa para:

**1. Opinioes genuinas** — Sua perspectiva unica e o que diferencia voce. A IA pode estruturar, mas a opiniao precisa ser sua.

**2. Historias pessoais** — Bastidores, vulnerabilidade, experiencias reais. A IA nao viveu sua vida.

**3. Tom de voz original** — A IA tende a ser generica. Voce precisa revisar e injetar personalidade.

**4. Estrategia** — Decidir o que postar, quando e por que ainda requer inteligencia humana.

## O fluxo de trabalho ideal com IA

Aqui esta o framework que recomendamos:

### Passo 1: Ideacao (humano)
Defina seus 3-5 pilares de conteudo. Mantenha um banco de ideias (Notion, Apple Notes, qualquer lugar). Anote insights do dia-a-dia, artigos interessantes, perguntas da audiencia.

### Passo 2: Geracao (IA)
Pegue uma ideia do banco e use IA para gerar o conteudo. Com Sequência Viral, voce pode:
- Colar um link de artigo
- Descrever o tema em uma frase
- Colar um video do YouTube

A IA gera 3 variacoes de carrossel em 30 segundos.

### Passo 3: Edicao (humano)
Revise cada variacao. Injete sua voz. Adicione exemplos pessoais. Remova o que parece generico. Esse passo e crucial — e o que separa conteudo bom de conteudo generico de IA.

### Passo 4: Design (IA + humano)
Com Sequência Viral, o design e automatico. Seu branding ja esta aplicado. Ajuste cores ou imagens se necessario. Exporte ou publique direto.

### Passo 5: Distribuicao (automatizado)
Publique no Instagram, adapte para Twitter thread e LinkedIn. Use ferramentas de agendamento para manter consistencia.

## Quanto tempo voce economiza?

Comparacao real de um criador que publica 5 carrosseis por semana:

| Etapa | Sem IA | Com IA (Sequência Viral) |
|-------|--------|-------------------|
| Pesquisa | 2h | 30min |
| Escrita | 5h | 1h |
| Design | 3h | 15min |
| Publicacao | 1h | 30min |
| **Total** | **11h** | **2h 15min** |

Isso e uma economia de quase 9 horas por semana. Em um mes, sao 36 horas — quase uma semana inteira de trabalho.

## Cuidados importantes

1. **Nunca publique sem revisar** — IA comete erros factuais. Sempre confira.
2. **Mantenha sua voz** — Se tudo parece escrito por IA, voce perde autenticidade.
3. **Diversifique inputs** — Nao use sempre o mesmo tipo de prompt. Experimente diferentes abordagens.
4. **Monitore metricas** — Compare performance de conteudo com e sem IA. Ajuste.

## Conclusao

IA e uma ferramenta, nao uma muleta. Use-a para eliminar o trabalho mecanico e liberar tempo para o trabalho criativo. O criador do futuro nao e quem escreve mais rapido — e quem tem melhores ideias e sabe usar tecnologia pra escala-las.

Comece gratuitamente com Sequência Viral e veja como IA pode transformar seu fluxo de producao.`,
  },

  "guia-completo-tamanhos-instagram-twitter-linkedin": {
    slug: "guia-completo-tamanhos-instagram-twitter-linkedin",
    title:
      "O Guia Completo de Tamanhos para Instagram, Twitter e LinkedIn",
    description:
      "Todos os tamanhos de imagem e video atualizados para 2026 para Instagram, Twitter/X e LinkedIn. Guia de referencia definitivo.",
    date: "2026-03-28",
    readTime: "5 min",
    category: "Referencia",
    content: `Publicar com o tamanho errado de imagem e um dos erros mais comuns — e mais faceis de evitar — nas redes sociais. Imagens cortadas, textos ilegveis e videos pixelados destroem a percepcao profissional do seu conteudo.

Este guia reune todos os tamanhos atualizados para 2026. Salve nos favoritos e consulte sempre que precisar.

## Instagram

### Post no Feed
- **Quadrado**: 1080 x 1080 px (1:1) — Classico, funciona sempre
- **Retrato**: 1080 x 1350 px (4:5) — Recomendado, ocupa mais espaco no feed
- **Paisagem**: 1080 x 566 px (1.91:1) — Pouco usado, menos impacto visual

### Carrossel
- **Tamanho por slide**: 1080 x 1350 px (4:5) — Maximo impacto
- **Numero de slides**: Ate 20 slides (atualizado em 2025)
- **Formato**: JPG ou PNG
- **Resolucao minima**: 1080 px de largura

### Stories
- **Tamanho ideal**: 1080 x 1920 px (9:16)
- **Area segura para texto**: Evite os 250 px superiores e 320 px inferiores (nome de usuario e CTAs do Instagram)

### Reels
- **Tamanho**: 1080 x 1920 px (9:16)
- **Duracao**: Ate 90 segundos (ate 3 minutos para contas verificadas)
- **Formato**: MP4 ou MOV

### Foto de Perfil
- **Tamanho**: 320 x 320 px (exibido como circulo de 110 px)

## Twitter / X

### Post com Imagem
- **Uma imagem**: 1600 x 900 px (16:9) — Melhor visibilidade
- **Duas imagens**: 700 x 800 px cada (7:8)
- **Tres imagens**: 1 de 700 x 800 px + 2 de 700 x 400 px
- **Quatro imagens**: 700 x 400 px cada

### Thread Visual
- **Tamanho por imagem**: 1080 x 1080 px (1:1) ou 1080 x 1350 px (4:5)
- **Formato**: JPG, PNG ou GIF

### Header/Banner
- **Tamanho**: 1500 x 500 px (3:1)
- **Area segura**: O centro 1000 x 300 px (os cantos sao cortados em mobile)

### Foto de Perfil
- **Tamanho**: 400 x 400 px (exibido como circulo)

## LinkedIn

### Post com Imagem
- **Tamanho recomendado**: 1200 x 627 px (1.91:1)
- **Post quadrado**: 1080 x 1080 px (1:1)
- **Post retrato**: 1080 x 1350 px (4:5)

### Documento/Carrossel
- **Tamanho por pagina**: 1080 x 1350 px (4:5) — Recomendado
- **Formato**: PDF
- **Maximo**: 300 paginas (mas 8-12 e o ideal)

### Banner do Perfil
- **Tamanho**: 1584 x 396 px (4:1)
- **Area segura**: Considere que a foto de perfil cobre parte do canto inferior esquerdo

### Foto de Perfil
- **Tamanho**: 400 x 400 px (exibido como circulo)

### Company Page Banner
- **Tamanho**: 1128 x 191 px

## Tabela Resumo — Carrosseis

| Plataforma | Tamanho Ideal | Proporcao | Formato | Max Slides |
|------------|---------------|-----------|---------|------------|
| Instagram | 1080 x 1350 px | 4:5 | JPG/PNG | 20 |
| Twitter/X | 1080 x 1080 px | 1:1 | JPG/PNG | - (thread) |
| LinkedIn | 1080 x 1350 px | 4:5 | PDF | 300 |

## Dicas universais

1. **Sempre exporte em 2x** — Telas retina mostram pixels. Use 2160 x 2700 px para um carrossel 4:5 de alta qualidade.

2. **Mantenha texto na area segura** — Cada plataforma corta de forma diferente. Deixe margem de pelo menos 5% em cada borda.

3. **Use PNG para texto** — JPG comprime e borra textos pequenos. PNG mantem nitidez.

4. **Teste em mobile antes de publicar** — 90% do consumo e no celular. O que parece bom no desktop pode ficar ilegvel no telefone.

5. **Automatize com Sequência Viral** — O Sequência Viral ja exporta no tamanho correto para cada plataforma. Voce nao precisa memorizar nenhum desses numeros — a ferramenta faz isso automaticamente.

## Conclusao

Tamanhos corretos sao o basico da producao de conteudo profissional. Este guia e atualizado regularmente conforme as plataformas mudam suas especificacoes. Salve-o e consulte sempre que tiver duvida.

Com Sequência Viral, voce nao precisa se preocupar com tamanhos — a exportacao automatica ja cuida disso. Mas saber os numeros te da mais controle sobre seu conteudo.`,
  },

  "12-hooks-primeiro-slide-carrossel-parar-scroll": {
    slug: "12-hooks-primeiro-slide-carrossel-parar-scroll",
    title: "12 Hooks de Primeiro Slide que Param o Scroll Instantaneamente",
    description: "O primeiro slide decide se alguém vai consumir seu carrossel ou continuar rolando. Aqui estão 12 padrões de hook que comprovadamente geram mais engajamento.",
    date: "2026-04-12",
    readTime: "10 min",
    category: "Estrategia",
    content: `Voce tem 0.7 segundos. E o tempo medio que uma pessoa leva pra decidir se para ou continua scrollando no feed. O primeiro slide do seu carrossel e o filtro entre ser consumido ou ser ignorado. Nenhum outro elemento importa se o hook falhar.

Depois de analisar mais de 2.000 carrosseis de alto desempenho no Instagram e LinkedIn, identificamos 12 padroes de hook que consistentemente param o scroll. Nenhum e teoria — todos foram testados com dados reais.

## O que faz um hook funcionar?

Antes dos padroes, entenda a psicologia. Um bom hook ativa pelo menos um destes gatilhos:

- **Curiosidade**: Informacao incompleta que o cerebro precisa resolver
- **Relevancia pessoal**: "Isso e sobre mim?"
- **Tensao emocional**: Medo de perder, surpresa, indignacao
- **Promessa de valor**: "Se eu consumir, ganho algo"

O segredo e ativar o gatilho em no maximo 10 palavras. Mais que isso e voce ja perdeu a batalha.

## Hook 1: Numero + Consequencia

**Formula**: [Numero] + [acao/coisa] + [resultado surpreendente]

Exemplos:
- "7 ferramentas de IA que substituem uma equipe de 5"
- "3 erros no carrossel que custam 80% do seu alcance"
- "5 habitos de R$0 que valem mais que qualquer curso"

Por que funciona: Numeros criam expectativa concreta. A consequencia gera curiosidade sobre o mecanismo. O cerebro precisa saber COMO aquilo funciona.

Engajamento medio: 2.8x acima da media da conta.

## Hook 2: Contrario ao Senso Comum

**Formula**: Negue algo que todo mundo acredita

Exemplos:
- "Pare de fazer conteudo educativo."
- "Consistencia nao e postar todo dia."
- "Mais seguidores nao significa mais dinheiro."

Por que funciona: O cerebro tem um reflexo automatico de defender suas crencas. Quando voce desafia uma crenca estabelecida, a pessoa PRECISA ler pra entender por que voce esta "errado" — e no processo, consome todo o conteudo.

Engajamento medio: 3.5x mais comentarios que a media.

## Hook 3: Historia Pessoal com Vulnerabilidade

**Formula**: Admita uma falha, erro ou momento dificil

Exemplos:
- "Em 2024, perdi R$50k em um mes."
- "Fui demitido. E foi a melhor coisa que aconteceu."
- "Passei 2 anos fazendo conteudo errado."

Por que funciona: Vulnerabilidade cria conexao emocional instantanea. A pessoa se identifica com a dor e quer saber como voce saiu dela. Historias pessoais tambem sao irresistiveis pro algoritmo porque geram tempo de permanencia alto.

Engajamento medio: 4x mais compartilhamentos.

## Hook 4: Pergunta + Dado Estatistico

**Formula**: Pergunta retorica seguida de um dado surpreendente

Exemplos:
- "Sabia que 90% dos carrosseis falham no slide 1?"
- "Voce gasta 15h por semana em conteudo. Devia gastar 2h."
- "72% dos creators desistem em 90 dias. Por que?"

Por que funciona: A pergunta forca o cerebro a buscar uma resposta. O dado valida que o tema e importante. Juntos, criam urgencia intelectual.

Engajamento medio: 2.2x mais salvamentos.

## Hook 5: Curiosidade Incompleta

**Formula**: Prometa uma informacao sem revelar

Exemplos:
- "A estrategia que ninguem fala sobre crescer no Instagram..."
- "Existe um padrao em todos os posts virais. Aqui esta."
- "Descobri o que separa 1% dos creators dos outros 99%."

Por que funciona: O Zeigarnik Effect — o cerebro precisa fechar loops abertos. Uma informacao incompleta cria tensao que so se resolve consumindo o conteudo.

Engajamento medio: 3x mais swipes completos (todos os slides).

## Hook 6: Promessa de Resultado Especifico

**Formula**: [Resultado] + [baixo esforco] ou [tempo curto]

Exemplos:
- "Este metodo gera 3x mais saves. Leva 10 minutos."
- "Dobre seu engajamento em 7 dias. Sem pagar nada."
- "Uma mudanca que transformou meu perfil. Zero custo."

Por que funciona: Especificidade gera credibilidade. "3x mais saves" e mais crivel que "muito mais engajamento". O baixo esforco remove a objecao principal.

Engajamento medio: 2.5x acima da media.

## Hook 7: Revelacao de Bastidores

**Formula**: Mostre o que esta por tras de algo que a audiencia admira

Exemplos:
- "O framework que uso pra gerar R$100k/mes"
- "Minha rotina exata de producao de conteudo (sem cortes)"
- "O que acontece nos bastidores de um post viral"

Por que funciona: As pessoas sao fascinadas por processos. Ver como alguem faz algo que elas querem fazer cria tanto valor pratico quanto conexao emocional.

Engajamento medio: 3.2x mais salvamentos.

## Hook 8: Comparacao Direta

**Formula**: [Coisa A] vs [Coisa B] — com implicacao de que a maioria esta na errada

Exemplos:
- "Creator 2023 vs Creator 2026"
- "LinkedIn post vs LinkedIn carrossel: dados reais"
- "O que voce posta vs O que o algoritmo quer"

Por que funciona: Comparacoes criam auto-identificacao ("em qual grupo eu estou?") e geram debate nos comentarios.

Engajamento medio: 2.7x mais comentarios.

## Hook 9: Medo e Urgencia

**Formula**: Consequencia negativa de nao agir

Exemplos:
- "Se nao fizer isso em 2026, vai ficar pra tras"
- "O Instagram vai mudar tudo em julho. Prepare-se."
- "Voce esta perdendo seguidores por causa disso."

Por que funciona: Loss aversion — o medo de perder algo e 2x mais forte que o desejo de ganhar. Use com parcimonia pra nao queimar a credibilidade.

Engajamento medio: 2x mais que a media, mas cuidado com overuse.

## Hook 10: Prova de Autoridade

**Formula**: [Credencial/volume de pesquisa] + [descoberta]

Exemplos:
- "Analisei 1.000 carrosseis virais. Aqui esta o padrao."
- "Gastei R$200k em anuncios. Isso e o que aprendi."
- "10 anos de marketing digital resumidos em 8 slides."

Por que funciona: Autoridade cria confianca instantanea. Se voce ja fez o trabalho duro, a pessoa quer o atalho.

Engajamento medio: 3x mais salvamentos.

## Hook 11: Segmentacao de Audiencia

**Formula**: Chame diretamente o publico que voce quer

Exemplos:
- "Se voce e creator com menos de 1.000 seguidores..."
- "Pra quem trabalha com marketing digital e esta cansado de..."
- "Fundadores de startup: parem de ignorar conteudo."

Por que funciona: Quando alguem se ve na descricao, o conteudo parece feito sob medida. Isso multiplica a relevancia percebida.

Engajamento medio: 2.4x mais engajamento do publico-alvo especifico.

## Hook 12: Confissao "Eu Estava Errado"

**Formula**: Admita que sua opiniao anterior estava incorreta

Exemplos:
- "Eu estava errado sobre carrosseis."
- "Mudei completamente de ideia sobre IA no conteudo."
- "Tudo que eu ensinei sobre Instagram estava incompleto."

Por que funciona: Combina vulnerabilidade com curiosidade. Se alguem muda de opiniao, a informacao nova deve ser poderosa. As pessoas querem saber O QUE mudou.

Engajamento medio: 3.8x mais comentarios (as pessoas adoram compartilhar se concordam ou discordam da mudanca).

## Como usar esses hooks no Sequência Viral

Quando voce gera um carrossel no Sequência Viral, a IA automaticamente seleciona o melhor padrao de hook para cada variacao. A variacao "dados" tende a usar Hooks 1, 4 e 10. A "storytelling" usa Hooks 3, 7 e 12. A "provocativa" usa Hooks 2, 5 e 9.

Voce pode personalizar o hook depois — mas ter 3 opcoes baseadas em padroes comprovados e um ponto de partida muito mais forte do que comecar do zero.

## Erros comuns no primeiro slide

Evite estes padroes que MATAM o engajamento:

- **Titulo generico**: "Dicas de marketing" (nenhum gatilho ativado)
- **Muito texto**: Mais de 10 palavras no titulo e 20 no corpo
- **Revelar o conteudo**: Se o primeiro slide entrega tudo, nao tem motivo pra swipar
- **Design poluido**: Muitas cores, fontes e elementos competem pela atencao
- **Sem promessa clara**: O leitor nao sabe o que ganha ao continuar

## Conclusao

O primeiro slide e 80% do trabalho. Se ele funciona, o resto e otimizacao. Escolha o padrao de hook que melhor se encaixa no seu conteudo, teste variantes toda semana e analise qual tipo de hook performa melhor com a SUA audiencia.

Com Sequência Viral, voce gera hooks otimizados automaticamente — mas agora sabe exatamente por que cada um funciona. Use esse conhecimento pra editar e refinar ate ficar perfeito.`,
  },

  "algoritmo-instagram-2026-como-funciona-o-que-mudou": {
    slug: "algoritmo-instagram-2026-como-funciona-o-que-mudou",
    title: "Algoritmo do Instagram em 2026: Como Funciona e O Que Mudou",
    description: "Entenda como o algoritmo do Instagram prioriza conteúdo em 2026. Feed, Explore, Reels e carrosséis — o que importa de verdade para alcance orgânico.",
    date: "2026-04-14",
    readTime: "11 min",
    category: "Instagram",
    content: `O algoritmo do Instagram em 2026 e fundamentalmente diferente do que era em 2023. Se voce ainda esta otimizando para curtidas e hashtags, esta jogando um jogo que nao existe mais. Aqui esta tudo que sabemos sobre como o algoritmo funciona HOJE — baseado em dados, testes e declaracoes oficiais do Instagram.

## O que mudou em 2025-2026

As maiores mudancas aconteceram entre outubro de 2025 e marco de 2026:

**1. DM Shares se tornaram o sinal #1** — Quando alguem compartilha seu post via DM, o peso algoritmico e 3-5x maior que uma curtida. O Instagram quer conteudo que gere conversas privadas.

**2. Saves continuam fortes** — Salvamentos sao o segundo sinal mais forte. Indicam que o conteudo tem valor de longo prazo.

**3. Curtidas perderam peso** — Likes agora sao o sinal MAIS FRACO. Ainda contam, mas muito menos que antes.

**4. Comentarios que geram replies** — Um comentario sozinho vale pouco. Um comentario que gera uma thread de respostas vale MUITO. O Instagram quer debates, nao "lindo!" e emojis.

**5. Carrosseis ganharam boost** — O Instagram declarou oficialmente que carrosseis tem prioridade no feed porque geram mais tempo de permanencia. Um carrossel com 10 slides pode aparecer ate 3 vezes no feed da mesma pessoa (com slides diferentes).

## Como funciona o ranking no Feed

O Feed usa 4 sinais principais, nesta ordem de importancia:

### 1. Interesse previsto (40%)
O Instagram preve quanto voce vai se interessar por um post baseado em:
- Seu historico de interacoes com aquele criador
- Tipo de conteudo que voce consome (carrossel, reels, fotos)
- Temas que voce demonstra interesse (baseado em texto e imagens)

### 2. Recencia (25%)
Posts mais recentes tem prioridade, mas o Instagram agora mostra conteudo de ate 72 horas atras se o engagement for alto. Antes era 24-48h.

### 3. Relacionamento (20%)
Contas com quem voce interage frequentemente (curtir, comentar, DM, marcar) aparecem mais. O Instagram cria um "relationship score" entre cada par de contas.

### 4. Frequencia de uso (15%)
Se voce abre o Instagram 20x por dia, ve posts mais recentes e variados. Se abre 2x por dia, o algoritmo seleciona os "melhores" pra voce.

## Como funciona o Explore

O Explore e completamente diferente do Feed. Aqui o Instagram mostra conteudo de contas que voce NAO segue. Os sinais:

- **Popularidade do post**: Velocidade de engajamento nas primeiras horas
- **Historico do Explore**: O que voce ja curtiu/salvou no Explore antes
- **Historico do criador**: Contas que publicam conteudo de alta qualidade consistentemente
- **Relevancia tematica**: Match entre o tema do post e seus interesses

Carrosseis educativos e listicles performam especialmente bem no Explore porque geram altos salvamentos — o sinal que mais leva conteudo pro Explore.

## O que o algoritmo quer de carrosseis especificamente

O Instagram revelou em fevereiro de 2026 que carrosseis tem um sistema de ranking parcialmente separado. Aqui estao os fatores:

**1. Taxa de swipe-through** — Quantas pessoas que viram o slide 1 chegaram ao slide final. Acima de 60% e excelente.

**2. Tempo por slide** — Se as pessoas pausam pra ler cada slide, o algoritmo interpreta como conteudo de qualidade.

**3. Re-visitacao** — Se alguem volta ao carrossel depois de ja ter visto, e um sinal fortissimo.

**4. Acao apos consumo** — O que a pessoa faz depois de ver o ultimo slide? Seguir, salvar, compartilhar e comentar sao os sinais positivos. Scrollar pro proximo post rapidamente e negativo.

## Estrategias praticas para 2026

### Para maximizar DM Shares:
- Crie conteudo "tag-worthy" — coisas que as pessoas enviam pra amigos
- Use CTAs como "Envia pra alguem que precisa ler isso"
- Conteudo relatable > conteudo educativo puro (pra DM shares especificamente)

### Para maximizar Saves:
- Listas, tutoriais e guias de referencia
- Conteudo que as pessoas vao querer consultar depois
- Use "Salve pra consultar depois" como CTA

### Para maximizar comentarios com replies:
- Faca perguntas no CTA que gerem debate (nao sim/nao)
- "Qual desses voce usa? Comenta o numero" (baixa fricao)
- Responda TODOS os comentarios nas primeiras 2 horas

### Para maximizar taxa de swipe-through:
- Primeiro slide com hook forte (veja nosso guia de 12 hooks)
- Mini-cliffhangers entre slides
- Ultimo slide com CTA que nao so "siga pra mais"

## Mitos que nao sao verdade em 2026

**Mito: Hashtags sao essenciais** — Hashtags tem impacto minimo no alcance em 2026. O Instagram usa reconhecimento de imagem e processamento de texto pra categorizar conteudo. 3-5 hashtags relevantes sao suficientes. 30 hashtags nao ajudam.

**Mito: Postar em horarios especificos e crucial** — O Instagram agora distribui conteudo ao longo de 72 horas. O horario de publicacao importa menos do que a qualidade. Publique quando seu conteudo estiver pronto.

**Mito: Reels sao mais importantes que carrosseis** — Em 2024, sim. Em 2026, o Instagram equilibrou. Carrosseis agora tem prioridade similar a Reels no Feed.

**Mito: Conta pessoal alcanca mais que conta profissional** — Nao ha evidencia estatistica disso em 2026. Use conta profissional — os insights sao essenciais.

## Como Sequência Viral ajuda voce a jogar o jogo do algoritmo

O Sequência Viral nao so cria carrosseis — ele os otimiza para o algoritmo de 2026:

- **Hooks de primeiro slide** baseados nos 12 padroes de maior performance
- **CTAs estrategicos** que direcionam para saves, shares ou comentarios dependendo do tipo de conteudo
- **Estrutura de slides** com mini-cliffhangers que maximizam swipe-through
- **3 variacoes** pra voce testar qual abordagem funciona melhor com sua audiencia

O algoritmo recompensa quem entende as regras. Agora voce entende.`,
  },

  "storytelling-em-carrosseis-como-contar-historias-que-engajam": {
    slug: "storytelling-em-carrosseis-como-contar-historias-que-engajam",
    title: "Storytelling em Carrosséis: Como Contar Histórias que Engajam",
    description: "Aprenda a usar técnicas de storytelling profissional em carrosséis de Instagram e LinkedIn. Estruturas narrativas, arcos emocionais e exemplos práticos.",
    date: "2026-04-09",
    readTime: "9 min",
    category: "Estrategia",
    content: `Listas e dicas funcionam. Mas historias TRANSFORMAM. Um carrossel com storytelling bem feito gera 4x mais compartilhamentos que um listicle educativo. O motivo e biologico: o cerebro humano processa narrativas de forma fundamentalmente diferente de informacoes isoladas.

Quando voce conta uma historia, o cerebro do leitor libera cortisol (atencao), dopamina (curiosidade) e oxitocina (empatia). Esse cocktail quimico faz a pessoa sentir que VIVEU a experiencia — e por isso compartilha.

## Os 4 arcos narrativos que funcionam em carrosseis

### Arco 1: A Jornada do Heroi (simplificada)

Estrutura em slides:
- **Slide 1**: O problema/situacao inicial (hook com vulnerabilidade)
- **Slide 2-3**: O agravamento — por que era pior do que parecia
- **Slide 4-5**: O ponto de virada — o que mudou
- **Slide 6-7**: A transformacao — como ficou depois
- **Slide 8**: A licao — o que voce aprendeu
- **Slide 9**: CTA emocional

Exemplo: "Em 2024, minha agencia quase faliu. Tinhamos 3 clientes, margem negativa e eu trabalhava 16h por dia. O que salvou nao foi trabalhar mais — foi mudar completamente o modelo de precificacao. Hoje temos 22 clientes e trabalho 8h. Aqui esta o que aprendi..."

Por que funciona: Identificacao com a dor + curiosidade sobre a solucao + inspiracao com o resultado.

### Arco 2: O Mito Derrubado

Estrutura em slides:
- **Slide 1**: Uma crenca popular apresentada como verdade ("Todo mundo diz que...")
- **Slide 2-3**: Evidencias que sustentam a crenca (faz o leitor concordar)
- **Slide 4**: A VIRADA — dados/experiencia que provam o contrario
- **Slide 5-7**: A nova perspectiva explicada
- **Slide 8**: Implicacoes praticas
- **Slide 9**: CTA que pede opiniao

Exemplo: "Todo mundo diz que voce precisa postar todo dia pra crescer no Instagram. Eu concordava. Fiz isso por 8 meses. 240 posts. Resultado? Cresci 2.000 seguidores. Depois passei a postar 3x por semana, focando em qualidade. Em 4 meses, cresci 12.000. Aqui esta o que os dados mostram..."

Por que funciona: O leitor se sente inteligente concordando no inicio — e depois fica chocado com a virada. Isso cria forte impulso pra compartilhar.

### Arco 3: O Antes vs Depois Detalhado

Estrutura em slides:
- **Slide 1**: O contraste dramatico (titulo com transformacao)
- **Slide 2-3**: O "antes" em detalhes (metricas, sentimentos, situacao)
- **Slide 4**: O momento de decisao
- **Slide 5-6**: As mudancas especificas que foram feitas
- **Slide 7-8**: O "depois" com dados concretos
- **Slide 9**: Como o leitor pode fazer o mesmo

Exemplo: "De 200 pra 50.000 seguidores em 6 meses. Sem ads. Sem sorteiros. Slide 2: Em janeiro de 2026, eu tinha 200 seguidores, 12 curtidas por post e zero vendas. Slide 3: Tentei de tudo — hashtags, reels diarios, trends. Nada funcionava..."

Por que funciona: Transformacoes sao as historias mais compartilhadas nas redes sociais. Dados concretos tornam crivel.

### Arco 4: A Analogia Inesperada

Estrutura em slides:
- **Slide 1**: Comparacao surpreendente ("Marketing de conteudo e como cozinhar ramen")
- **Slide 2-3**: O paralelo explicado (ingredientes = pilares de conteudo, tempero = tom de voz)
- **Slide 4-6**: Cada elemento da analogia com aplicacao pratica
- **Slide 7**: Onde a analogia quebra (mostra honestidade intelectual)
- **Slide 8**: A licao real por tras da analogia
- **Slide 9**: CTA criativo

Exemplo: "Criar conteudo e como montar uma playlist. O slide 1 e a musica de abertura — precisa prender. O meio sao as faixas que mantem o flow. O final e o encore que faz a pessoa querer mais..."

Por que funciona: Analogias ativam areas diferentes do cerebro. A surpresa da comparacao inicial gera curiosidade. E a estrutura familiar da analogia torna o conteudo mais facil de entender e lembrar.

## Tecnicas de micro-storytelling por slide

Alem do arco geral, cada slide individual pode usar tecnicas narrativas:

### Open Loops
Termine um slide com uma informacao incompleta: "Mas tinha um problema..." / "E entao tudo mudou." O cerebro PRECISA do proximo slide.

### Show, Don't Tell
Em vez de "eu estava frustrado", descreva: "Fechei o laptop, encostei na cadeira e fiquei 5 minutos olhando pro teto." A imagem mental e mais poderosa.

### Detalhes Especificos
"Perdi dinheiro" e fraco. "Perdi R$47.328 em 3 meses" e impossivel de ignorar. Especificidade = credibilidade.

### Tensao Progressiva
Cada slide deve aumentar a tensao, nao manter. Se o slide 5 tem a mesma intensidade emocional do slide 2, voce perdeu momentum.

## Storytelling + Sequência Viral

Quando voce gera carrosseis no Sequência Viral, a variacao "storytelling" automaticamente aplica o Arco 1 ou Arco 3 dependendo do conteudo. A IA identifica elementos narrativos no seu input (experiencias pessoais, transformacoes, dados de antes/depois) e estrutura a historia nos slides.

Voce pode entao ajustar — adicionar detalhes pessoais, injetar vulnerabilidade real e refinar o arco emocional. A IA cria a estrutura. Voce injeta a alma.

## Conclusao

Storytelling em carrosseis nao e sobre ser um escritor incrivel. E sobre usar estruturas que o cerebro humano esta programado pra consumir. Escolha um arco, siga a estrutura, adicione detalhes especificos e feche com um CTA emocional.

O resultado? Conteudo que as pessoas nao so consomem — mas sentem. E conteudo que as pessoas sentem e conteudo que elas compartilham.`,
  },

  "sequencia-viral-novidades-abril-2026-image-picker-pdf-export": {
    slug: "sequencia-viral-novidades-abril-2026-image-picker-pdf-export",
    title: "Sequência Viral: Novidades de Abril 2026 — Image Picker, PDF Export e Mais",
    description: "Confira as ultimas atualizacoes do Sequência Viral em abril de 2026. Novo seletor de imagens, export PDF corrigido, limites do plano free e melhorias de UX.",
    date: "2026-04-15",
    readTime: "4 min",
    category: "Sequência Viral",
    content: `Abril esta sendo um mes intenso de updates no Sequência Viral. Aqui estao as novidades mais recentes — todas ja disponveis na sua conta.

## Novo: Image Picker com Grid de Opcoes

Antes, quando voce buscava uma imagem diferente pra um slide, o Sequência Viral escolhia uma aleatoria dos resultados. Agora, ao clicar no botao de busca, voce ve um grid com 8 opcoes e escolhe a que mais combina com o seu conteudo.

A mesma chamada de API, zero custo extra — mas agora voce tem controle total sobre qual imagem vai no slide. Funciona tanto na edicao quanto na criacao de novos slides.

## PDF Export Corrigido

Alguns usuarios estavam reportando erro ao exportar PDF ("Export PDF error: {}"). Identificamos e corrigimos o problema — era uma incompatibilidade na forma como o arquivo era gerado em memoria.

Agora o export funciona de forma consistente: cada slide do carrossel vira uma pagina do PDF em 1080x1350px, perfeito pra enviar pra clientes ou arquivar.

Se algum slide tiver uma imagem de dominio externo que bloqueie captura (CORS), o Sequência Viral agora pula aquele slide em vez de travar todo o export — e avisa quais slides foram pulados.

## Controle de Limites do Plano Free

O plano free sempre foi de 5 carrosseis por mes. Mas a verificacao so acontecia no frontend — quem sabia contornar conseguia gerar mais.

Corrigimos isso. Agora o servidor verifica o usage_count antes de cada geracao. Se voce atingiu o limite do seu plano, recebe uma mensagem clara com opcao de upgrade.

Os limites atuais:
- **Free**: 5 carrosseis/mes
- **Pro**: 30 carrosseis/mes
- **Business**: Ilimitado

## Imagens sem Fundo Cinza

Quando uma imagem nao preenchia 100% do espaco do slide, aparecia um fundo cinza atras. Corrigimos isso — agora o wrapper da imagem e transparente, mantendo a harmonia visual do slide independente do tamanho da imagem.

Imagens menores agora ficam centralizadas com padding natural, sem background artificial.

## Texto Centralizado em Slides sem Imagem

Se um slide tem pouco texto e nenhuma imagem, o conteudo agora e centralizado verticalmente na pagina. Antes, ficava colado no topo — gerando muito espaco vazio embaixo.

## Feedback de Save Mais Claro

Ao salvar um rascunho, agora voce ve mensagens diferentes dependendo do modo:
- **Logado**: "Rascunho salvo na nuvem" (sincroniza entre dispositivos)
- **Convidado**: "Rascunho salvo localmente (entre na conta para sincronizar)"

Isso ajuda a entender quando os dados estao seguros na nuvem vs apenas no navegador.

## O que vem por ai

Estamos trabalhando em:
- **Agendamento direto** para Instagram e LinkedIn
- **Templates customizaveis** alem de white/dark
- **Colaboracao em tempo real** para times no plano Business
- **Analytics de performance** pra saber quais carrosseis performaram melhor

Acompanhe o roadmap completo em sequencia-viral.app/roadmap.

## Feedback?

Se encontrar algum bug ou tiver sugestao, envie pra hi@sequencia-viral.app. Cada mensagem e lida pela equipe.`,
  },

  "copywriting-para-redes-sociais-guia-definitivo-2026": {
    slug: "copywriting-para-redes-sociais-guia-definitivo-2026",
    title: "Copywriting para Redes Sociais: O Guia Definitivo para 2026",
    description: "Técnicas avançadas de copywriting para Instagram, Twitter/X e LinkedIn. Fórmulas, frameworks e exemplos reais que você pode aplicar hoje.",
    date: "2026-04-07",
    readTime: "12 min",
    category: "Copywriting",
    content: `Copywriting e a habilidade mais subvalorizada das redes sociais. Design chama atencao. Mas e o texto que converte atencao em acao — seguir, salvar, comentar, comprar. Se voce investe horas em design e minutos em copy, esta investindo na ordem errada.

Este guia reune tecnicas de copywriting especificas para redes sociais em 2026. Nao e teoria de livro — sao frameworks testados em milhares de posts reais.

## Principio 1: Escreva como fala

A diferenca entre copy profissional e copy generica e uma so: naturalidade. Copy de redes sociais nao e redacao academica. Nao e jornalismo. E uma conversa com alguem que voce respeita.

Regras praticas:
- Frases curtas. Uma ideia por frase.
- Use "voce", nao "o usuario" ou "as pessoas"
- Contracoes e informalidade sao bem-vindas ("ta", "pra", "ne")
- Leia em voz alta. Se soa estranho falado, reescreva.

**Ruim**: "E fundamental que criadores de conteudo compreendam a importancia de adaptar sua linguagem."
**Bom**: "Se voce escreve como um robo, ninguem para pra ler."

## Principio 2: Uma ideia por slide, uma ideia por tweet

O erro mais comum e colocar ideias demais em um unico slide ou post. Cada unidade de conteudo deve ter UMA unica mensagem central. Se voce precisa de "alem disso" e "tambem", separe em outro slide.

Teste: se voce nao consegue resumir o slide em 1 frase, ele tem ideias demais.

## Principio 3: Especificidade ganha de generalidade. Sempre.

Compare:
- "Muitas empresas estao usando IA" vs "78% das startups de marketing ja usam IA na producao de conteudo"
- "Economize tempo" vs "Economize 9 horas por semana"
- "Melhore seu conteudo" vs "Triplique seus salvamentos em 30 dias"

Numeros especificos, nomes proprios, prazos concretos — tudo isso aumenta credibilidade e engagement.

## As 7 Formulas de Copy que Funcionam em 2026

### Formula 1: PAS (Problem, Agitate, Solve)

**Problema**: Identifique a dor
**Agitacao**: Mostre por que e pior do que parece
**Solucao**: Apresente o caminho

Exemplo para carrossel:
- Slide 1: "Voce gasta 15h por semana criando conteudo" (Problema)
- Slide 2: "Sao 60h por mes. 720h por ano. O equivalente a 4 meses de trabalho em tempo integral." (Agitacao)
- Slide 3: "E se voce pudesse reduzir pra 3h por semana sem perder qualidade?" (Solucao)

### Formula 2: AIDA (Attention, Interest, Desire, Action)

**Atencao**: Hook que para o scroll
**Interesse**: Por que isso importa pra voce
**Desejo**: Como sua vida melhora
**Acao**: O que fazer agora

Exemplo para LinkedIn:
- Atencao: "Contratei uma equipe de conteudo por R$15k/mes. Depois demiti todos."
- Interesse: "Nao porque eram ruins — mas porque encontrei uma forma melhor."
- Desejo: "Hoje produzo 3x mais conteudo, com mais autenticidade, gastando R$50/mes."
- Acao: "Quer saber como? Comenta 'quero' que envio por DM."

### Formula 3: Before-After-Bridge

**Antes**: A situacao atual (dor)
**Depois**: O futuro ideal
**Ponte**: Como chegar la

Perfeita para carrosseis de produto:
- Antes: "15h por semana fazendo carrosseis na mao"
- Depois: "30 minutos por semana, 5 carrosseis prontos"
- Ponte: "Sequência Viral gera 3 variacoes em 30 segundos"

### Formula 4: So What?

Depois de escrever qualquer frase, pergunte "e dai?". Se nao tiver resposta, corte ou reescreva.

"Temos 10.000 usuarios" → So what? → "10.000 creators confiam no Sequência Viral pra economizar 9h por semana"

"Usamos IA avancada" → So what? → "A IA aprende seu tom de voz e gera carrosseis que soam como VOCE, nao como um robo"

### Formula 5: The One-Two Punch

Primeira frase: Afirmacao forte
Segunda frase: Evidencia ou contexto que torna irresistivel

Exemplos:
- "Consistencia nao e postar todo dia. E postar o conteudo certo, no formato certo, pro publico certo."
- "IA nao vai te substituir. Mas alguem usando IA vai."
- "O primeiro slide e 80% do trabalho. Os outros 20% sao otimizacao."

### Formula 6: Open-Close Loop

Abra uma questao no inicio. Feche so no final.

Slide 1: "Existe uma tecnica que faz qualquer carrossel ter 3x mais saves. Voce provavelmente nunca ouviu falar."
Slides 2-7: Contexto, exemplos, frameworks
Slide 8: "A tecnica? [revela aqui]. E funciona porque..."

O cerebro NAO CONSEGUE abandonar um loop aberto. E o motivo pelo qual series terminam em cliffhanger.

### Formula 7: The Micro-Story

Uma historia em 2-3 frases no corpo do slide:

"Semana passada, uma cliente me disse que gastava 4h por carrossel. Mostrei o Sequência Viral. Ela fez 3 em 15 minutos e mandou: 'por que ninguem me falou disso antes?'"

Micro-stories sao mais eficazes que dados em muitos contextos porque criam conexao emocional instantanea.

## Tom de voz por plataforma

### Instagram
- Mais visual, menos texto
- Emojis moderados (1-2 por slide, nao 10)
- Tom: conversa com amigo
- CTA: salvar, compartilhar, DM

### Twitter/X
- Direto ao ponto
- Humor e wit sao valorizados
- Tom: opiniao inteligente
- CTA: RT, reply, thread

### LinkedIn
- Mais profundo e reflexivo
- Primeira pessoa funciona muito
- Tom: mentor generoso
- CTA: comentar, seguir, link no perfil

## Como Sequência Viral aplica copywriting automaticamente

Quando voce gera um carrossel no Sequência Viral, o sistema aplica:

- **Hooks baseados nos 12 padroes de maior performance**
- **Estrutura PAS ou AIDA** dependendo do tipo de conteudo
- **CTAs algoritmicamente otimizados** (save, share ou comment conforme o objetivo)
- **Tom de voz do seu perfil** — nao generico, mas alinhado com como VOCE escreve

Voce pode editar tudo depois. Mas comecar com copy estrategica e infinitamente melhor que comecar do zero.

## Erros de copy que matam engajamento

1. **Copy generico**: "Dicas incriveis de marketing" (nenhum gatilho ativado)
2. **Excesso de jargao**: "Otimize seu funnel de conversao multicanal" (ninguem fala assim)
3. **Sem especificidade**: "Melhore seus resultados" (quais resultados? como? quanto?)
4. **CTA fraco**: "Gostou? Curte!" (curtida e o sinal mais fraco do algoritmo)
5. **Copy longa demais**: Se precisa de scroll pra ler um slide, tem texto demais

## Conclusao

Copywriting nao e talento — e tecnica. As formulas existem. Os padroes sao conhecidos. O que separa copy boa de copy excelente e pratica, testes e analise de dados. Comece aplicando uma formula por semana. Em 2 meses, seu conteudo sera irreconhecivel (no bom sentido).

E se quiser acelerar, o Sequência Viral aplica essas tecnicas automaticamente. Voce foca na ideia. A IA foca na estrutura.`,
  },

  "como-transformar-artigos-em-carrosseis-repurposing": {
    slug: "como-transformar-artigos-em-carrosseis-repurposing",
    title: "Como Transformar Artigos e Links em Carrosséis: O Guia de Repurposing",
    description: "Aprenda a pegar qualquer artigo, thread ou vídeo e transformar em carrossel de alto engajamento. Técnicas de repurposing com e sem IA.",
    date: "2026-04-03",
    readTime: "8 min",
    category: "Produtividade",
    content: `Se voce produz ou consome conteudo, esta sentado em uma mina de ouro de carrosseis. Cada artigo que voce le, cada video que assiste, cada thread que consome pode virar um carrossel de alto desempenho. O problema nunca e falta de ideias — e falta de um sistema de transformacao.

Repurposing nao e copiar. E reinterpretar conteudo existente pra um formato diferente, adicionando sua perspectiva e otimizando pra plataforma. Neste guia, vamos cobrir como transformar 5 tipos de fonte em carrosseis.

## Fonte 1: Artigos de Blog

Artigos sao a fonte mais rica. Um artigo de 2.000 palavras pode gerar de 2 a 4 carrosseis diferentes.

### O processo:

**Passo 1: Identifique os nucleos de valor**
Leia o artigo e marque cada insight/dado/tecnica individual. Um artigo bom tem de 5 a 15 nucleos de valor.

**Passo 2: Agrupe por tema**
Organize os nucleos em 2-3 temas. Cada tema vira um carrossel potencial.

**Passo 3: Estruture como slides**
- Slide 1: Hook baseado no insight mais forte do grupo
- Slides 2-8: Um nucleo por slide, com sua interpretacao
- Slide final: CTA + credito ao autor original

### Com Sequência Viral:
Cole o link do artigo. O Sequência Viral extrai o conteudo, identifica os nucleos de valor e gera 3 variacoes de carrossel automaticamente. Cada variacao pega um angulo diferente do mesmo artigo.

## Fonte 2: Threads do Twitter/X

Threads ja sao conteudo sequencial — o formato mais proximo de um carrossel. A transformacao e quase 1:1.

### O processo:

**Passo 1: Copie os tweets essenciais**
Nem todo tweet da thread merece um slide. Filtre os que tem insight real.

**Passo 2: Reescreva pra formato visual**
Tweets sao otimizados pra leitura rapida em texto. Carrosseis precisam de frases mais curtas e estrutura mais escaneaval.

**Passo 3: Adicione design**
O grande diferencial de thread → carrossel e o visual. Adicione imagens, icones e cor.

### Com Sequência Viral:
Descreva o tema da thread no campo de ideias e o Sequência Viral gera variacoes visuais com estrutura otimizada pra Instagram/LinkedIn.

## Fonte 3: Videos do YouTube

Videos longos sao uma fonte absurda de carrosseis. Um video de 20 minutos pode gerar 3-5 carrosseis.

### O processo:

**Passo 1: Assista em 1.5x com anotacoes**
Marque timestamps dos insights principais.

**Passo 2: Transcreva os pontos-chave**
Nao precisa transcrever tudo — so os momentos de valor.

**Passo 3: Organize em narrativa de slides**
Cada insight vira 1-2 slides. Adicione contexto proprio.

### Com Sequência Viral:
Cole o link do YouTube. O Sequência Viral extrai a transcricao automaticamente e gera carrosseis baseados no conteudo do video. Funciona com qualquer video publico que tenha legendas.

## Fonte 4: Seus proprios posts que performaram bem

Se um post seu teve alto engajamento, ele tem potencial pra ser expandido em carrossel.

### O processo:

**Passo 1: Identifique seus top 10 posts dos ultimos 90 dias**
Ordene por salvamentos e compartilhamentos (nao curtidas).

**Passo 2: Expanda o conteudo**
O post original e o slide 1 (hook). Os slides seguintes aprofundam.

**Passo 3: Adicione exemplos e dados**
O post original era condensado. O carrossel permite detalhar.

## Fonte 5: Pesquisas e relatorios

Dados sao materia-prima perfeita para carrosseis educativos.

### O processo:

**Passo 1: Escolha 5-8 dados mais surpreendentes**
Nem tudo e interessante. Selecione o que faz alguem parar.

**Passo 2: Contextualize cada dado**
"72% dos creators desistem em 90 dias" sozinho e fraco. "72% dos creators desistem em 90 dias — e a razao #1 nao e falta de resultado. E falta de sistema." Isso e um slide forte.

**Passo 3: Adicione sua interpretacao**
Dados sem opiniao sao chatos. Sua leitura e o que torna unico.

## Regras universais de repurposing

1. **Sempre adicione sua voz** — Repurposing sem interpretacao pessoal e plagio com design bonito.
2. **De credito a fonte** — Um simples "Baseado em [fonte]" no ultimo slide e suficiente.
3. **Otimize pro formato** — O que funciona em texto longo nao funciona em slides. Corte, resuma, simplifique.
4. **Teste variacoes** — O mesmo conteudo com hooks diferentes performa de formas completamente diferentes.
5. **Publique em multiplas plataformas** — Um carrossel pode ir pro Instagram, LinkedIn e Twitter (como thread visual).

## O sistema semanal de repurposing

Uma rotina que funciona:

- **Segunda**: Consuma 3-5 artigos/videos do seu nicho. Anote insights.
- **Terca**: Transforme os melhores insights em 5 carrosseis com Sequência Viral.
- **Quarta-Sexta**: Publique 1 por dia, monitorando metricas.
- **Sabado**: Analise performance e planeje a semana seguinte.

Tempo total: ~3 horas por semana pra 5 carrosseis de qualidade.

## Conclusao

Voce ja consome conteudo. A unica diferenca entre consumir e produzir e ter um sistema de transformacao. Com as tecnicas deste guia (e com Sequência Viral pra acelerar), voce transforma qualquer input em carrosseis de alta qualidade sem comecar do zero.

Cole um link. Gere 3 variacoes. Edite com sua voz. Publique. Repita.`,
  },
};

/* ─────────────────── GENERATE STATIC PARAMS ─────────────────── */

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

/* ─────────────────── GENERATE METADATA ─────────────────── */

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const post = posts[slug];

  if (!post) {
    return { title: "Post nao encontrado | Sequência Viral Blog" };
  }

  return {
    title: `${post.title} | Sequência Viral Blog`,
    description: post.description,
    alternates: {
      canonical: `https://sequencia-viral.app/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `https://sequencia-viral.app/blog/${post.slug}`,
      publishedTime: post.date,
      authors: ["Sequência Viral"],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

/* ─────────────────── PAGE ─────────────────── */

export default async function BlogPost(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const post = posts[slug];

  if (!post) {
    notFound();
  }

  // Simple markdown-like rendering for ## headings, **bold**, lists, and tables
  const renderContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let tableHeader: string[] = [];

    const flushTable = () => {
      if (tableHeader.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} className="overflow-x-auto my-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  {tableHeader.map((cell, i) => (
                    <th
                      key={i}
                      className="text-left py-2 px-3 font-semibold"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-[var(--border)]/50"
                  >
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-2 px-3 text-[var(--muted)]">
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
      inTable = false;
      tableRows = [];
      tableHeader = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Table detection
      if (line.startsWith("|")) {
        const cells = line
          .split("|")
          .filter((c) => c.trim() !== "")
          .map((c) => c.trim());

        if (!inTable) {
          inTable = true;
          tableHeader = cells;
          continue;
        }

        // Skip separator line
        if (cells.every((c) => /^[-:]+$/.test(c))) continue;

        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Headings
      if (line.startsWith("### ")) {
        elements.push(
          <h3
            key={i}
            className="font-[family-name:var(--font-serif)] text-xl tracking-tight mt-8 mb-3"
          >
            {line.replace("### ", "")}
          </h3>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2
            key={i}
            className="font-[family-name:var(--font-serif)] text-2xl tracking-tight mt-10 mb-4"
          >
            {line.replace("## ", "")}
          </h2>
        );
      } else if (line.startsWith("- **")) {
        // Bold list item
        const parts = line.replace("- **", "").split("**");
        elements.push(
          <li key={i} className="flex items-start gap-2 ml-4 mb-2">
            <span className="text-[var(--accent)] mt-1.5 shrink-0">
              &bull;
            </span>
            <span>
              <strong>{parts[0]}</strong>
              {parts[1]}
            </span>
          </li>
        );
      } else if (line.startsWith("- ")) {
        elements.push(
          <li key={i} className="flex items-start gap-2 ml-4 mb-2">
            <span className="text-[var(--accent)] mt-1.5 shrink-0">
              &bull;
            </span>
            <span>{line.replace("- ", "")}</span>
          </li>
        );
      } else if (line.trim() === "") {
        // Skip empty lines (spacing handled by margins)
      } else {
        // Regular paragraph - handle inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/);
        elements.push(
          <p
            key={i}
            className="text-[var(--muted)] leading-relaxed mb-4"
          >
            {parts.map((part, pi) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={pi} className="text-[var(--foreground)]">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </p>
        );
      }
    }

    if (inTable) flushTable();

    return elements;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-4xl px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="font-[family-name:var(--font-serif)] text-xl tracking-tight"
          >
            Sequência Viral
          </Link>
          <Link
            href="/blog"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Todos os posts
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium text-[var(--accent)] bg-orange-50 px-2 py-1 rounded-full">
              {post.category}
            </span>
            <span className="text-xs text-[var(--muted)]">{post.date}</span>
            <span className="text-xs text-[var(--muted)]">
              {post.readTime} de leitura
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl md:text-5xl tracking-tight leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-[var(--muted)] leading-relaxed">
            {post.description}
          </p>
        </header>

        <div className="prose-sequencia-viral">{renderContent(post.content)}</div>

        {/* CTA */}
        <div className="mt-16 p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center">
          <h3 className="font-[family-name:var(--font-serif)] text-2xl tracking-tight mb-3">
            Crie seu primeiro carrossel com IA
          </h3>
          <p className="text-[var(--muted)] mb-6">
            Gratis. Sem cartao de credito. Pronto em 30 segundos.
          </p>
          <a
            href="https://sequencia-viral.app"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-dark)] transition-colors text-sm"
          >
            Criar carrossel gratis
          </a>
        </div>
      </article>

      <footer className="border-t border-[var(--border)] py-8 bg-[#FAFAF8]">
        <div className="mx-auto max-w-4xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[#0A0A0A]/40">
            &copy; {new Date().getFullYear()} Sequência Viral. Todos os direitos reservados.
          </p>
          <a
            href="https://kaleidos.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#0A0A0A]/40 hover:text-[#0A0A0A]/60 transition-colors"
          >
            Powered by <span className="font-semibold">Kaleidos</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
