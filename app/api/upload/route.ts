import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { saveToUserGallery } from "@/lib/server/user-images";

export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAGIC_BYTES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

function validateMagicBytes(bytes: Uint8Array, claimedMime: string): boolean {
  const signatures = MAGIC_BYTES[claimedMime];
  if (!signatures) return false;
  return signatures.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  );
}

/**
 * POST /api/upload
 * multipart/form-data: { file: Blob, carouselId?: string, slideIndex?: string }
 *
 * Armazena em Supabase Storage bucket `carousel-images`.
 * Path convention: {userId}/{carouselId|draft}/{slideIndex}-{timestamp}.{ext}
 *
 * Retorna: { url: string, path: string }
 *
 * PRÉ-REQUISITO: o bucket `carousel-images` precisa existir com policy de read público.
 * Execute o SQL em docs/product/EDITOR-PLAN.md se ainda não criou.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "upload", user.id),
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Muitos uploads. Tente em alguns minutos." },
        { status: 429 }
      );
    }

    // Parse multipart form
    const form = await request.formData();
    const file = form.get("file");
    const carouselId = String(form.get("carouselId") || "draft");
    const slideIndex = String(form.get("slideIndex") || "0");

    if (!(file instanceof Blob)) {
      return Response.json({ error: "Arquivo não enviado" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: `Imagem muito grande. Máx: ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime)) {
      return Response.json(
        { error: `Formato inválido. Use: ${Array.from(ALLOWED_MIME).join(", ")}` },
        { status: 415 }
      );
    }

    // Precisa de service role pra escrever em Storage (ou policies abertas via RLS)
    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return Response.json(
        {
          error:
            "Upload não configurado no servidor. Falta SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 503 }
      );
    }

    const ext = mime.split("/")[1] || "png";
    const safeCarousel = carouselId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36) || "draft";
    const safeSlide = slideIndex.replace(/[^0-9]/g, "").slice(0, 3) || "0";
    const path = `${user.id}/${safeCarousel}/${safeSlide}-${Date.now()}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (!validateMagicBytes(bytes, mime)) {
      return Response.json(
        { error: "Arquivo corrompido ou extensão incompatível com o conteúdo real." },
        { status: 415 }
      );
    }

    const { error: uploadError } = await supabase.storage
      .from("carousel-images")
      .upload(path, bytes, {
        contentType: mime,
        upsert: false,
        cacheControl: "31536000",
      });

    if (uploadError) {
      // Erro comum: bucket não existe
      const msg = uploadError.message || "";
      if (msg.toLowerCase().includes("bucket") || msg.toLowerCase().includes("not found")) {
        return Response.json(
          {
            error:
              "Bucket 'carousel-images' não existe no Supabase. Veja docs/product/EDITOR-PLAN.md pro SQL de setup.",
          },
          { status: 503 }
        );
      }
      return Response.json({ error: `Upload falhou: ${msg}` }, { status: 502 });
    }

    const { data: pub } = supabase.storage.from("carousel-images").getPublicUrl(path);

    // Salva na galeria pra reuso futuro.
    await saveToUserGallery({
      userId: user.id,
      url: pub.publicUrl,
      source: "uploaded",
      carouselId: safeCarousel === "draft" ? null : safeCarousel,
      slideIndex: safeSlide !== "0" ? Number(safeSlide) : null,
      supabase,
    });

    return Response.json({ url: pub.publicUrl, path });
  } catch (err) {
    console.error("[upload] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
