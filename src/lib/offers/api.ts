import { supabase } from "@/integrations/supabase/client";
import type {
  OfferAction,
  OfferFlow,
  OfferProductRow,
  OfferRecord,
  OfferRuleGroup,
  OfferStats,
  OfferStatus,
  OfferType,
} from "./types";
import {
  DEFAULT_DESIGN,
  DEFAULT_FREQUENCY,
  DEFAULT_PRICING,
  DEFAULT_SCHEDULE,
  DEFAULT_TRIGGER,
} from "./types";

function asObj<T>(v: unknown, fallback: T): T {
  return v && typeof v === "object" ? ({ ...fallback, ...(v as object) } as T) : fallback;
}

function mapOffer(row: any, extras?: Partial<OfferRecord>): OfferRecord {
  return {
    id: row.id,
    owner_id: row.owner_id,
    store_id: row.store_id,
    name: row.name,
    status: row.status as OfferStatus,
    priority: row.priority ?? 0,
    offer_type: row.offer_type as OfferType,
    design: asObj(row.design, DEFAULT_DESIGN),
    pricing: asObj(row.pricing, DEFAULT_PRICING),
    trigger_config: asObj(row.trigger_config, DEFAULT_TRIGGER),
    frequency: asObj(row.frequency, DEFAULT_FREQUENCY),
    schedule: asObj(row.schedule, DEFAULT_SCHEDULE),
    template_key: row.template_key,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...extras,
  };
}

export async function listOffers(storeId: string): Promise<OfferRecord[]> {
  const [{ data, error }, { data: stats }] = await Promise.all([
    (supabase as any)
      .from("offers")
      .select("*")
      .eq("store_id", storeId)
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false }),
    (supabase as any).rpc("get_offer_stats_summary", { _store_id: storeId }),
  ]);
  if (error) throw error;

  const statsMap = new Map<string, OfferStats>();
  (stats || []).forEach((s: any) => {
    statsMap.set(s.offer_id, {
      offer_id: s.offer_id,
      views: Number(s.views) || 0,
      clicks: Number(s.clicks) || 0,
      accepts: Number(s.accepts) || 0,
      rejects: Number(s.rejects) || 0,
      revenue: Number(s.revenue) || 0,
      acceptance_rate: Number(s.acceptance_rate) || 0,
    });
  });

  return (data || []).map((row: any) =>
    mapOffer(row, { stats: statsMap.get(row.id) }),
  );
}

export async function getOffer(offerId: string): Promise<OfferRecord | null> {
  const { data, error } = await (supabase as any)
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [{ data: products }, { data: groups }, { data: rules }, { data: actions }] =
    await Promise.all([
      (supabase as any)
        .from("offer_products")
        .select("*")
        .eq("offer_id", offerId)
        .order("sort_order"),
      (supabase as any)
        .from("offer_rule_groups")
        .select("*")
        .eq("offer_id", offerId)
        .order("sort_order"),
      (supabase as any)
        .from("offer_rules")
        .select("*")
        .eq("offer_id", offerId)
        .order("sort_order"),
      (supabase as any)
        .from("offer_actions")
        .select("*")
        .eq("offer_id", offerId)
        .order("sort_order"),
    ]);

  const ruleGroups: OfferRuleGroup[] = (groups || []).map((g: any) => ({
    id: g.id,
    parent_group_id: g.parent_group_id,
    logic: g.logic,
    sort_order: g.sort_order,
    rules: (rules || [])
      .filter((r: any) => r.group_id === g.id)
      .map((r: any) => ({
        id: r.id,
        group_id: r.group_id,
        field: r.field,
        operator: r.operator,
        value: r.value,
        sort_order: r.sort_order,
      })),
  }));

  if (!ruleGroups.length) {
    ruleGroups.push({ logic: "and", sort_order: 0, rules: [] });
  }

  return mapOffer(data, {
    products: (products || []) as OfferProductRow[],
    rule_groups: ruleGroups,
    actions: (actions || []) as OfferAction[],
  });
}

