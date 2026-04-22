# Plan — Source fidelity + transcript verificação + imagens menos genéricas

**Data:** 2026-04-22
**Context:** Gabriel testou gerar carrossel com o vídeo do Investidor 4.20 (`https://www.youtube.com/watch?v=obSImkBppFQ`) e reportou: conteúdo shallow, sem dados reais do vídeo, frases genéricas de impacto, imagens genéricas. Mesmo depois dos ajustes iniciais (SOURCE_SLICE 14k, FIDELITY block), o output não tá citando dados concretos da fala.

## Root causes suspeitas (a validar com debug)

1. **Transcript truncado ou incompleto** — Possibilidades:
   - YouTube innertube API retornou só uma parte (auto-captions curtas)
   - Supadata fallback não acionado (só roda se primary falha, não quando primary retorna parcial)
   - Nosso SOURCE_SLICE recente (14k) pode ainda estar cortando vídeos longos
   - Sem log visível em prod = não sabemos quantos chars extraímos do vídeo do Investidor
2. **Gemini ignora transcript mesmo com FIDELITY block** — LLMs às vezes "resumem em vez de citar"
3. **imageQuery continua genérico** — prompt tem regra mas writer gera "trader at laptop" em vez de "bitcoin halving chart exchange screen 2026"
4. **Instagram carousel extractor** — provavelmente só pega a caption (texto embaixo), não o TEXTO DOS SLIDES (as imagens com frase). Perdemos 80% do conteúdo

## Plano (6 fases)

### Fase 1 — Debug visibility (admin test tool) · ~2h

Criar endpoint + UI admin pra verificar CADA passo da pipeline:

- **`POST /api/admin/source-debug`** (guard admin):
  ```json
  { "sourceType": "video"|"link"|"instagram", "sourceUrl": "..." }
  ```
  Retorna:
  ```json
  {
    "extracted": {
      "method": "innertube/ANDROID_VR" | "innertube/TVHTML5" | "supadata" | "apify" | "scraper",
      "chars": 12345,
      "firstChars": "...",
      "lastChars": "...",
      "durationMs": 1234
    },
    "namedEntities": ["pessoa A", "empresa B"],
    "keyQuotes": ["citacao 1", "citacao 2"],
    "dataPoints": ["30%", "R$ 50k", "2024"]
  }
  ```
- **Página `/app/admin/source-test`**: form com dropdown (video/link/instagram) + input URL + botão "Extrair". Mostra o resultado + botão "Copiar prompt final" que monta o userMessage exato que iria pro Gemini.
- Isso responde: "o transcript tá completo? tem citações? tem dados?"

### Fase 2 — Transcript completeness · ~1h

- **YouTube**: se primary retorna <3000 chars OU transcript do vídeo não cobre a duração (`duration_seconds * 2 < chars`), forçar Supadata como fallback secundário. Log em prod: `[youtube] method=X chars=Y duration=Zmin`.
- **SOURCE_SLICE** dinâmico: em vez de 14k fixo, usar min(transcript.length, 20000). Vídeos curtos cabem inteiros, longos pegam 20k chars (~40min de fala densa).
- **Supadata**: verificar se pt-BR tá configurado nos clients. Pode estar pulando pt-BR pra en-US.

### Fase 3 — Instagram extraction real · ~3h

Atual: `instagram-extractor.ts` provavelmente só pega caption text via Apify.
Alternativas:
- **Post/Reel**: Apify `instagram-scraper` + se `mediaType === "GraphVideo"`, baixar vídeo → usar Gemini vision/Supadata pra transcrever áudio
- **Carousel**: baixar todas as imagens (já temos pipeline via `/api/post-transcripts`) → rodar vision em cada slide → concatenar `[Slide 1 visible text] + [Slide 2] + ...`

**Incremento**: reusar `/api/post-transcripts/route.ts` que já faz vision de IG carousels — integrar no extractor.

