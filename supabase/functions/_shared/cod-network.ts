// Contract: https://developer.cod.network/#seller-v2/tag/orders/POST/v2/seller/orders
export const COD_NETWORK_BASE = 'https://api.cod.network/v2/seller';
export const COD_NETWORK_LABEL = 'سعودي نيتورك';
export interface CodLine {
  id: string; product_id: string | null; product_name: string;
  selected_color?: string | null; selected_size?: string | null; selected_product_code?: string | null;
  quantity: number; price: number; sku: string; variant_key: string;
}
export interface CodDraft {
  id: string; order_code: string; updated_at: string; currency_code: string; review_key: string;
  full_name: string; phone: string; address: string; city: string; area: string;
  country: string; total: number; items: CodLine[]; issue?: string;
  shipment?: { state: string; reference: string | null; error_message: string | null; resource_type?: 'order' | 'lead' } | null;
}
export interface CodEdits {
  full_name?: string; phone?: string; address?: string; city?: string; area?: string;
  skus?: Record<string, string>;
}
export function variantKey(row: Pick<CodLine, 'selected_color' | 'selected_size' | 'selected_product_code'>): string {
  return JSON.stringify([row.selected_color || '', row.selected_size || '', row.selected_product_code || '']);
}
export function cleanPhone(value: string): string {
  return value.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[\s()-]/g, '').replace(/^00/, '+');
}
export function sameCodPhone(a: string, b: string, country: string): boolean {
  const normalize = (value: string) => {
    const digits = cleanPhone(value).replace(/^\+/, '');
    // The provider may return Saudi mobile numbers in international form.
    return country === 'SA' ? digits.replace(/^966(?=5\d{8}$)/, '0').replace(/^(?=5\d{8}$)/, '0') : digits;
  };
  return normalize(a) === normalize(b);
}
function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim() === '—' || value.trim().length > max) throw Error(`راجع ${label}`);
  return value.trim();
}
/** Preserve exact COD cents, including delivery and order-level discounts.
 * Splitting remainder units avoids rounding a 3-piece shipment off by one cent. */
