export const maxDuration = 60;

import { getAuthenticatedUser } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

interface RecentPost {
  text: string;
  likes: number;
  comments: number;
}

interface BrandAnalysisRequest {
  bio: string | null;
  recentPosts: RecentPost[];
  handle: string;
  platform: string;
  followers?: number | null;
}

interface BrandAnalysisResponse {
  detected_niche: string[];
  tone_detected: string;
  top_topics: string[];
  posting_frequency: string;
  avg_engagement: { likes: number; comments: number };
  suggested_pillars: string[];
  suggested_audience: string;
}

function buildFallbackAnalysis(req: BrandAnalysisRequest): BrandAnalysisResponse {
  const posts = req.recentPosts || [];
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
  const count = posts.length || 1;

  return {
    detected_niche: [],
    tone_detected: "casual",
    top_topics: [],
    posting_frequency: posts.length >= 5 ? "~3-5x/semana" : "desconhecida",
    avg_engagement: {
      likes: Math.round(totalLikes / count),
      comments: Math.round(totalComments / count),
    },
    suggested_pillars: [],
    suggested_audience: "",
  };
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "brand-analysis", user.id),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const body: BrandAnalysisRequest = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Return fallback analysis without AI
      return Response.json(buildFallbackAnalysis(body));
    }

    const postsText = (body.recentPosts || [])
      .map((p, i) => `Post ${i + 1}: "${p.text}" (${p.likes} likes, ${p.comments} comments)`)
      .join("\n");

    const systemPrompt = `You are a social media brand analyst. Analyze the user's profile and recent posts to produce a brand intelligence report. Be specific and actionable.

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "detected_niche": ["niche1", "niche2"],
  "tone_detected": "casual" | "professional" | "provocative" | "educational",
  "top_topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "posting_frequency": "estimated posts per week, e.g. ~3-5x/semana",
  "avg_engagement": { "likes": 123, "comments": 45 },
  "suggested_pillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
  "suggested_audience": "Brief description of their likely audience in Portuguese"
}

Rules:
- detected_niche: 1-3 niches inferred from bio + post content
- tone_detected: analyze writing style across posts (formal vs informal, bold vs reserved)
- top_topics: 3-7 recurring themes from posts (be specific, not generic)
- posting_frequency: estimate from the data available
- avg_engagement: calculate average likes and comments across posts
- suggested_pillars: 3 content pillars they could focus on based on their content
- suggested_audience: who would follow this person, in Portuguese
- ALL text values in Portuguese (pt-BR) except field names`;

    const userMessage = `Profile: @${body.handle} on ${body.platform}
${body.followers ? `Followers: ${body.followers}` : ""}
Bio: ${body.bio || "(no bio)"}

Recent posts:
${postsText || "(no posts available)"}`;

    const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      console.error("[brand-analysis] Claude API error:", response.status);
      return Response.json(buildFallbackAnalysis(body));
    }

    const data = await response.json();
    const textBlock = data.content?.find(
      (block: { type: string }) => block.type === "text"
    );

    if (!textBlock?.text) {
      return Response.json(buildFallbackAnalysis(body));
    }

    let result: BrandAnalysisResponse;
    try {
      result = JSON.parse(textBlock.text);
    } catch {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        return Response.json(buildFallbackAnalysis(body));
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error("[brand-analysis] Unexpected error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
