# Content Machine — Engenharia Reversa (BrandsDecoded)

> Framework observável de criação de carrosséis extraído do Content Machine 5.4.
> Fonte: Conversa com ChatGPT + docs do plugin + análise dos templates Figma.

---

## 1. Princípio Central

Um carrossel forte nasce de uma **tensão central** — um conflito entre percepção comum e leitura mais profunda.

**Estrutura-base:**
1. Fato, sintoma ou insight inicial
2. Fricção central
3. Reenquadramento narrativo
4. Mecanismo explicativo
5. Prova ou âncora concreta
6. Aplicação ou implicação
7. Fechamento que amplia a leitura

---

## 2. Triagem do Insumo (4 camadas)

| Camada | O que extrair |
|--------|---------------|
| **Transformação** | O que o insumo bruto pode se tornar como narrativa |
| **Fricção central** | Qual contradição move o assunto |
| **Ângulo narrativo** | Qual leitura organiza melhor a história |
| **Evidências** | Quais sinais concretos justificam a interpretação |

---

## 3. Seleção de Ângulo

**Ângulos fortes contêm:**
- Tensão central identificável
- Mecanismo sugerido
- Âncora concreta, cultural ou observável
- Stake claro: por que isso importa

**Ângulos fracos:**
- Pergunta vazia sem reenquadramento
- Frase genérica que serve pra qualquer tema
- Opinião solta sem mecanismo
- Abstração sem prova

---

## 4. Espinha Dorsal (6 partes)

| Parte | Função |
|-------|--------|
| **Ângulo** | A tese central do post |
| **Hook** | Abertura que quebra a leitura óbvia |
| **Mecanismo** | Por que o fenômeno acontece |
| **Prova** | Sinais, exemplos, padrões A), B), C) |
| **Aplicação** | Para onde essa leitura aponta |
| **Direção** | Como os slides devem avançar |

---

## 5. Padrão da Capa (Headline)

A capa funciona melhor quando:
- Bloco 1 sustenta uma ideia sozinho
- Bloco 2 aprofunda, tensiona ou reenquadra
- As duas frases são **independentes**
- Leitura direta e memorável
- Sem dependência sintática entre blocos

**10 naturezas de headline:**
1. Reenquadramento
2. Conflito oculto
3. Implicação sistêmica
4. Contradição
5. Ameaça ou oportunidade
6. Nomeação
7. Diagnóstico cultural
8. Inversão
9. Ambição de mercado
10. Mecanismo social

**Regra-mãe:** Linha 1 = captura. Linha 2 = ancoragem.

---

## 6. Progressão dos Slides

1. Abrir com ruptura de expectativa
2. Nomear a tensão real
3. Deslocar do fato para o mecanismo
4. Mostrar por que a leitura comum é insuficiente
5. Sustentar com provas ou sinais
6. Ampliar a implicação
7. Fechar com formulação que reorganiza o tema

---

## 7. Tema → Fenômeno Cultural

Quando o tema envolve marca/produto/case/celebridade, tratar como:
- Símbolo de comportamento
- Disputa de status
- Mudança de hábito
- Identidade de grupo
- Sinal de época
- Condensação de ansiedade coletiva

---

## 8. Heurísticas de Linguagem

- Frases com alta densidade de sentido
- Pouca gordura verbal
- Mais tese do que ornamentação
- Menos adjetivo solto, mais mecanismo
- Preferência por afirmações específicas
- Progressão lógica entre blocos
- Fechamento que amplia, não resume

---

## 9. O que Enfraquece o Texto

- Generalidade excessiva
- Tom motivacional sem análise
- Repetição de ideia com palavras diferentes
- Excesso de abstração
- Falta de âncora observável
- Excesso de suspense sem entrega
- Estética acima de clareza

---

## 10. Regras de um Bom Hook

Deve fazer pelo menos 2 destas:
- Contrariar a leitura imediata
- Abrir uma tensão real
- Prometer uma explicação
- Elevar o stake
- Deslocar do literal para o estrutural

**Movimentos de hook:**
- "O problema não é X"
- "X revela algo maior"
- "A crise não começa onde parece"
- "O debate real está em outro lugar"

---

## 11. Como Sustentar a Prova

A prova pode operar por:
- Padrão recorrente de reação pública
- Contraste observável
- Linguagem usada pelas pessoas
- Comportamento de mercado
- Sintoma social ou cultural
- Sinal de mídia, consumo ou rotina

---

## 12. Templates

| Template | Blocos | Melhor para |
|----------|--------|-------------|
| **Principal** | 18 | Raciocínio desenvolvido, respiros e subtítulos |
| **Futurista** | 14 (10 slides) | Síntese densa, visual limpo, blocos curtos |
| **Autoral** | 18 | Leitura analítica fluida, menos quebras |
| **Twitter** | 21 | Avanço passo a passo, thread visual |

---

## 13. Checklist de Qualidade

- [ ] A capa sustenta o ângulo real?
- [ ] Slide 2 aprofunda sem depender do slide 1?
- [ ] Existe tensão central legível?
- [ ] Há mecanismo, não só opinião?
- [ ] A prova sustenta a tese?
- [ ] Cada slide move o raciocínio adiante?
- [ ] O fechamento reorganiza a leitura?
- [ ] Consistência entre abertura, desenvolvimento e fim?

---

## 14. Fórmula Prática

```
Assunto literal → tensão central → reenquadramento → mecanismo → prova → implicação → fechamento
```

**Aplicação rápida:**
1. Escrever o assunto como aparece na superfície
2. Perguntar qual contradição o torna interessante
3. Decidir qual leitura mais forte organiza o post
4. Formular abertura que rompa o óbvio
5. Explicar por que isso acontece
6. Listar 3 sinais que sustentem a leitura
7. Fechar com implicação mais ampla

---

## 15. Máquina de Estados (Fluxo do Plugin)

```
Estado 0: "Iniciar Experiência"
Estado 1: Escolha (1=transformar conteúdo, 2=criar de insight)
Estado 2: Receber insumo → pesquisa automática se necessário
Estado 3: Etapa 1 — Triagem (tabela)
Estado 4: Espera "ok"
Estado 5: Etapa 2 — Headlines (10 opções)
Estado 6: Espera escolha 1-10
Estado 7: Etapa 3 — Espinha dorsal (tabela)
Estado 8: Espera "ok"
Estado 9: Etapa 4 — Escolha template (1-4)
Estado 10: Espera escolha
Estado 11: Etapa 5 — Render final (Markdown)
```

---

*Extraído em: 2026-04-17 | Fonte: ChatGPT Content Machine 5.4 + BrandsDecoded*
