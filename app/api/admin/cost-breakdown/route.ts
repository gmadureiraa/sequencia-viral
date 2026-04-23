import {
  requireAdmin,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";

export const maxDuration = 30;

/**
 * GET /api/admin/cost-breakdown?range=7d|30d|90d|ytd|custom&from=ISO&to=ISO
 *
 * Retorna custos agregados POR PROCESSO DE USUÁRIO, não por chamada — pra
 * o Gabriel saber quanto custa cada etapa real (onboarding, 1 carrossel
 * Manifesto completo com imagens, 1 carrossel Twitter, 1 imagem avulsa,
 * 1 refresh de sugestões) e usar isso pra precificar.
 *
 * Payload:
 *  - perPromptType[] { type, calls, avgCostUsd, totalCostUsd, avgTokens: {in,out} }
 *  - processes[]     { id, label, avgCostUsd, components[], missing? }
 *  - topUsersByCost[] { userId, name, email, plan, totalCostUsd, callCount }
 *  - usdBrlRate       taxa de conversão pra exibição em BRL no client
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

    const url = new URL(request.url);
    const range = url.searchParams.get("range") ?? "30d";
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const { from, to } = resolveRange(range, fromParam, toParam);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    interface GenerationRow {
      user_id: string | null;
      provider: string | null;
      prompt_type: string | null;
      cost_usd: number | string | null;
      input_tokens: number | string | null;
      output_tokens: number | string | null;
      created_at: string | null;
      model: string | null;
    }

    interface ProfileRow {
      id: string;
      email: string | null;
      name: string | null;
      plan: string | null;
    }

    // Busca em paralelo: generations no range + profiles (snapshot pra JOIN).
    const [gensRes, profsRes] = await Promise.allSettled([
      sb
        .from("generations")
        .select(
          "user_id,provider,prompt_type,cost_usd,input_tokens,output_tokens,created_at,model"
        )
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(50000),
      sb
        .from("profiles")
        .select("id,email,name,plan")
        .limit(10000),
    ]);

    const queryErrors: Record<string, string> = {};

    const unwrap = <T>(
      r: PromiseSettledResult<{
        data: T[] | null;
        error: { message: string } | null;
      }>,
      label: string
    ): T[] => {
      if (r.status === "rejected") {
        queryErrors[label] = String(r.reason).slice(0, 160);
        return [];
      }
      if (r.value.error) {
        queryErrors[label] = r.value.error.message.slice(0, 160);
        return [];
      }
      return r.value.data ?? [];
    };

    const generations = unwrap<GenerationRow>(gensRes, "generations");
    const profiles = unwrap<ProfileRow>(profsRes, "profiles");

    const toNum = (v: number | string | null | undefined): number => {
      const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
      return Number.isFinite(n) ? n : 0;
    };

    // ─── perPromptType ──────────────────────────────────────────────────
    interface Bucket {
      calls: number;
      totalCost: number;
      totalIn: number;
      totalOut: number;
    }
    const byType = new Map<string, Bucket>();
    for (const g of generations) {
      const t = (g.prompt_type || "unknown").toLowerCase();
      const cur = byType.get(t) ?? {
        calls: 0,
        totalCost: 0,
        totalIn: 0,
        totalOut: 0,
      };
      cur.calls += 1;
      cur.totalCost += toNum(g.cost_usd);
      cur.totalIn += toNum(g.input_tokens);
      cur.totalOut += toNum(g.output_tokens);
      byType.set(t, cur);
    }

    const perPromptType = [...byType.entries()]
      .map(([type, b]) => ({
        type,
        calls: b.calls,
        avgCostUsd: b.calls > 0 ? round8(b.totalCost / b.calls) : 0,
        totalCostUsd: round6(b.totalCost),
        avgTokens: {
          in: b.calls > 0 ? Math.round(b.totalIn / b.calls) : 0,
          out: b.calls > 0 ? Math.round(b.totalOut / b.calls) : 0,
        },
      }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

    // Helper pra ler avg de um type (undefined se type não existe no range)
    const avgOf = (type: string): number | undefined => {
      const b = byType.get(type);
      if (!b || b.calls === 0) return undefined;
      return b.totalCost / b.calls;
    };

    // ─── processes[] ────────────────────────────────────────────────────
    // Heurísticas (atualizadas 2026-04-22 — pipeline novo):
    //  - Onboarding = 1×concepts + 1×post-vision-transcripts +
    //                 1×brand-analysis + 3×carousel (+ 3×source-ner se houver)
    //  - Carrossel Futurista = 1×carousel + 1×caption + 1×cover-scene +
    //                          5×image (capa Flash Image + 2 inner Flash Image
    //                          + 2 inner Serper stock, todos ~$0.008)
    //                          + opcional 1×source-ner (se source tinha conteúdo)
    //  - Carrossel Twitter = 1×carousel + 1×caption (imagens via Serper stock
    //                          também custam ~$0.008 mas não geram row em `generations`)
    //  - 1 imagem avulsa = 1×image (Flash Image default agora; antes Imagen)
    //  - Regerar 6 ideias = 1×concepts
    //  - Referências visuais (opcional) = 1×brand-aesthetic (~$0.004, Gemini Vision)
    const avgConcepts = avgOf("concepts");
    const avgTranscripts = avgOf("post-vision-transcripts");
    const avgBrandAnalysis = avgOf("brand-analysis");
    const avgCarousel = avgOf("carousel");
    const avgCaption = avgOf("caption");
    const avgCoverScene = avgOf("cover-scene");
    const avgSourceNer = avgOf("source-ner");
    const avgBrandAesthetic = avgOf("brand-aesthetic");

    // Pra "image", calculamos duas médias:
    //  - avgImageAll  → média global (mistura Flash Image + Imagen fallback)
    //  - avgFlashImg  → só gemini-3.1-flash-image-preview (~$0.008)
    //  - avgImagenOnly → só imagen-4.0-* (~$0.04, raramente usado hoje — só fallback)
    const avgImageAll = avgOf("image");
    let avgImagenOnly: number | undefined;
    let avgFlashImg: number | undefined;
    {
      const imagenRows = generations.filter((g) => {
        const m = (g.model || "").toLowerCase();
        const t = (g.prompt_type || "").toLowerCase();
        return t === "image" && m.startsWith("imagen-");
      });
      if (imagenRows.length > 0) {
        const sum = imagenRows.reduce((a, g) => a + toNum(g.cost_usd), 0);
        avgImagenOnly = sum / imagenRows.length;
      }
      const flashRows = generations.filter((g) => {
        const m = (g.model || "").toLowerCase();
        const t = (g.prompt_type || "").toLowerCase();
        return t === "image" && m.includes("flash-image");
      });
      if (flashRows.length > 0) {
        const sum = flashRows.reduce((a, g) => a + toNum(g.cost_usd), 0);
        avgFlashImg = sum / flashRows.length;
      }
    }
    // Unit estimate pra capa + inner slides (pipeline atual):
    //  - Capa: Flash Image default (fallback Imagen)
    //  - 2 Flash Image inner + 2 Serper stock inner (stock não conta em generations)
    //  - Estimamos 3× Flash Image (capa + 2 inner) logados em generations
    const avgImageUnit = avgFlashImg ?? avgImageAll ?? avgImagenOnly;

    const sumOpt = (...parts: (number | undefined)[]): number | undefined => {
      let total = 0;
      let anyMissing = false;
      for (const p of parts) {
        if (p === undefined) anyMissing = true;
        else total += p;
      }
      return anyMissing && total === 0 ? undefined : total;
    };

    const processes = [
      {
        id: "onboarding",
        label: "Onboarding completo (1 user)",
        components: [
          "concepts x1",
          "post-vision-transcripts x1",
          "brand-analysis x1",
          "carousel x3",
          "source-ner x3 (opcional)",
          "brand-aesthetic x1 (se upload refs)",
        ],
        avgCostUsd: roundMaybe(
          sumOpt(
            avgConcepts,
            avgTranscripts,
            avgBrandAnalysis,
            avgCarousel ? avgCarousel * 3 : undefined,
            avgSourceNer ? avgSourceNer * 3 : 0,
            avgBrandAesthetic ?? 0
          )
        ),
        missing: missingList({
          concepts: avgConcepts,
          "post-vision-transcripts": avgTranscripts,
          "brand-analysis": avgBrandAnalysis,
          carousel: avgCarousel,
        }),
      },
      {
        id: "carousel-manifesto",
        label: "1 carrossel Futurista (com imagens)",
        components: [
          "carousel x1",
          "caption x1",
          "cover-scene x1",
          "source-ner x1 (se source tem conteúdo)",
          "image x3 (Flash Image capa + 2 inner; 2 Serper stock não contam)",
        ],
        avgCostUsd: roundMaybe(
          sumOpt(
            avgCarousel,
            avgCaption,
            avgCoverScene,
            avgSourceNer ?? 0,
            avgImageUnit ? avgImageUnit * 3 : undefined
          )
        ),
        missing: missingList({
          carousel: avgCarousel,
          caption: avgCaption,
          "cover-scene": avgCoverScene,
          image: avgImageUnit,
        }),
      },
      {
        id: "carousel-twitter",
        label: "1 carrossel Twitter",
        components: [
          "carousel x1",
          "caption x1",
          "source-ner x1 (se source tem conteúdo)",
        ],
        avgCostUsd: roundMaybe(
          sumOpt(avgCarousel, avgCaption, avgSourceNer ?? 0)
        ),
        missing: missingList({
          carousel: avgCarousel,
          caption: avgCaption,
        }),
      },
      {
        id: "image-single",
        label: "1 imagem avulsa (Flash Image)",
        components: ["image x1 (gemini-3.1-flash-image-preview · fallback Imagen)"],
        avgCostUsd: roundMaybe(avgFlashImg ?? avgImageAll ?? avgImagenOnly),
        missing: missingList({
          image: avgFlashImg ?? avgImageAll ?? avgImagenOnly,
        }),
      },
      {
        id: "suggestions-refresh",
        label: "Regerar 6 ideias",
        components: ["concepts x1"],
        avgCostUsd: roundMaybe(avgConcepts),
        missing: missingList({ concepts: avgConcepts }),
      },
      {
        id: "brand-aesthetic",
        label: "Análise de referências visuais",
        components: ["brand-aesthetic x1 (Gemini Vision, multi-image)"],
        avgCostUsd: roundMaybe(avgBrandAesthetic),
        missing: missingList({ "brand-aesthetic": avgBrandAesthetic }),
      },
    ];

    // ─── topUsersByCost ─────────────────────────────────────────────────
    const userAgg = new Map<
      string,
      { totalCostUsd: number; callCount: number }
    >();
    for (const g of generations) {
      if (!g.user_id) continue;
      const cur = userAgg.get(g.user_id) ?? {
        totalCostUsd: 0,
        callCount: 0,
      };
      cur.totalCostUsd += toNum(g.cost_usd);
      cur.callCount += 1;
      userAgg.set(g.user_id, cur);
    }
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const topUsersByCost = [...userAgg.entries()]
      .map(([userId, stats]) => {
        const prof = profileById.get(userId);
        return {
          userId,
          name: prof?.name ?? null,
          email: prof?.email ?? null,
          plan: prof?.plan ?? "free",
          totalCostUsd: round6(stats.totalCostUsd),
          callCount: stats.callCount,
        };
      })
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
      .slice(0, 10);

    const usdBrlRate = parseFloat(process.env.USD_BRL_RATE || "5.60") || 5.6;

    return Response.json({
      range: { key: range, from: fromIso, to: toIso },
      perPromptType,
      processes,
      topUsersByCost,
      usdBrlRate,
      queryErrors:
        Object.keys(queryErrors).length > 0 ? queryErrors : undefined,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/cost-breakdown] error:", msg);
    return Response.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}

// ─── helpers ────────────────────────────────────────────────────────────

function missingList(
  parts: Record<string, number | undefined>
): string[] | undefined {
  const miss = Object.entries(parts)
    .filter(([, v]) => v === undefined)
    .map(([k]) => k);
  return miss.length > 0 ? miss : undefined;
}

function roundMaybe(n: number | undefined): number | null {
  if (n === undefined || !Number.isFinite(n)) return null;
  return round8(n);
}

function resolveRange(
  range: string,
  fromParam: string | null,
  toParam: string | null
): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  if (range === "custom" && fromParam && toParam) {
    const f = new Date(fromParam);
    const t = new Date(toParam);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
      f.setUTCHours(0, 0, 0, 0);
      t.setUTCHours(23, 59, 59, 999);
      return { from: f, to: t };
    }
  }

  const from = new Date(to);
  from.setUTCHours(0, 0, 0, 0);

  if (range === "7d") from.setUTCDate(from.getUTCDate() - 6);
  else if (range === "90d") from.setUTCDate(from.getUTCDate() - 89);
  else if (range === "ytd") from.setUTCFullYear(from.getUTCFullYear(), 0, 1);
  else from.setUTCDate(from.getUTCDate() - 29);

  return { from, to };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function round8(n: number): number {
  return Math.round(n * 100_000_000) / 100_000_000;
}
