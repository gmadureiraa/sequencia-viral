import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";

export const maxDuration = 60;

const MAX_BYTES_PER_FILE = 15 * 1024 * 1024;
const MAX_PNG_SLIDES = 24;

// P2-6 audit 2026-05-08: regex anterior `[1-5]` no nibble de versão
// rejeitava UUIDv6/v7 que Postgres pode passar a gerar. Aceita qualquer
// versão hex válida agora — o ownership check em `carousels.id = ? AND
// user_id = ?` é a defesa real contra IDOR.
function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * POST /api/carousel/exports
 * multipart/form-data:
 *   carouselId: uuid
 *   png: File (repetir por slide, na ordem)
 *   pdf: File opcional
 *
 * Faz upload para bucket `carousel-exports` e grava `export_assets` + `thumbnail_url` na linha do carrossel.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const limiter = await rateLimit({
      key: getRateLimitKey(request, "carousel-exports", user.id),
      limit: 25,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Limite de envios de export por hora. Tente mais tarde." },
        { status: 429 }
      );
    }

    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return Response.json(
        { error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const carouselId = String(form.get("carouselId") || "").trim();
    if (!carouselId || !isUuid(carouselId)) {
      return Response.json({ error: "carouselId inválido (UUID esperado)." }, { status: 400 });
    }

    const { data: owned, error: ownErr } = await supabase
      .from("carousels")
      .select("id")
      .eq("id", carouselId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownErr || !owned) {
      return Response.json(
        { error: "Carrossel não encontrado ou sem permissão." },
        { status: 404 }
      );
    }

    const pngEntries = form.getAll("png");
    if (pngEntries.length > MAX_PNG_SLIDES) {
      return Response.json(
        { error: `Máximo de ${MAX_PNG_SLIDES} imagens PNG por envio.` },
        { status: 400 }
      );
    }

    const folder = `${user.id}/${carouselId}/${Date.now()}`;
    const pngUrls: string[] = [];

    let slideIndex = 0;
    for (const entry of pngEntries) {
      if (!(entry instanceof Blob)) continue;
      if (entry.size > MAX_BYTES_PER_FILE) {
        return Response.json(
          { error: `Arquivo PNG muito grande (máx. ${MAX_BYTES_PER_FILE / 1024 / 1024}MB).` },
          { status: 413 }
        );
      }
      const mime = entry.type || "image/png";
      if (mime !== "image/png") {
        return Response.json({ error: "Cada campo png deve ser image/png." }, { status: 415 });
      }
      slideIndex += 1;
      const path = `${folder}/slide-${slideIndex}.png`;
      const bytes = new Uint8Array(await entry.arrayBuffer());
      const { error: upErr } = await supabase.storage.from("carousel-exports").upload(path, bytes, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "31536000",
      });
      if (upErr) {
        const msg = upErr.message || "";
        if (msg.toLowerCase().includes("bucket") || msg.toLowerCase().includes("not found")) {
          return Response.json(
            {
              error:
                "Bucket 'carousel-exports' não existe. Rode a migration em supabase/migrations/20260415120000_carousel_export_assets.sql",
            },
            { status: 503 }
          );
        }
        return Response.json({ error: `Upload falhou: ${msg}` }, { status: 502 });
      }
      const { data: pub } = supabase.storage.from("carousel-exports").getPublicUrl(path);
      pngUrls.push(pub.publicUrl);
    }

    if (pngUrls.length === 0) {
      return Response.json({ error: "Envie pelo menos um PNG (campo png)." }, { status: 400 });
    }

    let pdfUrl: string | undefined;
    const pdfEntry = form.get("pdf");
    if (pdfEntry instanceof Blob && pdfEntry.size > 0) {
      if (pdfEntry.size > MAX_BYTES_PER_FILE) {
        return Response.json(
          { error: `PDF muito grande (máx. ${MAX_BYTES_PER_FILE / 1024 / 1024}MB).` },
          { status: 413 }
        );
      }
      const pdfMime = pdfEntry.type || "application/pdf";
      if (pdfMime !== "application/pdf") {
        return Response.json({ error: "O campo pdf deve ser application/pdf." }, { status: 415 });
      }
      const pdfPath = `${folder}/carrossel.pdf`;
      const pdfBytes = new Uint8Array(await pdfEntry.arrayBuffer());
      const { error: pdfErr } = await supabase.storage.from("carousel-exports").upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
        cacheControl: "31536000",
      });
      if (pdfErr) {
        return Response.json({ error: `Upload PDF falhou: ${pdfErr.message}` }, { status: 502 });
      }
      const { data: pdfPub } = supabase.storage.from("carousel-exports").getPublicUrl(pdfPath);
      pdfUrl = pdfPub.publicUrl;
    }

    const exportPayload = {
      pngUrls,
      pdfUrl: pdfUrl ?? null,
      exportedAt: new Date().toISOString(),
      slideCount: pngUrls.length,
    };

    const { error: dbErr } = await supabase
      .from("carousels")
      .update({
        export_assets: exportPayload,
        thumbnail_url: pngUrls[0] ?? null,
      })
      .eq("id", carouselId)
      .eq("user_id", user.id);

    if (dbErr) {
      console.error("[carousel/exports] db update:", dbErr);
      return Response.json(
        { error: "Arquivos enviados, mas falhou ao atualizar o carrossel. Verifique a coluna export_assets." },
        { status: 500 }
      );
    }

    getPostHogClient().capture({
      distinctId: user.id,
      event: "carousel_exported",
      properties: {
        carousel_id: carouselId,
        slide_count: pngUrls.length,
        has_pdf: !!pdfUrl,
      },
    });

    return Response.json({
      ok: true,
      export_assets: exportPayload,
    });
  } catch (err) {
    console.error("[carousel/exports]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erro ao processar export" },
      { status: 500 }
    );
  }
}
