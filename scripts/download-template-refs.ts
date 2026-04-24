/**
 * Baixa carrosséis de referência via Apify, salva em docs/template-refs/<slug>/.
 * Roda com: bun scripts/download-template-refs.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-scraper";

const REFS = [
  {
    slug: "ambitious",
    url: "https://www.instagram.com/p/C-5R-65uI8c/",
    note: "@anajords — referência visual do template Ambição (motivacional)",
  },
  {
    slug: "blank",
    url: "https://www.instagram.com/blankschoolbr/p/DT28nYbDWoO/",
    note: "@blankschoolbr — referência visual do template Editorial",
  },
];

async function downloadOne(ref: (typeof REFS)[number]) {
  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error("APIFY_API_KEY ausente");

  const dir = join(
    process.cwd(),
    "docs",
    "template-refs",
    ref.slug
  );
  await mkdir(dir, { recursive: true });

  console.log(`\n→ ${ref.slug}: ${ref.url}`);
  const res = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apifyKey}&timeout=60`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [ref.url],
        resultsType: "details",
        resultsLimit: 1,
        addParentData: false,
      }),
      signal: AbortSignal.timeout(70_000),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Apify ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as Array<Record<string, unknown>>;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Apify devolveu vazio");
  }
  const post = data[0] as {
    caption?: string;
    ownerUsername?: string;
    likesCount?: number;
    commentsCount?: number;
    childPosts?: Array<{ displayUrl?: string; type?: string }>;
    images?: Array<{ displayUrl?: string }>;
    displayUrl?: string;
  };

  // Salva metadata
  const meta = {
    note: ref.note,
    sourceUrl: ref.url,
    owner: post.ownerUsername,
    caption: post.caption,
    likes: post.likesCount,
    comments: post.commentsCount,
    fetchedAt: new Date().toISOString(),
  };
  await writeFile(
    join(dir, "meta.json"),
    JSON.stringify(meta, null, 2)
  );

  // Coleta urls dos slides
  const slides: string[] = [];
  if (post.childPosts && post.childPosts.length > 0) {
    for (const c of post.childPosts) if (c.displayUrl) slides.push(c.displayUrl);
  } else if (post.images && post.images.length > 0) {
    for (const im of post.images) if (im.displayUrl) slides.push(im.displayUrl);
  } else if (post.displayUrl) {
    slides.push(post.displayUrl);
  }
  console.log(`  ${slides.length} slide(s)`);

  let saved = 0;
  for (let i = 0; i < slides.length; i++) {
    const url = slides[i];
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) {
        console.warn(`  ! slide ${i + 1} HTTP ${r.status}`);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      const idx = String(i + 1).padStart(2, "0");
      const file = join(dir, `slide-${idx}.jpg`);
      await writeFile(file, buf);
      saved++;
    } catch (err) {
      console.warn(
        `  ! slide ${i + 1} erro:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
  console.log(`  ✓ ${saved}/${slides.length} salvos em ${dir}`);
}

async function main() {
  for (const r of REFS) {
    try {
      await downloadOne(r);
    } catch (err) {
      console.error(
        `✗ ${r.slug} falhou:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

main();
