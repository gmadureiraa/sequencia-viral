/**
 * Helper que monta brandContext + feedbackContext (memory rules) a partir
 * de profiles.brand_analysis pra um user específico. Usado em:
 *  - /api/generate (manual): inline em route.ts (legado, mantém duplicação por
 *    enquanto pra não regridir).
 *  - /api/cron/zernio-autopilot: NOVO uso — antes o autopilot ignorava brand
 *    voice e gerava conteúdo genérico. Agora respeita o mesmo voice DNA.
 *
 * Mantém shape e comportamento espelhado de app/api/generate/route.ts:447-594
 * pra que carrosseis manuais e do autopilot soem idênticos em voz/estrutura.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface BrandContextResult {
  brandContext: string;
  feedbackContext: string;
}

interface VoiceDna {
  summary?: string;
  tone?: string[];
  hook_patterns?: string[];
  cta_style?: string;
  structure_signature?: string;
  vocabulary_markers?: string[];
  dos?: string[];
  donts?: string[];
  sample_captions?: string[];
}

export async function loadBrandContextForUser(
  sb: SupabaseClient,
  userId: string
): Promise<BrandContextResult> {
  const { data: prof } = await sb
    .from("profiles")
    .select("brand_analysis")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) return { brandContext: "", feedbackContext: "" };

  const ba = prof.brand_analysis as Record<string, unknown> | null;
  if (!ba || typeof ba !== "object") return { brandContext: "", feedbackContext: "" };

  const pillars = Array.isArray(ba.content_pillars)
    ? (ba.content_pillars as string[]).join(", ")
    : "";
  const topics = Array.isArray(ba.top_topics)
    ? (ba.top_topics as string[]).join(", ")
    : "";
  const tone_detected = (ba.tone_detected as string) || "";
  const audience = (ba.audience_description as string) || "";
  const voice = (ba.voice_preference as string) || "";
  const voiceSamples = Array.isArray(ba.voice_samples)
    ? (ba.voice_samples as string[])
        .map((s) => (typeof s === "string" ? s.slice(0, 240) : ""))
        .filter(Boolean)
        .join("\n---\n")
    : "";
  const tabus = Array.isArray(ba.tabus)
    ? (ba.tabus as string[]).filter(Boolean).join(", ")
    : "";
  const contentRules = Array.isArray(ba.content_rules)
    ? (ba.content_rules as string[]).filter(Boolean).join("; ")
    : "";

  const voiceDna = (ba.__voice_dna ?? null) as VoiceDna | null;
  let voiceDnaBlock = "";
  if (voiceDna && typeof voiceDna === "object") {
    const dnaLines: string[] = [];
    if (voiceDna.summary) dnaLines.push(`Resumo: ${voiceDna.summary}`);
    if (voiceDna.tone?.length) dnaLines.push(`Tom: ${voiceDna.tone.join(", ")}`);
    if (voiceDna.hook_patterns?.length)
      dnaLines.push(`Padrões de hook: ${voiceDna.hook_patterns.join(" | ")}`);
    if (voiceDna.structure_signature)
      dnaLines.push(`Estrutura: ${voiceDna.structure_signature}`);
    if (voiceDna.cta_style) dnaLines.push(`CTA estilo: ${voiceDna.cta_style}`);
    if (voiceDna.vocabulary_markers?.length)
      dnaLines.push(`Marcadores vocabulário: ${voiceDna.vocabulary_markers.join(", ")}`);
    if (voiceDna.dos?.length) dnaLines.push(`Replicar: ${voiceDna.dos.join(" | ")}`);
    if (voiceDna.donts?.length) dnaLines.push(`Evitar: ${voiceDna.donts.join(" | ")}`);
    if (voiceDna.sample_captions?.length)
      dnaLines.push(
        `Trechos reais:\n${voiceDna.sample_captions.map((c) => `· ${c}`).join("\n")}`
      );
    if (dnaLines.length > 0) {
      voiceDnaBlock = `\n- VOICE DNA (carrosséis reais do criador, imite ritmo e estrutura sem copiar literalmente):\n${dnaLines.join("\n")}\n`;
    }
  }

  let brandContext = "";
  if (
    pillars ||
    topics ||
    tone_detected ||
    audience ||
    voice ||
    voiceSamples ||
    tabus ||
    contentRules ||
    voiceDnaBlock
  ) {
    brandContext = `
USER BRAND CONTEXT (use this to make content sound authentically like this creator, not generic AI):
- Content pillars: ${pillars || "not specified"}
- Typical topics: ${topics || "not specified"}
- Detected writing tone: ${tone_detected || "not specified"}
- Target audience: ${audience || "not specified"}
- Voice preference: ${voice || "not specified"}
${voiceSamples ? `- Voice samples (imite ritmo e estrutura, NÃO copie literalmente):\n${voiceSamples}\n` : ""}${voiceDnaBlock}${tabus ? `- NEVER use these words or phrases: ${tabus}\n` : ""}${contentRules ? `- Rules to follow strictly: ${contentRules}\n` : ""}`;
  }

  // Memoria aprendida com feedback pos-download (text_rules são imperativas).
  let feedbackContext = "";
  const memory = ba.__generation_memory as
    | { text_rules?: unknown }
    | undefined;
  const textRules = Array.isArray(memory?.text_rules)
    ? (memory.text_rules as unknown[])
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .slice(0, 20)
    : [];
  if (textRules.length > 0) {
    feedbackContext = `Regras vindas de feedback passado (PESO ALTO, respeitar sempre):\n${textRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
  }

  return { brandContext, feedbackContext };
}
