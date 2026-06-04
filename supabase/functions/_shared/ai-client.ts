/** OpenAI-compatible chat completions client (OpenAI, OpenRouter, etc.). */

export function getAiConfig(): { apiKey: string | undefined; baseUrl: string } {
  const apiKey =
    Deno.env.get("AI_API_KEY") ||
    Deno.env.get("OPENAI_API_KEY") ||
    undefined;
  const baseUrl = (
    Deno.env.get("AI_API_BASE_URL") || "https://openrouter.ai/api/v1"
  ).replace(/\/$/, "");
  return { apiKey, baseUrl };
}

export function getAiModel(fallback: string): string {
  return Deno.env.get("AI_MODEL") || fallback;
}

export async function chatCompletions(
  body: Record<string, unknown>,
  init?: RequestInit,
): Promise<Response> {
  const { apiKey, baseUrl } = getAiConfig();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI_API_KEY not configured" }), {
      status: 503,
    });
  }
  return fetch(`${baseUrl}/chat/completions`, {
    ...init,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
    body: JSON.stringify(body),
  });
}
