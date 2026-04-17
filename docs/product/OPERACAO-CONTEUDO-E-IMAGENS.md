# Operação de Conteúdo e Imagens (fora do app)

Este documento descreve o padrão operacional para pesquisa, ingestão de links, geração de imagens e uso de referências visuais no PostFlow.

Objetivo: garantir carrosséis com alta qualidade editorial e visual, mantendo consistência de estilo por cliente.

---

## 1) Pesquisa online para criação de conteúdo

### Fontes recomendadas por tipo

- **Notícia / atualidades:** Reuters, Bloomberg, Valor, Exame, Folha, Estadão, CoinDesk, The Block.
- **Dados e benchmarks:** Statista, McKinsey, Bain, Deloitte, Pew, IBGE, DataReportal.
- **Produto e tech:** docs oficiais, changelogs, GitHub releases, blogs de engenharia.
- **Marketing e creator economy:** HubSpot, Ahrefs, Semrush, Socialinsider, Later.

### Regra operacional de pesquisa

1. Buscar 3-5 fontes por tema.
2. Priorizar fonte primária (original) sobre agregadores.
3. Registrar URL + data da coleta.
4. Extrair:
   - headline principal
   - pontos-chave
   - números e citações
   - contexto (o “por quê” da notícia)

### Saída esperada

- Resumo factual em bullets
- Tese editorial do carrossel
- Ângulo escolhido (dados, narrativa, provocativo)
- Lista de referências usadas

---

## 2) Ingestão de link de notícia (texto + TODAS as imagens)

Requisito de negócio: quando cliente colar uma notícia, o sistema precisa tentar puxar **todo o texto** e **todas as imagens disponíveis** do conteúdo.

### Ordem de tentativa (fallback chain)

1. **Extractor principal** (article parser HTML limpo)
2. **Renderização com navegador/headless** (captura conteúdo pós-JS)
3. **Leitura por API de crawl** (quando site bloqueia parser direto)
4. **RSS/AMP/sitemaps da origem** (se existir versão limpa)
5. **Fallback manual guiado**: usuário cola texto + adiciona imagens

### O que deve ser coletado

- título
- subtítulo
- autor (quando houver)
- data de publicação
- corpo completo (parágrafos + intertítulos)
- URL canônica
- **todas as imagens** candidatas (hero, inline, galeria)
- metadados de cada imagem: URL original, dimensão, alt/caption, posição no texto

### Critérios de qualidade

- deduplicar imagens iguais (hash/perceptual hash)
- preservar ordem de aparição no artigo
- filtrar ícones/logos de navegação (ruído)
- manter ao menos 1 imagem hero e N imagens inline válidas

### Observações legais e editoriais

- respeitar direitos autorais e termos de uso da fonte
- não remover crédito quando necessário
- permitir modo “somente referência” sem republicação direta da imagem

---

## 3) Geração e busca de imagens

## 3.1 Busca (stock/web)

Quando possível, usar imagens do próprio conteúdo da fonte. Se faltar:

- buscar por `imageQuery` com contexto do slide
- priorizar relevância semântica (não só keyword literal)
- aplicar filtro de segurança e qualidade

## 3.2 Geração (Nano Banana)

O cliente pode definir nos ajustes:

- tipo de imagem preferida (foto real, ilustração, 3D, editorial, minimalista etc.)
- intensidade visual (clean, médio, forte)
- paleta dominante
- estilo de composição

A geração deve sempre herdar:

- tema do cliente (claro/escuro)
- nicho
- tom editorial

---

## 4) Referências visuais por cliente (até 3)

Requisito: o cliente pode subir até 3 referências para orientar estética/estilo.

### Regras

- máximo: 3 referências ativas
- aceitar URL e upload
- salvar metadados: `tipo`, `origem`, `tags`, `força de influência`
- permitir reorder (prioridade visual)

### Como usar no pipeline

1. Extrair “assinatura visual” das referências (cores, contraste, composição, textura, tipografia percebida)
2. Montar instrução de estilo para o gerador
3. Injetar no prompt da imagem + validação pós-geração

### Resultado esperado

- consistência entre carrosséis do mesmo cliente
- redução de output genérico
- aproximação da identidade visual desejada

---

## 5) Upload de imagens antes da criação

Requisito: cliente pode anexar imagens antes da IA gerar o carrossel.

### Fluxo recomendado

1. Cliente seleciona 1..N imagens no passo de entrada
2. Sistema classifica cada imagem (produto, pessoa, screenshot, gráfico, branding)
3. IA usa anexos como contexto para:
   - definir narrativa
   - sugerir posição por slide
   - gerar novas imagens no mesmo estilo

### Estratégia de uso

- `hard-lock`: imagem obrigatória em slide específico
- `soft-reference`: imagem inspira estilo, mas pode ser substituída

---

## 6) Ajustes de cliente (modelo recomendado)

Campos sugeridos para settings:

- `image_preference_type` (foto, ilustração, 3d, mixed)
- `image_style_prompt` (texto livre curto)
- `image_palette` (hex ou nome de paleta)
- `image_mood` (corporate, bold, clean, cinematic, playful)
- `reference_images[]` (max 3)
- `respect_source_images` (boolean para priorizar imagens da notícia)

---

## 7) Critérios de aceite (DoD)

- Link de notícia retorna texto completo em >80% dos casos suportados.
- Pipeline retorna “todas as imagens candidatas” + ordenação + dedupe.
- Cliente consegue configurar preferência visual + 3 referências.
- Imagens anexadas pré-criação entram no contexto da IA.
- Saída final mostra rastreabilidade de origem de imagem (fonte, gerada, upload).

---

## 8) Se APIs extras forem necessárias

Se o crawler atual não alcançar os requisitos, usar stack complementar (ver documento técnico):

- crawler/render robusto para páginas dinâmicas
- extractor de artigo com fallback por DOM
- serviço de visão para similaridade com referências
- armazenamento de mídia com metadados

Documento relacionado: `docs/technical/ARQUITETURA-INGESTAO-MIDIA-E-REFERENCIAS.md`.
