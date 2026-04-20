import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "./auth";

export type UserImageSource = "generated" | "uploaded" | "unsplash" | "search";

/**
 * Salva uma imagem na galeria do usuário (tabela `user_images`). Falha
 * silenciosa — se der erro, não quebra o fluxo principal de geração.
 */
export async function saveToUserGallery(params: {
  userId: string;
  url: string;
  source: UserImageSource;
  title?: string;
  description?: string;
  prompt?: string;
  tags?: string[];
  carouselId?: string | null;
  slideIndex?: number | null;
  supabase?: SupabaseClient | null;
}): Promise<void> {
  const sb = params.supabase ?? createServiceRoleSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("user_images").insert({
      user_id: params.userId,
      url: params.url,
      source: params.source,
      title: params.title ?? null,
      description: params.description ?? null,
      prompt: params.prompt ?? null,
      tags: params.tags ?? [],
      carousel_id: params.carouselId ?? null,
      slide_index: params.slideIndex ?? null,
    });
  } catch (err) {
    console.warn(
      "[user-images] falha ao salvar na galeria:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Incrementa o contador de uso de uma imagem (pra ranking na galeria).
 */
export async function touchUserImage(params: {
  userId: string;
  url: string;
  supabase?: SupabaseClient | null;
}): Promise<void> {
  const sb = params.supabase ?? createServiceRoleSupabaseClient();
  if (!sb) return;
  try {
    // Busca a row primeiro (pra incrementar usage_count atomicamente).
    const { data: existing } = await sb
      .from("user_images")
      .select("id,usage_count")
      .eq("user_id", params.userId)
      .eq("url", params.url)
      .limit(1)
      .maybeSingle();
    if (!existing) return;
    await sb
      .from("user_images")
      .update({
        usage_count: (existing.usage_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } catch (err) {
    console.warn(
      "[user-images] falha ao marcar uso:",
      err instanceof Error ? err.message : err
    );
  }
}
