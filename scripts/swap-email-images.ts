/**
 * Substitui URLs Unsplash nos templates Resend pelos heroes reais (HTTP 200).
 * Sequencial (rate-limit) + cache buster bumped.
 */

import "dotenv/config";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY ausente em .env.local");

const HEROES = {
  sv: "https://viral.kaleidos.com.br/email-assets/sv-hero.png",
  reels: "https://viral.kaleidos.com.br/email-assets/reels-hero.png",
  radar: "https://viral.kaleidos.com.br/email-assets/radar-hero.png",
  kaleidos: "https://viral.kaleidos.com.br/email-assets/kaleidos-hero.png",
  madureira: "https://viral.kaleidos.com.br/email-assets/madureira-hero.png",
};

const CACHE_BUSTER = "<!-- rev 2026-05-05-images-v1 -->";

// Mapeamento alias → hero
function heroFor(alias: string): string | null {
  // Cross-promo overrides
  const crossPromo: Record<string, keyof typeof HEROES> = {
    "madureira-d2-reels-viral-v2": "reels",
    "madureira-d4-sv-v1": "sv",
    "madureira-d6-radar-v1": "radar",
    "sv-cross-1-reels-v1": "reels",
    "sv-cross-2-radar-v1": "radar",
    "kaleidos-k5-products-v1": "kaleidos",
    "kaleidos-op-5-products-v1": "kaleidos",
  };
  if (crossPromo[alias]) return HEROES[crossPromo[alias]];

  if (alias.startsWith("sv-")) return HEROES.sv;
  if (alias.startsWith("reels-")) return HEROES.reels;
  if (alias.startsWith("radar-")) return HEROES.radar;
  if (alias.startsWith("kaleidos-k") || alias.startsWith("kaleidos-op-")) return HEROES.kaleidos;
  if (alias.startsWith("madureira-")) return HEROES.madureira;
  return null;
}

type Template = {
  id: string;
  alias: string | null;
  name: string;
  status: string;
};

type FullTemplate = Template & {
  html: string;
  text: string;
  subject: string;
  variables?: any[];
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  return res.json();
}

async function listTemplates(): Promise<Template[]> {
  const all: Template[] = [];
  let after: string | undefined;
  do {
    const path = after ? `/templates?limit=100&after=${after}` : `/templates?limit=100`;
    const json = await api(path);
    all.push(...json.data);
    after = json.has_more ? json.data[json.data.length - 1].id : undefined;
  } while (after);
  return all;
}

async function getTemplate(id: string): Promise<FullTemplate> {
  return api(`/templates/${id}`);
}

async function updateTemplate(id: string, patch: { html?: string; text?: string }) {
  return api(`/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

async function publishTemplate(id: string) {
  return api(`/templates/${id}/publish`, { method: "POST" });
}

const UNSPLASH_RE = /https:\/\/images\.unsplash\.com\/photo-[^\s"'<>]+/g;

function bumpCacheBuster(html: string): string {
  // Substitui qualquer comentário "<!-- rev 2026-05-05-* -->"
  const revRe = /<!--\s*rev\s+2026-05-05[^>]*?-->/gi;
  if (revRe.test(html)) {
    return html.replace(revRe, CACHE_BUSTER);
  }
  // Caso não tenha rev, adiciona após </head>
  if (html.includes("</head>")) {
    return html.replace("</head>", `</head>\n${CACHE_BUSTER}`);
  }
  return CACHE_BUSTER + "\n" + html;
}

function swapText(text: string): string {
  // Substitui qualquer URL Unsplash no texto plano também
  return text.replace(UNSPLASH_RE, "");
}

async function main() {
  console.log("Listando templates...");
  const templates = await listTemplates();
  console.log(`Total: ${templates.length}\n`);

  let updated = 0;
  let skippedNoImage = 0;
  let skippedNoMapping = 0;
  const errors: string[] = [];
  let firstSample: { alias: string; before: string; after: string } | null = null;

  for (const t of templates) {
    const alias = t.alias || t.name;
    try {
      const full = await getTemplate(t.id);
      const matches = full.html.match(UNSPLASH_RE);

      if (!matches || matches.length === 0) {
        console.log(`SKIP ${alias} — no image`);
        skippedNoImage++;
        continue;
      }

      const hero = heroFor(alias);
      if (!hero) {
        console.log(`SKIP ${alias} — no mapping (${matches.length} unsplash URLs found)`);
        skippedNoMapping++;
        continue;
      }

      const before = matches[0];
      let newHtml = full.html.replace(UNSPLASH_RE, hero);
      newHtml = bumpCacheBuster(newHtml);

      // Ajustar alt text vazio se relevante
      newHtml = newHtml.replace(
        /alt=""\s+style="display:block/g,
        `alt="Hero" style="display:block`,
      );

      const newText = swapText(full.text || "");

      if (!firstSample) {
        firstSample = { alias, before, after: hero };
      }

      await updateTemplate(t.id, { html: newHtml, text: newText });
      // Pequena pausa entre PATCH e PUBLISH
      await new Promise((r) => setTimeout(r, 250));
      await publishTemplate(t.id);

      console.log(`OK   ${alias} → ${hero.split("/").pop()}`);
      updated++;
      // Rate limit: ~2 req/sec safety
      await new Promise((r) => setTimeout(r, 500));
    } catch (e: any) {
      const msg = `ERR  ${alias}: ${e.message}`;
      console.error(msg);
      errors.push(msg);
      // Pausa maior em caso de erro
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("\n=== RESUMO ===");
  console.log(`Total: ${templates.length}`);
  console.log(`Atualizados: ${updated}`);
  console.log(`Skip (sem imagem): ${skippedNoImage}`);
  console.log(`Skip (sem mapping): ${skippedNoMapping}`);
  console.log(`Erros: ${errors.length}`);
  if (firstSample) {
    console.log(`\nSample antes/depois (${firstSample.alias}):`);
    console.log(`  ANTES: ${firstSample.before}`);
    console.log(`  DEPOIS: ${firstSample.after}`);
  }
  if (errors.length) {
    console.log("\nErros:");
    errors.forEach((e) => console.log("  " + e));
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
