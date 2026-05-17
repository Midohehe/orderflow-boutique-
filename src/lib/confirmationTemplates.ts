export interface TemplateVars {
  customer_name?: string | null;
  product_name?: string | null;
  price?: number | string | null;
  city?: string | null;
  quantity?: number | null;
  order_id?: string | null;
}

export const DEFAULT_TEMPLATE_BODY =
  "السلام عليكم {اسم}،\nنتواصل معك لتأكيد طلبك ({منتج}) بسعر {سعر} د.ل إلى مدينة {مدينة}. هل التوصيل والمواصفات لا تزال صحيحة؟";

export function renderTemplate(body: string, vars: TemplateVars): string {
  const map: Record<string, string> = {
    "{اسم}": String(vars.customer_name || ""),
    "{منتج}": String(vars.product_name || ""),
    "{سعر}": vars.price != null ? String(vars.price) : "",
    "{مدينة}": String(vars.city || ""),
    "{الكمية}": vars.quantity != null ? String(vars.quantity) : "",
    "{رقم}": String(vars.order_id || "").slice(0, 8),
  };
  let out = body || "";
  for (const k of Object.keys(map)) out = out.split(k).join(map[k]);
  return out;
}

export const TEMPLATE_VARIABLES: { token: string; label: string }[] = [
  { token: "{اسم}", label: "اسم العميل" },
  { token: "{منتج}", label: "اسم المنتج" },
  { token: "{سعر}", label: "السعر" },
  { token: "{مدينة}", label: "المدينة" },
  { token: "{الكمية}", label: "الكمية" },
  { token: "{رقم}", label: "رقم الطلب" },
];