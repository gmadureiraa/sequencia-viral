import { GoogleGenAI } from "@google/genai";

/**
 * Heurística leve pra detectar se um texto é majoritariamente em
 * português ou não. Não usa ML — só checa palavras-stop comuns.
 */
function looksLikePortuguese(text: string): boolean {
  if (!text || text.length < 50) return true;
  const sample = text.slice(0, 2000).toLowerCase();
  const ptStops = ["que", "para", "com", "uma", "como", "você", "está", "isso", "também", "porque", "muito"];
  const enStops = ["the", "and", "for", "with", "this", "that", "you", "have", "from", "they", "your"];
  let pt = 0, en = 0;
  for (const w of ptStops) if (sample.includes(` ${w} `)) pt++;
  for (const w of enStops) if (sample.includes(` ${w} `)) en++;
  return pt >= en;
}

/**
 * Se source não é pt-BR e o user pediu pt-BR, traduz e condensa via Gemini Flash.
 * Preserva: nomes próprios, números/datas, citações de impacto.
 * Max ~1500 chars de saída.
 */
export async function translateSourceIfNeeded(
  source: string,
  targetLanguage: string
): Promise<string> {
  if (!source) return source;
  const target = (targetLanguage || "pt-br").toLowerCase();
  if (target !== "pt-br" && target !== "pt") return source;
  if (looksLikePortuguese(source)) return source;

  const key = process.env.GEMINI_API_KEY;
  if (!key) return source; // fallback silencioso

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Source em outro idioma:\n\n"""\n${source.slice(0, 8000)}\n"""\n\nTarefa: TRADUZA e CONDENSE pra português brasileiro coloquial. Preserve: nomes próprios, números, datas, citações de impacto memoráveis (mantenha entre aspas). Max 1500 chars. Retorne APENAS o texto traduzido, sem prefácio.`,
      config: {
        temperature: 0.3,
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const translated = (result.text || "").trim();
    return translated || source;
  } catch (err) {
    console.warn("[translate-source] falhou, usando source raw:", err);
    return source;
  }
}
