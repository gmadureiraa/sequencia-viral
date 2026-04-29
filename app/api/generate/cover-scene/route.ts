import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
import { GoogleGenAI } from "@google/genai";
import { costForTokens, recordGeneration } from "@/lib/server/generation-log";
import {
  getDesignTemplateMeta,
  normalizeDesignTemplate,
  type DesignTemplateId,
} from "@/lib/carousel-templates";

export const maxDuration = 15;

interface CoverSceneRequest {
  heading: string;
  body?: string;
  niche?: string;
  tone?: string;
  brandAesthetic?: string;
  /** Template visual escolhido — trava style guide + modifier estético. */
  designTemplate?: DesignTemplateId;
}

interface CoverScenePayload {
  sceneDescription: string;
  subjectFocus: string;
  environment: string;
  lighting: string;
  mood: string;
  composition: string;
  paletteHints: string[];
}

/**
 * POST /api/generate/cover-scene
 * Passo 1 do 2-pass pra gerar capa cinematográfica do template Futurista.
 * Gemini 2.5 Flash lê o tema do carrossel e devolve uma descrição visual
 * RICA (metáfora, ambiente, luz, composição) que vira o prompt principal
 * do Imagen no passo 2.
 *
 * Custo: ~$0.001 por chamada. Reduz tempo que o user espera vendo capa
 * medíocre — planeja narrativa antes.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "cover-scene", user.id),
    limit: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: CoverSceneRequest;
  try {
    body = (await request.json()) as CoverSceneRequest;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const heading = (body.heading || "").trim().slice(0, 500);
  if (!heading) {
    return Response.json({ error: "heading obrigatório" }, { status: 400 });
  }

  const bodyText = (body.body || "").trim().slice(0, 2000);
  const niche = (body.niche || "").slice(0, 80);
  const tone = (body.tone || "").slice(0, 80);
  const brandAesthetic = (body.brandAesthetic || "").slice(0, 1500);
  // Template lock — cover-scene respeita style guide + modifier do template
  // visual. Sem isso, a "cena cinematográfica" sai do mood do template
  // (ex: tema editorial Manifesto recebia cena tech neon Futurista).
  const tmplId = body.designTemplate
    ? normalizeDesignTemplate(body.designTemplate)
    : null;
  const tmplMeta = tmplId ? getDesignTemplateMeta(tmplId) : null;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return Response.json(
      { error: "IA indisponível" },
      { status: 503 }
    );
  }

  // Brand aesthetic fallback — se user não configurou, tenta profile
  let aesthetic = brandAesthetic;
  if (!aesthetic) {
    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      try {
        const { data: prof } = await sb
          .from("profiles")
          .select("brand_analysis")
          .eq("id", user.id)
          .single();
        const ba = prof?.brand_analysis as Record<string, unknown> | null;
        const a = ba?.__image_aesthetic as
          | { description?: string }
          | undefined;
        if (a?.description) aesthetic = a.description;
      } catch {
        /* ignora */
      }
    }
  }

  // Prompt schema inspired by Google's image-gen docs:
  //   "A photorealistic [shot type] of [subject], [action]. Illuminated by
   //   [lighting], creating a [mood]. Captured with a [lens], emphasizing
  //   [textures]. [Aspect ratio]."
  // We output field-by-field so the image route can assemble a tight,
  // well-structured prompt for Imagen.
  const templateBlock = tmplMeta
    ? `\nTEMPLATE VISUAL ESCOLHIDO (REGRA INVIOLÁVEL — não improvise):
- Nome: "${tmplMeta.name}" (id: ${tmplMeta.id})
- Style guide: ${tmplMeta.styleGuidePrompt}
- Modifier estético OBRIGATÓRIO em todas as imagens deste carrossel: "${tmplMeta.slideAestheticModifier}"
- Paleta preferida: ${tmplMeta.preferPalette.join(", ")}
- Paleta proibida: ${tmplMeta.avoidPalette.join(", ") || "(nenhuma)"}

A cena cinematográfica deve estar dentro do mood + paleta + textura do template acima. Se o tema do briefing parecer pedir um mood diferente do template, o TEMPLATE VENCE.\n`
    : "";

  const prompt = `Você é um diretor de arte editorial cinematográfico. Receba o tema do slide de capa de um carrossel e devolva uma DESCRIÇÃO VISUAL estruturada pra alimentar um gerador de imagem (Imagen 4 / Gemini Image).

O resultado precisa parecer CAPA DE REVISTA ou POSTER DE NETFLIX, não stock photo. Reference: BrandsDecoded Instagram (editorial premium, composição narrativa forte, iluminação dramática, metáforas visuais).
${templateBlock}
TEMA DA CAPA:
"""
Título: ${heading}
${bodyText ? `Subtítulo: ${bodyText}\n` : ""}${niche ? `Nicho: ${niche}\n` : ""}${tone ? `Tom: ${tone}\n` : ""}
"""
${aesthetic ? `ESTÉTICA DA MARCA (seguir fielmente):\n${aesthetic}\n\n` : ""}
## SUAS REGRAS

1. **Planeje uma METÁFORA VISUAL** — não literal. Se o tema é "ChatGPT morreu", mostre um robô chatbot com a placa do ChatGPT caído em cemitério. Se é "Claude é o novo Figma", mostre um personagem Claude (sol laranja estrelado) ensinando numa lousa com Figma/Canva riscados. Metáfora precisa ser RECONHECÍVEL na primeira olhada.

2. **Subject CENTRALIZADO** no quadro, terço médio/superior. O terço INFERIOR do frame fica mais escuro/simples pro texto overlay. Composição "rule of thirds" com bottom vazio.

3. **Iluminação cinematográfica dramática** — nunca flat light. Rim light, key light, practicals (lâmpadas cênicas), blue hour, amber sunset, studio red/blue, hard window light. Específico por cena.

4. **Mood + gênero visual** — Netflix poster dramatic, Vogue editorial cover, documentary photojournalism, 3D render cinematic, etc. Escolha UM gênero coerente.

5. **Paleta de 2-3 cores dominantes** que saturem a cena sem ficar look "IA genérica".

6. **NUNCA DESCREVA TEXTO NA CENA** — regra obrigatória. Jamais sugira placas escritas, títulos visíveis, jornais abertos, telas com UI legível, logotipos, letreiros de loja, letreiros luminosos, letras no quadro, letras no chão, letras em roupas, watermarks. Se o conceito exigir superfície que normalmente teria texto (revista, livro, quadro-negro, painel), descreva a superfície como "blank", "illegible", "blurred beyond recognition" ou apenas "abstract shapes" — NUNCA com palavras ou letras visíveis. Texto é renderizado depois como overlay no front; a imagem tem que sair 100% livre de qualquer caractere legível.

## OUTPUT

Retorne APENAS JSON válido:

{
  "sceneDescription": "parágrafo único de 60-120 palavras descrevendo a cena completa em inglês, técnico, pronto pra Imagen",
  "subjectFocus": "pt-BR, subject principal (ex: 'Joker como apresentador de telejornal')",
  "environment": "pt-BR (ex: 'estúdio caótico com câmeras')",
  "lighting": "pt-BR (ex: 'luzes vermelhas e azuis de estúdio, rim light no rosto')",
  "mood": "pt-BR (ex: 'satírico, teatral, uncanny')",
  "composition": "pt-BR (ex: 'subject center-upper, rule of thirds, bottom third simpler for text')",
  "paletteHints": ["3 cores em pt-BR (ex: 'vermelho carmesim', 'azul profundo', 'amarelo TV news')"]
}`;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await geminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.85,
          maxOutputTokens: 800,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    );
    const text = result.text || "";
    const usage = result.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;
    await recordGeneration({
      userId: user.id,
      model: "gemini-2.5-flash",
      provider: "google",
      inputTokens,
      outputTokens,
      costUsd: costForTokens("gemini-2.5-flash", inputTokens, outputTokens),
      promptType: "cover-scene",
    });

    let parsed: Partial<CoverScenePayload>;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const scene: CoverScenePayload = {
      sceneDescription: (parsed.sceneDescription || "").slice(0, 1500),
      subjectFocus: (parsed.subjectFocus || "").slice(0, 200),
      environment: (parsed.environment || "").slice(0, 200),
      lighting: (parsed.lighting || "").slice(0, 200),
      mood: (parsed.mood || "").slice(0, 120),
      composition:
        (parsed.composition || "").slice(0, 200) ||
        "subject center, rule of thirds, bottom third simpler for text",
      paletteHints: Array.isArray(parsed.paletteHints)
        ? parsed.paletteHints.slice(0, 4).map((p) => String(p).slice(0, 60))
        : [],
    };

    if (!scene.sceneDescription) {
      return Response.json(
        { error: "IA não produziu descrição válida" },
        { status: 502 }
      );
    }

    return Response.json(scene);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cover-scene] Gemini falhou:", msg);
    return Response.json({ error: msg.slice(0, 200) }, { status: 502 });
  }
}
