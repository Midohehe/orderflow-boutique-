/** Parse Supabase plan_limit errors from triggers. */
export function parsePlanLimitError(message: string): { metric: string; limit: number } | null {
  const m = message.match(/plan_limit:(\w+):(-?\d+)/);
  if (!m) return null;
  return { metric: m[1], limit: parseInt(m[2], 10) };
}

export const PLAN_LIMIT_LABELS: Record<string, string> = {
  stores: "عدد المتاجر",
  products: "عدد المنتجات",
  staff: "عدد الموظفين",
  orders_month: "طلبات الشهر",
};

export function planLimitMessage(metric: string, limit: number): string {
  const label = PLAN_LIMIT_LABELS[metric] || metric;
  if (limit < 0) return `تم تجاوز حد ${label}.`;
  return `وصلت إلى حد ${label} (${limit}) في خطتك الحالية. ترقِّ خطتك للمتابعة.`;
}

export function usagePercent(used: number, max: number): number {
  if (max < 0) return 0;
  if (max === 0) return 100;
  return Math.min(100, Math.round((used / max) * 100));
}

export function isUnlimited(max: number): boolean {
  return max < 0;
}

export function formatLimit(max: number): string {
  return isUnlimited(max) ? "∞" : String(max);
}
