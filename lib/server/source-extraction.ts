/**
 * Wrapper pra extração de source content com metadados (chars, tempo,
 * previews). Usado pelo `/api/admin/source-debug` pra auditoria e também
 * internamente pra gerar logs estruturados.
 *
 * Mantém compatibilidade com a chamada atual de `/api/generate` — os utils
 * originais (`getYouTubeTranscript`, `extractContentFromUrl`,
 * `extractInstagramContent`) continuam intactos.
 */

import { extractContentFromUrl } from "@/lib/url-extractor";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";

export type DebugSourceType = "video" | "link" | "instagram";

export interface ExtractionResult {
  content: string;
  method: string;
  chars: number;
  firstChars: string;
  lastChars: string;
  durationMs: number;
  error?: string;
}

function buildResult(
  content: string,
  method: string,
  start: number,
  error?: string
): ExtractionResult {
  const chars = content.length;
  const PREVIEW = 500;
  return {
    content,
    method,
    chars,
    firstChars: content.slice(0, PREVIEW),
    lastChars:
      chars > PREVIEW * 2 ? content.slice(chars - PREVIEW) : "",
    durationMs: Date.now() - start,
    error,
  };
}

export async function extractSourceWithMeta(
  sourceType: DebugSourceType,
  sourceUrl: string
): Promise<ExtractionResult> {
  const start = Date.now();

  if (sourceType === "link") {
    try {
      const content = await extractContentFromUrl(sourceUrl);
      return buildResult(content, "url-extractor/fetch+regex", start);
    } catch (err) {
      return buildResult(
        "",
        "url-extractor/fetch+regex",
        start,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  if (sourceType === "video") {
    try {
      const content = await getYouTubeTranscript(sourceUrl);
      return buildResult(
        content,
        "youtube-transcript/innertube+fallback",
        start
      );
    } catch (err) {
      return buildResult(
        "",
        "youtube-transcript/innertube+fallback",
        start,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  if (sourceType === "instagram") {
    try {
      const { extractInstagramContent } = await import(
        "@/lib/instagram-extractor"
      );
      const content = await extractInstagramContent(sourceUrl);
      return buildResult(content, "instagram/apify+supadata", start);
    } catch (err) {
      return buildResult(
        "",
        "instagram/apify+supadata",
        start,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return buildResult("", "unknown", start, "sourceType inválido");
}
