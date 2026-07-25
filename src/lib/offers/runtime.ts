import type {
  OfferFrequency,
  OfferRecord,
  OfferRule,
  OfferRuleGroup,
  OfferSchedule,
  TriggerType,
} from "./types";
import { DEFAULT_FREQUENCY, DEFAULT_SCHEDULE, DEFAULT_TRIGGER } from "./types";

export type OfferMatchContext = {
  storeId: string;
  productId?: string | null;
  categoryId?: string | null;
  landingSlug?: string | null;
  landingPageId?: string | null;
  orderValue?: number;
  orderQuantity?: number;
  city?: string | null;
  country?: string | null;
  device?: "mobile" | "desktop" | "tablet";
  utmSource?: string | null;
  utmCampaign?: string | null;
};

const SESSION_PREFIX = "ofb_offer_";

function asArray(v: OfferRule["value"]): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (v === null || v === undefined || v === "") return [];
  return [String(v)];
}

function compare(op: string, left: string | number | boolean, right: OfferRule["value"]): boolean {
  if (op === "in" || op === "contains") {
    const list = asArray(right).map((x) => x.toLowerCase());
    const l = String(left).toLowerCase();
    if (op === "contains") return list.some((x) => l.includes(x) || x.includes(l));
    return list.includes(l);
  }

  const rv = Array.isArray(right) ? right[0] : right;
  if (typeof left === "number" || (typeof rv === "number" && !Number.isNaN(Number(left)))) {
    const ln = Number(left);
    const rn = Number(rv);
    if (op === "eq") return ln === rn;
    if (op === "neq") return ln !== rn;
    if (op === "gt") return ln > rn;
    if (op === "gte") return ln >= rn;
    if (op === "lt") return ln < rn;
    if (op === "lte") return ln <= rn;
  }

  const ls = String(left).toLowerCase();
  const rs = String(rv ?? "").toLowerCase();
  if (op === "eq") return ls === rs;
  if (op === "neq") return ls !== rs;
  if (op === "contains") return ls.includes(rs);
  return false;
}

function contextValue(field: string, ctx: OfferMatchContext): string | number | boolean | null {
  switch (field) {
    case "product":
      return ctx.productId || null;
    case "category":
      return ctx.categoryId || null;
    case "landing_page":
      return ctx.landingPageId || ctx.landingSlug || null;
    case "store":
      return ctx.storeId;
    case "order_value":
      return ctx.orderValue ?? 0;
    case "order_quantity":
      return ctx.orderQuantity ?? 1;
    case "customer_city":
      return (ctx.city || "").toLowerCase();
    case "country":
      return (ctx.country || "").toLowerCase();
    case "device":
      return ctx.device || "mobile";
    case "utm_source":
      return (ctx.utmSource || "").toLowerCase();
    case "utm_campaign":
      return (ctx.utmCampaign || "").toLowerCase();
    case "day_of_week":
      return String(new Date().getDay());
    case "returning_customer":
    case "new_customer":
      return false;
    default:
      return null;
  }
}

export function evaluateRule(rule: OfferRule, ctx: OfferMatchContext): boolean {
  const left = contextValue(rule.field, ctx);
  if (left === null || left === undefined || left === "") {
    // Missing context → rule fails (except empty product on pages without product)
    return false;
  }
  return compare(rule.operator || "eq", left, rule.value);
}

export function evaluateRuleGroup(group: OfferRuleGroup, ctx: OfferMatchContext): boolean {
  const rules = group.rules || [];
  const children = group.children || [];
  if (rules.length === 0 && children.length === 0) return true;

  const results = [
    ...rules.map((r) => evaluateRule(r, ctx)),
    ...children.map((c) => evaluateRuleGroup(c, ctx)),
  ];

  if (group.logic === "or") return results.some(Boolean);
  return results.every(Boolean);
}

export function offerMatchesRules(offer: OfferRecord, ctx: OfferMatchContext): boolean {
  const groups = offer.rule_groups || [];
  if (groups.length === 0) {
    // No groups = no restrictions
    return true;
  }
  const hasAnyRules = groups.some((g) => (g.rules || []).length > 0 || (g.children || []).length > 0);
  if (!hasAnyRules) return true;
  // Top-level groups are AND together (wizard stores one AND group)
  return groups.every((g) => evaluateRuleGroup(g, ctx));
}

