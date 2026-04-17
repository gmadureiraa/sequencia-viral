#!/usr/bin/env node
// Gera assets de brand do PostFlow via Gemini 3 Pro Image.
// Estética: UI-style clean (não foto) — fundo branco, glow laranja radial,
// ícones 3D glossy quadrados arredondados, pills flutuantes, sem texto.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public/brand");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const envFile = resolve(ROOT, ".env.local");
const envText = readFileSync(envFile, "utf8");
const KEY = envText.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!KEY) throw new Error("GEMINI_API_KEY not in .env.local");

const MODEL = "gemini-3-pro-image-preview";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;

const STYLE = `UI illustration style for a premium AI SaaS called PostFlow. Clean white background (#FAFAF8)
with soft radial orange glow (#FF8534 at 10% opacity) behind the main subject.
Aesthetic: Apple-like, cute, 3D glossy icons, lots of soft curves, rounded square
icons (like iOS app icons) with subtle inner highlight and drop shadow,
floating pill-shaped UI chips with glassmorphism, concentric faint radar circles.
Style reference: iOS, visionOS, Raycast, Linear product illustrations.
NO photography, NO clay, NO realistic textures, NO photo of objects.
Vector-clean. Centered composition with breathing room. Absolutely NO text, NO watermark, NO logos.`;

const prompts = {
  "hero-bloom": `${STYLE}
A single large 3D glossy rounded-square icon floating in the center (like an iOS app icon),
burnt orange gradient #FF8534 to #EC6000, with a small stack of 3 tilted carousel-card
previews peeking from behind. Soft orange glow beneath. Thin concentric rings
very faint in background. Aspect 16:10.`,

  "bento-stack": `${STYLE}
A 3D isometric stack of 5 rounded-square card chips floating slightly apart,
each a different soft cream shade, top card tinted orange. Subtle orange glow below.
Clean Raycast-style illustration, no photo. Aspect 4:3.`,

  "bento-rss": `${STYLE}
Central 3D glossy orange rounded-square icon with a small RSS wifi-like symbol inside,
surrounded by 3 floating tiny pill-shaped chips representing news feeds orbiting around it.
Faint concentric rings in background. Aspect 1:1.`,

  "bento-publish": `${STYLE}
Three 3D glossy rounded-square icons side by side representing Instagram, X, and LinkedIn
— each in a soft gradient (orange, black, blue) — connected by thin curved dotted lines
rising upward. Small arrow pill floating above. Aspect 1:1.`,

  "bento-brandkit": `${STYLE}
A floating 3D glossy orange paint palette icon in rounded-square shape, with 4 small
color chip pills floating around it (cream, terracotta, charcoal, peach). Soft shadows.
Aspect 1:1.`,

  "bento-repurpose": `${STYLE}
One large 3D glossy orange rounded-square icon in center with a seed symbol, and 4 smaller
chips flying outward representing a thread, a post, a carousel, and a reel — each a tiny
rounded square. Soft curved dotted lines connecting. Aspect 1:1.`,

  "app-hero": `${STYLE}
A workspace concept — a large floating 3D glossy orange rounded-square icon in center with
a sparkle symbol, with 3 small floating pill chips around it labeled conceptually (no real text,
just abstract pill shapes). Soft morning orange glow. Aspect 16:9.`,

  "empty-carousels": `${STYLE}
A single empty cream-colored rounded-square card chip floating in center with a tiny dashed
outline around it, and a small floating plus-icon pill above. Very minimal, lots of negative
space. Aspect 4:3.`,

  "icon-sparkle": `${STYLE}
One single 3D glossy orange rounded-square icon with a sparkle star symbol inside,
centered, soft shadow. iOS app icon style. Aspect 1:1.`,

  "icon-lightning": `${STYLE}
One single 3D glossy orange rounded-square icon with a lightning bolt symbol inside,
centered, soft shadow. iOS app icon style. Aspect 1:1.`,

  "hero-carousel-meta": `${STYLE}
A stack of 3 tilted Instagram-carousel-shaped cards (4:5 aspect rectangles) floating in
3D space, each card shows an abstract minimal layout hint with a colored tag chip on top
and simple shape blocks (no readable text). Top card has an orange tag, middle one a dark tag,
bottom one a cream tag. Soft shadow beneath, orange glow. Aspect 4:5.`,
};

async function generate(slug, prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${slug}: ${res.status} ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = img?.inlineData?.data || img?.inline_data?.data;
  if (!b64) throw new Error(`${slug}: no image in response: ${JSON.stringify(json).slice(0, 300)}`);
  const buf = Buffer.from(b64, "base64");
  const out = resolve(OUT, `${slug}.png`);
  writeFileSync(out, buf);
  console.log(`  ✓ ${slug}.png (${(buf.length / 1024).toFixed(0)} KB)`);
}

const requested = process.argv.slice(2);
const list = requested.length ? requested : Object.keys(prompts);

console.log(`Generating ${list.length} images with ${MODEL}…`);
for (const slug of list) {
  const prompt = prompts[slug];
  if (!prompt) {
    console.warn(`  ! unknown slug: ${slug}`);
    continue;
  }
  try {
    await generate(slug, prompt);
  } catch (e) {
    console.error(`  ✗ ${slug}: ${e.message}`);
  }
}
console.log("Done.");
