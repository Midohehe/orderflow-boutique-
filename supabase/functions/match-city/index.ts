// Matches a customer-entered city/address to a canonical (city, area) pair
// from the shipping carrier. Two-step algorithm:
//   1) Identify the CITY from the customer's text (token / fuzzy / neighborhood
//      inference, then AI fallback).
//   2) Within that city, identify the AREA from the available areas only.
// This avoids global fuzzy soup that picks nonsense pairs like
// {city:"الصين", area:"بنغازي"} just because "بنغازي" exists as a sub-zone of
// a China-shipping service zone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { defaultCityAreas } from "../_shared/defaultCityAreas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Carrier zones that are NOT real Libyan delivery destinations.
const EXCLUDED_ZONE_NAMES = ["الصين", "china", "صين"];

// Service-area keywords: never auto-select unless customer's text contains them.
const SERVICE_KEYWORDS = ["نسائي", "vip", "في اي بي", "express", "اكسبرس", "اكسبريس", "سريع", "شركات", "مكتب"];

const norm = (s: string) => {
  let t = (s || "").toString().trim();
  t = t.replace(/[\u064B-\u0652\u0670]/g, "");
  t = t.replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
  t = t.replace(/\s+/g, " ").toLowerCase();
  t = t.replace(/^ال/, "");
  return t.trim();
};
const tokenize = (s: string) => norm(s).split(/[\s,،\-\/\.()]+/).filter(Boolean);

const isExcluded = (name: string) => {
  const n = norm(name);
  return EXCLUDED_ZONE_NAMES.some((ex) => n === norm(ex));
};
const isServiceArea = (name: string) => {
  const n = norm(name);
  return SERVICE_KEYWORDS.some((k) => n.includes(norm(k)));
};

interface Z { external_id: number; parent_external_id: number | null; name: string; kind: string; }

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

// Score how strongly `name` (a city or area) is referenced in the customer's
// `inputTokens` + raw normalized input. Returns 0..100.
function nameScore(name: string, inputTokens: string[], inputNorm: string): number {
  const n = norm(name);
  if (!n) return 0;
  // Skip pure-numeric or 1-char names.
  if (n.length < 2) return 0;
  const tokSet = new Set(inputTokens);

  // 1) Exact token match (whole-word) — strongest.
  if (tokSet.has(n)) return 100;
  // Multi-word name: all words present as tokens.
  if (n.includes(" ")) {
    const parts = n.split(/\s+/).filter((w) => w.length >= 2);
    if (parts.length >= 2 && parts.every((p) => tokSet.has(p))) return 95;
  }
  // 2) Substring match (only if name is reasonably long to avoid noise).
  if (n.length >= 4 && inputNorm.includes(n)) return 88;
  // 3) Fuzzy: levenshtein tolerance grows with length.
  const tol = n.length >= 7 ? 2 : n.length >= 5 ? 1 : 0;
  if (tol > 0) {
    for (const t of inputTokens) {
      if (t.length < 3) continue;
      if (Math.abs(t.length - n.length) <= tol && lev(t, n) <= tol) {
        return 80 - tol * 5; // 75 or 70
      }
    }
  }
  // 4) Substring of a long token (e.g. "بنغازى" inside "بنغازىا").
  if (n.length >= 5) {
    for (const t of inputTokens) {
      if (t.length >= n.length && t.includes(n)) return 70;
    }
  }
  return 0;
}

// ============= City + area catalog =============
interface CityCatalog {
  /** Canonical name (preferring carrier spelling if available) */
  canonical: string;
  /** Normalized form used for matching */
  norm: string;
  /** External zone_id if from carrier */
  zoneId: number | null;
  /** Alternate spellings (from defaults + carrier) */
  aliases: string[];
  /** Areas in this city: canonical area name + zoneAreaId if from carrier */
  areas: Array<{ canonical: string; norm: string; areaId: number | null }>;
}

