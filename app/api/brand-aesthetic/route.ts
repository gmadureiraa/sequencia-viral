import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { assertSafeAndResolve } from "@/lib/server/ssrf-guard";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 45;

/**
 * Recebe URLs de imagens de referência, chama Gemini 2.5 Flash multimodal
 * pra destilar uma descrição estética (paleta, luz, composição, mood,
 * estilo fotográfico) em 2-3 frases, e persiste em
 * `profiles.brand_analysis.__image_aesthetic`.
 *
 * Essa descrição é usada como prefix do prompt do Imagen 4 em /api/images
 * quando o usuário gera imagens, garantindo que as fotos sigam a linguagem
 * visual da marca.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "brand-aesthetic", user.id),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit. Tenta daqui a pouco." },
        {
          status: 429,
          headers: { "Retry-After": String(limiter.retryAfterSec) },
        }
      );
    }

    const { imageUrls } = (await request.json()) as { imageUrls?: unknown };
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return Response.json(
        { error: "Envie pelo menos 1 imageUrl." },
        { status: 400 }
      );
    }
    const urls = imageUrls
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .slice(0, 3);
    if (urls.length === 0) {
      return Response.json(
        { error: "Nenhuma URL válida." },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return Response.json({ error: "IA não configurada." }, { status: 503 });
    }

    // Baixa cada imagem e converte pra inlineData (base64). URL passa por
    // SSRF guard (protocolo + DNS resolve) antes do fetch pra impedir que
    // um cliente malicioso transforme essa rota em um proxy pra IPs
    // privados (AWS metadata, cluster interno etc).
    const imageParts = await Promise.all(
      urls.map(async (url) => {
        let safeUrl: URL;
        try {
          safeUrl = await assertSafeAndResolve(url);
        } catch {
          return null;
        }
        try {
          const res = await fetch(safeUrl.toString(), {
            signal: AbortSignal.timeout(10_000),
            redirect: "manual",
          });
          if (!res.ok) return null;
          const ct = (
            res.headers.get("content-type") || "image/jpeg"
          ).split(";")[0];
          if (!/^image\//i.test(ct)) return null;
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 10 * 1024 * 1024) return null;
          const base64 = Buffer.from(buf).toString("base64");
          return { inlineData: { data: base64, mimeType: ct } };
        } catch {
          return null;
        }
      })
    );

    const valid = imageParts.filter(
      (p): p is { inlineData: { data: string; mimeType: string } } => p !== null
    );
    if (valid.length === 0) {
      return Response.json(
        { error: "Não consegui baixar nenhuma imagem de referência." },
        { status: 400 }
      );
    }

    const prompt = `Você é um diretor de arte. Analise as ${valid.length} imagens de referência enviadas e destile a ESTÉTICA VISUAL COMUM em um parágrafo único de 2-4 frases. Foque em:

- Paleta de cores (tons dominantes, contraste, saturação)
- Iluminação (natural, dura, suave, direcional, hora do dia)
- Composição e enquadramento (macro, wide, frontal, lateral, overhead)
- Textura e grão (filme, digital limpo, granulado)
- Mood / atmosfera (melancólico, enérgico, contemplativo, desordenado)
- Estilo fotográfico (editorial, documentary, candid, still life, lifestyle)

Retorne APENAS JSON no formato:
{"aesthetic":"descrição única em 2-4 frases, em inglês, pronta pra ser prefixo de um prompt de geração de imagem com Imagen","palette":["#hex1","#hex2","#hex3"],"keywords":["keyword1","keyword2","keyword3","keyword4","keyword5"]}

A "aesthetic" vai ser colocada como prefix de prompts tipo: "<aesthetic>. Primary subject: person typing on laptop. Technical: sharp focus, natural color." Então precisa estar em inglês, descritiva, sem adjetivos vazios. Exemplo bom: "Muted warm palette with dusty amber and soft olive green. Natural window light from the left casting soft shadows. Close-up and medium shots, shallow depth of field, 35mm film grain. Contemplative, grounded mood. Editorial documentary style."`;

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, ...valid],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1000 },
      },
    });

    const text = result.text || "";
    let parsed: { aesthetic?: string; palette?: string[]; keywords?: string[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m)
        return Response.json(
          { error: "Modelo devolveu resposta inválida." },
          { status: 502 }
        );
      parsed = JSON.parse(m[0]);
    }

    const aesthetic = (parsed.aesthetic || "").trim();
    if (!aesthetic) {
      return Response.json(
        { error: "Modelo não produziu descrição." },
        { status: 502 }
      );
    }

    // Persiste em brand_analysis.__image_aesthetic.
    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      const { data: prof } = await sb
        .from("profiles")
        .select("brand_analysis")
        .eq("id", user.id)
        .single();
      const prev =
        prof?.brand_analysis && typeof prof.brand_analysis === "object"
          ? { ...(prof.brand_analysis as Record<string, unknown>) }
          : {};
      prev.__image_aesthetic = {
        description: aesthetic,
        palette: Array.isArray(parsed.palette)
          ? parsed.palette.slice(0, 6)
          : [],
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.slice(0, 10)
          : [],
        updatedAt: new Date().toISOString(),
      };
      await sb
        .from("profiles")
        .update({ brand_analysis: prev })
        .eq("id", user.id);
    }

    return Response.json({
      aesthetic,
      palette: parsed.palette ?? [],
      keywords: parsed.keywords ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brand-aesthetic] error:", msg);
    return Response.json({ error: msg.slice(0, 140) }, { status: 500 });
  }
}
