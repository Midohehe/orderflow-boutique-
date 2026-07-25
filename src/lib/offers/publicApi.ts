import { supabase } from "@/integrations/supabase/client";
import type { OfferRecord } from "./types";
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

function mapPublicOffer(row: any): OfferRecord {
  const ruleGroups = Array.isArray(row.rule_groups) ? row.rule_groups : [];
  // If RPC returned empty groups but flat rules, wrap them
  const groups =
    ruleGroups.length > 0
      ? ruleGroups.map((g: any) => ({
          id: g.id,
          logic: g.logic === "or" ? "or" : "and",
          sort_order: g.sort_order ?? 0,
          rules: Array.isArray(g.rules)
            ? g.rules.map((r: any, i: number) => ({
                field: r.field,
                operator: r.operator || "eq",
                value: r.value,
                sort_order: r.sort_order ?? i,
              }))
            : [],
        }))
      : [];

  return {
    id: row.id,
    owner_id: "",
    store_id: row.store_id,
    name: row.name,
    status: row.status,
    priority: row.priority ?? 0,
    offer_type: row.offer_type,
    design: asObj(row.design, DEFAULT_DESIGN),
    pricing: asObj(row.pricing, DEFAULT_PRICING),
    trigger_config: asObj(row.trigger_config, DEFAULT_TRIGGER),
    frequency: asObj(row.frequency, DEFAULT_FREQUENCY),
    schedule: asObj(row.schedule, DEFAULT_SCHEDULE),
    products: Array.isArray(row.products)
      ? row.products.map((p: any) => ({
          product_id: p.product_id,
          category_id: p.category_id,
          sort_order: p.sort_order ?? 0,
          is_default: !!p.is_default,
          allow_variants: p.allow_variants !== false,
          allow_multi_select: !!p.allow_multi_select,
          product_name: p.product_name || undefined,
          product_image: p.product_image || undefined,
          product_price:
            p.product_price != null && p.product_price !== ""
              ? Number(p.product_price)
              : undefined,
        }))
      : [],
    rule_groups: groups,
    actions: Array.isArray(row.actions) ? row.actions : [],
  };
}

/** Prefer design image, else default offer product image */
export function resolveOfferDisplayImage(offer: OfferRecord): string {
  if (offer.design?.image) return offer.design.image;
  const def = offer.products?.find((p) => p.is_default) || offer.products?.[0];
  return def?.product_image || "";
}

export async function fetchPublicActiveOffers(storeId: string): Promise<OfferRecord[]> {
  const { data, error } = await (supabase as any).rpc("get_public_active_offers", {
    _store_id: storeId,
  });
  if (error) {
    console.error("get_public_active_offers", error);
    return [];
  }
  const rows = Array.isArray(data) ? data : [];
  return rows.map(mapPublicOffer);
}

export async function trackOfferEvent(params: {
  offerId: string;
  storeId: string;
  eventType: "view" | "click" | "accept" | "reject" | "dismiss";
  revenue?: number;
  landingSlug?: string | null;
  city?: string | null;
  campaign?: string | null;
  device?: string | null;
}) {
  try {
    await (supabase as any).from("offer_analytics_events").insert({
      offer_id: params.offerId,
      store_id: params.storeId,
      event_type: params.eventType,
      revenue: params.revenue ?? 0,
      landing_slug: params.landingSlug || null,
      city: params.city || null,
      campaign: params.campaign || null,
      device: params.device || null,
    });
  } catch (e) {
    console.error("trackOfferEvent", e);
  }
}
