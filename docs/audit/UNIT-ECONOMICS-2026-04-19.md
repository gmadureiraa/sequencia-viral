# Unit Economics — Sequência Viral · 2026-04-19

Custo real por carrossel, margem por plano, teto de CAC pra ads.
Todos os cálculos têm premissas declaradas — se mudar 1 premissa, os
números mudam linear. Taxa usada: **1 USD = R$ 5,00** (ajuste se precisar).

---

## 1. Custo por chamada de API (fonte: `lib/server/generation-log.ts`)

| API | Modelo | Pricing | Por chamada típica |
|---|---|---|---|
| `/api/generate` | gemini-2.5-flash | $0.15/1M in · $0.60/1M out | ~5k in + 4k out = **$0.0032** |
| `/api/generate-concepts` | gemini-2.5-flash | idem | ~1.5k + 1k = **$0.0009** |
| `/api/generate/caption` | gemini-2.5-flash | idem | ~2k + 800 = **$0.0008** |
| `/api/images` mode=search | Serper | $0.005/query | 1 busca = **$0.005** |
| `/api/images` mode=generate | imagen-4.0 | $0.04/imagem | 1 img = **$0.04** |
| `/api/brand-aesthetic` | gemini-2.5-flash Vision | idem + input maior | ~3k + 300 = **$0.0007** (1x) |
| `/api/brand-analysis` | claude-sonnet-4-6 | $3/1M in · $15/1M out | ~1.5k + 600 = **$0.0135** (1x) |
| Apify IG scraper | via quotas | ~$0.001/req (volume alto) | **$0.001** |

---

## 2. Custo por carrossel completo

Assumindo 1 carrossel = 1 gen texto + 1 caption + 8 imagens + 1 concept (se usado)

### Cenário A — Default (Serper pra imagens)
```
Texto + thinking        = $0.0032
Caption                 = $0.0008
8 imagens via Serper    = $0.040   (8 × $0.005)
─────────────────────────────────
TOTAL                   = $0.044   ≈ R$ 0,22 por carrossel
```

### Cenário B — Usuário usa Imagen 4 em metade das imagens
```
Texto + caption         = $0.0040
4 imagens search        = $0.020
4 imagens Imagen 4      = $0.160   (4 × $0.04)
─────────────────────────────────
TOTAL                   = $0.184   ≈ R$ 0,92 por carrossel
```

### Cenário C — Usuário usa Imagen 4 em todas (pior caso)
```
Texto + caption         = $0.0040
8 imagens Imagen 4      = $0.320
─────────────────────────────────
TOTAL                   = $0.324   ≈ R$ 1,62 por carrossel
```

### Custos únicos (amortizados, não por carrossel)
- **brand-analysis** (Claude): $0.014 — roda 1x por conta no onboarding
- **brand-aesthetic** (Vision): $0.001 — cada vez que user re-sobe refs
- **Apify scrape**: $0.001 — no onboarding se conectar IG

> Usuário novo custa ~$0.015 (R$ 0,08) só pra onboardar — irrelevante.

---

## 3. Custo por usuário / mês

Premissa: usuário usa **60% search + 40% Imagen IA** (meio-termo realista).
Custo médio por carrossel nesse mix = **$0.10 ≈ R$ 0,50**.

| Plano | Carrosséis/mês típico | Custo API/mês | Receita | Gross margin |
|---|---|---|---|---|
| **Free** | 5 (limite) | R$ 2,50 | R$ 0 | **−R$ 2,50** (CAC) |
| **Pro** | 20 (67% do limit) | R$ 10 | R$ 89 | **89%** (R$ 79 lucro) |
| **Pro heavy** | 30 (100%) | R$ 15 | R$ 89 | **83%** (R$ 74) |
| **Agência** | 120 (média de agência ativa) | R$ 60 | R$ 249 | **76%** (R$ 189) |

**Insight**: mesmo no pior caso de uso pesado com Imagen (Cenário C × 30), o Pro ainda dá ~R$ 41 de lucro (46% margin). **Margem é bem protegida.**

---

## 4. LTV (Lifetime Value) — quanto cada pagante rende no tempo

Premissa de churn: **15% ao mês** (SaaS B2C criadores de conteúdo típico).
Tempo médio de assinatura = 1 / 0.15 = **6,7 meses**.

| Plano | Receita/mês | Custo/mês | Lucro/mês | LTV (6,7mo) |
|---|---|---|---|---|
| Pro mensal | R$ 89 | R$ 10 | R$ 79 | **R$ 529** |
| Pro anual (−20%) | R$ 71 | R$ 10 | R$ 61 | **R$ 732** (paga 12m upfront) |
| Agência mensal | R$ 249 | R$ 60 | R$ 189 | **R$ 1.266** |
| Agência anual | R$ 199 | R$ 60 | R$ 139 | **R$ 1.668** |

