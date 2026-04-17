import { CONTENT_MACHINE_RENDER_SPECS, normalizeDesignTemplate } from "@/lib/carousel-templates";
import type { DesignTemplateId } from "@/lib/carousel-templates";
import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

// ─── Types ──────────────────────────────────────────────────────────

type StepName = "triagem" | "headlines" | "backbone" | "render";
type TemplateName = DesignTemplateId;

interface GenerateV2Request {
  step: StepName;
  topic: string;
  template: TemplateName;
  context?: string;
  choice?: number;
  niche: string;
  tone: string;
  language: string;
}

// ─── Content Machine System Prompt ──────────────────────────────────

const CONTENT_MACHINE_SYSTEM = `Você é o Content Machine 5.4 — um agente de construção narrativa para carrosséis de alto impacto.

PRINCÍPIO CENTRAL: Todo carrossel forte nasce de uma TENSÃO CENTRAL — um conflito entre a percepção comum e uma leitura mais profunda. Sem tensão, não há swipe.

REGRAS GLOBAIS DE LINGUAGEM:
- Não inventar fatos, números, datas, locais ou fontes.
- Não fazer acusações diretas a pessoas ou empresas.
- Sem metalinguagem. Sem 2ª pessoa ("você", "tu", "seu", "sua").
- Proibido: "cena", sugestões de imagem/cor/design/layout/tipografia.
- Frases com alta densidade de sentido. Zero gordura verbal.
- Mais tese do que ornamentação. Menos adjetivo solto, mais mecanismo.
- ESPECIFICIDADE RADICAL: nunca "muitas pessoas" — sempre "78% dos criadores". Nunca "resultados incríveis" — sempre "aumento de 340% em saves".
- PROIBIDO: "game-changer", "nesse sentido", "atualmente", "a maioria", "resultados incríveis", "muitas pessoas", "descubra como".
- Progressão lógica entre blocos. Cada bloco move o raciocínio adiante.
- Fechamento que AMPLIA a leitura, nunca apenas resume.

Você retorna APENAS JSON no formato exigido por cada etapa. Nunca retorne texto fora do JSON.`;

// ─── Step-specific prompts ──────────────────────────────────────────

function buildTriagemPrompt(topic: string, niche: string, tone: string, language: string): string {
  return `${CONTENT_MACHINE_SYSTEM}

ETAPA: TRIAGEM — Extrair a tensão narrativa profunda do insumo.

NÃO resuma o insumo. DISSEQUE-O. Encontre onde está o conflito, a contradição, o não-dito.

PROCESSO INTERNO (4 camadas de extração):
1. TRANSFORMAÇÃO: O que esse insumo bruto pode se tornar como narrativa? Qual é o salto entre o fato literal e a história poderosa? Explique a costura e a consequência.
2. FRICÇÃO CENTRAL: Qual CONTRADIÇÃO real move este assunto? Não é "o tema é X" — é "todo mundo acha Y, mas na verdade Z porque W". Sem fricção = sem carrossel. Se não encontrar fricção forte, o carrossel vai ser medíocre.
3. ÂNGULO NARRATIVO: Qual leitura mais forte organiza o carrossel? Escolha UMA entre: reenquadramento, conflito oculto, implicação sistêmica, contradição, ameaça/oportunidade, nomeação, diagnóstico cultural, inversão, ambição de mercado, mecanismo social. Justifique a escolha.
4. EVIDÊNCIAS: Sinais concretos, observáveis e verificáveis que sustentam a leitura. Use prosa com A), B), C). Cada evidência deve ser específica — números, nomes, comportamentos observáveis. Nunca "muitas empresas fazem isso" — sempre "3 das 5 maiores fintechs do Brasil migraram para..."

RETORNE JSON:
{
  "transformacao": "O salto narrativo possível — de fato bruto a história poderosa, com costura e consequência",
  "friccao": "A contradição CENTRAL que torna este assunto interessante — formulada como tensão entre percepção comum vs. realidade",
  "angulo": "A leitura dominante escolhida (nomeie qual das 10 naturezas) + por que ela é a mais forte para este insumo",
  "evidencias": "Prosa com A), B), C) — sinais concretos, específicos e verificáveis"
}

Nicho: ${niche}
Tom: ${tone}
Idioma: ${language}

INSUMO:
${topic}`;
}

