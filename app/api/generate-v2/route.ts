import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

// ─── Types ──────────────────────────────────────────────────────────

type StepName = "triagem" | "headlines" | "backbone" | "render";
type TemplateName = "principal" | "futurista" | "autoral" | "twitter";

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

const CONTENT_MACHINE_SYSTEM = `Você é o Content Machine 5.4 — um agente de construção narrativa para carrosséis.

REGRAS GLOBAIS DE LINGUAGEM:
- Não inventar fatos, números, datas, locais ou fontes.
- Não fazer acusações diretas a pessoas ou empresas.
- Sem metalinguagem.
- Sem 2ª pessoa ("você", "tu", "seu", "sua").
- Proibido usar o termo "cena".
- Proibido sugerir imagem, cor, design, layout, tipografia, enquadramento ou edição.
- Frases com alta densidade de sentido.
- Pouca gordura verbal.
- Mais tese do que ornamentação.
- Menos adjetivo solto, mais mecanismo.
- Preferência por afirmações específicas.
- Progressão lógica entre blocos.
- Fechamento que amplia, não resume.

Você retorna APENAS JSON no formato exigido por cada etapa. Nunca retorne texto fora do JSON.`;

// ─── Step-specific prompts ──────────────────────────────────────────

function buildTriagemPrompt(topic: string, niche: string, tone: string, language: string): string {
  return `${CONTENT_MACHINE_SYSTEM}

ETAPA: TRIAGEM
Analise o insumo abaixo e extraia a triagem narrativa.

RETORNE JSON com exatamente estes campos:
{
  "transformacao": "O que o insumo bruto pode se tornar como narrativa — explique com costura e consequência",
  "friccao": "Qual contradição real move o assunto — explicite a tensão, não apenas resuma o tema",
  "angulo": "Qual leitura mais forte organiza o carrossel — escolha a leitura dominante",
  "evidencias": "Sinais concretos que justificam a interpretação — use prosa com A), B), C)"
}

Nicho: ${niche}
Tom: ${tone}
Idioma: ${language}

INSUMO:
${topic}`;
}

function buildHeadlinesPrompt(topic: string, context: string, niche: string, tone: string, language: string): string {
  return `${CONTENT_MACHINE_SYSTEM}

ETAPA: HEADLINES (CAPAS)
Com base na triagem abaixo, gere 10 opções de headline para a capa do carrossel.

REGRAS:
- Cada headline tem 2 linhas independentes
- Linha 1 = captura (termina com "?" ou ":")
- Linha 2 = ancoragem (termina com "." ou "!")
- As 10 opções devem variar de natureza:
  1. reenquadramento
  2. conflito oculto
  3. implicação sistêmica
  4. contradição
  5. ameaça ou oportunidade
  6. nomeação
  7. diagnóstico cultural
  8. inversão
  9. ambição de mercado
  10. mecanismo social
- Headline NÃO é mini-resumo. É mecanismo de captura.
- Evitar headlines genéricas que servem para vários temas.
- Sem linguagem burocrática ou analítica demais.
- Sem 2ª pessoa.

RETORNE JSON:
{
  "angulo_dominante": "explicação curta do ângulo escolhido e da tensão que ele privilegia",
  "headlines": [
    { "line1": "...", "line2": "..." },
    ...
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

ETAPA: ESPINHA DORSAL
Com base na triagem e na headline escolhida (opção ${choice}), construa a espinha dorsal do carrossel.

CAMPOS:
- headline_escolhida: a headline selecionada (linha 1 + linha 2)
- hook: abertura que quebra a leitura óbvia e contextualiza a tensão da headline
- mecanismo: por que o fenômeno acontece
- prova: sinais, exemplos, padrões — use A), B), C)
- aplicacao: para onde essa leitura aponta, consequência mais ampla
- direcao: como os slides devem avançar, sem CTA comercial

RETORNE JSON:
{
  "headline_escolhida": "linha 1 | linha 2",
  "hook": "...",
  "mecanismo": "...",
  "prova": "...",
  "aplicacao": "...",
  "direcao": "..."
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
  const templateSpec: Record<TemplateName, { blocks: number; rules: string }> = {
    principal: {
      blocks: 18,
      rules: "Exatamente 18 blocos. Alternância entre blocos mais curtos e mais densos. A capa deve preservar reenquadramento + stake + mecanismo.",
    },
    futurista: {
      blocks: 14,
      rules: "Exatamente 14 textos para 10 slides. Compactação maior. Blocos densos e concisos.",
    },
    autoral: {
      blocks: 18,
      rules: "Exatamente 18 blocos. Progressão narrativa contínua. Preservar o mecanismo central ao longo do desenvolvimento.",
    },
    twitter: {
      blocks: 21,
      rules: "Exatamente 21 blocos. Estrutura fragmentada estilo thread. Manter continuidade lógica entre os blocos.",
    },
  };

  const spec = templateSpec[template];

  return `${CONTENT_MACHINE_SYSTEM}

ETAPA: RENDER FINAL
Gere o carrossel completo no template escolhido.

TEMPLATE: ${template.toUpperCase()} (${spec.blocks} blocos)
REGRAS DO TEMPLATE: ${spec.rules}

REGRAS GERAIS DO RENDER:
- Obedecer integralmente ao template
- Manter a capa coerente com a headline escolhida
- Não usar 2ª pessoa
- Não truncar — se estourar, comprimir
- Cada bloco no formato "texto N - conteúdo"
- Sem explicação fora dos blocos

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
    const { step, topic, template, context, choice, niche, tone, language } = body;

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
        if (!template) {
          return Response.json({ error: "Template é obrigatório para render" }, { status: 400 });
        }
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
