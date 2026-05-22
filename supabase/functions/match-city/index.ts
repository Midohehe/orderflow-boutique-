// Matches a customer-entered city/address to canonical shipping zones.
// Strategy: build the full (city|area) candidate list from defaults + the user's
// corrections, then ALWAYS consult two AI models (Gemini 2.5 Pro + GPT-5-mini)
// in parallel via structured tool calling. Local fuzzy matching is used only to
// pre-rank candidates and as a final fallback when both AIs fail. The result is
// validated against the master list so we never return a (city,area) pair that
// doesn't exist together.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { defaultCityAreas } from "../_shared/defaultCityAreas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const norm = (s: string) => {
  let t = (s || "").toString().trim();
  t = t.replace(/[\u064B-\u0652\u0670]/g, "");
  t = t.replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
  t = t.replace(/\s+/g, " ").toLowerCase();
  t = t.replace(/^ال/, "");
  return t.trim();
};
const tokens = (s: string) => norm(s).split(/[\s,،\-\/]+/).filter(Boolean);

interface Z { external_id: number; parent_external_id: number | null; name: string; kind: string; }
interface Pair { city: string; area: string; }

// Service-type "areas" that carriers add as logistics options (not real
// geographic places). Examples: "توصيل نسائي", "VIP", "اكسبرس". These should
// NEVER be auto-selected unless the customer's own text explicitly contains
// the same keyword (e.g. the customer asked for ladies-only delivery).
const SERVICE_KEYWORDS = [
  "نسائي",
  "توصيل نسائي",
  "vip",
  "في اي بي",
  "express",
  "اكسبرس",
  "اكسبريس",
  "سريع",
  "خاص",
  "شركات",
  "مكتب",
];
function areaServiceKeywords(areaName: string): string[] {
  const a = norm(areaName);
  return SERVICE_KEYWORDS.filter((k) => a.includes(norm(k)));
}
function isServiceArea(areaName: string): boolean {
  return areaServiceKeywords(areaName).length > 0;
}
function inputAllowsServiceArea(inputNorm: string, areaName: string): boolean {
  const kws = areaServiceKeywords(areaName);
  if (kws.length === 0) return true;
  // every service keyword in the area's name must be present in the input
  return kws.every((k) => inputNorm.includes(norm(k)));
}

// Validate that an area name has REAL evidence in the customer's input.
// Used to reject low-quality fuzzy picks like "الصين" appearing in طرابلس
// when the customer never mentioned it. Returns true if any meaningful token
// of the area name actually appears (as a token / substring / ≤1 edit) in
// the input, OR if the area equals the city (placeholder row).
function areaHasInputEvidence(areaName: string, cityName: string, inputNorm: string, inputToks: string[]): boolean {
  const aN = norm(areaName);
  const cN = norm(cityName);
  if (!aN || aN === cN) return true; // city==area placeholder
  // STRICT rule for short area names (≤ 4 chars after normalization, e.g. "صين"):
  // require an EXACT token match in the input. Short names produce too many
  // false positives via fuzzy/substring matching.
  if (aN.length <= 4) {
    return inputToks.includes(aN);
  }
  // Split into significant words (skip very short ones like "ال", "بن").
  const words = aN.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return true;
  for (const w of words) {
    if (inputNorm.includes(w)) return true;
    if (inputToks.includes(w)) return true;
    if (w.length >= 5) {
      // tolerate 1 edit for longer words only
      for (const t of inputToks) {
        if (Math.abs(t.length - w.length) <= 1 && lev(t, w) <= 1) return true;
      }
    }
  }
  return false;
}

