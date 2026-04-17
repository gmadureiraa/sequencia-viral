/**
 * Gera PNGs 3D isométricos para a hero animation do PostFlow.
 * Estilo: clay/isometric, cantos arredondados, sombra suave, fundo transparente.
 *
 * Uso: `bun scripts/generate-hero-assets.ts`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/hero");

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";

/* ─── Estilo base compartilhado ─── */
const BASE_STYLE =
  "3D isometric app icon, soft clay material, rounded corners (border-radius 28px), subtle long shadow, clean white/light background, minimal, no text, no letters, no words, premium SaaS aesthetic, viewed from slight top angle 30 degrees";

const JOBS: {
  filename: string;
  prompt: string;
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
}[] = [
  /* ─── 8 INPUT ICONS ─── */
  {
    filename: "input-link.png",
    aspectRatio: "1:1",
    prompt: `${BASE_STYLE}. A chain link icon representing a URL/web link. Primary color: bright blue #2563EB with lighter blue gradient. The icon sits on a rounded white square tile floating with depth shadow below.`,
  },
  {
    filename: "input-pdf.png",
    aspectRatio: "1:1",
    prompt: `${BASE_STYLE}. A document/PDF file icon with folded corner. Primary color: vibrant orange #EC6000. The document has subtle lines suggesting text content. Sits on a rounded white tile with depth shadow.`,
  },
  {
    filename: "input-video.png",
    aspectRatio: "1:1",
    prompt: `${BASE_STYLE}. A play button / video icon inside a rounded rectangle. Primary color: red #DC2626 with subtle gradient. Clean modern video symbol. Sits on a white tile with depth shadow.`,
  },
  {
    filename: "input-idea.png",
    aspectRatio: "1:1",
    prompt: `${BASE_STYLE}. A lightbulb icon representing ideas and creativity. Primary color: warm yellow #D97706 with golden glow. Simple elegant lightbulb shape. Sits on a rounded white tile with depth shadow.`,
  },
  {
    filename: "input-text.png",
    aspectRatio: "1:1",
    prompt: `${BASE_STYLE}. A chat bubble / text message icon. Primary color: purple #7C3AED with violet gradient. Simple rounded speech bubble shape. Sits on a rounded white tile with depth shadow.`,
  },
  {
    filename: "input-image.png",
    aspectRatio: "1:1",
    prompt: `${BASE_STYLE}. A photo/image icon with a small mountain and sun inside a frame. Primary color: emerald green #059669. Simple landscape thumbnail. Sits on a rounded white tile with depth shadow.`,
  },
  {
    filename: "input-audio.png",
    aspectRatio: "1:1",
    prompt: `${BASE_STYLE}. A microphone icon for audio/podcast content. Primary color: pink #DB2777 with rose gradient. Clean modern mic silhouette. Sits on a rounded white tile with depth shadow.`,
  },
  {
    filename: "input-article.png",
    aspectRatio: "1:1",
    prompt: `${BASE_STYLE}. An open book icon representing articles and blog posts. Primary color: cyan #0891B2 with teal accents. Simple book shape with pages visible. Sits on a rounded white tile with depth shadow.`,
  },

  /* ─── HUB CENTRAL ─── */
  {
    filename: "hub-central.png",
    aspectRatio: "1:1",
    prompt: `3D isometric circular platform hub, viewed from above at 30 degree angle. A glowing orange #EC6000 target/bullseye in the center with concentric rings getting lighter toward edges. The platform sits on a metallic silver cylinder base with reflective surface. Subtle blue-white glow emanating from center. Clean white background. Premium tech aesthetic like a data processing node. No text, no letters.`,
  },

  /* ─── 3 OUTPUT CARDS ─── */
  {
    filename: "output-carousel.png",
    aspectRatio: "4:3",
    prompt: `3D isometric floating card showing an Instagram carousel post mockup. Multiple stacked slides with rounded corners, the front slide shows an abstract orange #EC6000 gradient design with placeholder content blocks. Small slide indicator dots at bottom. White card with subtle shadow. Premium social media tool aesthetic. No readable text, just visual blocks suggesting content layout.`,
  },
  {
    filename: "output-post.png",
    aspectRatio: "4:3",
    prompt: `3D isometric floating card showing a social media post mockup. Single card with rounded corners showing a small circle avatar at top, horizontal lines suggesting text, and a colorful abstract image placeholder in orange and pink tones. Heart and comment icons at bottom. White card with shadow. Premium SaaS aesthetic. No readable text.`,
  },
  {
    filename: "output-thread.png",
    aspectRatio: "4:3",
    prompt: `3D isometric floating card showing a Twitter/X thread mockup. Connected cards with a vertical line linking them, each mini card has a small circle avatar and horizontal lines suggesting tweet text. Blue accent #1DA1F2 connecting line. White cards with shadow. Clean modern aesthetic. No readable text.`,
  },
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "Defina GEMINI_API_KEY (ex.: no .env.local) e rode de novo."
    );
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey });

  console.log(`Gerando ${JOBS.length} assets para hero em ${OUT}...\n`);

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
        console.log(
          "FALHOU",
          reason ? `(RAI: ${reason})` : "(sem bytes na resposta)"
        );
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

  console.log(
    `\nDone: ${success} gerados, ${failed} falharam. Assets em ${OUT}`
  );
}

void main();
