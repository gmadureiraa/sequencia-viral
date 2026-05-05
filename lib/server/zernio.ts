/**
 * Cliente tipado pra Zernio API (https://zernio.com/api/v1).
 *
 * Zernio é scheduler unified pra Twitter/IG/LinkedIn/FB/TikTok/YouTube/Bluesky/
 * Threads/Pinterest/Reddit/etc. SV usa pra agendar carrosséis gerados — admin
 * only por enquanto (gating em /api/zernio/* via lib/server/auth.ts::requireAdmin).
 *
 * Modelo conceitual:
 *   Profile → container/marca (ex: "Madureira", "Defiverso").
 *   Account → conta social conectada via OAuth, pertence a um Profile.
 *   Post    → conteúdo, schedulável pra múltiplas Accounts simultaneamente.
 *
 * Auth: header `Authorization: Bearer ${ZERNIO_API_KEY}` em todo request.
 * A chave fica em env (ZERNIO_API_KEY). Single-tenant: 1 key Zernio pra
 * toda a operação Kaleidos (cada cliente vira 1 Profile).
 *
 * Doc: https://docs.zernio.com
 */

const ZERNIO_BASE_URL = "https://zernio.com/api/v1";

// ============================================================
// Tipos do Zernio (subset que SV usa)
// ============================================================

export type ZernioPlatform =
  | "twitter"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "bluesky"
  | "threads"
  | "pinterest"
  | "reddit"
  | "snapchat"
  | "telegram"
  | "googlebusiness";

export interface ZernioProfile {
  _id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ZernioAccount {
  _id: string;
  platform: ZernioPlatform;
  profileId?: string;
  username?: string;
  displayName?: string;
  status?: string;
  /** O Zernio retorna campos extras dependendo da plataforma — preserve raw. */
  [key: string]: unknown;
}

export interface ZernioPostPlatformTarget {
  platform: ZernioPlatform;
  accountId: string;
}

export interface ZernioCreatePostInput {
  content: string;
  /** ISO sem timezone (ex: "2026-05-10T14:00:00") + timezone separado. */
  scheduledFor?: string;
  timezone?: string;
  publishNow?: boolean;
  platforms: ZernioPostPlatformTarget[];
  /** URLs de mídia já hospedadas (ex: PNGs dos slides no Supabase Storage). */
  mediaUrls?: string[];
  title?: string;
}

export interface ZernioPost {
  _id: string;
  status?: string;
  scheduledFor?: string;
  publishNow?: boolean;
  platforms?: ZernioPostPlatformTarget[];
  [key: string]: unknown;
}

// ============================================================
// Erros
// ============================================================

export class ZernioApiError extends Error {
  status: number;
  code?: string;
  body: unknown;

  constructor(status: number, message: string, body?: unknown, code?: string) {
    super(message);
    this.name = "ZernioApiError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

export class ZernioConfigError extends Error {
  constructor() {
    super("ZERNIO_API_KEY ausente. Configure no .env / Vercel.");
    this.name = "ZernioConfigError";
  }
}

// ============================================================
// Cliente low-level
// ============================================================

interface ZernioRequestInit {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Timeout em ms (default 20s). */
  timeoutMs?: number;
}

function getApiKey(): string {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new ZernioConfigError();
  return key;
}

function buildUrl(
  path: string,
  query?: ZernioRequestInit["query"]
): string {
  const url = new URL(path.startsWith("/") ? path.slice(1) : path, ZERNIO_BASE_URL + "/");
  // URL constructor com base URL terminando em /api/v1 + path "/v1/profiles" pode
  // gerar resultado inesperado. Como ZERNIO_BASE_URL já termina em /api/v1, o path
  // é só "/profiles", "/connect/twitter", etc. Normalizamos:
  const base = ZERNIO_BASE_URL.endsWith("/") ? ZERNIO_BASE_URL : ZERNIO_BASE_URL + "/";
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const finalUrl = new URL(cleanPath, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      finalUrl.searchParams.append(k, String(v));
    }
  }
  // Pra suprimir warning unused (URL acima foi pra documentação do raciocínio)
  void url;
  return finalUrl.toString();
}

async function zernioRequest<T>(
  path: string,
  init: ZernioRequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = buildUrl(path, init.query);
  const method = init.method ?? "GET";
  const timeoutMs = init.timeoutMs ?? 20_000;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    throw new ZernioApiError(0, `Zernio fetch failed: ${msg}`);
  }

