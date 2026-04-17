import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    const { user } = auth;

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "images-search", user.id),
      limit: 100,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSec),
          },
        }
      );
    }

    const body = await request.json();
    const { query, mode } = body as { query?: string; mode?: "search" | "generate" };

    if (!query || typeof query !== "string") {
      return Response.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }
    if (query.length > 500) {
      return Response.json(
        { error: "Query too long (max 500 chars)" },
        { status: 400 }
      );
    }

    // ── MODE: GENERATE (Gemini Imagen) ──────────────────────────────
    if (mode === "generate") {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const imagePrompt = `Professional editorial photograph for social media carousel about: ${query}. Clean, modern, high quality, no text overlay.`;

          const res = await ai.models.generateImages({
            model: "imagen-4.0-generate-001",
            prompt: imagePrompt,
            config: { numberOfImages: 1, aspectRatio: "1:1" },
          });

          const imageBytes = res.generatedImages?.[0]?.image?.imageBytes;
          if (imageBytes) {
            // Try to upload to Supabase Storage
            const supabase = createServiceRoleSupabaseClient();
            if (supabase) {
              const buffer = Buffer.from(imageBytes, "base64");
              const path = `generated/${user.id}/${Date.now()}.png`;
              const { error: uploadError } = await supabase.storage
                .from("carousel-images")
                .upload(path, buffer, {
                  contentType: "image/png",
                  upsert: false,
                  cacheControl: "31536000",
                });

              if (!uploadError) {
                const { data: pub } = supabase.storage
                  .from("carousel-images")
                  .getPublicUrl(path);

                return Response.json({
                  images: [
                    {
                      url: pub.publicUrl,
                      title: query,
                      source: "Gemini Imagen",
                      generated: true,
                    },
                  ],
                });
              }
              console.warn("[images] Supabase upload failed, returning data URL:", uploadError.message);
            }

            // Fallback: return as data URL if storage upload fails
            return Response.json({
              images: [
                {
                  url: `data:image/png;base64,${imageBytes}`,
                  title: query,
                  source: "Gemini Imagen",
                  generated: true,
                },
              ],
            });
          }
        } catch (err) {
          console.error("[images] Gemini Imagen error:", err);
          // Fall through to search mode as fallback
        }
      }

      // If Gemini failed, fall through to Serper search as fallback
    }

    // ── MODE: SEARCH (Serper / Unsplash) ────────────────────────────

    // Strategy 1: Serper.dev Google Image Search
    const serperKey = process.env.SERPER_API_KEY;
    if (serperKey) {
      try {
        const resp = await fetch("https://google.serper.dev/images", {
          method: "POST",
          headers: {
            "X-API-KEY": serperKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: query, num: 5 }),
          signal: AbortSignal.timeout(10_000),
        });

        if (resp.ok) {
          const data = await resp.json();
          const images = (data.images || [])
            .slice(0, 5)
            .map(
              (img: {
                imageUrl?: string;
                title?: string;
                source?: string;
              }) => ({
                url: img.imageUrl || "",
                title: img.title || "",
                source: img.source || "",
                generated: false,
              })
            );

          return Response.json({ images });
        }
      } catch (err) {
        console.error("Serper API error:", err);
      }
    }

    // Strategy 2: Fallback — return placeholder images using Unsplash
    const encodedQuery = encodeURIComponent(query);
    const fallbackImages = Array.from({ length: 5 }, (_, i) => ({
      url: `https://source.unsplash.com/800x600/?${encodedQuery}&sig=${i}`,
      title: `${query} - Image ${i + 1}`,
      source: "Unsplash",
      generated: false,
    }));

    return Response.json({ images: fallbackImages });
  } catch (error) {
    console.error("Images API error:", error);
    return Response.json(
      {
        error: process.env.NODE_ENV === "production"
          ? "Erro ao buscar imagens. Tente novamente."
          : (error instanceof Error ? error.message : "Internal server error"),
      },
      { status: 500 }
    );
  }
}
