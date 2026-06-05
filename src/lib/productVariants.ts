import { buildVariantKeys } from "@/components/ProductForm";

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