> **Anual ganha em LTV** mesmo com desconto — garante 12 meses de fluxo sem churn.

---

## 5. CAC máximo sustentável

Regra de ouro SaaS: **LTV : CAC = 3 : 1** (saudável) · **4:1** (ótimo) · **2:1** (apertado).

| Meta | Pro (LTV R$ 529) | Agência (LTV R$ 1.266) |
|---|---|---|
| **3:1 (saudável)** | R$ 176 por pagante | R$ 422 por pagante |
| **4:1 (ótimo)** | R$ 132 | R$ 316 |
| **Payback 3 meses** | R$ 237 | R$ 567 |

**Seu teto prático de CAC**:
- **Pro: até R$ 180 por pagante** → payback ~2,3 meses, LTV:CAC ~3:1
- **Agência: até R$ 400 por pagante** → payback ~2,1 meses

---

## 6. Orçamento de ads — quanto gastar

### Funnel típico (Meta/Instagram Ads BR, vertical criador):

| Etapa | Taxa | Custo acumulado/pagante Pro |
|---|---|---|
| Click (CPC) | R$ 1,50 | R$ 1,50 |
| Visita → signup free | 5% | R$ 30 |
| Free → Pro pagante (baseline) | 8% | **R$ 375** |
| Free → Pro com popup 30% + onboarding bom | 15% | **R$ 200** |
| Free → Pro com trial 7d auto | 25% | **R$ 120** |

**Sem popup**: R$ 375 por pagante → dentro do limite R$ 237 (payback 3m)? **Não**. Ruim.
**Com popup 30%**: R$ 200 → dentro do limite. **OK mas apertado.**
**Com trial 7d + popup**: R$ 120 → confortável. **Margem boa pra escalar.**

### Budget sugerido pra começar

**Fase 1 — Teste (2-3 semanas)**: R$ 50/dia ≈ R$ 1.500/mês
- Meta: validar CPC < R$ 2,00 e conversion landing→signup > 4%
- Se bateu: vai pra Fase 2

**Fase 2 — Escala inicial (4-8 semanas)**: R$ 200/dia ≈ R$ 6.000/mês
- Meta: 3 pagantes/dia (Pro ou Agência)
- Monitorar CAC real vs LTV

**Fase 3 — Escala real**: R$ 500-1000/dia se unit economics baterem
- Meta: LTV:CAC ≥ 3:1

### Campanhas recomendadas

1. **Retargeting quente**: quem visitou landing mas não cadastrou — CPM baixo, conversão alta
2. **Lookalike dos primeiros 20 pagantes**: quando tiver 20+ pros
3. **Interest targeting**: criadores de conteúdo, SMMA, copywriters, ecommerce solo
4. **Conteúdo orgânico + boost**: posts do @madureira que perfoman → impulsiona (CAC muito menor)

---

## 7. Regra mental rápida

> **"Cada R$ 1 de MRR novo custa R$ 2-3 em ads."**

Então pra bater **R$ 10.000 de MRR novo/mês**:
- Gasto em ads: **R$ 20-30k/mês**
- Novos pagantes: **~100 pro ou ~40 agência**
- Break-even desse gasto: mês 3 depois da aquisição

---

## 8. Variáveis que movem os números

| Alavanca | Impacto |
|---|---|
| Subir preço Pro pra R$ 129 | +45% LTV, −5% conversão estimada → **net +35%** |
| Reduzir churn de 15% pra 10% | **+50% LTV** (mais importante que preço) |
| Popup 30% off (já implementado) | +87% conversion free→pro |
| Trial 7d automático (não implementado) | +213% conversion (grande) |
| Anual com 20% off (já implementado) | +38% LTV |
| Render-mode default mudar pra Imagen | −70% margem (evitar) |

**Maior alavanca de lucro**: **reduzir churn**. Onboarding bom + emails de ativação fazem milagre.

---

## 9. Unit economics resumido num número

> **Cada Pro pagante rende ~R$ 79/mês de lucro. Dura ~6,7 meses. Custa adquirir ~R$ 150-200.**
> **Retorno: R$ 529 de lucro vs R$ 200 de CAC = 2,6x em 6 meses, 3,3x se anual.**

Saudável. Sustentável. Escalável se otimizar churn e conversion.

---

## 10. Próximas ações pra melhorar unit economics

1. **Implementar trial de 7 dias no Pro** (conversion sobe muito)
2. **Email de "saudade" no subscription.deleted** pra recuperar churners (gap do audit)
3. **Résumé mensal de atividade** — engajamento diário = menos churn
4. **Rotina de win-back** pros cancelados (email 30 dias depois)
5. **Considerar Pro mensal R$ 109** (teste A/B) — LTV sobe mais que conversão cai
6. **Pushar anual agressivamente** na landing (já tem toggle)

Se precisar rodar simulação pra outros cenários (volume diferente, preço diferente, churn diferente), me passa os parâmetros que eu recalculo.
