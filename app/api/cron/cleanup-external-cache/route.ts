import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";

export const maxDuration = 300;

const BUCKET = "carousel-images";
const PREFIX = "external-cache";
const TTL_DAYS = 90;
const LIST_LIMIT = 1000;
const REMOVE_BATCH_SIZE = 100;

/**
 * Cleanup mensal do prefix `external-cache/` no bucket `carousel-images`.
 * Apaga blobs (Serper/Unsplash/Google Images) cacheados há mais de 90 dias.
 *
 * Por que: cache cresce sem limite. ~10 imgs × 250kb por carrossel × 100/mês
 * = 250MB/mês acumulado. Em 1 ano sem TTL: ~3GB. Tier free Supabase: 1GB.
 *
 * Schedule: dia 1 às 03:00 UTC — ver vercel.json.
 *
 * Algoritmo:
 *   1. List folders em `external-cache/` (cada folder = userId)
 *   2. Pra cada folder, list files com paginação
 *   3. Filter created_at < now - 90d
 *   4. Batch remove (até 100 paths por chamada — limite Supabase)
 *
 * Idempotente: rodar 2x no mesmo dia não estraga nada.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("cleanup-external-cache"))
    return cronSkipped("cleanup-external-cache");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  // 1. Lista folders no nível externalcache (cada folder = userId)
  const { data: folders, error: foldersErr } = await sb.storage
    .from(BUCKET)
    .list(PREFIX, { limit: LIST_LIMIT, sortBy: { column: "name", order: "asc" } });

  if (foldersErr) {
    console.error("[cron/cleanup-external-cache] list folders falhou:", foldersErr);
    return Response.json(
      { error: `List folders falhou: ${foldersErr.message}` },
      { status: 500 },
    );
  }

  if (!folders || folders.length === 0) {
    return Response.json({
      ok: true,
      message: "external-cache/ vazio — nada a limpar",
      cutoff: cutoffIso,
    });
  }

  let totalScanned = 0;
  let totalDeleted = 0;
  const errors: { folder: string; error: string }[] = [];

  for (const folder of folders) {
    // Folders aparecem como "rows" sem extensão; arquivos no nível raiz aparecem como `name.ext`
    if (folder.name.includes(".")) continue;

    const folderPath = `${PREFIX}/${folder.name}`;
    let offset = 0;
    const toDelete: string[] = [];

    while (true) {
      const { data: files, error: filesErr } = await sb.storage
        .from(BUCKET)
        .list(folderPath, {
          limit: LIST_LIMIT,
          offset,
          sortBy: { column: "created_at", order: "asc" },
        });

      if (filesErr) {
        errors.push({ folder: folderPath, error: filesErr.message });
        break;
      }

      if (!files || files.length === 0) break;

      for (const file of files) {
        totalScanned++;
        // Supabase storage `created_at` é ISO string
        const createdAt = file.created_at ? new Date(file.created_at) : null;
        if (createdAt && createdAt < cutoff) {
          toDelete.push(`${folderPath}/${file.name}`);
        }
      }

      if (files.length < LIST_LIMIT) break;
      offset += LIST_LIMIT;
    }

    // Batch delete (limite Supabase: ~100 paths por chamada)
    for (let i = 0; i < toDelete.length; i += REMOVE_BATCH_SIZE) {
      const batch = toDelete.slice(i, i + REMOVE_BATCH_SIZE);
      const { error: rmErr } = await sb.storage.from(BUCKET).remove(batch);
      if (rmErr) {
        errors.push({ folder: folderPath, error: rmErr.message });
      } else {
        totalDeleted += batch.length;
      }
    }
  }

  return Response.json({
    ok: true,
    cutoff: cutoffIso,
    ttl_days: TTL_DAYS,
    folders_processed: folders.filter((f) => !f.name.includes(".")).length,
    scanned: totalScanned,
    deleted: totalDeleted,
    errors,
  });
}