async function buildCatalog(admin: ReturnType<typeof createClient>): Promise<CityCatalog[]> {
  // Carrier live zones
  const { data: zonesData } = await admin
    .from("shipping_zones")
    .select("external_id,parent_external_id,name,kind");
  const zall = (zonesData || []) as Z[];
  const carrierZones = zall.filter((z) => z.kind === "zone" && !isExcluded(z.name));
  const carrierAreas = zall.filter((z) => z.kind === "area");

  // Hidden defaults
  const { data: hiddenData } = await admin.from("hidden_default_cities").select("city,area");
  const hidden = new Set((hiddenData || []).map((r: any) => `${norm(r.city)}||${norm(r.area)}`));

  // Build map by normalized city name
  const map = new Map<string, CityCatalog>();

  // Seed from carrier zones (preferred canonical = carrier spelling)
  for (const z of carrierZones) {
    const key = norm(z.name);
    if (!key) continue;
    const subAreas = carrierAreas.filter((a) => a.parent_external_id === z.external_id);
    const areas = subAreas
      .filter((a) => !hidden.has(`${z.name}||${a.name}`))
      .map((a) => ({ canonical: a.name, norm: norm(a.name), areaId: a.external_id }));
    map.set(key, {
      canonical: z.name,
      norm: key,
      zoneId: z.external_id,
      aliases: [z.name],
      areas,
    });
  }

  // Merge defaults
  for (const [city, areas] of Object.entries(defaultCityAreas)) {
    const key = norm(city);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        canonical: city,
        norm: key,
        zoneId: null,
        aliases: [city],
        areas: [],
      });
    }
    const entry = map.get(key)!;
    if (!entry.aliases.includes(city)) entry.aliases.push(city);
    for (const a of areas) {
      if (hidden.has(`${city}||${a}`)) continue;
      const aN = norm(a);
      if (!entry.areas.some((x) => x.norm === aN)) {
        entry.areas.push({ canonical: a, norm: aN, areaId: null });
      }
    }
  }

  return Array.from(map.values());
}

// ============= Step 1: pick city =============
interface CityPick { city: CityCatalog; score: number; via: string; }

// Junk city values where the city FIELD shouldn't be trusted — the real city
// is usually inside the address field instead.
const CITY_FIELD_JUNK_RE = /^(خارج|داخل|من\s|عن\s)/;

function pickCity(
  catalog: CityCatalog[],
  cityTokens: string[],
  addrTokens: string[],
  cityNorm: string,
  addrNorm: string,
): CityPick | null {
  const cityFieldUntrustworthy = !cityNorm || CITY_FIELD_JUNK_RE.test(cityNorm);

  let best: CityPick | null = null;
  const consider = (city: CityCatalog, score: number, via: string) => {
    if (score <= 0) return;
    if (!best || score > best.score) best = { city, score, via };
  };

  // (a) Direct city-name match. Prefer ADDRESS over CITY field (address is
  // usually richer and more reliable, especially when city field is junky).
  for (const c of catalog) {
    let addrS = nameScore(c.canonical, addrTokens, addrNorm);
    let cityS = nameScore(c.canonical, cityTokens, cityNorm);
    for (const al of c.aliases) {
      addrS = Math.max(addrS, nameScore(al, addrTokens, addrNorm));
      cityS = Math.max(cityS, nameScore(al, cityTokens, cityNorm));
    }
    // Address hit gets +5 bonus to break ties in its favor; city-field hit is
    // discounted when the field is junky.
    if (addrS > 0) consider(c, addrS + 5, "addr");
    if (cityS > 0) consider(c, cityFieldUntrustworthy ? cityS - 30 : cityS, "city-field");
  }

  // (b) Neighborhood inference: area name in input → parent city. Discounted
  // so a direct city match always wins.
  for (const c of catalog) {
    for (const a of c.areas) {
      if (isServiceArea(a.canonical)) continue;
      const addrS = nameScore(a.canonical, addrTokens, addrNorm);
      const cityS = nameScore(a.canonical, cityTokens, cityNorm);
      const s = Math.max(addrS, cityS) - 10;
      if (s > 0) consider(c, s, `area:${a.canonical}`);
    }
  }

  return best && best.score >= 60 ? best : null;
}

