# Arquitetura técnica — ingestão de notícia, imagens e referências

Este documento traduz os requisitos de produto para implementação técnica.

---

## 1) Requisitos funcionais críticos

1. Ao colar link de notícia, extrair:
   - texto completo
   - metadados editoriais
   - **todas as imagens relevantes** do artigo
2. Permitir preferência de estilo de imagem por cliente.
3. Permitir até 3 imagens de referência por cliente.
4. Permitir upload de imagens antes da geração.
5. Usar referências no pipeline “Nano Banana” para manter estética consistente.

---

## 2) Pipeline técnico proposto

## 2.1 Ingestão de URL

### Etapa A — normalização

- resolver canonical URL
- remover parâmetros de tracking
- detectar domínio/fonte

### Etapa B — extração de conteúdo

Prioridade:
1. parser HTML de artigo
2. navegador headless (render JS)
3. fallback API de crawling

### Etapa C — extração de imagens

- coletar `og:image`, `twitter:image`, `<img>`, `<source>`, galerias
- baixar metadados (dimensão, tipo, peso)
- dedupe por hash
- ranking por relevância no corpo

### Etapa D — persistência

Salvar em storage e banco:

- `source_articles`
- `source_article_images`
- `source_extraction_logs`

---

## 3) Preferências visuais por cliente

Tabela sugerida: `profile_image_preferences`

Campos:
- `profile_id`
- `image_preference_type`
- `image_style_prompt`
- `image_palette`
- `image_mood`
- `respect_source_images`
- `updated_at`

Tabela de referências: `profile_style_references`

Campos:
- `id`
- `profile_id`
- `position` (1..3)
- `source_type` (`upload` | `url`)
- `image_url`
- `notes`
- `active`
- `created_at`

---

## 4) Upload de imagens pré-criação

Tabela sugerida: `generation_inputs_assets`

Campos:
- `id`
- `user_id`
- `draft_id`
- `image_url`
- `role` (`hard-lock` | `soft-reference`)
- `created_at`

Uso:
- Entram no prompt de geração textual e visual
- `hard-lock`: mapeadas para slide específico
- `soft-reference`: usadas como guia de estilo/tema

---

## 5) Prompting para Nano Banana com referências

Template de instrução visual (exemplo):

- Estilo preferido do cliente
- Paleta e mood
- Referências 1..3 (descrição + vetor de estilo)
- Restrições (evitar texto embutido, evitar marcas d’água)
- Contexto do slide (heading/body)

Pós-processamento:
- score de similaridade estética com referências
- score de coerência temática com slide
- fallback para busca web se geração ficar abaixo do limiar

---

## 6) APIs recomendadas (se precisar complementar)

Se a stack atual não cobrir “texto completo + todas imagens” com alta taxa de sucesso, recomendo adicionar:

1. **Crawler/render robusto** (JS-heavy pages)
2. **Extractor de artigo dedicado**
3. **Serviço de visão/similaridade** para referências estéticas
4. **Storage/CDN** com metadados e versionamento

---

## 7) Riscos e mitigação

- **Paywall/anti-bot:** fallback manual + múltiplos extractors
- **Copyright de imagem:** sinalizar origem e modo de uso
- **Drift de estilo:** validador de semelhança com referências
- **Custo de geração:** cache de assets por tema/slides similares

---

## 8) Checklist de implementação (faseado)

### Fase 1
- schema de preferências e referências (max 3)
- upload pré-criação
- ingestão de texto + imagens básicas

### Fase 2
- pipeline com fallback múltiplo para extração
- ranking/qualidade de imagens
- uso das referências no Nano Banana

### Fase 3
- scoring automático de estilo
- observabilidade completa (taxa de sucesso por domínio)
- otimização de custo e cache

---

## 9) O que preciso de você (produto) para liberar 100%

Para implementar exatamente como pediu, preciso confirmar:

1. Qual provedor/API vamos usar para crawling robusto (ou se posso propor um).
2. Limite de custo mensal para extração + geração de imagem.
3. Política de uso de imagem de notícia (referência vs republicação).
4. Prioridade inicial: qualidade máxima de extração ou velocidade de geração.
