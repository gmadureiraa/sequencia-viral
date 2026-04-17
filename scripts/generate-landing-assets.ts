/**
 * Gera PNGs para a landing com Imagen (Gemini API).
 * Requer GEMINI_API_KEY no ambiente e billing habilitado no Google AI Studio quando aplicável.
 *
 * Uso: `bun run assets:landing`
 *
 * Modelo padrão: imagen-4.0-generate-001 (@google/genai). Se falhar, ajuste `IMAGE_MODEL`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/brand/landing");

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";

const JOBS: {
  filename: string;
  prompt: string;
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
}[] = [
  {
    filename: "hero-gemini.png",
    aspectRatio: "16:9",
    prompt:
      "Editorial flat vector illustration for a SaaS landing hero. Abstract stacked rounded rectangles suggesting social media carousel slides, floating sparkles, warm cream background #FAFAF8, bold orange accents #EC6000, black outlines #0A0A0A, generous whitespace, no text, no logos, no letters, premium creative tool aesthetic, consistent icon-like geometry.",
  },
  {
    filename: "process-gemini.png",
    aspectRatio: "1:1",
    prompt:
      "Minimal flat vector spot illustration, no text, no logos. Three connected steps: lightbulb idea, magic wand transformation, share arrow export. Colors cream #FFFDF9, orange #EC6000, black #0A0A0A, thick friendly outlines, same visual language as Lucide icons, square composition.",
  },
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Defina GEMINI_API_KEY (ex.: no .env.local) e rode de novo.");
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey });

  for (const job of JOBS) {
    process.stdout.write(`Gerando ${job.filename} com ${IMAGE_MODEL}... `);
    try {
      const res = await ai.models.generateImages({
        model: IMAGE_MODEL,
        prompt: job.prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: job.aspectRatio,
          includeRaiReason: true,
        },
      });

      const bytes = res.generatedImages?.[0]?.image?.imageBytes;
      if (!bytes) {
        const reason = res.generatedImages?.[0]?.raiFilteredReason;
        console.log("falhou.", reason ? `RAI: ${reason}` : "Sem bytes na resposta.");
        continue;
      }

      const buf = Buffer.from(bytes, "base64");
      writeFileSync(join(OUT, job.filename), buf);
      console.log("ok.");
    } catch (e) {
      console.log("erro:", e instanceof Error ? e.message : e);
    }
  }

  console.log(`Arquivos em ${OUT}. Troque as referências em app/page.tsx se quiser usar *-gemini.png.`);
}

void main();
