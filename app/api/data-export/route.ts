import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export const maxDuration = 30;

/**
 * GET /api/data-export
 *
 * Exporta dados do usuário autenticado em JSON (LGPD / portabilidade).
 * Inclui: profile, carousels, generations (metadados, sem conteúdo prompt),
 * payments, redemptions.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "data-export", user.id),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Limite de exports por hora. Tente mais tarde." },
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

  try {
    const [profileRes, carouselsRes, generationsRes, paymentsRes, redemptionsRes] =
      await Promise.all([
        sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        sb.from("carousels").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        sb
          .from("generations")
          .select("id,model,provider,input_tokens,output_tokens,cost_usd,prompt_type,created_at,carousel_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        sb.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        sb
          .from("coupon_redemptions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

    // Remove campos sensíveis do profile antes de exportar.
    let profile = profileRes.data as Record<string, unknown> | null;
    if (profile) {
      const { stripe_customer_id: _c, stripe_subscription_id: _s, ...safeProfile } = profile;
      void _c;
      void _s;
      profile = safeProfile;
    }

    const dump = {
      meta: {
        app: "sequencia-viral",
        format_version: 1,
        exported_at: new Date().toISOString(),
        user_id: user.id,
        user_email: user.email,
      },
      profile,
      carousels: carouselsRes.data || [],
      generations: generationsRes.data || [],
      payments: paymentsRes.data || [],
      coupon_redemptions: redemptionsRes.data || [],
    };

    return new Response(JSON.stringify(dump, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="sequencia-viral-export-${user.id.slice(
          0,
          8
        )}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("[data-export] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erro ao exportar dados." },
      { status: 500 }
    );
  }
}
