/**
 * Extracts transcript from a YouTube video.
 *
 * Strategy (tries in order):
 *   1. InnerTube `player` endpoint with multiple clients (ANDROID_VR, TVHTML5, WEB).
 *   2. Watch-page HTML scrape for `captionTracks` JSON.
 *   3. `get_video_info` endpoint (older but often less strict).
 *   4. Direct `timedtext` endpoint for common languages.
 *   5. Supadata (paid fallback) — quando configurado, entrega ASR quando nada mais funciona.
 */

import { fetchSupadataTranscript, isSupadataConfigured } from "./supadata";

const VIDEO_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

// Public innertube keys. These are baked into YouTube's own web/mobile clients
// and are not secrets — they only unlock the innertube player endpoint.
const INNERTUBE_WEB_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

type InnerTubeClient = {
  label: string; // used for logging
  apiKey?: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
};

type CaptionTrack = {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text?: string }[] };
};

const INNERTUBE_CLIENTS: InnerTubeClient[] = [
  // ANDROID_VR — robust against PoToken requirements, no login needed.
  {
    label: "ANDROID_VR",
    body: {
      context: {
        client: {
          clientName: "ANDROID_VR",
          clientVersion: "1.57.29",
          deviceMake: "Oculus",
          deviceModel: "Quest 3",
          androidSdkVersion: 32,
          osName: "Android",
          osVersion: "12L",
          hl: "en",
          gl: "US",
          userAgent:
            "com.google.android.apps.youtube.vr.oculus/1.57.29 (Linux; U; Android 12L; SM-G973U) gzip",
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
    headers: {
      "User-Agent":
        "com.google.android.apps.youtube.vr.oculus/1.57.29 (Linux; U; Android 12L; SM-G973U) gzip",
      "X-YouTube-Client-Name": "28",
      "X-YouTube-Client-Version": "1.57.29",
    },
  },
  // TVHTML5 — also routinely serves captions without PoToken.
  {
    label: "TVHTML5",
    body: {
      context: {
        client: {
          clientName: "TVHTML5",
          clientVersion: "7.20241201.18.00",
          hl: "en",
          gl: "US",
          userAgent:
            "Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15",
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15",
      "X-YouTube-Client-Name": "7",
      "X-YouTube-Client-Version": "7.20241201.18.00",
    },
  },
  // WEB — last resort with api key. Often hits "Video unavailable" but worth trying.
  {
    label: "WEB",
    apiKey: INNERTUBE_WEB_API_KEY,
    body: {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20241201.00.00",
          hl: "en",
          gl: "US",
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "X-YouTube-Client-Name": "1",
      "X-YouTube-Client-Version": "2.20241201.00.00",
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com/",
    },
  },
];

const PREFERRED_LANG_ORDER = [
  "pt",
  "pt-BR",
  "pt-PT",
  "en",
  "en-US",
  "en-GB",
  "es",
  "fr",
  "de",
];

export function extractVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(VIDEO_ID_REGEX);
  return match ? match[1] : null;
}

export async function getYouTubeTranscript(url: string): Promise<string> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("URL do YouTube inválida. Cole o link completo do vídeo.");
  }

  const errors: string[] = [];

  for (const client of INNERTUBE_CLIENTS) {
    try {
      const result = await fetchViaInnerTube(videoId, client);
      if (result) return result;
    } catch (err) {
      errors.push(
        `innertube/${client.label}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  try {
    const result = await fetchTranscriptViaPage(videoId);
    if (result) return result;
  } catch (err) {
    errors.push(`page: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const result = await fetchTranscriptViaGetVideoInfo(videoId);
    if (result) return result;
  } catch (err) {
    errors.push(
      `get_video_info: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  for (const lang of PREFERRED_LANG_ORDER) {
    for (const asr of [false, true]) {
      try {
        const result = await fetchTimedText(videoId, lang, asr);
        if (result) return result;
      } catch {
        /* continue */
      }
    }
  }

  // 5) Supadata (ASR pago) — última carta quando tudo falha.
  if (isSupadataConfigured()) {
    try {
      const sup = await fetchSupadataTranscript(
        `https://www.youtube.com/watch?v=${videoId}`,
        { lang: "pt" }
      );
      if (sup && sup.content) {
        return formatTranscriptOutput({
          title: `YouTube vídeo ${videoId}`,
          lang: sup.lang,
          isAuto: true,
          durationSec: 0,
          text: sup.content,
        });
      }
    } catch (err) {
      errors.push(
        `supadata: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.warn("[yt-transcript] all strategies failed:", errors);
  throw new Error(
    "Não foi possível extrair a transcrição. O vídeo pode não ter legendas, ou o YouTube está bloqueando a requisição. Tente outro vídeo ou cole o conteúdo manualmente."
  );
}

async function fetchViaInnerTube(
  videoId: string,
  client: InnerTubeClient
): Promise<string | null> {
  const url = client.apiKey
    ? `https://www.youtube.com/youtubei/v1/player?key=${client.apiKey}&prettyPrint=false`
    : `https://www.youtube.com/youtubei/v1/player?prettyPrint=false`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...client.headers,
    },
    body: JSON.stringify({ ...client.body, videoId }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    if (process.env.DEBUG_YT_TRANSCRIPT) {
      const txt = await res.text().catch(() => "");
      console.log(
        `[yt-transcript][${client.label}] HTTP ${res.status}: ${txt.slice(0, 200)}`
      );
    }
    return null;
  }
  const data = await res.json();

  const status = data?.playabilityStatus?.status;
  if (status && status !== "OK" && status !== "LIVE_STREAM_OFFLINE") {
    const reason =
      data?.playabilityStatus?.reason ||
      data?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason
        ?.simpleText;
    if (reason) throw new Error(`YouTube: ${reason}`);
  }

  const tracks: CaptionTrack[] =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) {
    if (process.env.DEBUG_YT_TRANSCRIPT) {
      console.log(
        `[yt-transcript][${client.label}] no captionTracks. status=${status}`
      );
    }
    return null;
  }

  const title = data?.videoDetails?.title || "";
  const durationSec = Number(data?.videoDetails?.lengthSeconds || 0);

  const track = pickBestTrack(tracks);
  if (!track?.baseUrl) return null;

  const text = await fetchCaptionJson(track.baseUrl);
  if (!text) return null;

  return formatTranscriptOutput({
    title,
    lang: track.languageCode,
    isAuto: track.kind === "asr",
    durationSec,
    text,
  });
}

function pickBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  const nonAsr = tracks.filter((t) => t.kind !== "asr");
  const asr = tracks.filter((t) => t.kind === "asr");
  const pickPreferred = (pool: CaptionTrack[]) => {
    for (const lang of PREFERRED_LANG_ORDER) {
      const hit = pool.find(
        (t) => t.languageCode?.toLowerCase() === lang.toLowerCase()
      );
      if (hit) return hit;
    }
    return pool[0];
  };
  return pickPreferred(nonAsr) || pickPreferred(asr) || tracks[0] || null;
}

async function fetchCaptionJson(baseUrl: string): Promise<string | null> {
  const url = appendFormat(baseUrl, "json3");
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  const raw = await res.text();
  if (!raw.trim()) return null;

  try {
    const data = JSON.parse(raw);
    const lines: string[] = [];
    for (const event of data.events || []) {
      if (!event.segs) continue;
      const text = event.segs
        .map((seg: { utf8?: string }) => seg.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (text && text !== "\n") lines.push(text);
    }
    const transcript = lines.join(" ").replace(/\s+/g, " ").trim();
    return transcript || null;
  } catch {
    // XML/TTML fallback
    const stripped = raw
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    return stripped || null;
  }
}

function appendFormat(url: string, fmt: string): string {
  if (/[?&]fmt=/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "fmt=" + fmt;
}

async function fetchTimedText(
  videoId: string,
  lang: string,
  asr: boolean
): Promise<string | null> {
  const url =
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3` +
    (asr ? "&kind=asr" : "");

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;
  const raw = await res.text();
  if (!raw.trim()) return null;

  let data: { events?: { segs?: { utf8?: string }[] }[] } | null = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data?.events?.length) return null;

  const lines: string[] = [];
  for (const event of data.events) {
    if (!event.segs) continue;
    const text = event.segs
      .map((seg) => seg.utf8 || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text && text !== "\n") lines.push(text);
  }
  const transcript = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!transcript) return null;

  return formatTranscriptOutput({
    title: `Video ${videoId}`,
    lang,
    isAuto: asr,
    durationSec: 0,
    text: transcript,
  });
}

async function fetchTranscriptViaPage(
  videoId: string
): Promise<string | null> {
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;

  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
      Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+000;",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return null;
  const html = await response.text();

  const titleMatch = html.match(/"title":"((?:[^"\\]|\\.)*)"/);
  const title = titleMatch
    ? titleMatch[1].replace(/\\"/g, '"').replace(/\\u0026/g, "&")
    : "";

  // Greedy-match the full captionTracks array until first ] that ends it.
  const captionMatch = html.match(/"captionTracks":(\[[^\]]*\])/);
  if (!captionMatch) return null;

  let tracks: CaptionTrack[];
  try {
    tracks = JSON.parse(captionMatch[1]);
  } catch {
    return null;
  }
  if (!tracks.length) return null;

  const track = pickBestTrack(tracks);
  if (!track?.baseUrl) return null;

  const text = await fetchCaptionJson(track.baseUrl);
  if (!text) return null;

  return formatTranscriptOutput({
    title,
    lang: track.languageCode,
    isAuto: track.kind === "asr",
    durationSec: 0,
    text,
  });
}

/**
 * Legacy `get_video_info` endpoint. Still serves captions metadata in some cases
 * where the innertube endpoint returns PoToken errors.
 */
async function fetchTranscriptViaGetVideoInfo(
  videoId: string
): Promise<string | null> {
  const url =
    `https://www.youtube.com/get_video_info?video_id=${videoId}` +
    `&html5=1&c=TVHTML5&cver=7.20241201.18.00&cplayer=UNIPLAYER`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const text = await res.text();
  const params = new URLSearchParams(text);
  const playerResponse = params.get("player_response");
  if (!playerResponse) return null;
  let data: {
    captions?: {
      playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
    };
    videoDetails?: { title?: string; lengthSeconds?: string };
  };
  try {
    data = JSON.parse(playerResponse);
  } catch {
    return null;
  }
  const tracks =
    data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) return null;
  const track = pickBestTrack(tracks);
  if (!track?.baseUrl) return null;
  const body = await fetchCaptionJson(track.baseUrl);
  if (!body) return null;
  return formatTranscriptOutput({
    title: data.videoDetails?.title || "",
    lang: track.languageCode,
    isAuto: track.kind === "asr",
    durationSec: Number(data.videoDetails?.lengthSeconds || 0),
    text: body,
  });
}

function formatTranscriptOutput(args: {
  title: string;
  lang?: string;
  isAuto?: boolean;
  durationSec?: number;
  text: string;
}): string {
  const { title, lang, isAuto, durationSec, text } = args;
  const truncated = text.length > 8000 ? text.slice(0, 8000) + "…" : text;
  const meta: string[] = [];
  if (title) meta.push(`Vídeo: ${title}`);
  if (lang) meta.push(`Idioma: ${lang}${isAuto ? " (auto)" : ""}`);
  if (durationSec && durationSec > 0) {
    const m = Math.floor(durationSec / 60);
    const s = durationSec % 60;
    meta.push(`Duração: ${m}:${String(s).padStart(2, "0")}`);
  }
  const header = meta.length ? meta.join("\n") + "\n\n" : "";
  return `${header}Transcrição:\n${truncated}`;
}