// Find the best area inside a given city by fuzzy matching every token of the
// customer input against every area name. Uses combinedScore (Lev + similar_text)
// and also rewards substring/prefix overlap so partial words like "بوعط" match
// "بوعطني" or "بوهديمة" by closest similarity.
function findBestAreaInCity(
  list: Pair[],
  cityName: string,
  inputTokens: string[],
): { area: string; score: number } | null {
  const areas = list.filter((r) => r.city === cityName).map((r) => r.area);
  const cityNorm = norm(cityName);
  let best: { area: string; score: number } | null = null;
  for (const a of areas) {
    const aN = norm(a);
    if (!aN || aN === cityNorm) continue;
    let topScore = 0;
    for (const tk of inputTokens) {
      if (!tk || tk === cityNorm || tk.length < 3) continue;
      let s = combinedScore(tk, aN);
      // Bonus when token is a prefix/substring of area or vice-versa.
      if (aN.startsWith(tk) || tk.startsWith(aN)) s = Math.max(s, 0.85);
      else if (aN.includes(tk) || tk.includes(aN)) s = Math.max(s, 0.8);
      if (s > topScore) topScore = s;
    }
    if (topScore > 0 && (!best || topScore > best.score)) {
      best = { area: a, score: topScore };
    }
  }
  return best;
}

// STRONG signal: find an area whose normalized name appears as an exact token
// (or near-exact, ≤1 edit) inside the customer's input. Example: input
// "الرياضية، طرابلس" → area "الرياضية" under "طرابلس". This is way more reliable
// than fuzzy partial overlap because it requires a full word boundary match.
function findExactTokenArea(
  list: Pair[],
  inputTokens: string[],
): { pair: Pair; score: number } | null {
  if (inputTokens.length === 0) return null;
  const tokSet = new Set(inputTokens.filter((t) => t && t.length >= 3));
  let best: { pair: Pair; score: number } | null = null;
  for (const r of list) {
    const aN = norm(r.area);
    const cN = norm(r.city);
    if (!aN || aN === cN) continue; // skip city==area placeholder rows
    let score = 0;
    if (tokSet.has(aN)) score = 1;
    else if (aN.length >= 4) {
      // multi-word area name: all words present as tokens
      const aWords = aN.split(/\s+/).filter(Boolean);
      if (aWords.length > 1 && aWords.every((w) => tokSet.has(w))) score = 0.95;
      else {
        // tolerate 1 edit for areas length ≥ 5
        for (const t of tokSet) {
          if (Math.abs(t.length - aN.length) <= 1 && lev(t, aN) <= 1) { score = 0.9; break; }
        }
      }
    }
    if (score > 0) {
      // small bonus if the city is also mentioned in input tokens
      if (cN && tokSet.has(cN)) score += 0.2;
      if (!best || score > best.score) best = { pair: r, score };
    }
  }
  return best;
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// PHP-like similar_text: returns the number of matching characters via
// longest common substring recursion. Used to compute a similarity percent.
function similarText(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let max = 0, posA = 0, posB = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > max) { max = k; posA = i; posB = j; }
    }
  }
  if (max === 0) return 0;
  let sum = max;
  if (posA > 0 && posB > 0) sum += similarText(a.slice(0, posA), b.slice(0, posB));
  if (posA + max < a.length && posB + max < b.length) {
    sum += similarText(a.slice(posA + max), b.slice(posB + max));
  }
  return sum;
}

// Combined similarity score in [0,1] — average of normalized Levenshtein and
// PHP-style similar_text percent. Mirrors the user's PHP findBestCity logic.
function combinedScore(a: string, b: string): number {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const maxLen = Math.max(A.length, B.length);
  const levScore = 1 - lev(A, B) / maxLen;
  const sim = similarText(A, B);
  const simScore = (sim * 2) / (A.length + B.length);
  return levScore * 0.5 + simScore * 0.5;
}

// Pick the best matching city name from a list using combinedScore.
function findBestCity(input: string, cities: string[]): { city: string; score: number } | null {
  if (!input) return null;
  let best: { city: string; score: number } | null = null;
  for (const c of cities) {
    const s = combinedScore(input, c);
    if (!best || s > best.score) best = { city: c, score: s };
  }
  return best;
}

function fuzzyContains(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  if (haystack.includes(needle)) return true;
  if (needle.length < 4) return false;
  const win = needle.length;
  const tol = needle.length >= 6 ? 2 : 1;
  for (let i = 0; i <= haystack.length - win + tol; i++) {
    const sub1 = haystack.slice(i, i + win + 1);
    if (lev(sub1, needle) <= tol) return true;
    const sub2 = haystack.slice(i, i + win);
    if (lev(sub2, needle) <= tol) return true;
  }
  return false;
}

