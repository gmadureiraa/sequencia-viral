/**
 * Gera 3 imagens de referencia pro step "Estilo de imagem" do onboarding:
 * - photo.jpg: fotografia editorial
 * - illus.jpg: ilustracao chapada/editorial
 * - iso3d.jpg: 3D isometrico
 *
 * Rodar: bun scripts/generate-onboarding-styles.ts
 * Requer .env.vercel.prod com GEMINI_API_KEY (vercel env pull).
 *
 * As imagens sao salvas em public/onboarding-styles/ e referenciadas
 * diretamente no <img> do StepVisual.
 */

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

function loadEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${filePath} not found. Run: vercel env pull ${filePath}`);
  }
  const out: Record<string, string> = {};
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

const envPath = path.resolve(process.cwd(), ".env.vercel.prod");
const env = loadEnv(envPath);
const geminiKey = env.GEMINI_API_KEY;
if (!geminiKey) throw new Error("GEMINI_API_KEY missing in .env.vercel.prod");

const ai = new GoogleGenAI({ apiKey: geminiKey });

const styles = [
  {
    id: "photo",
    prompt: `Editorial photography, cinematic medium shot of a modern creator working on laptop at a sunlit cafe window, golden hour warm light streaming through window, shallow depth of field with creamy bokeh, visible grain and subtle film texture, Kodak Portra tones, muted olive green and warm beige palette, composition centered on subject with softly blurred background, magazine-quality atmospheric mood. NO TEXT, NO LOGOS, NO SIGNS, NO VISIBLE WRITING ANYWHERE in the frame. Square aspect ratio 1:1.`,
  },
  {
    id: "illus",
    prompt: `Flat editorial illustration style, clean geometric forms, abstract figure of a creator holding a device, warm coral and teal color palette with mustard yellow accents, minimal line work with deliberate negative space, New Yorker magazine style, bold shapes, solid color fills, subtle paper texture grain overlay, composition with strong rule of thirds. NO TEXT, NO LETTERS, NO NUMBERS, NO LOGOS anywhere. Square aspect ratio 1:1.`,
  },
  {
    id: "iso3d",
    prompt: `Isometric 3D render of a cozy creator workspace with desk, floating shapes, soft gradient lighting, pastel purple and teal and soft peach palette, smooth matte surfaces with subtle ambient occlusion, geometric objects floating mid-air, clean studio background, Figma illustration style, toy-like playful proportions, detailed but minimal. NO TEXT, NO LETTERS, NO LOGOS, NO UI, NO SCREENS with content visible. Square aspect ratio 1:1.`,
  },
] as const;

async function generate(style: (typeof styles)[number]) {
  console.log(`→ generating ${style.id}...`);
  const result = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt: style.prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "1:1",
      outputMimeType: "image/jpeg",
    },
  });
  const img = result.generatedImages?.[0];
  if (!img?.image?.imageBytes) {
    console.error(`  ✗ no image returned for ${style.id}`);
    return;
  }
  const bytes = Buffer.from(img.image.imageBytes, "base64");
  const outDir = path.resolve(process.cwd(), "public/onboarding-styles");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${style.id}.jpg`);
  fs.writeFileSync(outPath, bytes);
  console.log(`  ✓ saved ${outPath} (${bytes.length} bytes)`);
}

async function main() {
  for (const s of styles) {
    try {
      await generate(s);
    } catch (err) {
      console.error(
        `  ✗ error generating ${s.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