function buildHeadlinesPrompt(topic: string, context: string, niche: string, tone: string, language: string): string {
  return `${CONTENT_MACHINE_SYSTEM}

ETAPA: HEADLINES — Gerar 10 capas que PARAM O SCROLL em 0.7 segundos.

PRINCÍPIO: Headline NÃO é mini-resumo da tese. Headline é MECANISMO DE CAPTURA. O leitor deve sentir que tem algo MAIOR em jogo — algo que precisa entender agora.

REGRA-MÃE:
- Linha 1 = INTERRUPÇÃO (max 8 palavras). Quebra a leitura óbvia. Termina com "?" ou ":"
- Linha 2 = ANCORAGEM (max 12 palavras). Dá contexto e eleva o stake. Termina com "." ou "!"
- As duas linhas são INDEPENDENTES — cada uma sustenta uma ideia sozinha
- Juntas, criam tensão irresistível

CHECKLIST INTERNO para cada headline (TODAS devem passar):
- INTERRUPÇÃO: faz o polegar parar? Se não, reescreva.
- RELEVÂNCIA: é específica DESTE tema? Se trocar o assunto e ainda funcionar, é genérica demais. Reescreva.
- CLAREZA: entende em 0.7 segundos? Se precisar reler, simplifique.
- TENSÃO: cria vontade de swipe? Se não, falta conflito. Reescreva.

10 NATUREZAS OBRIGATÓRIAS (uma por headline, nesta ordem):
1. REENQUADRAMENTO — "Todo mundo olha X pelo lado errado. O ângulo real é..."
2. CONFLITO OCULTO — "Por trás de X, existe uma guerra que ninguém vê."
3. IMPLICAÇÃO SISTÊMICA — "X não é um caso isolado. É o sintoma de..."
4. CONTRADIÇÃO — "O conselho mais repetido sobre X está factualmente errado."
5. AMEAÇA OU OPORTUNIDADE — "Quem ignorar X nos próximos 12 meses vai..."
6. NOMEAÇÃO — "Existe um fenômeno sem nome que explica por que X acontece."
7. DIAGNÓSTICO CULTURAL — "X revela algo profundo sobre como essa geração pensa."
8. INVERSÃO — "E se o contrário do conselho comum for o caminho?"
9. AMBIÇÃO DE MERCADO — "O mercado de X está mudando. Quem entender primeiro..."
10. MECANISMO SOCIAL — "X funciona por causa de uma dinâmica que ninguém explica."

PROIBIÇÕES:
- Headlines genéricas que servem pra qualquer tema
- Linguagem burocrática, escolar, relatório corporativo
- Explicar toda a tese na linha 1 (a capa ABRE a tensão, não a resolve)
- 10 variações mornas da mesma ideia
- Abstrações sem imagem mental ou conflito
- Fórmulas gastas: "O guia definitivo", "Tudo que precisa saber", "X dicas para Y"

RETORNE JSON:
{
  "angulo_dominante": "O ângulo escolhido + a tensão que ele privilegia (1 frase)",
  "headlines": [
    { "line1": "interrupção — max 8 palavras, termina com ? ou :", "line2": "ancoragem — max 12 palavras, termina com . ou !" },
    ... (10 total)
  ]
}

Nicho: ${niche}
Tom: ${tone}
Idioma: ${language}

TRIAGEM:
${context}

INSUMO ORIGINAL:
${topic}`;
}

