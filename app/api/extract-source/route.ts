import { extractContentFromUrl } from "@/lib/url-extractor";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export const maxDuration = 30;

/**
 * Extracts content from a URL source (link, video, instagram).
 * Used by the concepts step so that concepts are based on actual source content.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const limiter = await rateLimit({
      key: getRateLimitKey(request, "extract", user.id),
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Limite de requisições atingido. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const { sourceType, sourceUrl } = await request.json();

    if (!sourceUrl || typeof sourceUrl !== "string") {
      return Response.json({ error: "URL é obrigatória." }, { status: 400 });
    }

    if (sourceUrl.length > 2000) {
      return Response.json({ error: "URL muito longa (max 2000 chars)." }, { status: 400 });
    }

    let content = "";

    if (sourceType === "link") {
      try {
        content = await extractContentFromUrl(sourceUrl);
      } catch (err) {
        return Response.json(
          {
            error: `Não foi possível extrair conteúdo da URL: ${err instanceof Error ? err.message : "erro desconhecido"}. Dica: cole o texto manualmente no campo "Minha ideia".`,
          },
          { status: 400 }
        );
      }
    } else if (sourceType === "video") {
      try {
        content = await getYouTubeTranscript(sourceUrl);
      } catch (err) {
        return Response.json(
          {
            error: `Não foi possível extrair a transcrição do YouTube: ${err instanceof Error ? err.message : "erro desconhecido"}. O vídeo pode não ter legendas disponíveis.`,
          },
          { status: 400 }
        );
      }
    } else if (sourceType === "instagram") {
      try {
        const { extractInstagramContent } = await import("@/lib/instagram-extractor");
        content = await extractInstagramContent(sourceUrl);
      } catch (err) {
        return Response.json(
          {
            error: `Falha ao extrair o post do Instagram: ${err instanceof Error ? err.message : "erro desconhecido"}. Dica: cole a legenda como texto no modo "Minha ideia".`,
          },
          { status: 400 }
        );
      }
    } else {
      return Response.json({ error: "Tipo de fonte não suportado." }, { status: 400 });
    }

    if (!content.trim()) {
      return Response.json(
        { error: "Nenhum conteúdo extraído da URL. Tente colar o texto manualmente." },
        { status: 400 }
      );
    }

    return Response.json({ content });
  } catch (error) {
    console.error("[extract-source] Error:", error);
    return Response.json(
      { error: "Erro interno ao extrair conteúdo. Tente novamente." },
      { status: 500 }
    );
  }
}