### Fase 4 — Content fidelity (NER pre-processing) · ~2h

Problema: Gemini ignora FIDELITY block mesmo com ele no prompt.
Fix: pipeline de 2 passos.

**Passo 1** — Extração estruturada (antes do writer):
```ts
const facts = await gemini.generateContent({
  model: "gemini-2.5-flash",
  contents: `Extraia do transcript:
  - 5-10 NOMES PRÓPRIOS mencionados (pessoas, empresas, produtos, lugares)
  - 5-10 NÚMEROS/DATAS/ESTATÍSTICAS exatas
  - 3-5 FRASES DE IMPACTO literais (max 80 chars cada)
  - 3 ARGUMENTOS CENTRAIS do speaker (1 frase cada)
  
  Source:\n${transcript}
  
  Retorne JSON: { entities, dataPoints, quotes, arguments }`,
  config: { responseMimeType: "application/json" }
});
```

**Passo 2** — Writer recebe os facts como `MUST CITE` list:
```
# FACTS DO SOURCE — CITE EXPLICITAMENTE
Entities: {facts.entities.join(", ")}
Data: {facts.dataPoints.join(", ")}
Quotes: {facts.quotes.map(q => `"${q}"`).join("; ")}

Teste: ao final do carrossel, 60% dos headings/bodys DEVEM conter
pelo menos 1 entity/data/quote da lista acima.
```

Isso força citação específica. Custo: +$0.0005 por carrossel (Flash barato).

### Fase 5 — Image specificity · ~1h

- Na geração de `imageQuery` do writer prompt: rule reforçada "se source tem named entity que faz sentido visualmente, USE ela no imageQuery".
- Post-processamento: se `imageQuery` contém palavras da lista proibida ("strategy", "success", "growth", etc.) OU é <4 words, REJEITAR e reescrever.
- Adicionar lista de named entities como candidates no prompt: `IMAGE SCENE CANDIDATES (da fonte): ${facts.entities.join(", ")}`.

### Fase 6 — A/B comparison tool (admin) · ~2h

No painel admin:
- "Gerar com X" vs "Gerar com Y" — roda o mesmo source duas vezes com configs diferentes (com/sem grounding, com/sem NER, com/sem FIDELITY block) e mostra os 2 outputs lado a lado.
- Útil pra afinar o prompt sem precisar recriar a conta toda.

## Ordem de implementação

| Fase | Esforço | Impacto | Prioridade |
|---|---|---|---|
| 1 — Debug tool | 2h | Alto (destrava tudo) | **P0** |
| 4 — NER pre-processing | 2h | Alto | **P0** |
| 5 — Image specificity | 1h | Médio-Alto | **P1** |
| 2 — Transcript robustness | 1h | Médio | **P1** |
| 3 — IG carousel/reel full | 3h | Médio | **P2** (depois de validar 1+4) |
| 6 — A/B tool | 2h | Nice-to-have | **P2** |

**Total P0**: 4h. **Total P0+P1**: 6h. **Total full**: 11h.

## Hipótese falsificável

Se depois de **Fase 1+4** (6h) Gabriel testar o mesmo vídeo do Investidor 4.20 e:
- Debug tool mostrar `chars > 10k` no transcript → transcript tá completo
- Carrossel citar pelo menos 3 nomes próprios do vídeo (ex: nome do entrevistado, empresa, token específico) → fidelidade OK
- imageQuery de pelo menos 50% dos slides conter termos específicos (não genéricos) → imagem OK

Se sim → fechamos. Se não → partimos pra Fase 5 (image rules) + ajuste de prompts.

## Observações

- Custo adicional com NER pre-processing: ~$0.0005 por carrossel (Gemini Flash). Negligível.
- Debug tool não afeta user final — só admin.
- Mantém compatibilidade com fluxos atuais. Nenhum breaking change.
- Não exige grounding (googleSearch) — foco é fidelidade AO SOURCE, não web search externa.
