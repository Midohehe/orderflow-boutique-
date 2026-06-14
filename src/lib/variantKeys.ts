/**
 * Pure variant-key helpers shared by the dashboard ProductForm and the public
 * landing page. Kept dependency-free so importing it never drags heavy editor
 * components (RichTextEditor, SearchableSelect, ProductForm) into the landing
 * bundle — that import chain previously bloated conversion pages.
 */
export const buildVariantKeys = (
  colorsCsv: string,
  sizesCsv: string,
  codesCsv: string
): string[] => {
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const colors = split(colorsCsv);
  const sizes = split(sizesCsv);
  const codes = split(codesCsv);

  const keys: string[] = [];
  if (colors.length && sizes.length) {
    colors.forEach((c) => sizes.forEach((s) => keys.push(`${c} - ${s}`)));
  } else if (colors.length) {
    keys.push(...colors);
  } else if (sizes.length) {
    keys.push(...sizes);
  }
  // Only treat product_codes as variant keys when the product has NO colors and NO sizes.
  // When colors/sizes exist, codes are per-variant SKUs (stored in variant_skus) — not separate variants.
  if (keys.length === 0 && codes.length) {
    codes.forEach((c) => {
      if (!keys.includes(c)) keys.push(c);
    });
  }
  return keys;
};