function withinSchedule(schedule: OfferSchedule): boolean {
  const s = { ...DEFAULT_SCHEDULE, ...schedule };
  const now = new Date();
  if (s.startDate) {
    const start = new Date(s.startDate);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (s.endDate) {
    const end = new Date(s.endDate);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  if (Array.isArray(s.weekdays) && s.weekdays.length > 0 && !s.weekdays.includes(now.getDay())) {
    return false;
  }
  if (s.businessHoursOnly && s.businessHoursStart && s.businessHoursEnd) {
    const mins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = s.businessHoursStart.split(":").map(Number);
    const [eh, em] = s.businessHoursEnd.split(":").map(Number);
    const startM = (sh || 0) * 60 + (sm || 0);
    const endM = (eh || 0) * 60 + (em || 0);
    if (mins < startM || mins > endM) return false;
  }
  return true;
}

function frequencyAllows(offerId: string, frequency: OfferFrequency): boolean {
  const f = { ...DEFAULT_FREQUENCY, ...frequency };
  try {
    if (f.mode === "every_visit") return true;
    if (f.mode === "once" || f.mode === "once_per_customer") {
      if (localStorage.getItem(`${SESSION_PREFIX}accepted_${offerId}`)) return false;
      if (localStorage.getItem(`${SESSION_PREFIX}seen_${offerId}`)) return false;
    }
    if (f.mode === "once_per_session") {
      if (sessionStorage.getItem(`${SESSION_PREFIX}seen_${offerId}`)) return false;
      if (sessionStorage.getItem(`${SESSION_PREFIX}decided_${offerId}`)) return false;
    }
    if (f.mode === "every_x_days" && f.everyDays > 0) {
      const raw = localStorage.getItem(`${SESSION_PREFIX}seen_at_${offerId}`);
      if (raw) {
        const then = Number(raw);
        if (Date.now() - then < f.everyDays * 86400000) return false;
      }
    }
  } catch {
    /* private mode */
  }
  return true;
}

export function markOfferSeen(offerId: string) {
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}seen_${offerId}`, "1");
    localStorage.setItem(`${SESSION_PREFIX}seen_${offerId}`, "1");
    localStorage.setItem(`${SESSION_PREFIX}seen_at_${offerId}`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function markOfferDecided(offerId: string, accepted: boolean) {
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}decided_${offerId}`, accepted ? "accept" : "decline");
    if (accepted) localStorage.setItem(`${SESSION_PREFIX}accepted_${offerId}`, "1");
  } catch {
    /* ignore */
  }
}

/** Clear session lock so merchant tests can re-show (dev helper via query ?reset_offers=1) */
export function resetOfferSessionLocks() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(SESSION_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function detectDevice(): "mobile" | "desktop" | "tablet" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android/i.test(ua)) return "mobile";
  return "desktop";
}

export function findMatchingOffer(
  offers: OfferRecord[],
  ctx: OfferMatchContext,
  triggers: TriggerType[],
): OfferRecord | null {
  const triggerSet = new Set(triggers);
  const candidates = offers
    .filter((o) => o.status === "active")
    .filter((o) => {
      const t = { ...DEFAULT_TRIGGER, ...o.trigger_config };
      return triggerSet.has(t.type);
    })
    .filter((o) => withinSchedule({ ...DEFAULT_SCHEDULE, ...o.schedule }))
    .filter((o) => frequencyAllows(o.id, { ...DEFAULT_FREQUENCY, ...o.frequency }))
    .filter((o) => offerMatchesRules(o, ctx))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return candidates[0] || null;
}

/** Order bumps shown embedded in the form */
export function findOrderBumpOffers(offers: OfferRecord[], ctx: OfferMatchContext): OfferRecord[] {
  return offers
    .filter((o) => o.status === "active")
    .filter((o) => o.offer_type === "order_bump" || o.trigger_config?.type === "inside_checkout")
    .filter((o) => withinSchedule({ ...DEFAULT_SCHEDULE, ...o.schedule }))
    .filter((o) => offerMatchesRules(o, ctx))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}
