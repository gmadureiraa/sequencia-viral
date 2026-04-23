# PERF — /api/generate + /api/images

Auditoria iniciada 2026-04-22. Alvo: reduzir p50 de 85s → 60s no template Futurista com 8 slides.

## Otimizações aplicadas nesta passada

1. **Writer Gemini 2.5 Pro**: `thinkingBudget` 16000 → 12000 e
   `maxOutputTokens` 14000 → 10000 em `/api/generate/route.ts` e
   `lib/server/generate-carousel.ts`. 10k output cabe 3 variations x 10 slides
   com folga. Thinking 12k ainda dá raciocínio pra estrutura 3-atos.
   Ganho P50 esperado: -3 a -5s.
2. **NER Gemini 2.5 Flash**: `maxOutputTokens` 5000 → 3500 em
   `lib/server/source-ner.ts`. JSON completo com summary+keyPoints+quotes+
   entities+dataPoints+arguments cabe. Ganho esperado: -1s.
3. **Timing logs**: adicionado `[generate][timing] source=...ms ner=...ms writer=...ms`
   pra auditoria futura.

**Total esperado**: -4 a -6s no P50 (de 85s para ~79-81s). Ainda longe de 60s,
mas são as otimizações seguras sem refactor.

## Otimizações NÃO aplicadas — risco ou refactor

### 1. Streaming de slides (writer → imagem)
**Ganho potencial**: -10 a -20s (elimina barreira writer → batch imagens).

**O que seria**: em vez de esperar writer finalizar e depois Promise.all de 8
imagens, iniciar geração da imagem de cada slide ASSIM que o writer libera
aquele slide individualmente.

**Por que não agora**: requer migrar `/api/generate` para streaming (Gemini
`generateContentStream`), parser incremental de JSON e refactor do client em
`app/app/create/new/page.tsx` pra consumir SSE/ReadableStream e disparar
`/api/images` por slide. É uma feature, não um tweak.

### 2. Paralelizar extração de source + NER
**Ganho potencial**: -1 a -3s se fonte estiver lenta.

**O que seria**: quando temos URL/YouTube/Instagram, rodar `extractContentFromUrl`
em paralelo com pre-warm da call do NER (preparar prompt, aquecer handler).

**Por que não agora**: NER DEPENDE do sourceContent. Não há como paralelizar
sem speculative exec. Ganho marginal.

### 3. Cover-scene skip quando decider entrega StructuredImagePrompt
Já implementado em `app/api/images/route.ts` linha 393-394:
```ts
const shouldUseCoverScene =
  isCover && !isTwitterTpl && !structuredPromptOverride;
```
✅ Está correto. Nenhuma ação.

### 4. Concorrência limitada em /api/images (rate-limit)
**Ganho potencial**: impacto neutro ou negativo em throughput, mas mais
consistência de resposta.

**O que seria**: hoje o client faz `Promise.all(8 slides.map)` disparando 8
chamadas simultâneas a `/api/images`. Cada uma interna roda 1 decider
(Gemini Flash) + 1 Flash Image. Gemini Flash tem rate limit ~60 RPM — 8
concurrent bate rate bem rápido em produção.

**Por que não agora**: mudança de comportamento. Se vier relatório de
throttling 429 em prod, limitar concorrência client-side a 4 com `p-limit`
ou semáforo manual. Código atual é `Promise.all` puro:
`app/app/create/new/page.tsx:519`.

### 5. Writer prompt compression
Writer prompt ~15k chars (systemPrompt + userMessage). Prompt cache do
Gemini aceita, mas input tokens contam. Reduzir repetição entre blocos
(ex: REGRA DE LINGUAGEM + RADICAL SPECIFICITY têm overlap).

**Por que não agora**: ganho de tokens <5%, fragilizar o prompt é caro.

## Instrumentação aberta

Se `[generate][timing]` mostrar `writer > 45s` consistentemente em prod,
considerar item 1 (streaming). Se `ner > 4s`, reduzir `MAX_INPUT_CHARS`
de 18000 pra 12000 em `source-ner.ts`.
