/**
 * Cria bucket `carousel-images` em producao via service role API.
 * Rodar: bun scripts/create-buckets.ts
 *
 * Usa NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY do .env.vercel.prod
 * (vercel env pull).
 */

import { createClient } from "@supabase/supabase-js";
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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceRole);

const buckets = [
  {
    id: "carousel-images",
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  },
];

async function main() {
  for (const b of buckets) {
    console.log(`→ checking bucket ${b.id}...`);
    const { data: existing } = await supabase.storage.getBucket(b.id);
    if (existing) {
      console.log(`  already exists — updating to match config`);
      const { error } = await supabase.storage.updateBucket(b.id, {
        public: b.public,
        fileSizeLimit: b.fileSizeLimit,
        allowedMimeTypes: b.allowedMimeTypes,
      });
      if (error) {
        console.error(`  update failed:`, error.message);
        process.exitCode = 1;
      } else {
        console.log(`  ✓ updated`);
      }
      continue;
    }
    const { error } = await supabase.storage.createBucket(b.id, {
      public: b.public,
      fileSizeLimit: b.fileSizeLimit,
      allowedMimeTypes: b.allowedMimeTypes,
    });
    if (error) {
      console.error(`  create failed:`, error.message);
      process.exitCode = 1;
    } else {
      console.log(`  ✓ created`);
    }
  }
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
