/**
 * One-off: aplica a migration 20260423011704_carousel_feedback.sql via
 * service role REST API (executa cada statement usando a função `sql`
 * do PostgREST auth se disponível, ou fallback via `rpc`).
 *
 * Como Supabase PostgREST não permite DDL arbitrário sem RPC helper,
 * esse script imprime o SQL pro user colar no Dashboard se não der.
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
  const sql = await Bun.file(
    "supabase/migrations/20260423011704_carousel_feedback.sql"
  ).text();

  console.log("\n=== SQL a aplicar ===\n");
  console.log(sql);
  console.log("\n=== FIM ===\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltam env vars. Rode via Dashboard manualmente.");
    process.exit(1);
  }

  // Usa a REST API /rest/v1/rpc/exec_sql se existir. Senao exit com hint.
  try {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) {
      console.log("Migration aplicada via RPC exec_sql.");
      return;
    }
    const body = await res.text();
    console.error(`exec_sql falhou (${res.status}): ${body}`);
    console.error(
      "\nCole o SQL acima direto no Supabase Dashboard → SQL Editor → Run."
    );
    process.exit(2);
  } catch (err) {
    console.error("Erro:", err);
    process.exit(3);
  }
}

main();
