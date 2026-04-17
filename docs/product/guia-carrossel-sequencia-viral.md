# Guia completo — Carrosséis no Sequência Viral

Este guia explica **como tirar o máximo do produto**: o que configurar no perfil, como escolher tema (claro/escuro), cada fonte de conteúdo (ideia, link, vídeo, Instagram), como usar **link só como inspiração**, edição, imagens, export e boas práticas de publicação.

---

## 1. Visão geral do fluxo

1. **Onboarding / Ajustes** — você define quem é a marca na tela (nome, @redes, tom, idioma, estilo do slide).
2. **Criar** — escolhe a fonte (ideia, link, YouTube, Instagram, sugestões IA), opcionalmente um “foco” no texto, e gera **3 variações**.
3. **Escolher variação** — pega a que mais combina com o objetivo (dados, história ou provocativo).
4. **Editar** — ajusta títulos, corpo, ordem dos slides, imagens e branding.
5. **Exportar** — baixa PNG (e PDF experimental, se disponível) e publica no Instagram / LinkedIn / X.

O Sequência Viral foi pensado para **um fluxo só**: menos cópia em um lugar, design em outro e legenda em outro.

---

## 2. O que o perfil do cliente precisa ter (e por quê)

Tudo abaixo alimenta a **identidade no rodapé do carrossel**, o tom da IA e a consistência visual.

### 2.1 Campos essenciais

- **Nome** — aparece como autor no preview; reforça pessoalidade da marca.
- **Foto (avatar)** — aumenta reconhecimento e confiança; evita carrossel “sem rosto”.
- **@ do Twitter/X ou Instagram** — usado no slide de CTA e na identidade; a IA também usa para fechar com “siga para mais [tema]”.
- **LinkedIn (URL)** — opcional, mas ajuda quando o conteúdo é B2B ou carreira.

### 2.2 Tom e idioma

- **Tom** (profissional, casual, provocativo, educacional) — muda ritmo de frase, intensidade e tipo de gancho.
- **Idioma** — o gerador trata **pt-BR**, **en** e **es** de forma explícita no prompt. Mantenha o mesmo idioma do perfil e do carrossel para não misturar instruções.

### 2.3 Nichos / tags

- **Nichos** — orientam exemplos, jargão e ângulo (“se você é creator de cripto…” vs “se você vende B2B…”).
- Quanto mais específico, menos genérico fica o texto. Evite lista gigante; 2–4 tags fortes costumam bastar.

### 2.4 Estilo do carrossel (tema)

- **Claro** — leitura em feed claro; bom para Instagram “clean” e muitos creators.
- **Escuro** — contraste forte; funciona bem em nichos tech, crypto, “premium”.

Esse preferência vem do perfil e pode ser trocada **na edição** do carrossel atual sem mudar o perfil.

### 2.5 Checklist rápido antes de gerar

- [ ] Nome + foto preenchidos  
- [ ] Pelo menos um @ (X ou Instagram)  
- [ ] Tom e idioma coerentes com o canal  
- [ ] Nicho definido (não só “geral”)  
- [ ] Estilo claro/escuro conferido  

---

## 3. Fontes de conteúdo no “Criar”

### 3.1 Minha ideia

Use quando já sabe o tema. **Dica:** escreva o foco como briefing — “para quem é”, “qual dor”, “qual promessa”.

Exemplo de briefing forte:

> Para freelancers de marketing que perdem tempo com briefing. Promessa: carrossel em 15 min com 3 frameworks.

### 3.2 Link (artigo, blog, PDF)

O Sequência Viral tenta **extrair texto** da URL. Funciona melhor com:

- Artigos com HTML legível  
- Blogs sem paywall duro  
- Páginas com conteúdo principal bem marcado no HTML  

**Pode falhar quando:**

- O site exige login, cookie ou bloqueia scrapers  
- O texto está todo dentro de imagem ou PDF pesado  
- A página é basicamente um app SPA vazio no primeiro HTML  

**Quando falhar:** copie o trecho principal e use **Minha ideia**, ou cole a legenda no campo de texto + link só como referência mental.

### 3.3 Vídeo (YouTube)

A IA usa a **transcrição** quando disponível. Vídeos sem legenda/transcrição podem gerar pouco contexto.

**Dica:** prefira vídeos com fala clara e legendas automáticas ativas.

### 3.4 Post / Reel do Instagram

Funciona com posts públicos; o sistema tenta usar **legenda + contexto**. Contas privadas ou mídia restrita não funcionam.

Se o Instagram retornar erro, use o fallback sugerido pelo próprio app: **cole a legenda em “Minha ideia”**.

### 3.5 Sugestões de IA

Útil para quando você quer **tema quente** dentro de um nicho. Combine com nicho bem definido no perfil / seletor.

