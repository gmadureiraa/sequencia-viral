/**
 * Gera PNGs com FUNDO TRANSPARENTE para a hero animation.
 * v2: sem background, elementos isolados para overlay direto na página.
 *
 * Uso: `bun scripts/generate-hero-assets-v2.ts`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/hero");

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";

const TRANSPARENT_BASE =
  "isolated object on pure white background, no shadow on ground, floating in empty space, product photography style, clean cutout ready";

const JOBS: {
  filename: string;
  prompt: string;
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
}[] = [
  /* ─── INPUT ICONS: 3D clay style, isolated, no ground shadow ─── */
  {
    filename: "input-link.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. Single 3D glossy chain link icon, blue #2563EB color, clay/plastic material, rounded soft edges, slight top-down perspective, no tile, no base, no platform, just the floating icon alone.`,
  },
  {
    filename: "input-pdf.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. Single 3D glossy document icon with folded corner, orange #EC6000 color, clay/plastic material, rounded soft edges, slight top-down perspective, no tile, no base, just the floating document alone.`,
  },
  {
    filename: "input-video.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. Single 3D glossy play button icon, red #DC2626 color, rounded rectangle shape, clay/plastic material, soft edges, slight top-down perspective, no tile, no base, just the floating play button alone.`,
  },
  {
    filename: "input-idea.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. Single 3D glossy lightbulb icon, golden yellow #D97706 color, clay/plastic material, rounded soft shape, slight top-down perspective, no tile, no base, just the floating lightbulb alone.`,
  },
  {
    filename: "input-text.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. Single 3D glossy speech bubble icon, purple #7C3AED color, clay/plastic material, rounded soft edges, slight top-down perspective, no tile, no base, just the floating chat bubble alone.`,
  },
  {
    filename: "input-image.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. Single 3D glossy photo frame icon with small mountain landscape inside, green #059669 color, clay/plastic material, rounded soft edges, slight top-down perspective, no tile, no base, just the floating photo icon alone.`,
  },
  {
    filename: "input-audio.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. Single 3D glossy microphone icon, pink #DB2777 color, clay/plastic material, rounded soft shape, slight top-down perspective, no tile, no base, just the floating microphone alone.`,
  },
  {
    filename: "input-article.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. Single 3D glossy open book icon, cyan #0891B2 color, clay/plastic material, rounded soft edges, slight top-down perspective, no tile, no base, just the floating book alone.`,
  },

  /* ─── HUB CENTRAL ─── */
  {
    filename: "hub-central.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. 3D isometric circular glowing platform seen from slight above angle, orange #EC6000 bullseye target in center with concentric rings, metallic silver cylindrical base, blue-white rim glow, floating in empty space with no ground plane, no ground shadow.`,
  },

  /* ─── OUTPUT CARDS: floating mockups, no ground ─── */
  {
    filename: "output-carousel.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. 3D floating Instagram carousel mockup, multiple stacked white cards with rounded corners, front card shows abstract orange gradient placeholder content, small dots at bottom, tilted at slight angle, no ground, no shadow on floor.`,
  },
  {
    filename: "output-post.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. 3D floating social media post card mockup, single white rounded card with circle avatar placeholder at top and horizontal lines for text and a colorful image area, tilted at slight angle, no ground, no floor shadow.`,
  },
  {
    filename: "output-thread.png",
    aspectRatio: "1:1",
    prompt: `${TRANSPARENT_BASE}. 3D floating Twitter thread mockup, three connected white cards linked by blue vertical line, each card has small circle avatar and text lines, tilted at slight angle, no ground, no floor shadow.`,
  },
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Defina GEMINI_API_KEY e rode de novo.");
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey });

  console.log(`Gerando ${JOBS.length} assets v2 (fundo branco puro p/ remoção) em ${OUT}...\n`);

  let success = 0;
  let failed = 0;

  for (const job of JOBS) {
    process.stdout.write(`  ${job.filename} ... `);
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
        console.log("FALHOU", reason ? `(RAI: ${reason})` : "(sem bytes)");
        failed++;
        continue;
      }

      const buf = Buffer.from(bytes, "base64");
      writeFileSync(join(OUT, job.filename), buf);
      console.log(`OK (${(buf.length / 1024).toFixed(0)}KB)`);
      success++;
    } catch (e) {
      console.log("ERRO:", e instanceof Error ? e.message : e);
      failed++;
    }
  }

  console.log(`\nDone: ${success} OK, ${failed} falharam.`);
  console.log(`\nPróximo passo: rodar remoção de fundo com sips ou sharp.`);
}

void main();
