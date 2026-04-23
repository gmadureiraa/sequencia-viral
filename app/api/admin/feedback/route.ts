import {
  requireAdmin,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";

export const maxDuration = 20;

interface FeedbackRow {
  id: string;
  user_id: string | null;
  carousel_id: string | null;
  raw_text: string;
  classified_buckets: string[] | null;
  text_rules: string[] | null;
  image_rules: string[] | null;
  classifier_model: string | null;
  classifier_cost_usd: number | string | null;
  created_at: string | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  name: string | null;
}

interface CarouselRow {
  id: string;
  title: string | null;
}

export interface AdminFeedbackItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  carouselId: string | null;
  carouselTitle: string | null;
  rawText: string;
  buckets: string[];
  textRules: string[];
  imageRules: string[];
  classifierModel: string | null;
  classifierCostUsd: number | null;
  createdAt: string | null;
}

/**
 * GET /api/admin/feedback
 *
 * Lista os últimos 100 feedbacks pós-download. Join manual em profiles +
 * carousels pra mostrar email / title na admin view. Acesso restrito a
 * ADMIN_EMAILS.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const sb = createServiceRoleSupabaseClient();
    if (!sb) {
      return Response.json(
        { error: "Service role key ausente — admin indisponível." },
        { status: 503 }
      );
    }

    const { data: rows, error } = await sb
      .from("carousel_feedback")
      .select(
        "id,user_id,carousel_id,raw_text,classified_buckets,text_rules,image_rules,classifier_model,classifier_cost_usd,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[admin/feedback] query falhou:", error.message);
      return Response.json(
        { error: "Falha ao carregar feedbacks: " + error.message },
        { status: 500 }
      );
    }

    const list = (rows ?? []) as FeedbackRow[];
    const userIds = Array.from(
      new Set(list.map((r) => r.user_id).filter((v): v is string => !!v))
    );
    const carouselIds = Array.from(
      new Set(list.map((r) => r.carousel_id).filter((v): v is string => !!v))
    );

    // Join manual com profiles e carousels. Supabase PostgREST nao faz join
    // em tabela sem FK declarada, entao busca separada e mergeia em memoria.
    let profilesById = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      try {
        const { data: profs } = await sb
          .from("profiles")
          .select("id,email,name")
          .in("id", userIds);
        if (Array.isArray(profs)) {
          profilesById = new Map((profs as ProfileRow[]).map((p) => [p.id, p]));
        }
      } catch (err) {
        console.warn(
          "[admin/feedback] falha ao carregar profiles:",
          err instanceof Error ? err.message : err
        );
      }
    }

    let carouselsById = new Map<string, CarouselRow>();
    if (carouselIds.length > 0) {
      try {
        const { data: carousels } = await sb
          .from("carousels")
          .select("id,title")
          .in("id", carouselIds);
        if (Array.isArray(carousels)) {
          carouselsById = new Map(
            (carousels as CarouselRow[]).map((c) => [c.id, c])
          );
        }
      } catch (err) {
        console.warn(
          "[admin/feedback] falha ao carregar carousels:",
          err instanceof Error ? err.message : err
        );
      }
    }

    const items: AdminFeedbackItem[] = list.map((r) => {
      const profile = r.user_id ? profilesById.get(r.user_id) : undefined;
      const carousel = r.carousel_id
        ? carouselsById.get(r.carousel_id)
        : undefined;
      const cost =
        typeof r.classifier_cost_usd === "string"
          ? parseFloat(r.classifier_cost_usd)
          : r.classifier_cost_usd ?? null;
      return {
        id: r.id,
        userId: r.user_id,
        userEmail: profile?.email ?? null,
        userName: profile?.name ?? null,
        carouselId: r.carousel_id,
        carouselTitle: carousel?.title ?? null,
        rawText: r.raw_text,
        buckets: Array.isArray(r.classified_buckets)
          ? r.classified_buckets
          : [],
        textRules: Array.isArray(r.text_rules) ? r.text_rules : [],
        imageRules: Array.isArray(r.image_rules) ? r.image_rules : [],
        classifierModel: r.classifier_model,
        classifierCostUsd: Number.isFinite(cost as number)
          ? (cost as number)
          : null,
        createdAt: r.created_at,
      };
    });

    return Response.json({ items });
  } catch (err) {
    console.error("[admin/feedback] erro:", err);
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erro desconhecido ao carregar feedbacks.",
      },
      { status: 500 }
    );
  }
}
