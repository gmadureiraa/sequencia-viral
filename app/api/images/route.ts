import type { DesignTemplateId, ImagePeopleMode } from "@/lib/carousel-templates";
import {
  getDesignTemplateMeta,
  imagePeopleModeImagenInstruction,
  imagePeopleModeSearchSuffix,
  normalizeDesignTemplate,
  normalizeImagePeopleMode,
} from "@/lib/carousel-templates";
import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

const MAX_QUERY_LEN = 500;

function clip(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

/** Junta termo de busca com trechos do slide para resultados mais alinhados ao conteúdo. */
function mergeImageSearchText(
  query: string,
  contextHeading?: string,
  contextBody?: string
): string {
  const base = query.trim();
  const ctx = [contextHeading, contextBody]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!ctx) return clip(base, MAX_QUERY_LEN);
  return clip(`${base} ${ctx}`, MAX_QUERY_LEN);
}

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
    const {
      query,
      mode,
      niche,
      tone,
      designTemplate,
      contextHeading,
      contextBody,
      peopleMode: peopleModeRaw,
    } = body as {
      query?: string;
      mode?: "search" | "generate";
      niche?: string;
      tone?: string;
      designTemplate?: DesignTemplateId;
      contextHeading?: string;
      contextBody?: string;
      peopleMode?: ImagePeopleMode;
    };

    if (!query || typeof query !== "string") {
      return Response.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }
    if (query.length > MAX_QUERY_LEN) {
      return Response.json(
        { error: "Query too long (max 500 chars)" },
        { status: 400 }
      );
    }

    const heading =
      typeof contextHeading === "string" ? contextHeading : undefined;
    const bodyCtx =
      typeof contextBody === "string" ? contextBody : undefined;
    const mergedSearch = mergeImageSearchText(query, heading, bodyCtx);
    const tmplId = normalizeDesignTemplate(designTemplate);
    const tmplMeta = getDesignTemplateMeta(tmplId);
    const peopleMode = normalizeImagePeopleMode(peopleModeRaw);
    const peopleSearch = imagePeopleModeSearchSuffix(peopleMode);
    const searchQuery = clip(
      `${mergedSearch} ${tmplMeta.imageSearchStyleHint} ${peopleSearch}`
        .replace(/\s+/g, " ")
        .trim(),
      MAX_QUERY_LEN
    );
    const slideThemeHint = [heading, bodyCtx]
      .filter(Boolean)
      .join(" — ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);

    // ── MODE: GENERATE (Gemini Imagen) ──────────────────────────────
    if (mode === "generate") {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const peopleInstr = imagePeopleModeImagenInstruction(peopleMode);
          const styleHint = `Layout: ${tmplMeta.name} — ${tmplMeta.desc} Keywords: ${tmplMeta.imageSearchStyleHint}.`;
          const nicheHint = niche ? `Niche/context: ${niche}.` : "";
          const toneHint = tone ? `Editorial tone: ${tone}.` : "";
          const imagePrompt = [
            "Hyper-realistic professional photograph for Instagram carousel square frame.",
            tmplMeta.imageGenRealismFragment,
            nicheHint,
            toneHint,
            styleHint,
            peopleInstr,
            slideThemeHint
              ? `Slide theme — the image mood, setting, and subject matter must directly reflect this content (no readable text in frame): ${slideThemeHint}.`
              : "",
            `Primary subject / visual focus: ${query}.`,
            "Technical: sharp focus on subject, natural color, believable shadows, 8K detail level, documentary realism.",
            "Hard constraints: no text, no letters, no watermarks, no logos, no UI mockups with readable text.",
          ]
            .filter(Boolean)
            .join(" ");

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
          body: JSON.stringify({ q: searchQuery, num: 5 }),
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
    const encodedQuery = encodeURIComponent(searchQuery);
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