export async function saveOffer(input: {
  id?: string;
  ownerId: string;
  storeId: string;
  offer: Omit<OfferRecord, "id" | "owner_id" | "store_id"> & { id?: string };
}): Promise<string> {
  const { ownerId, storeId, offer } = input;
  const payload = {
    owner_id: ownerId,
    store_id: storeId,
    name: offer.name.trim() || "عرض بدون اسم",
    status: offer.status,
    priority: offer.priority ?? 0,
    offer_type: offer.offer_type,
    design: offer.design,
    pricing: offer.pricing,
    trigger_config: offer.trigger_config,
    frequency: offer.frequency,
    schedule: offer.schedule,
    template_key: offer.template_key || null,
    updated_at: new Date().toISOString(),
  };

  let offerId = offer.id || input.id;

  if (offerId) {
    const { error } = await (supabase as any)
      .from("offers")
      .update(payload)
      .eq("id", offerId);
    if (error) throw error;
  } else {
    const { data, error } = await (supabase as any)
      .from("offers")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    offerId = data.id as string;
    await (supabase as any).from("offer_stats").upsert({ offer_id: offerId });
  }

  // Replace children
  await Promise.all([
    (supabase as any).from("offer_products").delete().eq("offer_id", offerId),
    (supabase as any).from("offer_rules").delete().eq("offer_id", offerId),
    (supabase as any).from("offer_rule_groups").delete().eq("offer_id", offerId),
    (supabase as any).from("offer_actions").delete().eq("offer_id", offerId),
  ]);

  const products = (offer.products || []).map((p, i) => ({
    offer_id: offerId,
    product_id: p.product_id || null,
    category_id: p.category_id || null,
    collection_key: p.collection_key || null,
    sort_order: p.sort_order ?? i,
    is_default: !!p.is_default,
    allow_variants: p.allow_variants !== false,
    allow_multi_select: !!p.allow_multi_select,
    meta: {},
  }));
  if (products.length) {
    const { error } = await (supabase as any).from("offer_products").insert(products);
    if (error) throw error;
  }

  const groups = offer.rule_groups?.length
    ? offer.rule_groups
    : [{ logic: "and" as const, sort_order: 0, rules: [] }];

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const { data: gRow, error: gErr } = await (supabase as any)
      .from("offer_rule_groups")
      .insert({
        offer_id: offerId,
        parent_group_id: null,
        logic: g.logic || "and",
        sort_order: g.sort_order ?? gi,
      })
      .select("id")
      .single();
    if (gErr) throw gErr;

    const rules = (g.rules || [])
      .filter((r) => r.field)
      .map((r, ri) => ({
        offer_id: offerId,
        group_id: gRow.id,
        field: r.field,
        operator: r.operator || "eq",
        value: r.value ?? null,
        sort_order: r.sort_order ?? ri,
      }));
    if (rules.length) {
      const { error } = await (supabase as any).from("offer_rules").insert(rules);
      if (error) throw error;
    }
  }

  const actions = (offer.actions || []).map((a, i) => ({
    offer_id: offerId,
    on_event: a.on_event,
    action_type: a.action_type,
    config: a.config || {},
    sort_order: a.sort_order ?? i,
  }));
  if (actions.length) {
    const { error } = await (supabase as any).from("offer_actions").insert(actions);
    if (error) throw error;
  }

  return offerId!;
}

export async function deleteOffer(offerId: string): Promise<void> {
  const { error } = await (supabase as any).from("offers").delete().eq("id", offerId);
  if (error) throw error;
}

export async function duplicateOffer(offerId: string): Promise<string> {
  const full = await getOffer(offerId);
  if (!full) throw new Error("العرض غير موجود");
  return saveOffer({
    ownerId: full.owner_id,
    storeId: full.store_id,
    offer: {
      ...full,
      id: undefined,
      name: `${full.name} (نسخة)`,
      status: "draft",
    },
  });
}

export async function listFlows(storeId: string): Promise<OfferFlow[]> {
  const { data, error } = await (supabase as any)
    .from("offer_flows")
    .select("*")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    owner_id: r.owner_id,
    store_id: r.store_id,
    name: r.name,
    is_active: !!r.is_active,
    graph: r.graph || { nodes: [], edges: [] },
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function saveFlow(flow: {
  id?: string;
  ownerId: string;
  storeId: string;
  name: string;
  is_active: boolean;
  graph: OfferFlow["graph"];
}): Promise<string> {
  const payload = {
    owner_id: flow.ownerId,
    store_id: flow.storeId,
    name: flow.name.trim() || "مسار عروض",
    is_active: flow.is_active,
    graph: flow.graph,
    updated_at: new Date().toISOString(),
  };
  if (flow.id) {
    const { error } = await (supabase as any)
      .from("offer_flows")
      .update(payload)
      .eq("id", flow.id);
    if (error) throw error;
    return flow.id;
  }
  const { data, error } = await (supabase as any)
    .from("offer_flows")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteFlow(flowId: string): Promise<void> {
  const { error } = await (supabase as any).from("offer_flows").delete().eq("id", flowId);
  if (error) throw error;
}

export function exportOffersCsv(offers: OfferRecord[]): string {
  const header = [
    "name",
    "type",
    "status",
    "priority",
    "views",
    "accepts",
    "rejects",
    "acceptance_rate",
    "revenue",
  ];
  const lines = [header.join(",")];
  for (const o of offers) {
    const s = o.stats;
    lines.push(
      [
        JSON.stringify(o.name),
        o.offer_type,
        o.status,
        o.priority,
        s?.views ?? 0,
        s?.accepts ?? 0,
        s?.rejects ?? 0,
        s?.acceptance_rate ?? 0,
        s?.revenue ?? 0,
      ].join(","),
    );
  }
  return lines.join("\n");
}
