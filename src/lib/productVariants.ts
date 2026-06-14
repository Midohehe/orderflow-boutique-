import { buildVariantKeys } from "@/lib/variantKeys";

export interface ProductVariantSource {
  colors?: string[] | null;
  sizes?: string[] | null;
  product_codes?: string[] | null;
}

export interface ParsedVariantSelection {
  color: string;
  size: string;
  productCode: string;
}

/** All selectable variant keys for a product (color, size, or product code). */
export function getProductVariantKeys(product: ProductVariantSource | null | undefined): string[] {
  if (!product) return [];
  return buildVariantKeys(
    (product.colors || []).join(", "),
    (product.sizes || []).join(", "),
    (product.product_codes || []).join(", "),
  );
}

export function productUsesColorOrSize(product: ProductVariantSource | null | undefined): boolean {
  return ((product?.colors?.length ?? 0) > 0) || ((product?.sizes?.length ?? 0) > 0);
}

export function productHasVariants(product: ProductVariantSource | null | undefined): boolean {
  return getProductVariantKeys(product).length > 0;
}

/** True when the customer has no real choice (exactly one variant key). */
export function productHasSingleVariant(product: ProductVariantSource | null | undefined): boolean {
  return getProductVariantKeys(product).length === 1;
}

/** Parsed selection for the sole variant, or null when multiple/none. */
export function getSingleVariantSelection(
  product: ProductVariantSource | null | undefined,
): ParsedVariantSelection | null {
  const keys = getProductVariantKeys(product);
  if (keys.length !== 1 || !product) return null;
  return parseVariantKey(keys[0], product);
}

/** Split a variant key back into color / size / product code for order submission. */
export function parseVariantKey(
  key: string,
  product: ProductVariantSource,
): ParsedVariantSelection {
  const colors = product.colors || [];
  const sizes = product.sizes || [];
  if (key.includes(" - ")) {
    const [a, b] = key.split(" - ").map((s) => s.trim());
    return { color: a, size: b, productCode: "" };
  }
  if (colors.includes(key)) return { color: key, size: "", productCode: "" };
  if (sizes.includes(key)) return { color: "", size: key, productCode: "" };
  return { color: "", size: "", productCode: key };
}

export function selectionMatchesKey(
  sel: ParsedVariantSelection,
  key: string,
  product: ProductVariantSource,
): boolean {
  const parsed = parseVariantKey(key, product);
  if (parsed.color && sel.color !== parsed.color) return false;
  if (parsed.size && sel.size !== parsed.size) return false;
  if (parsed.productCode && sel.productCode !== parsed.productCode) return false;
  if (!parsed.color && !parsed.size && !parsed.productCode) return false;
  return true;
}

export interface ProductStockSource extends ProductVariantSource {
  variant_stock?: Record<string, number> | null;
  stock?: number;
}

/** Same key format as apply-order-stock edge function. */
export function buildVariantKeyFromSelection(sel: ParsedVariantSelection): string | null {
  const c = (sel.color || "").trim();
  const s = (sel.size || "").trim();
  const k = (sel.productCode || "").trim();
  if (c && s) return `${c} - ${s}`;
  if (c) return c;
  if (s) return s;
  if (k) return k;
  return null;
}

export function getVariantStockAmount(
  product: ProductStockSource | null | undefined,
  selection: ParsedVariantSelection,
  strictStock = false,
): number {
  if (!product) return 0;
  const key = buildVariantKeyFromSelection(selection);
  const vs = product.variant_stock || {};
  if (key && Object.prototype.hasOwnProperty.call(vs, key)) {
    return Number(vs[key]) || 0;
  }
  if (strictStock && productHasVariants(product)) {
    return 0;
  }
  return Number(product.stock) || 0;
}

export function isVariantSelectionOutOfStock(
  product: ProductStockSource | null | undefined,
  selection: ParsedVariantSelection,
  strictStock: boolean,
): boolean {
  if (!strictStock || !product) return false;
  return getVariantStockAmount(product, selection, true) <= 0;
}

export function isColorOptionOutOfStock(
  product: ProductStockSource | null | undefined,
  color: string,
  currentItem: ParsedVariantSelection,
  strictStock: boolean,
): boolean {
  if (!strictStock || !product) return false;
  const sizes = product.sizes || [];
  const colors = product.colors || [];
  if (colors.length && sizes.length) {
    if (currentItem.size) {
      return (
        getVariantStockAmount(product, { color, size: currentItem.size, productCode: "" }, true) <= 0
      );
    }
    return sizes.every(
      (size) => getVariantStockAmount(product, { color, size, productCode: "" }, true) <= 0,
    );
  }
  if (colors.length) {
    return getVariantStockAmount(product, { color, size: "", productCode: "" }, true) <= 0;
  }
  return false;
}

export function isSizeOptionOutOfStock(
  product: ProductStockSource | null | undefined,
  size: string,
  currentItem: ParsedVariantSelection,
  strictStock: boolean,
): boolean {
  if (!strictStock || !product) return false;
  const sizes = product.sizes || [];
  const colors = product.colors || [];
  if (colors.length && sizes.length) {
    if (currentItem.color) {
      return (
        getVariantStockAmount(product, { color: currentItem.color, size, productCode: "" }, true) <= 0
      );
    }
    return colors.every(
      (c) => getVariantStockAmount(product, { color: c, size, productCode: "" }, true) <= 0,
    );
  }
  if (sizes.length) {
    return getVariantStockAmount(product, { color: "", size, productCode: "" }, true) <= 0;
  }
  return false;
}

export function isCodeKeyOutOfStock(
  product: ProductStockSource | null | undefined,
  key: string,
  strictStock: boolean,
): boolean {
  if (!strictStock || !product) return false;
  return getVariantStockAmount(product, parseVariantKey(key, product), true) <= 0;
}
