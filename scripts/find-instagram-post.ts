/**
 * Helper: Consulta a Apify (instagram-scraper) e retorna URLs de posts recentes
 * do @madureira que tenham caption. Usado pra descobrir uma URL válida p/ o E2E.
 */
async function loadEnv() {
  try {
    const text = await Bun.file(".env.local").text();
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      let value = m[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {}
}

async function main() {
  await loadEnv();
  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    console.error("APIFY_API_KEY ausente");
    process.exit(1);
  }
  const username = process.argv[2] || "madureira";
  const runInput = {
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: "posts",
    resultsLimit: 8,
    addParentData: false,
  };
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=90`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runInput),
      signal: AbortSignal.timeout(110_000),
    }
  );
  if (!res.ok) {
    console.error(`Apify HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error("resposta não-array");
    process.exit(1);
  }
  console.log(`Total de items: ${data.length}`);
  for (const post of data) {
    const p = post as {
      url?: string;
      shortCode?: string;
      type?: string;
      caption?: string;
      likesCount?: number;
    };
    const cap = (p.caption || "").slice(0, 80).replace(/\s+/g, " ");
    console.log(
      `  ${p.url || p.shortCode}  [${p.type}]  likes=${p.likesCount ?? "?"}  cap="${cap}..."`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
