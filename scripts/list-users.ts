import { createClient } from "@supabase/supabase-js";

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
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Total: ${data.users.length}`);
  for (const u of data.users.slice(0, 20)) {
    console.log(`  ${u.id}  ${u.email}  created ${u.created_at}`);
  }
}
main();