// ============= Step 2: pick area within selected city =============
function pickArea(city: CityCatalog, inputTokens: string[], inputNorm: string): { area: string; areaId: number | null; score: number } | null {
  let best: { area: string; areaId: number | null; score: number } | null = null;
  for (const a of city.areas) {
    if (isServiceArea(a.canonical)) {
      // Only allow if customer's text contains the service keyword
      const aN = norm(a.canonical);
      const hasKw = SERVICE_KEYWORDS.some((k) => inputNorm.includes(norm(k)) && aN.includes(norm(k)));
      if (!hasKw) continue;
    }
    const s = nameScore(a.canonical, inputTokens, inputNorm);
    if (s > 0 && (!best || s > best.score)) {
      best = { area: a.canonical, areaId: a.areaId, score: s };
    }
  }
  return best && best.score >= 70 ? best : null;
}

// ============= AI fallback: city only =============
async function aiPickCity(catalog: CityCatalog[], city: string, address: string, apiKey: string): Promise<string | null> {
  const cityList = catalog.map((c) => c.canonical).join("، ");
  const prompt = `أنت خبير بجغرافيا ليبيا. لديك القائمة التالية من المدن المتاحة للشحن:

${cityList}

مدخل العميل:
- مدينة مكتوبة: "${city || ""}"
- عنوان مكتوب: "${address || ""}"

اختر اسم المدينة الأنسب من القائمة فقط (يجب أن يكون اسمًا موجودًا حرفيًا في القائمة).
- إذا ذكر العميل اسم حي (مثل تاجوراء، عين زارة، الفرناج) استنتج المدينة الأم (طرابلس).
- إذا تعذر التحديد بثقة، أعد "NONE".
استدع الأداة pick_city فقط.`;

  const tool = {
    type: "function",
    function: {
      name: "pick_city",
      description: "اختر اسم المدينة من القائمة.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["city", "confidence"],
        additionalProperties: false,
      },
    },
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "pick_city" } },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error("aiPickCity status", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = await res.json();
    const call = j?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = call?.function?.arguments;
    if (!argsStr) return null;
    const args = typeof argsStr === "string" ? JSON.parse(argsStr) : argsStr;
    const picked = String(args.city || "").trim();
    const conf = Number(args.confidence) || 0;
    if (!picked || picked.toUpperCase() === "NONE" || conf < 0.5) return null;
    return picked;
  } catch (e) {
    console.error("aiPickCity error", (e as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ============= main =============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { city, address } = await req.json() as { city?: string; address?: string; owner_id?: string };
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const catalog = await buildCatalog(admin);
    const cityInput = city || "";
    const addrInput = address || "";
    const inputTokens = [...tokenize(cityInput), ...tokenize(addrInput)];
    const inputNorm = norm(cityInput + " " + addrInput);

    // Hard override: user-saved correction with matching input text.
    const { data: corrections } = await admin
      .from("city_corrections")
      .select("city,area,input_text");
    if (corrections && inputNorm) {
      const exact = (corrections as any[]).find(
        (o) => o.input_text && norm(o.input_text) === inputNorm,
      );
      if (exact) {
        console.log("match-city: correction override", exact);
        return new Response(JSON.stringify({
          zone_id: null, area_id: null,
          zone_name: exact.city, area_name: exact.area,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fuzzy correction override: pick the correction whose input_text tokens
      // have the highest overlap with the customer's text. Requires that ALL
      // meaningful tokens (length >= 2) of the saved input_text are present in
      // the customer's input (subset match), so we don't apply unrelated rules.
      const inputTokSet = new Set([...tokenize(cityInput), ...tokenize(addrInput)]);
      let bestFuzzy: { rule: any; overlap: number } | null = null;
      for (const o of corrections as any[]) {
        if (!o.input_text) continue;
        // Use UNIQUE tokens — duplicates like "طرابلس طرابلس" must not count
        // as two distinct signals.
        const savedToksUnique = Array.from(
          new Set(tokenize(o.input_text).filter((t) => t.length >= 2)),
        );
        // Require at least 2 unique meaningful tokens so a saved rule with
        // only the city name (e.g. "طرابلس") can't hijack every order in
        // that city — the customer's address must provide a specific
        // landmark that matches a saved correction.
        if (savedToksUnique.length < 2) continue;
        const matched = savedToksUnique.filter((t) => inputTokSet.has(t));
        // Require full subset match (every saved token present in input).
        if (matched.length !== savedToksUnique.length) continue;
        // Prefer the most specific rule (most tokens matched).
        if (!bestFuzzy || savedToksUnique.length > bestFuzzy.overlap) {
          bestFuzzy = { rule: o, overlap: savedToksUnique.length };
        }
      }
      if (bestFuzzy) {
        console.log("match-city: correction fuzzy override", bestFuzzy.rule, "matched tokens:", bestFuzzy.overlap);
        return new Response(JSON.stringify({
          zone_id: null, area_id: null,
          zone_name: bestFuzzy.rule.city, area_name: bestFuzzy.rule.area,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // Add corrections as extra cities to the catalog (in case user added a new one).
    for (const r of (corrections || []) as any[]) {
      const key = norm(r.city);
      if (!key || isExcluded(r.city)) continue;
      let entry = catalog.find((c) => c.norm === key);
      if (!entry) {
        entry = { canonical: r.city, norm: key, zoneId: null, aliases: [r.city], areas: [] };
        catalog.push(entry);
      }
      const aN = norm(r.area);
      if (aN && !entry.areas.some((a) => a.norm === aN)) {
        entry.areas.push({ canonical: r.area, norm: aN, areaId: null });
      }
    }

    // ============ STEP 1: pick city ============
    const cityTokens = tokenize(cityInput);
    const addrTokens = tokenize(addrInput);
    const cityNormStr = norm(cityInput);
    const addrNormStr = norm(addrInput);
    let cityPick = pickCity(catalog, cityTokens, addrTokens, cityNormStr, addrNormStr);

    if (!cityPick) {
      // AI fallback (city only)
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (apiKey) {
        const aiCity = await aiPickCity(catalog, cityInput, addrInput, apiKey);
        if (aiCity) {
          const key = norm(aiCity);
          const found = catalog.find((c) => c.norm === key);
          if (found) cityPick = { city: found, score: 60, via: "ai" };
        }
      }
    }

    if (!cityPick) {
      console.log("match-city: no city found", { city: cityInput, address: addrInput });
      return new Response(JSON.stringify({
        zone_id: null, area_id: null,
        zone_name: null, area_name: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("match-city: city picked", { city: cityPick.city.canonical, score: cityPick.score, via: cityPick.via });

    // ============ STEP 2: pick area within city ============
    const areaPick = pickArea(cityPick.city, inputTokens, inputNorm);

    // Fallback: area == city (placeholder), preferring carrier's own placeholder area if any.
    let finalAreaName: string;
    let finalAreaId: number | null = null;
    if (areaPick) {
      finalAreaName = areaPick.area;
      finalAreaId = areaPick.areaId;
      console.log("match-city: area picked", { area: areaPick.area, score: areaPick.score });
    } else {
      // Look for a city-as-area placeholder among carrier areas.
      const placeholder = cityPick.city.areas.find((a) => a.norm === cityPick!.city.norm);
      if (placeholder) {
        finalAreaName = placeholder.canonical;
        finalAreaId = placeholder.areaId;
      } else {
        finalAreaName = cityPick.city.canonical;
      }
      console.log("match-city: no area, using city-as-area", finalAreaName);
    }

    return new Response(JSON.stringify({
      zone_id: cityPick.city.zoneId,
      area_id: finalAreaId,
      zone_name: cityPick.city.canonical,
      area_name: finalAreaName,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("match-city error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
