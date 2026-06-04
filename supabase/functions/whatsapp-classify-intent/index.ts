// Classifies a customer's WhatsApp reply intent (confirm / cancel / other)
// using an OpenAI-compatible API. Used by mazbot-poll when literal keyword matching fails.
import { chatCompletions, getAiConfig, getAiModel } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, prompt_context } = await req.json();
    const message = String(text || "").trim();
    if (!message) {
      return new Response(JSON.stringify({ intent: "other" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { apiKey } = getAiConfig();
    if (!apiKey) {
      return new Response(JSON.stringify({ intent: "other", reason: "no_api_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `أنت مصنّف نوايا. ستحصل على رسالة وصلت من زبون رداً على رسالة طلب تأكيد لطلب شراء.
صنّف الرسالة كواحدة من:
- confirm: الزبون يؤكد الطلب ويريد المتابعة (مثال: "نعم"، "أكيد"، "تمام"، "خلاص"، "موافق"، "ايوا"، "ابعث"، "نبيها"، "اوكي").
- cancel: الزبون يلغي أو لا يريد (مثال: "لا"، "ما نبيش"، "بدلت رايي"، "الغي"، "مش رايد"، "no").
- other: غير ذلك (سؤال، تعليق، رسالة غير ذات صلة).

استخدم الأداة classify_intent دائماً.`;

    const aiRes = await chatCompletions({
      model: getAiModel("google/gemini-2.5-flash-lite"),
      temperature: 0,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `سياق آخر رسالة تأكيد:\n${String(prompt_context || "(لا يوجد)")}\n\nرد الزبون:\n${message}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "classify_intent",
          description: "صنّف نية الزبون",
          parameters: {
            type: "object",
            properties: {
              intent: { type: "string", enum: ["confirm", "cancel", "other"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["intent"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify_intent" } },
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("classify ai error", aiRes.status, t);
      return new Response(JSON.stringify({ intent: "other", reason: `ai_${aiRes.status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await aiRes.json();
    const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
    let args: any = {};
    try { args = JSON.parse(tc?.function?.arguments || "{}"); } catch {}
    const intent = ["confirm", "cancel", "other"].includes(args?.intent) ? args.intent : "other";
    const conf = typeof args?.confidence === "number" ? args.confidence : null;
    return new Response(JSON.stringify({ intent, confidence: conf }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-intent error", e);
    return new Response(JSON.stringify({ intent: "other", error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