  const ct = res.headers.get("content-type") || "";
  let parsed: unknown = null;
  if (ct.includes("application/json")) {
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
  } else {
    parsed = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const errorObj =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const message =
      (errorObj?.error as string) ||
      (errorObj?.message as string) ||
      (typeof parsed === "string" ? parsed.slice(0, 300) : "") ||
      `Zernio HTTP ${res.status}`;
    const code = errorObj?.code as string | undefined;
    throw new ZernioApiError(res.status, message, parsed, code);
  }

  return parsed as T;
}

// ============================================================
// Profiles
// ============================================================

export async function listZernioProfiles(): Promise<ZernioProfile[]> {
  const data = await zernioRequest<{ profiles?: ZernioProfile[] }>("/v1/profiles");
  return data.profiles ?? [];
}

export async function createZernioProfile(input: {
  name: string;
  description?: string;
}): Promise<ZernioProfile> {
  const data = await zernioRequest<{ profile: ZernioProfile }>(
    "/v1/profiles",
    { method: "POST", body: input }
  );
  return data.profile;
}

export async function deleteZernioProfile(profileId: string): Promise<void> {
  await zernioRequest(`/v1/profiles/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
  });
}

// ============================================================
// Connect (OAuth handshake)
// ============================================================

export interface ZernioConnectUrlInput {
  platform: ZernioPlatform;
  profileId: string;
  redirectUrl?: string;
}

export async function getZernioConnectUrl(
  input: ZernioConnectUrlInput
): Promise<{ authUrl: string; state?: string }> {
  return zernioRequest<{ authUrl: string; state?: string }>(
    `/v1/connect/${encodeURIComponent(input.platform)}`,
    {
      query: {
        profileId: input.profileId,
        redirect_url: input.redirectUrl,
      },
    }
  );
}

// ============================================================
// Accounts
// ============================================================

export async function listZernioAccounts(opts?: {
  profileId?: string;
}): Promise<ZernioAccount[]> {
  const data = await zernioRequest<{ accounts?: ZernioAccount[] }>(
    "/v1/accounts",
    { query: { profileId: opts?.profileId } }
  );
  return data.accounts ?? [];
}

export async function deleteZernioAccount(accountId: string): Promise<void> {
  await zernioRequest(`/v1/accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
  });
}

// ============================================================
// Posts
// ============================================================

export async function createZernioPost(
  input: ZernioCreatePostInput
): Promise<ZernioPost> {
  const data = await zernioRequest<{ post: ZernioPost }>("/v1/posts", {
    method: "POST",
    body: input,
    timeoutMs: 30_000,
  });
  return data.post;
}

export async function listZernioPosts(opts?: {
  status?: "draft" | "scheduled" | "published" | "failed";
  limit?: number;
}): Promise<ZernioPost[]> {
  const data = await zernioRequest<{ posts?: ZernioPost[] }>("/v1/posts", {
    query: { status: opts?.status, limit: opts?.limit },
  });
  return data.posts ?? [];
}

export async function deleteZernioPost(postId: string): Promise<void> {
  await zernioRequest(`/v1/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
  });
}

export async function updateZernioPost(
  postId: string,
  input: Partial<{
    content: string;
    scheduledFor: string;
    timezone: string;
    title: string;
    mediaUrls: string[];
  }>
): Promise<ZernioPost> {
  const data = await zernioRequest<{ post: ZernioPost }>(
    `/v1/posts/${encodeURIComponent(postId)}`,
    { method: "PATCH", body: input }
  );
  return data.post;
}

// ============================================================
// Health-check helper (admin pode usar pra validar a key)
// ============================================================

export async function pingZernio(): Promise<{ ok: boolean; profilesCount?: number; error?: string }> {
  try {
    const profiles = await listZernioProfiles();
    return { ok: true, profilesCount: profiles.length };
  } catch (err) {
    if (err instanceof ZernioApiError) {
      return { ok: false, error: `${err.status}: ${err.message}` };
    }
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
