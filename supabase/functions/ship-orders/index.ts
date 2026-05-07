// Sends selected orders to the shipping company (Turbo Express / Accurate API).
// Authenticates with email+password via GraphQL, then submits each order.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { initialLibyanLocations } from "../_shared/locationData.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  order_ids: string[];
  shipping_included?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Verify caller is authenticated admin
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const ids = (body.order_ids || []).filter((x) => typeof x === "string").slice(0, 200);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "No orders selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read settings (avoid RLS issues)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows } = await admin
      .from("shipping_settings")
      .select("*")
      .eq("owner_id", userData.user.id)
      .eq("enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    const settings = settingsRows?.[0];

    if (!settings || !settings.enabled || !settings.email || !settings.password) {
      return new Response(
        JSON.stringify({ error: "إعدادات شركة الشحن غير مكتملة أو غير مفعّلة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const endpoint: string = settings.endpoint || "https://turboex.ly:8001/graphql";

    // 1) Login via GraphQL to get token
    const loginQuery = {
      query: `mutation Login($input: LoginInput!) {
        login(input: $input) {
          token
        }
      }`,
      variables: {
        input: {
          username: settings.email,
          password: settings.password,
          rememberMe: true,
        },
      },
    };

    const loginRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginQuery),
    });
    const loginJson = await loginRes.json().catch(() => ({}));
    const loginData = loginJson?.data?.login ?? {};
    const token: string | undefined = loginData.token;

    if (!token) {
      console.error("Login failed", loginJson);
      return new Response(
        JSON.stringify({
          error: "فشل تسجيل الدخول لشركة الشحن. تحقق من البريد وكلمة المرور.",
          details: loginJson,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Fetch the orders to send
    const { data: orders, error: oErr } = await admin
      .from("orders")
      .select("*")
      .in("id", ids);

    // Fetch products to look up per-variant warehouse code (shipping company storage code)
    const productIds = Array.from(new Set((orders || []).map((o: any) => o.product_id).filter(Boolean)));
    const productsMap = new Map<string, { variant_warehouse_codes: Record<string, string> }>();
    if (productIds.length > 0) {
      const { data: prods } = await admin
        .from("products")
        .select("id, variant_warehouse_codes")
        .in("id", productIds);
      (prods || []).forEach((p: any) => productsMap.set(p.id, { variant_warehouse_codes: p.variant_warehouse_codes || {} }));
    }

    if (oErr || !orders) {
      return new Response(JSON.stringify({ error: "Could not load orders" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; ok: boolean; reference?: string; error?: string }> = [];

    // Helper: GraphQL request with auth
    const gql = async (query: string, variables: Record<string, unknown> = {}) => {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
      });
      return await r.json().catch(() => ({}));
    };

    // 3) Load services + zones + customer warehouse products
    const meta = await gql(`{
      listShippingServicesDropdown { id name }
      listZonesDropdown { id name }
      listProductsDropdown { id name code }
    }`);

    const services = meta?.data?.listShippingServicesDropdown || [];
    const zones = meta?.data?.listZonesDropdown || [];
    const whProducts: Array<{ id: number; name: string; code: string }> = meta?.data?.listProductsDropdown || [];
    // Map by warehouse code (e.g. "80753960") AND by id-as-string, to get internal id.
    const whProductByCode = new Map<string, number>();
    for (const p of whProducts) {
      if (p.code) whProductByCode.set(String(p.code).trim(), p.id);
      whProductByCode.set(String(p.id), p.id);
    }
    // Also merge from local synced table (fast lookup, owner-scoped)
    const { data: localWh } = await admin
      .from("shipping_warehouse_products")
      .select("external_id, code")
      .eq("owner_id", userData.user.id);
    for (const p of localWh || []) {
      if (p.code) whProductByCode.set(String(p.code).trim(), p.external_id);
      whProductByCode.set(String(p.external_id), p.external_id);
    }

    const defaultServiceId = services[0]?.id;

    // Arabic-aware normalization: strip diacritics, normalize alef/yaa/taa marbouta,
    // remove "ال" prefix, collapse spaces.
    const norm = (s: string) => {
      let t = (s || "").toString().trim();
      t = t.replace(/[\u064B-\u0652\u0670]/g, ""); // diacritics
      t = t.replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
      t = t.replace(/\s+/g, " ").toLowerCase();
      t = t.replace(/^ال/, "");
      return t.trim();
    };
    const tokens = (s: string) => norm(s).split(/[\s,،\-\/]+/).filter(Boolean);

    const normalizePhone = (phone: string) => {
      const digits = String(phone || "").replace(/\D/g, "");
      if (digits.startsWith("218")) return `+${digits}`;
      if (digits.startsWith("0")) return `+218${digits.slice(1)}`;
      if (digits.length === 9) return `+218${digits}`;
      return phone.startsWith("+") ? phone : `+${digits}`;
    };

    // Levenshtein distance for fuzzy matching (handles typos like اجورا/تاجورا)
    const levenshtein = (a: string, b: string): number => {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const m = a.length, n = b.length;
      let prev = new Array(n + 1).fill(0);
      let curr = new Array(n + 1).fill(0);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
      }
      return prev[n];
    };
    // Similarity score 0..1 based on edit distance, normalized by longer length
    const similarity = (a: string, b: string): number => {
      const na = norm(a), nb = norm(b);
      if (!na || !nb) return 0;
      const maxLen = Math.max(na.length, nb.length);
      return 1 - levenshtein(na, nb) / maxLen;
    };

    const matchByName = <T extends { id: number; name: string }>(list: T[], query: string): T | undefined => {
      const q = norm(query);
      if (!q) return undefined;
      // exact
      let m = list.find((x) => norm(x.name) === q);
      if (m) return m;
      // contains either way
      m = list.find((x) => { const n = norm(x.name); return n.includes(q) || q.includes(n); });
      if (m) return m;
      // token overlap
      const qTokens = tokens(query);
      let best: { item: T; score: number } | undefined;
      for (const x of list) {
        const xTokens = tokens(x.name);
        const score = qTokens.filter((t) => xTokens.some((y) => y === t || y.includes(t) || t.includes(y))).length;
        if (score > 0 && (!best || score > best.score)) best = { item: x, score };
      }
      if (best) return best.item;
      // Fuzzy fallback: pick closest by edit-distance similarity (>=0.6)
      let fuzzy: { item: T; sim: number } | undefined;
      for (const x of list) {
        // best similarity over tokens vs name and full name
        const sims = [similarity(query, x.name), ...qTokens.map((t) => similarity(t, x.name))];
        const sim = Math.max(...sims);
        if (sim >= 0.6 && (!fuzzy || sim > fuzzy.sim)) fuzzy = { item: x, sim };
      }
      return fuzzy?.item;
    };

    // Canonical Libyan city/region map (from TurboEx official list).
    // Used to correct noisy/misspelled city & region names before matching against the live zones API.
    const resolveLocation = (rawCity: string, rawAddress: string): { city: string; region: string } => {
      const nCity = norm(rawCity);
      const nAddr = norm(rawAddress);
      const mapping = initialLibyanLocations as Record<string, string[]>;
      const OFFICE = norm("استلام مكتب");

      // Find the most specific region match within a text. Prefers the LONGEST region name,
      // and de-prioritizes the generic "استلام مكتب" if any concrete region also matches.
      const bestRegionInText = (regions: string[], text: string): string | undefined => {
        if (!text) return undefined;
        const matches: Array<{ region: string; len: number; isOffice: boolean }> = [];
        for (const r of regions) {
          const nr = norm(r);
          if (!nr) continue;
          if (nr === text || text.includes(nr) || nr.includes(text)) {
            matches.push({ region: r, len: nr.length, isOffice: nr === OFFICE });
          }
        }
        if (matches.length === 0) return undefined;
        const concrete = matches.filter((m) => !m.isOffice);
        const pool = concrete.length > 0 ? concrete : matches;
        pool.sort((a, b) => b.len - a.len);
        return pool[0].region;
      };

      // 1) If we can identify the city, find the most specific region inside it.
      for (const [city, regions] of Object.entries(mapping)) {
        const nc = norm(city);
        if (!nc) continue;
        const cityHit = nc === nCity || nCity.includes(nc) || nAddr.includes(nc);
        if (cityHit) {
          const r = bestRegionInText(regions, nAddr) || bestRegionInText(regions, nCity);
          return { city, region: r || rawAddress || city };
        }
      }

      // 2) No direct city hit — search regions of all cities, pick the most specific.
      let bestPair: { city: string; region: string; len: number; isOffice: boolean } | undefined;
      for (const [city, regions] of Object.entries(mapping)) {
        for (const r of regions) {
          const nr = norm(r);
          if (!nr) continue;
          const inAddr = nAddr && (nr === nAddr || nAddr.includes(nr) || nr.includes(nAddr));
          const inCity = nCity && (nr === nCity || nCity.includes(nr) || nr.includes(nCity));
          if (inAddr || inCity) {
            const isOffice = nr === OFFICE;
            const candidate = { city, region: r, len: nr.length, isOffice };
            if (
              !bestPair ||
              (bestPair.isOffice && !candidate.isOffice) ||
              (bestPair.isOffice === candidate.isOffice && candidate.len > bestPair.len)
            ) bestPair = candidate;
          }
        }
      }
      if (bestPair) return { city: bestPair.city, region: bestPair.region };

      // 3) Fuzzy fallback - closest city + region by edit distance
      let bestCity: { city: string; sim: number } | undefined;
      for (const city of Object.keys(mapping)) {
        const sim = Math.max(similarity(rawCity, city), similarity(rawAddress, city));
        if (sim >= 0.65 && (!bestCity || sim > bestCity.sim)) bestCity = { city, sim };
      }
      if (bestCity) {
        const regions = mapping[bestCity.city] || [];
        let bestRegion: { region: string; sim: number } | undefined;
        for (const r of regions) {
          if (norm(r) === OFFICE) continue;
          const sim = Math.max(similarity(rawAddress, r), similarity(rawCity, r));
          if (sim >= 0.6 && (!bestRegion || sim > bestRegion.sim)) bestRegion = { region: r, sim };
        }
        return { city: bestCity.city, region: bestRegion?.region || rawAddress || bestCity.city };
      }
      return { city: rawCity, region: rawAddress };
    };

    const findZone = (city: string, address: string) => {
      return matchByName(zones, city) || matchByName(zones, address);
    };

    const areasCache = new Map<number, Array<{ id: number; name: string }>>();
    const loadAreas = async (zoneId: number) => {
      if (areasCache.has(zoneId)) return areasCache.get(zoneId)!;
      const childZonesMeta = await gql(
        `query ChildZones($input: ListZonesFilterInput) { listZonesDropdown(input: $input) { id name } }`,
        { input: { parentId: zoneId } },
      );
      const childZones = childZonesMeta?.data?.listZonesDropdown || [];
      if (childZones.length > 0) {
        areasCache.set(zoneId, childZones);
        return childZones;
      }
      const areaMeta = await gql(
        `query Areas($cityId: Int) { listAreasDropdown(cityId: $cityId) { id name } }`,
        { cityId: zoneId },
      );
      const areas = areaMeta?.data?.listAreasDropdown || [];
      areasCache.set(zoneId, areas);
      return areas;
    };

    const saveMutation = `mutation Save($input: ShipmentInput!) {
      saveShipment(input: $input) { id code refNumber }
    }`;

    for (const o of orders) {
      let zoneId: number | undefined = o.matched_zone_id ?? undefined;
      let areaId: number | undefined = o.matched_area_id ?? undefined;
      let zoneName: string | undefined = o.matched_zone_name ?? undefined;
      let areaName: string | undefined = o.matched_area_name ?? undefined;

      // Pre-correct city/region against canonical Libyan list before matching live zones
      const resolved = resolveLocation(o.city || "", o.address || "");
      // The user's corrections list (matched_zone_name/matched_area_name) takes priority
      let correctedCity = (o.matched_zone_name && o.matched_zone_name.trim()) || resolved.city;
      let correctedRegion = (o.matched_area_name && o.matched_area_name.trim()) || resolved.region;
      let needsConfirmation = false;

      // If customer didn't specify a real region (address == city, or no address),
      // and the city has multiple regions including "استلام مكتب" → default to office pickup.
      // Skip this if we already have a matched area from corrections (matched_area_name).
      const cityRegions = (initialLibyanLocations as Record<string, string[]>)[correctedCity];
      const addrIsJustCity = !o.address || norm(o.address) === norm(correctedCity) || norm(o.address) === norm(o.city || "");
      const hasMatchedArea = !!(o.matched_area_name && o.matched_area_name.trim());
      if (!hasMatchedArea && cityRegions && cityRegions.length > 1 && addrIsJustCity) {
        const office = cityRegions.find((r) => norm(r).includes(norm("استلام مكتب")));
        if (office) {
          correctedRegion = office;
          needsConfirmation = true;
        }
      }

      // If not pre-matched, try live matching against zones list (using corrected names first)
      if (!zoneId || !areaId) {
        let zone = findZone(correctedCity, correctedRegion) || findZone(o.city || "", o.address || "");
        let area: { id: number; name: string } | undefined;
        if (zone) {
          const areas = await loadAreas(zone.id);
          area =
            matchByName(areas, correctedRegion) ||
            matchByName(areas, correctedCity) ||
            matchByName(areas, o.address || "") ||
            matchByName(areas, o.city || "");
        }
        if (!area) {
          const candidates = zones.filter((z: { id: number; name: string }) => {
            const n = norm(z.name);
            return n && (norm(correctedCity).includes(n) || norm(o.city).includes(n) || norm(o.address).includes(n));
          });
          for (const z of candidates) {
            const areas = await loadAreas(z.id);
            const found =
              matchByName(areas, correctedRegion) ||
              matchByName(areas, o.address || "") ||
              matchByName(areas, o.city || "");
            if (found) { zone = z; area = found; break; }
          }
        }
        if (zone) { zoneId = zone.id; zoneName = zone.name; }
        if (area) { areaId = area.id; areaName = area.name; }
      }

      if (!zoneId || !areaId) {
        results.push({ id: o.id, ok: false, error: `تعذر مطابقة المدينة/المنطقة: "${o.city}" - "${o.address}"` });
        continue;
      }

      const phone = normalizePhone(String(o.phone || ""));

      // Look up warehouse storage code for this variant
      const whCodes = (o.product_id && productsMap.get(o.product_id)?.variant_warehouse_codes) || {};
      const variantKey =
        (o.selected_color && o.selected_size) ? `${o.selected_color} - ${o.selected_size}` :
        (o.selected_color || o.selected_size || o.selected_product_code || "");
      let rawWh = (whCodes[variantKey] || whCodes[o.selected_color || ""] || whCodes[o.selected_size || ""] || whCodes[o.selected_product_code || ""] || "").toString().trim();
      // Fallback: selected_product_code itself may be the warehouse numeric code.
      if (!rawWh && o.selected_product_code && /^\d+$/.test(String(o.selected_product_code).trim())) {
        rawWh = String(o.selected_product_code).trim();
      }
      // Fallback: any numeric value in the product's warehouse code map.
      if (!rawWh) {
        const anyNumeric = Object.values(whCodes).find((v) => /^\d+$/.test(String(v || "").trim()));
        if (anyNumeric) rawWh = String(anyNumeric).trim();
      }
      // The warehouse code from our DB (e.g. "80753960") is the customer-facing code,
      // but the API expects the internal product id. Map via listProductsDropdown.
      const warehouseInternalId = rawWh ? whProductByCode.get(rawWh) : undefined;
      console.log("ship-orders wh-lookup", { orderId: o.id, variantKey, rawWh, warehouseInternalId, available: whProducts.map(p => `${p.id}:${p.code}`) });
      const qty = Math.max(1, Number(o.quantity) || 1);
      // Per-unit price = total order price / quantity (price column stores order total)
      const unitPrice = qty > 0 ? (Number(o.price) || 0) / qty : (Number(o.price) || 0);
      const shipmentProducts = warehouseInternalId
        ? [{ productId: warehouseInternalId, price: unitPrice, quantity: qty }]
        : undefined;

      const input: Record<string, unknown> = {
        serviceId: defaultServiceId,
        recipientName: o.customer_name,
        recipientPhone: phone,
        recipientMobile: phone,
        recipientAddress: (areaName || correctedRegion || o.address || correctedCity || o.city || "-"),
        recipientZoneId: zoneId,
        recipientSubzoneId: areaId,
        description: [
          o.product_name,
          o.selected_color ? `اللون: ${o.selected_color}` : null,
          o.selected_size ? `المقاس: ${o.selected_size}` : null,
          o.selected_product_code ? `الكود: ${o.selected_product_code}` : null,
        ].filter(Boolean).join(" - "),
        typeCode: "FDP",
        priceTypeCode: body.shipping_included ? "INCLD" : "EXCLD",
        paymentTypeCode: "COLC",
        openableCode: "N",
        banknoteCode: "ANY",
        refNumber: o.id.slice(0, 12).toUpperCase(),
        notes: [
          o.selected_color,
          o.selected_size,
          o.selected_product_code,
          (needsConfirmation && areaName && norm(areaName).includes(norm("استلام مكتب")))
            ? "اتصل بالزبون للتاكيد"
            : null,
        ].filter(Boolean).join(" / ") || undefined,
      };
      if (shipmentProducts) {
        // When shipmentProducts is set, the API derives weight/pieces/price from products
        // and forbids top-level weight/piecesCount/price as well as receiveInWarehouse/typeCode.
        // Setting shipmentProducts alone is enough to deduct from the company's warehouse stock.
        input.shipmentProducts = shipmentProducts;
      } else {
        // No warehouse product → send as a regular shipment with explicit fields.
        input.piecesCount = o.quantity || 1;
        input.weight = 1;
        input.price = Number(o.price) || 0;
      }


      try {
        const j = await gql(saveMutation, { input });
        const created = j?.data?.saveShipment;
        if (created && (created.code || created.id)) {
          const reference = created.code || String(created.id);
          results.push({ id: o.id, ok: true, reference });
          await admin
            .from("orders")
            .update({
              shipped_to_company: true,
              shipping_reference: String(reference),
              status: "shipped",
            })
            .eq("id", o.id);
        } else {
          const errMsg = j?.errors?.[0]?.message || "Unknown error";
          console.error("saveShipment failed", o.id, j);
          results.push({ id: o.id, ok: false, error: errMsg });
        }
      } catch (e) {
        results.push({ id: o.id, ok: false, error: (e as Error).message });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return new Response(
      JSON.stringify({ ok: true, sent: okCount, total: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
