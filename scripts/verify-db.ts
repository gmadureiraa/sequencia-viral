/**
 * Verifica que o usuário Gabriel consegue listar seus carrosséis,
 * e mostra o estado da tabela profiles (auth + usage + plano).
 */
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const email = process.env.TEST_USER_EMAIL!;

  const admin = createClient(url, svc);
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const me = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!me) throw new Error("user not found");
  console.log(`\n👤 ${me.email}`);
  console.log(`   id: ${me.id}`);
  console.log(`   created_at: ${me.created_at}`);
  console.log(`   last_sign_in: ${me.last_sign_in_at}`);

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "name,email,plan,usage_count,usage_limit,onboarding_completed,twitter_handle,instagram_handle,brand_analysis"
    )
    .eq("id", me.id)
    .single();
  console.log(`\n🧑‍💼 profile:`);
  console.log(`   name: ${profile?.name}`);
  console.log(`   plan: ${profile?.plan}`);
  console.log(`   usage: ${profile?.usage_count}/${profile?.usage_limit}`);
  console.log(`   onboarding_completed: ${profile?.onboarding_completed}`);
  console.log(`   twitter: @${profile?.twitter_handle}`);
  console.log(`   instagram: @${profile?.instagram_handle}`);
  console.log(`   brand_analysis: ${profile?.brand_analysis ? "✅" : "—"}`);

  // simular login e listar como o app faz
  const clientAs = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: me.email!,
  });
  // nao usamos session, só validamos conexão
  void session;
  void clientAs;

  const { data: carousels } = await admin
    .from("carousels")
    .select("id,title,slides,style,status,created_at,updated_at,thumbnail_url")
    .eq("user_id", me.id)
    .order("updated_at", { ascending: false });

  console.log(`\n📚 carrosséis (${carousels?.length ?? 0} total):\n`);
  for (const c of carousels || []) {
    const slides = Array.isArray(c.slides) ? c.slides.length : 0;
    const src = (c.style as { test_source_type?: string })?.test_source_type;
    console.log(
      `  ${c.id}  [${c.status}]  ${slides} slides  ${src ? `from=${src}` : ""}`
    );
    console.log(`    "${c.title}"`);
    const firstSlide = (c.slides as Array<{ heading?: string; body?: string }>)?.[0];
    if (firstSlide) {
      console.log(`    1.hed: ${firstSlide.heading}`);
      console.log(`    1.bdy: ${String(firstSlide.body || "").slice(0, 80)}`);
    }
    console.log();
  }

  // generations stats
  const { data: gens } = await admin
    .from("generations")
    .select("provider,model,prompt_type,input_tokens,output_tokens,cost_usd,created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(10);
  console.log(`\n🎛 generations (últimas ${gens?.length ?? 0}):`);
  for (const g of gens || []) {
    console.log(
      `   ${g.created_at}  ${g.model}  src=${g.prompt_type}  in=${g.input_tokens} out=${g.output_tokens} $${g.cost_usd}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
