/**
 * Debug endpoint — checks all critical services.
 * Access: GET /api/debug (no auth required)
 * Remove in production after debugging.
 */
export async function GET() {
  const checks: Record<string, string> = {};

  // 1. Supabase URL
  checks.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING";
  checks.SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING";
  checks.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING";

  // 2. Gemini
  checks.GEMINI_API_KEY = process.env.GEMINI_API_KEY ? "SET" : "MISSING";

  // 3. Anthropic
  checks.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ? "SET" : "MISSING";

  // 4. Other keys
  checks.SERPER_API_KEY = process.env.SERPER_API_KEY ? "SET" : "MISSING";
  checks.APIFY_API_KEY = process.env.APIFY_API_KEY ? "SET" : "MISSING";
  checks.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ? "SET" : "MISSING";

  // 5. Test Supabase connection
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (url && key) {
      const sb = createClient(url, key);
      const { error } = await sb.from("profiles").select("id").limit(1);
      checks.SUPABASE_CONNECTION = error ? `ERROR: ${error.message}` : "OK";
    } else {
      checks.SUPABASE_CONNECTION = "SKIPPED (missing env vars)";
    }
  } catch (e) {
    checks.SUPABASE_CONNECTION = `ERROR: ${e instanceof Error ? e.message : "unknown"}`;
  }

  // 6. Test Gemini
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      const ai = new GoogleGenAI({ apiKey: key });
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Say OK",
        config: { maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } },
      });
      checks.GEMINI_CONNECTION = result.text ? "OK" : "NO RESPONSE";
    } else {
      checks.GEMINI_CONNECTION = "SKIPPED (missing key)";
    }
  } catch (e) {
    checks.GEMINI_CONNECTION = `ERROR: ${e instanceof Error ? e.message : "unknown"}`;
  }

  // 7. Test URL extraction
  try {
    const { extractContentFromUrl } = await import("@/lib/url-extractor");
    const content = await extractContentFromUrl("https://example.com");
    checks.URL_EXTRACTION = content.length > 0 ? `OK (${content.length} chars)` : "EMPTY";
  } catch (e) {
    checks.URL_EXTRACTION = `ERROR: ${e instanceof Error ? e.message : "unknown"}`;
  }

  return Response.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks,
  });
}
