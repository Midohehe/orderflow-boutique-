/** Resolve variant map key (warehouse / EasyOrders) from order line fields. */
export function resolveVariantKey(
  color: string | null | undefined,
  size: string | null | undefined,
  code: string | null | undefined,
): string {
  const c = (color ?? "").trim();
  const s = (size ?? "").trim();
  const pc = (code ?? "").trim();
  if (c && s) return `${c} - ${s}`;
  return c || s || pc;
}

type VariantMaps = {
  variant_warehouse_codes?: Record<string, string> | null;
  variant_easyorders_ids?: Record<string, string> | null;
};

type LineFields = {
  selected_color?: string | null;
  selected_size?: string | null;
  selected_product_code?: string | null;
  warehouse_code?: string | null;
  easyorders_variant_id?: string | null;
};

/** Mirrors ship-orders resolveWh lookup against product variant maps. */
export function resolveWarehouseCode(
  prod: VariantMaps | undefined | null,
  item: LineFields,
): string | null {
  const direct = (item.warehouse_code ?? "").trim();
  if (direct) return direct;

  const whCodes = prod?.variant_warehouse_codes;
  if (!whCodes) return null;

  const color = (item.selected_color ?? "").trim();
  const size = (item.selected_size ?? "").trim();
  const code = (item.selected_product_code ?? "").trim();

  let variantKey = color && size ? `${color} - ${size}` : color || size || code;

  if ((!whCodes[variantKey] || !variantKey) && item.easyorders_variant_id && prod?.variant_easyorders_ids) {
    for (const [vk, eoId] of Object.entries(prod.variant_easyorders_ids)) {
      if (String(eoId) === String(item.easyorders_variant_id)) {
        variantKey = vk;
        break;
      }
    }
  }

  const raw =
    whCodes[variantKey] ||
    whCodes[color] ||
    whCodes[size] ||
    whCodes[code] ||
    "";

  let trimmed = String(raw).trim();

  // Single mapped variant: use it when code matches or product has one code only
  if (!trimmed) {
    const entries = Object.entries(whCodes).filter(([, v]) => String(v ?? "").trim());
    if (entries.length === 1) {
      const [onlyKey, onlyVal] = entries[0];
      if (!code || onlyKey === code) trimmed = String(onlyVal).trim();
    }
  }

  return trimmed || null;
}

export function resolveEasyOrdersVariantId(
  prod: VariantMaps | undefined | null,
  item: LineFields,
): string | null {
  const direct = (item.easyorders_variant_id ?? "").trim();
  if (direct) return direct;

  const eoMap = prod?.variant_easyorders_ids;
  if (!eoMap) return null;

  const key = resolveVariantKey(item.selected_color, item.selected_size, item.selected_product_code);
  const candidates = [
    key,
    [item.selected_color, item.selected_size].filter(Boolean).join(" - "),
    item.selected_color ?? "",
    item.selected_size ?? "",
    item.selected_product_code ?? "",
  ].filter(Boolean) as string[];

  for (const k of candidates) {
    if (eoMap[k]) return String(eoMap[k]);
  }
  return null;
}