function buildBackbonePrompt(topic: string, context: string, choice: number, niche: string, tone: string, language: string): string {
  return `${CONTENT_MACHINE_SYSTEM}

ETAPA: ESPINHA DORSAL — Construir a arquitetura narrativa que faz cada slide INEVITÁVEL.

Com base na triagem e na headline escolhida (opção ${choice}), construa a espinha dorsal.

PRINCÍPIO: A espinha dorsal é o ROTEIRO do carrossel. Cada campo alimenta diretamente os slides. Se a espinha dorsal for fraca, nenhum template salva o resultado.

CAMPOS E O QUE CADA UM DEVE FAZER:

1. HEADLINE ESCOLHIDA: A headline selecionada — linha 1 + linha 2. Sem modificação.

2. HOOK: A abertura do carrossel (slide 2). NÃO repita a headline. O hook deve:
   - Contextualizar a tensão que a headline ABRIU
   - Deslocar o leitor do fato literal para o mecanismo profundo
   - Criar um open loop que os próximos slides vão resolver
   - Terminar com uma frase que PUXA para o próximo slide

3. MECANISMO: O "POR QUE" profundo do fenômeno. NÃO é descrição — é explicação causal.
   - Qual é a engrenagem invisível que faz isso acontecer?
   - Qual dinâmica sistêmica sustenta o fenômeno?
   - Por que a leitura óbvia é insuficiente?

4. PROVA: Sinais CONCRETOS e OBSERVÁVEIS que sustentam a tese. Use A), B), C).
   - Cada prova deve ser específica: números, nomes, comportamentos, padrões de mercado
   - Provas fracas (genéricas, sem âncora) destroem a credibilidade do carrossel
   - Provas fortes: "A) O engagement rate de carrosséis subiu 47% vs. imagens em 2025 (Hootsuite)"

5. APLICAÇÃO: Para onde essa leitura APONTA. Consequência mais ampla.
   - Não é "o que fazer" — é "o que isso significa para o futuro"
   - Deve ampliar o escopo: do caso específico para a implicação estrutural

6. DIREÇÃO: Como os slides devem PROGREDIR — a curva narrativa.
   - Onde entra a ruptura? Onde entra a prova? Onde entra o twist?
   - Cada slide deve ter uma RAZÃO para existir na sequência
   - O slide final deve AMPLIAR (não resumir) a leitura do slide 1

RETORNE JSON:
{
  "headline_escolhida": "linha 1 | linha 2",
  "hook": "Abertura que contextualiza a tensão e cria open loop",
  "mecanismo": "A engrenagem causal — por que isso acontece de verdade",
  "prova": "A), B), C) — sinais concretos com números/nomes/padrões",
  "aplicacao": "Implicação ampla — o que isso significa além do caso específico",
  "direcao": "Progressão narrativa — como os slides avançam e onde entra cada elemento"
}

Nicho: ${niche}
Tom: ${tone}
Idioma: ${language}

CONTEXTO ACUMULADO:
${context}

INSUMO ORIGINAL:
${topic}`;
}

function buildRenderPrompt(topic: string, context: string, template: TemplateName, niche: string, tone: string, language: string): string {
  const spec = CONTENT_MACHINE_RENDER_SPECS[template];

  return `${CONTENT_MACHINE_SYSTEM}

ETAPA: RENDER FINAL — Transformar a espinha dorsal em um carrossel onde NENHUM bloco é pulável.

O identificador visual "${template}" só define export/layout no app — não mude tom, densidade ou estrutura argumentativa por causa dele.
BLOCOS OBRIGATÓRIOS: exatamente ${spec.blocks}.
${spec.rules}

PRINCÍPIO DO RENDER: Cada bloco deve FLUIR para o próximo. O leitor não deve conseguir parar no meio. Se um bloco pode ser removido sem perda, ele é fraco — reescreva.

REGRAS DE QUALIDADE POR BLOCO:
1. CAPA (bloco 1-2): Deve preservar a headline escolhida com fidelidade. Reenquadramento + stake + tensão devem estar presentes. A capa ABRE o loop narrativo.

2. DESENVOLVIMENTO (blocos intermediários):
   - Cada bloco avança o raciocínio — nunca repete a mesma ideia com palavras diferentes
   - A última frase de cada bloco deve PUXAR para o próximo (micro-cliffhanger)
   - A cada 3 blocos, QUEBRE O PADRÃO: se os anteriores eram afirmações, use uma pergunta retórica ou dado surpreendente
   - ESPECIFICIDADE: nunca "empresas estão adotando" — sempre "a Nubank cortou 40% do time de conteúdo e triplicou o output com IA"
   - Cada bloco merece existir na sequência. Se não tem razão narrativa, comprima no bloco anterior.

3. FECHAMENTO (últimos 2 blocos):
   - NÃO resuma o carrossel. AMPLIE a leitura.
   - Faça CALLBACK ao bloco 1 — feche o loop que a capa abriu
   - O último bloco deve deixar o leitor com uma implicação maior que o tema inicial
   - CTA implícito: a formulação final deve provocar save, share, ou comentário pela QUALIDADE da conclusão, não por pedir explicitamente

REGRAS GERAIS:
- Exatamente ${spec.blocks} blocos de texto (o "template visual" no app não altera esta etapa)
- Manter a capa coerente com a headline escolhida na espinha dorsal
- Não usar 2ª pessoa
- Não truncar — se estourar, comprimir mantendo densidade
- Cada bloco no formato "texto N - conteúdo"
- Sem explicação fora dos blocos
- Tom conversacional, como alguém inteligente explicando no bar — não como um relatório corporativo

RETORNE JSON:
{
  "blocks": [
    "texto 1 - ...",
    "texto 2 - ...",
    ...
    "texto ${spec.blocks} - ..."
  ]
}

Nicho: ${niche}
Tom: ${tone}
Idioma: ${language}

CONTEXTO ACUMULADO (triagem + espinha dorsal):
${context}

INSUMO ORIGINAL:
${topic}`;
}

