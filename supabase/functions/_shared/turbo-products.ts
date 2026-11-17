export interface TurboSourceProduct {
  id: string; store_id: string; owner_id: string; name: string; price: number;
  colors: string[] | null; sizes: string[] | null; product_codes: string[] | null;
  variant_skus: Record<string, string> | null; variant_warehouse_codes: Record<string, string> | null;
  warehouse_linked: boolean; deleted_at: string | null;
}
export interface TurboProductInput { code: string; name: string; price: number; weight: number; active: boolean }
export interface TurboRemoteProduct { id: number; code: string; name: string; price: number; weight: number; availableQuantity: number }
const tags = (values: string[] | null) => [...new Set((values || []).map(value => value.trim()).filter(Boolean))];
export function turboRevision(product: TurboSourceProduct) {
  return { name: product.name, price: product.price, colors: product.colors, sizes: product.sizes,
    product_codes: product.product_codes, variant_skus: product.variant_skus, warehouse_linked: product.warehouse_linked };
}
export async function turboProductPlan(product: TurboSourceProduct) {
  if (product.deleted_at || !product.warehouse_linked) throw Error('فعّل ربط المنتج بمخزن شركة التوصيل أولًا');
  if (!product.name.trim() || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) throw Error('راجع اسم المنتج وسعر البيع');
  const colors = tags(product.colors), sizes = tags(product.sizes), codes = tags(product.product_codes);
  const keys = colors.length && sizes.length ? colors.flatMap(color => sizes.map(size => `${color} - ${size}`))
    : colors.length ? colors : sizes.length ? sizes : codes.length ? codes : [''];
  if (keys.length > 200 || new Set(keys).size !== keys.length) throw Error('راجع المتغيرات؛ الحد الأقصى 200 متغير مميز');
  const seen = new Set<string>();
  return await Promise.all(keys.map(async key => {
    const linked = (product.variant_warehouse_codes?.[key] || '').trim();
    const supplied = (product.variant_skus?.[key] || (!colors.length && !sizes.length ? key : '')).trim();
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
    const suffix = Array.from(hash.slice(0, 4), byte => byte.toString(16).padStart(2, '0')).join('');
    const code = linked || supplied || `WL-${product.id.replace(/-/g, '')}-${suffix}`;
    if (code.length > 100 || seen.has(code)) throw Error('يجب أن يكون لكل متغير كود مختلف لا يتجاوز 100 حرف');
    seen.add(code);
    return { key, code, name: key === '' || (!colors.length && !sizes.length && codes.length === 1)
      ? product.name.trim() : `${product.name.trim()} — ${key}`, linked: !!linked };
  }));
}
export function turboWeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10000) throw Error('أدخل وزنًا صحيحًا أكبر من صفر');
  return value;
}
export function matchingTurboProduct(remote: TurboRemoteProduct, input: TurboProductInput): boolean {
  return Number.isSafeInteger(remote.id) && remote.id > 0 && remote.code === input.code && remote.name === input.name
    && Math.abs(Number(remote.price) - input.price) < 0.00001 && Math.abs(Number(remote.weight) - input.weight) < 0.00001;
}