// Score every (city|area) pair against the customer input. Returns a sorted list.
function scoreCandidates(list: Pair[], city: string, address: string) {
  const qCity = norm(city || "");
  const qAddr = norm(address || "");
  const qAll = (qCity + " " + qAddr).trim();

  const scored: Array<{ row: Pair; score: number }> = [];
  for (const r of list) {
    const a = norm(r.area);
    const c = norm(r.city);
    const sameAsCity = a === c;
    let score = 0;
    if (a) {
      if (a === qAddr) score = Math.max(score, 1000 + a.length);
      else if (a === qCity) score = Math.max(score, sameAsCity ? 200 + a.length : 900 + a.length);
      else if (fuzzyContains(qAddr, a)) score = Math.max(score, 700 + a.length);
      else if (fuzzyContains(qAll, a)) score = Math.max(score, 500 + a.length);
    }
    if (c) {
      if (c === qCity) score = Math.max(score, sameAsCity ? 200 : 300);
      else if (fuzzyContains(qAll, c)) score = Math.max(score, sameAsCity ? 150 : 250);
    }
    if (score > 0) scored.push({ row: r, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

const AI_TOOL = {
  type: "function",
  function: {
    name: "pick_city_area",
    description: "اختر زوج المدينة/المنطقة الأنسب من القائمة المتاحة.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "اسم المدينة بالضبط كما في القائمة، أو NONE." },
        area: { type: "string", description: "اسم المنطقة بالضبط كما في القائمة، أو NONE." },
        confidence: { type: "number", description: "ثقة من 0 إلى 1." },
        reasoning: { type: "string", description: "شرح موجز جدًا (سطر واحد)." },
      },
      required: ["city", "area", "confidence"],
      additionalProperties: false,
    },
  },
};

// Verification tool: ask a stronger model to pick the BEST of a short list of
// already-ranked candidates (or reject all of them). This is the second-pass
// "judge" that catches cases where the first-pass picks an area that happens
// to fuzzy-match but is geographically/contextually wrong.
const VERIFY_TOOL = {
  type: "function",
  function: {
    name: "verify_best_candidate",
    description: "اختر أفضل مرشح صحيح من القائمة المختصرة، أو ارفضها جميعًا.",
    parameters: {
      type: "object",
      properties: {
        index: { type: "integer", description: "رقم المرشح الأفضل (يبدأ من 1)، أو 0 لرفض الجميع." },
        confidence: { type: "number", description: "ثقة من 0 إلى 1." },
        reasoning: { type: "string", description: "شرح موجز جدًا (سطر واحد)." },
      },
      required: ["index", "confidence"],
      additionalProperties: false,
    },
  },
};

function buildPrompt(list: Pair[], city: string, address: string): string {
  // Group pairs by city for compactness.
  const byCity: Record<string, string[]> = {};
  for (const r of list) {
    (byCity[r.city] ||= []).push(r.area);
  }
  const catalog = Object.entries(byCity)
    .map(([c, areas]) => `${c}: ${[...new Set(areas)].join("، ")}`)
    .join("\n");

  return `أنت خبير بجغرافيا ليبيا وأحياء مدنها وأسمائها الشعبية.
لديك قائمة شركة الشحن (مدينة → مناطق متاحة):

${catalog}

مدخل العميل:
- مدينة: "${city || ""}"
- عنوان: "${address || ""}"

قواعد صارمة:
1) يجب أن تختار زوجًا (مدينة|منطقة) موجودًا حرفيًا في القائمة أعلاه.
2) إذا كتب العميل اسم حي شعبي (مثل "خلة الفرناج" أو "الخلة" قرب طرابلس) اربطه بأقرب منطقة في نفس المدينة (الفرناج في طرابلس).
3) "غوط الشغال" = "غوط الشعال" في طرابلس.
4) إن لم يكن اسم المدينة واضحًا في المدخل، استنتجها من اسم الحي/المنطقة (مثلًا "تاجوراء" → طرابلس).
5) إذا تعذّر الاستنتاج بثقة، أعد city="NONE" area="NONE".
استدعِ الأداة pick_city_area فقط.`;
}

// Build a tight verification prompt that shows ONLY the top candidates and
// asks a stronger model to pick the single best one (or reject all).
function buildVerifyPrompt(
  candidates: Array<{ pair: Pair; weight: number; src: string }>,
  city: string,
  address: string,
): string {
  const lines = candidates
    .map((c, i) => `${i + 1}) المدينة: "${c.pair.city}" — المنطقة: "${c.pair.area}"`)
    .join("\n");
  return `أنت مدقّق خبير بجغرافيا ليبيا وأحياء مدنها.
مدخل العميل:
- مدينة: "${city || ""}"
- عنوان: "${address || ""}"

لدينا المرشحون التالون (مرتّبون مبدئيًا):
${lines}

المطلوب: اختر رقم المرشّح الأنسب جغرافيًا ومنطقيًا لمدخل العميل.
قواعد:
- لا تخترع مرشحًا غير موجود في القائمة.
- لا تختر منطقة لم تُذكر بأي شكل في مدخل العميل ولا يمكن استنتاجها منطقيًا منه.
- إذا كان مدخل العميل لا يطابق أي مرشح فعليًا (مثلًا يذكر حيًا غير موجود ضمنهم)، أعد index=0.
- لو كان المدخل عامًا (مدينة فقط بدون حي)، فضّل المرشح الذي تكون فيه المنطقة = المدينة نفسها.
استدعِ الأداة verify_best_candidate فقط.`;
}

async function verifyWithModel(
  model: string,
  candidates: Array<{ pair: Pair; weight: number; src: string }>,
  city: string,
  address: string,
  apiKey: string,
  timeoutMs = 10000,
): Promise<{ index: number; confidence: number } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: buildVerifyPrompt(candidates, city, address) }],
        tools: [VERIFY_TOOL],
        tool_choice: { type: "function", function: { name: "verify_best_candidate" } },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error("verify AI", model, "status", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = await res.json();
    const call = j?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = call?.function?.arguments;
    if (!argsStr) return null;
    const args = typeof argsStr === "string" ? JSON.parse(argsStr) : argsStr;
    const idx = Number(args.index);
    if (!Number.isFinite(idx)) return null;
    return { index: idx, confidence: Number(args.confidence) || 0 };
  } catch (e) {
    console.error("verify AI", model, "error", (e as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function askModel(model: string, prompt: string, apiKey: string, timeoutMs = 12000): Promise<{ city: string; area: string; confidence: number } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        tools: [AI_TOOL],
        tool_choice: { type: "function", function: { name: "pick_city_area" } },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error("AI", model, "status", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = await res.json();
    const call = j?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = call?.function?.arguments;
    if (!argsStr) return null;
    const args = typeof argsStr === "string" ? JSON.parse(argsStr) : argsStr;
    return {
      city: String(args.city || "").trim(),
      area: String(args.area || "").trim(),
      confidence: Number(args.confidence) || 0,
    };
  } catch (e) {
    console.error("AI", model, "error", (e as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

function findPair(list: Pair[], city: string, area: string): Pair | undefined {
  if (!city || !area || city.toUpperCase() === "NONE" || area.toUpperCase() === "NONE") return undefined;
  let pick = list.find((r) => r.city === city && r.area === area);
  if (pick) return pick;
  pick = list.find((r) => norm(r.city) === norm(city) && norm(r.area) === norm(area));
  if (pick) return pick;
  // city matches but area mismatch → try area within that city
  pick = list.find((r) => norm(r.city) === norm(city) && fuzzyContains(norm(r.area), norm(area)));
  return pick;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { city, address, owner_id } = await req.json() as { city?: string; address?: string; owner_id?: string };
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build full (city|area) candidate list from defaults (minus hidden) + corrections.
    // Hidden defaults & corrections are managed globally by superadmin.
    let hidden = new Set<string>();
    {
      const { data: hiddenRows } = await admin
        .from("hidden_default_cities")
        .select("city,area");
      hidden = new Set((hiddenRows || []).map((r: any) => `${r.city}||${r.area}`));
    }
    const list: Pair[] = [];
    for (const [c, areas] of Object.entries(defaultCityAreas)) {
      for (const a of areas) {
        if (!hidden.has(`${c}||${a}`)) list.push({ city: c, area: a });
      }
    }
    // Merge the carrier's LIVE shipping_zones cache so areas the carrier
    // actually supports (e.g. "الرياضية" under "طرابلس") become first-class
    // candidates — not just a last-resort fallback.
    {
      const { data: liveZones } = await admin
        .from("shipping_zones")
        .select("external_id,parent_external_id,name,kind");
      const zall = (liveZones || []) as Z[];
      const zoneRows = zall.filter((x) => x.kind === "zone");
      const areaRows = zall.filter((x) => x.kind === "area");
      const seen = new Set(list.map((r) => `${norm(r.city)}||${norm(r.area)}`));
      for (const z of zoneRows) {
        const zAreas = areaRows.filter((a) => a.parent_external_id === z.external_id);
        const rows = zAreas.length === 0
          ? [{ city: z.name, area: z.name }]
          : zAreas.map((a) => ({ city: z.name, area: a.name }));
        for (const r of rows) {
          const key = `${norm(r.city)}||${norm(r.area)}`;
          if (!seen.has(key) && !hidden.has(`${r.city}||${r.area}`)) {
            list.push(r);
            seen.add(key);
          }
        }
      }
    }
    let overrides: Array<{ city: string; area: string; input_text: string | null }> = [];
    {
      const { data: corrections } = await admin
        .from("city_corrections")
        .select("city,area,input_text");
      for (const r of (corrections || []) as Array<{ city: string; area: string; input_text: string | null }>) {
        list.push({ city: r.city, area: r.area });
        overrides.push(r);
      }
    }

    // Hard override: if the user previously corrected the same input text, use it directly.
    const inputKey = norm((city || "") + " " + (address || ""));
    if (overrides.length > 0 && inputKey) {
      const exact = overrides.find((o) => o.input_text && norm(o.input_text) === inputKey);
      if (exact) {
        return new Response(JSON.stringify({
          zone_id: null, area_id: null,
          zone_name: exact.city, area_name: exact.area,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (list.length > 0) {
      // Local pre-ranking (used as evidence for AI + final fallback).
      const scored = scoreCandidates(list, city || "", address || "");
      const topLocal = scored[0];

      // FAST PATH: if local matching is already very confident (exact area-level
      // hit), return immediately and skip the AI round-trip entirely.
      if (topLocal && topLocal.score >= 1000) {
        return new Response(JSON.stringify({
          zone_id: null, area_id: null,
          zone_name: topLocal.row.city, area_name: topLocal.row.area,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Otherwise consult fast AI models in parallel (shorter timeout).
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      const prompt = buildPrompt(list, city || "", address || "");
      let geminiPick: { city: string; area: string; confidence: number } | null = null;
      let gptPick: { city: string; area: string; confidence: number } | null = null;
      if (apiKey) {
        const [a, b] = await Promise.all([
          askModel("google/gemini-3-flash-preview", prompt, apiKey, 6000),
          askModel("openai/gpt-5-nano", prompt, apiKey, 6000),
        ]);
        geminiPick = a;
        gptPick = b;
      }

      const candidates: Array<{ pair: Pair; weight: number; src: string }> = [];
      const push = (p: Pair | undefined, weight: number, src: string) => {
        if (!p) return;
        const existing = candidates.find((x) => x.pair.city === p.city && x.pair.area === p.area);
        if (existing) existing.weight += weight;
        else candidates.push({ pair: p, weight, src });
      };

      if (geminiPick) {
        const p = findPair(list, geminiPick.city, geminiPick.area);
        push(p, 2 + geminiPick.confidence, "gemini");
      }
      if (gptPick) {
        const p = findPair(list, gptPick.city, gptPick.area);
        push(p, 2 + gptPick.confidence, "gpt");
      }
      // Local hint: only contributes weight if it's a strong area-level match.
      if (topLocal && topLocal.score >= 700) {
        push(topLocal.row, 1.5, "local-strong");
      } else if (topLocal && topLocal.score >= 300) {
        push(topLocal.row, 0.5, "local-weak");
      }

      // Extra signal: PHP-style findBestCity (Levenshtein + similar_text) over
      // unique city names — catches typos like "ترابلس" → "طرابلس".
      const uniqueCities = [...new Set(list.map((r) => r.city))];
      const bestCityByText = findBestCity(((city || "") + " " + (address || "")).trim(), uniqueCities);
      if (bestCityByText && bestCityByText.score >= 0.7) {
        const sameCity = list.filter((r) => r.city === bestCityByText.city);
        let bestArea: Pair | undefined;
        let bestAreaScore = 0;
        for (const r of sameCity) {
          const s = combinedScore(address || city || "", r.area);
          if (s > bestAreaScore) { bestAreaScore = s; bestArea = r; }
        }
        if (bestArea) push(bestArea, 1 + bestCityByText.score, "best-city");
      }

      // NEW: For each "candidate city" (top local match + best-by-text + exact
      // city tokens in input), find the closest area inside it by token-level
      // fuzzy matching. Lets "بنغازي بوعطني" map to the closest Benghazi area.
      const candidateCities = new Set<string>();
      if (topLocal) candidateCities.add(topLocal.row.city);
      if (bestCityByText && bestCityByText.score >= 0.6) candidateCities.add(bestCityByText.city);
      const inputToks = [...tokens(city || ""), ...tokens(address || "")];
      for (const uc of uniqueCities) {
        const ucN = norm(uc);
        if (inputToks.some((t) => t === ucN || (ucN.length >= 4 && (t.includes(ucN) || ucN.includes(t) && t.length >= 4)))) {
          candidateCities.add(uc);
        }
      }
      for (const cc of candidateCities) {
        const ba = findBestAreaInCity(list, cc, inputToks);
        if (ba && ba.score >= 0.6) {
          const pair = list.find((r) => r.city === cc && r.area === ba.area);
          if (pair) push(pair, 1.5 + ba.score, "fuzzy-area");
        }
      }

      // STRONGEST local signal: an area whose name appears as an exact token in
      // the input. Weighted higher than the AI picks so the carrier's own area
      // names always win over geographic guesses.
      const exactArea = findExactTokenArea(list, inputToks);
      if (exactArea) {
        push(exactArea.pair, 4 + exactArea.score, "exact-token-area");
      }

      candidates.sort((a, b) => b.weight - a.weight);
      console.log("match-city candidates", { city, address, candidates: candidates.slice(0, 5).map((c) => ({ ...c.pair, w: c.weight, s: c.src })) });

      // GUARD: drop candidates that are service areas (e.g. "توصيل نسائي")
      // unless the customer's input actually contains those service keywords.
      // Also drop candidates with no real textual evidence in the input
      // (prevents fuzzy noise like "الصين" sneaking into طرابلس).
      const inputNormAll = norm((city || "") + " " + (address || ""));
      const filtered = candidates.filter((c) => {
        if (!inputAllowsServiceArea(inputNormAll, c.pair.area)) {
          console.log("match-city dropped (service area without keyword)", c.pair);
          return false;
        }
        if (!areaHasInputEvidence(c.pair.area, c.pair.city, inputNormAll, inputToks)) {
          console.log("match-city dropped (no input evidence)", c.pair, "w=", c.weight);
          return false;
        }
        return true;
      });

      let final: Pair | undefined = filtered[0]?.pair;

      // ============ EXTRA VERIFICATION LAYER ============
      // Two strong models judge the top-3 filtered candidates. We require
      // consensus (both agree on same candidate) OR very high single-model
      // confidence to override the first-pass pick. If they unanimously
      // reject all top candidates (index=0), we drop to the city-only row.
      const topForVerify = filtered.slice(0, 3);
      if (apiKey && topForVerify.length >= 2) {
        const [v1, v2] = await Promise.all([
          verifyWithModel("google/gemini-2.5-pro", topForVerify, city || "", address || "", apiKey, 10000),
          verifyWithModel("openai/gpt-5-mini", topForVerify, city || "", address || "", apiKey, 10000),
        ]);
        const valid = (v: { index: number; confidence: number } | null) =>
          v && Number.isInteger(v.index) && v.index >= 0 && v.index <= topForVerify.length;
        const ok1 = valid(v1) ? v1! : null;
        const ok2 = valid(v2) ? v2! : null;
        console.log("match-city verify votes", { v1: ok1, v2: ok2, topForVerify: topForVerify.map((c) => c.pair) });

        // Both reject → fall back to city-only row of the top filtered candidate.
        if (ok1?.index === 0 && ok2?.index === 0) {
          const topCityName = topForVerify[0]?.pair.city;
          if (topCityName) {
            const cityOnly = list.find((r) => r.city === topCityName && norm(r.city) === norm(r.area));
            if (cityOnly) {
              console.log("match-city verify: both rejected, using city-only", cityOnly);
              final = cityOnly;
            }
          }
        } else if (ok1 && ok2 && ok1.index > 0 && ok1.index === ok2.index) {
          // Consensus on a specific candidate.
          final = topForVerify[ok1.index - 1].pair;
          console.log("match-city verify consensus", final);
        } else {
          // No consensus: prefer the verifier with highest confidence ≥ 0.75.
          const best = [ok1, ok2]
            .filter((v): v is { index: number; confidence: number } => !!v && v.index > 0)
            .sort((a, b) => b.confidence - a.confidence)[0];
          if (best && best.confidence >= 0.75) {
            final = topForVerify[best.index - 1].pair;
            console.log("match-city verify single-high-conf", final, "conf=", best.confidence);
          }
        }
      }
      // ===================================================

      // Final fallback: weak local hit if AIs gave nothing usable — but still
      // respect the service-area guard.
      if (!final && topLocal && inputAllowsServiceArea(inputNormAll, topLocal.row.area)) {
        final = topLocal.row;
      }

      // If we filtered everything out but we DID identify a city confidently,
      // fall back to the city-only row (city==area) so we don't return junk.
      if (!final) {
        const cityOnly = candidates.find((c) =>
          norm(c.pair.city) === norm(c.pair.area) &&
          inputAllowsServiceArea(inputNormAll, c.pair.area)
        );
        if (cityOnly) final = cityOnly.pair;
      }

      if (final) {
        return new Response(JSON.stringify({
          zone_id: null, area_id: null,
          zone_name: final.city, area_name: final.area,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ===== Fallback: query the live shipping_zones cache (Turbo Express) =====
    const { data: all } = await admin.from("shipping_zones").select("external_id,parent_external_id,name,kind");
    const zlist = (all || []) as Z[];
    if (zlist.length === 0) {
      return new Response(JSON.stringify({ error: "no zones cached" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const zones = zlist.filter((x) => x.kind === "zone");
    const areas = zlist.filter((x) => x.kind === "area");

    // Build pair list from live zones for AI.
    const pairList: Pair[] = [];
    for (const z of zones) {
      const zAreas = areas.filter((a) => a.parent_external_id === z.external_id);
      if (zAreas.length === 0) pairList.push({ city: z.name, area: z.name });
      for (const a of zAreas) pairList.push({ city: z.name, area: a.name });
    }

    let zone: Z | undefined;
    let area: Z | undefined;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey && pairList.length > 0) {
      const prompt = buildPrompt(pairList, city || "", address || "");
      const [a, b] = await Promise.all([
        askModel("google/gemini-3-flash-preview", prompt, apiKey, 6000),
        askModel("openai/gpt-5-nano", prompt, apiKey, 6000),
      ]);
      const picks = [a, b].filter(Boolean) as Array<{ city: string; area: string; confidence: number }>;
      // Pick by majority then highest confidence
      let chosen: Pair | undefined;
      if (picks.length === 2 && picks[0].city === picks[1].city && picks[0].area === picks[1].area) {
        chosen = findPair(pairList, picks[0].city, picks[0].area);
      } else {
        picks.sort((x, y) => y.confidence - x.confidence);
        for (const p of picks) {
          const f = findPair(pairList, p.city, p.area);
          if (f) { chosen = f; break; }
        }
      }
      if (chosen) {
        zone = zones.find((z) => z.name === chosen!.city);
        area = areas.find((ar) => ar.name === chosen!.area && ar.parent_external_id === zone?.external_id);
      }
    }

    return new Response(JSON.stringify({
      zone_id: zone?.external_id ?? null,
      zone_name: zone?.name ?? null,
      area_id: area?.external_id ?? null,
      area_name: area?.name ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