// ─── Route Handler ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    const { user } = auth;

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "generate-v2", user.id),
      limit: 50,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("[generate-v2] GEMINI_API_KEY missing");
      return Response.json(
        { error: "IA não está configurada no servidor." },
        { status: 503 }
      );
    }

    // Plan limit check
    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      const { data: prof } = await sb
        .from("profiles")
        .select("usage_count, usage_limit, plan")
        .eq("id", user.id)
        .single();
      if (prof) {
        const limit = prof.usage_limit ?? 5;
        const count = prof.usage_count ?? 0;
        if (count >= limit) {
          return Response.json(
            {
              error: `Limite de ${limit} carrosséis atingido no plano ${prof.plan || "free"}. Faça upgrade para continuar.`,
              code: "PLAN_LIMIT_REACHED",
            },
            { status: 403 }
          );
        }
      }
    }

    const body: GenerateV2Request = await request.json();
    const { step, topic, context, choice, niche, tone, language } = body;
    const template: DesignTemplateId = normalizeDesignTemplate(body.template);

    if (!topic || !step) {
      return Response.json({ error: "topic e step são obrigatórios" }, { status: 400 });
    }
    if (topic.length > 10000) {
      return Response.json({ error: "Insumo muito longo (max 10000 chars)" }, { status: 400 });
    }

    // Build step-specific prompt
    let prompt: string;
    switch (step) {
      case "triagem":
        prompt = buildTriagemPrompt(topic, niche || "", tone || "", language || "pt-br");
        break;
      case "headlines":
        prompt = buildHeadlinesPrompt(topic, context || "", niche || "", tone || "", language || "pt-br");
        break;
      case "backbone":
        if (!choice || choice < 1 || choice > 10) {
          return Response.json({ error: "Escolha uma headline de 1 a 10" }, { status: 400 });
        }
        prompt = buildBackbonePrompt(topic, context || "", choice, niche || "", tone || "", language || "pt-br");
        break;
      case "render":
        prompt = buildRenderPrompt(topic, context || "", template, niche || "", tone || "", language || "pt-br");
        break;
      default:
        return Response.json({ error: `Step inválido: ${step}` }, { status: 400 });
    }

    // Call Gemini
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    let textResponse: string;
    try {
      const genResult = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.85,
          maxOutputTokens: 8000,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      textResponse = genResult.text || "";
    } catch (err) {
      console.error("[generate-v2] Gemini API error:", err);
      return Response.json(
        {
          error: process.env.NODE_ENV === "production"
            ? "Geração com IA falhou. Tente novamente."
            : `Gemini error: ${err instanceof Error ? err.message : "Unknown"}`,
        },
        { status: 502 }
      );
    }

    if (!textResponse) {
      return Response.json({ error: "Sem resposta da IA" }, { status: 502 });
    }

    // Parse JSON
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(textResponse);
    } catch {
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        console.error("[generate-v2] Failed to parse:", textResponse.slice(0, 500));
        return Response.json({ error: "Falha ao parsear resposta da IA" }, { status: 502 });
      }
    }

    // Increment usage_count after successful render (final step)
    if (step === "render" && sb) {
      void (async () => {
        try {
          const { error: incErr } = await sb.rpc("increment_usage_count", { uid: user.id });
          if (incErr) {
            const { data: currentProfile } = await sb
              .from("profiles")
              .select("usage_count")
              .eq("id", user.id)
              .single();
            if (currentProfile) {
              await sb
                .from("profiles")
                .update({ usage_count: (currentProfile.usage_count ?? 0) + 1 })
                .eq("id", user.id);
            }
          }
          await sb.from("generations").insert({
            user_id: user.id,
            model: "gemini-2.5-flash",
            provider: "google",
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
            prompt_type: "v2-render",
          });
        } catch (e) {
          console.warn("[generate-v2] Failed to track usage:", e);
        }
      })();
    }

    return Response.json({ step, data: result });
  } catch (err) {
    console.error("[generate-v2] Unexpected error:", err);
    return Response.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
