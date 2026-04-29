import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export const maxDuration = 30;

const MAX_CAROUSELS_PER_IMPORT = 200;

type ImportPayload = {
  meta?: { app?: string; format_version?: number };
  carousels?: Array<Record<string, unknown>>;
  profile?: Record<string, unknown> | null;
};

/**
 * POST /api/data-import
 *
 * Importa carrosséis de um JSON previamente exportado via /api/data-export.
 * Regras:
 *  - Apenas a lista `carousels` é importada (profile não é sobrescrito).
 *  - Cada carrossel entra como rascunho duplicado (novo id, user_id do atual).
 *  - Protege contra floods: máx 200 por request.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "data-import", user.id),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Limite de imports por hora." },
      { status: 429 }
    );
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) {
    return Response.json(
      { error: "Servidor sem Supabase configurado." },
      { status: 503 }
    );
  }

  let payload: ImportPayload;
  try {
    payload = (await request.json()) as ImportPayload;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (payload.meta?.app && payload.meta.app !== "sequencia-viral") {
    return Response.json(
      { error: "Arquivo não é um export do Sequência Viral." },
      { status: 400 }
    );
  }

  const inbound = Array.isArray(payload.carousels) ? payload.carousels : [];
  if (inbound.length === 0) {
    return Response.json(
      { error: "Nenhum carrossel no arquivo." },
      { status: 400 }
    );
  }
  if (inbound.length > MAX_CAROUSELS_PER_IMPORT) {
    return Response.json(
      {
        error: `Máximo de ${MAX_CAROUSELS_PER_IMPORT} carrosséis por import. Divida em lotes.`,
      },
      { status: 413 }
    );
  }

  type CarouselRow = {
    user_id: string;
    title: string;
    slides: unknown;
    style: unknown;
    source_url: string | null;
    source_text: string | null;
    status: string;
    thumbnail_url: string | null;
  };

  const rows: CarouselRow[] = [];
  const skipped: string[] = [];

  for (const raw of inbound) {
    const slides = raw.slides;
    if (!Array.isArray(slides) || slides.length === 0) {
      skipped.push(String(raw.id || raw.title || "(sem id)"));
      continue;
    }
    const title =
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim().slice(0, 200)
        : "Carrossel importado";
    const style =
      raw.style && typeof raw.style === "object" ? raw.style : {};
    const status =
      raw.status === "published" || raw.status === "archived" || raw.status === "draft"
        ? (raw.status as string)
        : "draft";
    // Scheme guard: só aceita https:// em source_url/thumbnail_url pra
    // evitar javascript:/data: URIs que depois sejam renderizados em <a>
    // sem escape. Tudo fora disso → null (row importa, mas link some).
    const safeHttps = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const trimmed = v.trim().slice(0, 2000);
      if (!/^https:\/\//i.test(trimmed)) return null;
      return trimmed;
    };
    rows.push({
      user_id: user.id,
      title,
      slides,
      style,
      source_url: safeHttps(raw.source_url),
      source_text:
        typeof raw.source_text === "string" ? raw.source_text.slice(0, 10000) : null,
      status,
      thumbnail_url: safeHttps(raw.thumbnail_url),
    });
  }

  if (rows.length === 0) {
    return Response.json(
      { error: "Nenhum carrossel válido no arquivo.", skipped },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await sb
    .from("carousels")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("[data-import] insert error:", error);
    return Response.json(
      { error: `Falha ao importar: ${error.message}` },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    imported: inserted?.length ?? 0,
    skipped,
    ids: (inserted || []).map((r) => r.id),
  });
}