export function codItems(lines: CodLine[], total: number, skus: Record<string, string> = {}) {
  if (!lines.length || lines.length > 100 || !Number.isFinite(total) || total < 0 || total > 9999999) throw Error('مبلغ التحصيل أو المنتجات غير صالح');
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 999 || !Number.isFinite(line.price) || line.price < 0) throw Error('راجع كمية وسعر منتجات الطلب');
  }
  const totalCents = Math.round(total * 100);
  const weight = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  let allocated = 0;
  const result: Array<{ sku: string; quantity: number; price: number }> = [];
  lines.forEach((line, index) => {
    const sku = requiredText(skus[line.id] ?? line.sku, `رمز SKU للمنتج «${line.product_name}»`, 200);
    const share = index === lines.length - 1 ? totalCents - allocated
      : Math.floor(totalCents * (weight > 0 ? line.price * line.quantity / weight : line.quantity / count));
    allocated += share;
    const unit = Math.floor(share / line.quantity), remainder = share % line.quantity;
    const add = (quantity: number, cents: number) => {
      while (quantity > 0) { const chunk = Math.min(100, quantity); result.push({ sku, quantity: chunk, price: cents / 100 }); quantity -= chunk; }
    };
    add(line.quantity - remainder, unit); add(remainder, unit + 1);
  });
  return result;
}
export function buildCodPayload(draft: CodDraft, edits: CodEdits, currencyCode: string) {
  if (draft.issue) throw Error(draft.issue);
  if (draft.currency_code !== currencyCode) throw Error(`عملة الطلب ${draft.currency_code} تختلف عن عملة الربط ${currencyCode}. لا يتم تحويل المبالغ تلقائيًا`);
  const phone = cleanPhone(requiredText(edits.phone ?? draft.phone, 'رقم الهاتف', 40));
  if (!/^\+?\d{7,15}$/.test(phone)) throw Error('راجع رقم هاتف العميل');
  const full_name = requiredText(edits.full_name ?? draft.full_name, 'اسم العميل', 200);
  if (full_name === 'بدون اسم') throw Error('أدخل اسم العميل قبل الإرسال');
  return {
    full_name, phone, country: draft.country,
    address: requiredText(edits.address ?? draft.address, 'العنوان', 1000),
    city: requiredText(edits.city ?? draft.city, 'المدينة', 200),
    area: requiredText(edits.area ?? draft.area, 'المنطقة / الحي', 200),
    pay_mode: 'cod', items: codItems(draft.items, draft.total, edits.skus),
  };
}
export function codRemoteOrder(value: unknown): { id: string; reference: string; phone: string; total: number } | null {
  const result = value as { status?: string; data?: Record<string, unknown> } | null;
  if (result?.status !== 'success' || !result.data) return null;
  const data = result.data, id = String(data.id ?? '');
  if (!/^\d+$/.test(id) || id === '0') return null;
  return { id, reference: String(data.tracking_number || data.reference || id), phone: String(data.customer_phone || ''), total: Number(data.total) };
}
/** Drop products are rejected by POST /orders (40049) and use POST /leads. */
export function buildCodLeadPayload(order: ReturnType<typeof buildCodPayload>) {
  return { phone: order.phone, name: order.full_name, country: order.country,
    address: [...new Set([order.address, order.area, order.city].filter(Boolean))].join('، '), items: order.items };
}
export function codHasErrorCode(value: unknown, code: number, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 5) return false;
  if (Array.isArray(value)) return value.some(entry => codHasErrorCode(entry, code, depth + 1));
  const body = value as Record<string, unknown>;
  return String(body.code) === String(code) || ['errors', 'error', 'details'].some(key => codHasErrorCode(body[key], code, depth + 1));
}
export function codRemoteLead(value: unknown): { id: string; reference: string; phone: string; total: number; items: Array<{ sku: string; quantity: number; price: number }> } | null {
  const result = value as { status?: string; data?: Record<string, unknown> } | null;
  if (result?.status !== 'success' || !result.data) return null;
  const data = result.data, id = String(data.id ?? '');
  if (!/^[1-9]\d*$/.test(id)) return null;
  let original = data.original_payload;
  if (typeof original === 'string') { try { original = JSON.parse(original); } catch { original = null; } }
  const related = (value: unknown): unknown[] => Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data) ? (value as { data: unknown[] }).data : [];
  const included = [...related(data.items), ...related(data.drop_items)];
  const rows = included.length ? included : related((original as { items?: unknown } | null)?.items);
  const items = rows.map(value => {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const relation = (row.drop_product || row.product) as { data?: { sku?: unknown } } | undefined;
    return { sku: String(row.sku || relation?.data?.sku || ''), quantity: Number(row.quantity), price: row.price == null ? NaN : Number(row.price) };
  });
  const valid = items.length > 0 && items.every(item => item.sku && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(item.price) && item.price >= 0);
  return { id, reference: `LEAD-${id}`, phone: String(data.phone || ''), items,
    total: valid ? items.reduce((sum, item) => sum + item.quantity * item.price, 0) : NaN };
}
export function codError(value: unknown, status: number, token = ''): string {
  if (status === 401 || status === 403) return 'رفضت الشركة رمز API Token؛ راجع إعدادات الربط مع السوبر أدمن';
  if (status === 429) return 'تم تجاوز عدد الطلبات المسموح به؛ حاول لاحقًا';
  if (codHasErrorCode(value, 40049)) return 'المنتج من نوع دروبشيبينغ؛ يجب إرساله إلى الشركة كطلب بانتظار التأكيد (Lead)، وليس كشحنة مباشرة (رمز 40049)';
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const clean = (text: string) => (token ? text.split(token).join('[محجوب]') : text)
    .replace(/Bearer\s+\S+/gi, '[محجوب]').replace(/<[^>]*>/g, '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300);
  const details: string[] = [];
  // Read only error fields, never reflect the full response/customer snapshot.
  const collect = (entry: unknown, field = '', depth = 0) => {
    if (depth > 4 || details.length >= 5) return;
    if (typeof entry === 'string') { const message = clean(entry); if (message) details.push(field ? `${clean(field)}: ${message}` : message); }
    else if (Array.isArray(entry)) entry.slice(0, 5).forEach(item => collect(item, field, depth + 1));
    else if (entry && typeof entry === 'object') Object.entries(entry).slice(0, 10).forEach(([key, item]) => collect(item, key === 'message' ? field : key, depth + 1));
  };
  if (typeof body.message === 'string') collect(body.message);
  collect(body.errors); collect(body.error); collect(body.details);
  const code = (typeof body.code === 'string' || typeof body.code === 'number') && /^\d{3,8}$/.test(String(body.code)) ? clean(String(body.code)) : '';
  const message = [...new Set(details)].join(' — ').slice(0, 450);
  return `رفضت الشركة الطلب (HTTP ${status}${code ? `، رمز ${code}` : ''}): ${message || 'لم ترسل الشركة سببًا تفصيليًا للرفض؛ راجع بيانات العميل وSKU وتوفر المنتج في بلد التوصيل'}`;
}