---

## 4. Usar um link “só como inspiração”

Você não precisa que o Sequência Viral leia a página inteira. Modos de uso:

1. **Inspiração de estrutura** — você gosta da progressão de slides (gancho → lista → CTA). Coloque no campo “Tema / foco”: “Replicar a estrutura: problema → 3 erros → framework → CTA salvar”.
2. **Inspiração de tom** — “Mesmo nível de provocação que esse artigo, mas com exemplos do meu nicho”.
3. **Citação parcial** — copie 2–3 trechos para o campo de ideia e deixe claro: “não copiar literalmente; reescrever com minha voz”.

**Observações importantes:**

- Se o site tiver **paywall**, não conte com extração automática.  
- Se o texto for muito longo, defina um **foco** (“resume só a parte sobre X”).  
- Para **PDF**, depende do extractor; se der erro, extraia o texto manualmente.  
- Sempre revise o resultado para **evitar plágio** e para checar fatos.

---

## 5. As três variações (estilos)

Após gerar, você verá três linhas editoriais diferentes:

- **Dados / prova** — números, comparações, credibilidade.  
- **Narrativa** — história, vulnerabilidade, identificação.  
- **Provocativo** — contrarian, debate, comentários.

Escolha pela **intenção do post**:

- Quer **salvar**? Dados costumam performar bem.  
- Quer **comentário**? Provocativo, com pergunta honesta no final.  
- Quer **compartilhamento em DM**? Narrativa com “envia pra alguém”.

---

## 6. Edição: slides, imagens e branding

### 6.1 Texto

- **Título (heading)** — curto, escaneável; é o que manda no primeiro segundo.  
- **Corpo** — poucas linhas; uma ideia por slide.  
- Evite blocos enormes; o carrossel é **swipe**, não artigo.

### 6.2 Imagens

- Cada slide tem um `imageQuery` usado para busca.  
- Você pode **trocar a imagem**, **subir arquivo** ou refinar o termo de busca.  
- **Queries em inglês** costumam funcionar melhor em bancos de imagem.

### 6.3 Branding no preview

- Toggle de branding mostra/oculta **avatar + nome + @** conforme o layout.  
- Use ocultar só se estiver fazendo peça genérica de teste — em produção, branding aumenta conversão de perfil.

### 6.4 Ordem dos slides

- Reordene quando a narrativa ficar mais forte (ex.: prova social antes do how-to).  
- Mantenha **um gancho forte no slide 1**; é o maior gargalo de performance.

---

## 7. Export e publicação

### 7.1 PNG

- Export em alta para **1080×1350** (formato clássico de feed).  
- Baixe todos os slides e publique na ordem no Instagram / carrossel no LinkedIn.

### 7.2 PDF

- Útil para arquivo ou alguns fluxos de LinkedIn document; valide preview antes.

### 7.3 Legenda e primeiro comentário

O Sequência Viral foca no **visual**; ainda assim recomenda-se:

- **Legenda** com gancho + 1 linha de contexto + CTA + hashtags moderadas (se fizer sentido na plataforma).  
- **Primeiro comentário** com link ou detalhe (algoritmo e UX).

---

## 8. Boas práticas de conteúdo (alto nível)

- **Slide 1 é anúncio do resto** — se falhar, o carrossel inteiro morre.  
- **Um slide, uma ideia** — quem scrolla rápido precisa entender só pelos títulos.  
- **CTA específico** — “Salva pra aplicar” > “Segue aí”.  
- **Prova quando possível** — print, número, case curto.  
- **Tom = promessa** — não prometa tom “provocativo” e entregue texto corporativo.

---

## 9. Problemas comuns e soluções

| Sintoma | Causa provável | O que fazer |
|--------|----------------|-------------|
| Geração falha no link | Paywall, bloqueio, SPA | Copiar texto manualmente; usar “Minha ideia” |
| Instagram não extrai | Post privado / link errado | Conferir URL pública; colar legenda |
| Texto em inglês misturado | Idioma inconsistente | Ajustar idioma no criador + perfil |
| Imagem ruim | Query vaga | Trocar `imageQuery` por termo mais específico |
| Export cortado | Zoom do navegador | Usar zoom 100% e tentar de novo |

---

## 10. Onde ajustar cada coisa no app

- **Perfil completo** — `Ajustes` (`/app/settings`) e onboarding inicial.  
- **Novo carrossel** — `Criar` (`/app/create`).  
- **Rascunhos salvos** — `Meus carrosséis` (`/app/carousels`).  
- **Este guia dentro do app** — `Guia` (`/app/help`).

---

*Última revisão: alinhado ao fluxo atual de criação, geração e export do Sequência Viral.*
