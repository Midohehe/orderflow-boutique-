import type { OfferPricing, OfferProductRow } from "./types";

export type OfferPriceBreakdown = {
  productName: string;
  originalPrice: number;
  finalPrice: number;
  savings: number;
  discountLabel: string;
  showOriginal: boolean;
};

export function computeOfferPriceBreakdown(
  pricing: OfferPricing,
  product?: OfferProductRow | null,
  currencySymbol = "",
): OfferPriceBreakdown | null {
  const original = Number((product as { product_price?: number } | null)?.product_price);
  const hasOriginal = Number.isFinite(original) && original > 0;
  const base = hasOriginal ? original : 0;

  let finalPrice = base;
  let discountLabel = "عرض";

  switch (pricing.mode) {
    case "percent_discount": {
      const pct = Math.max(0, Math.min(100, Number(pricing.percentDiscount) || 0));
      finalPrice = hasOriginal ? Number((base * (1 - pct / 100)).toFixed(2)) : 0;
      discountLabel = `خصم ${pct}%`;
      break;
    }
    case "fixed_discount": {
      const fixed = Math.max(0, Number(pricing.fixedDiscount) || 0);
      finalPrice = hasOriginal ? Math.max(0, Number((base - fixed).toFixed(2))) : 0;
      discountLabel = `وفر ${fixed} ${currencySymbol}`.trim();
      break;
    }
    case "custom_price": {
      finalPrice = Math.max(0, Number(pricing.customPrice) || 0);
      discountLabel = hasOriginal && finalPrice < base
        ? `وفر ${Number((base - finalPrice).toFixed(2))} ${currencySymbol}`.trim()
        : "سعر خاص";
      break;
    }
    case "free_product": {
      finalPrice = 0;
      discountLabel = "مجاني";
      break;
    }
    case "free_shipping": {
      finalPrice = base;
      discountLabel = "شحن مجاني";
      break;
    }
    default: {
      finalPrice = base;
      discountLabel = "عرض";
    }
  }

  if (!hasOriginal && pricing.mode !== "custom_price" && pricing.mode !== "free_product") {
    return {
      productName: product?.product_name || "",
      originalPrice: 0,
      finalPrice: 0,
      savings: 0,
      discountLabel,
      showOriginal: false,
    };
  }

  const originalPrice = hasOriginal ? base : finalPrice;
  const savings = Math.max(0, Number((originalPrice - finalPrice).toFixed(2)));

  return {
    productName: product?.product_name || "",
    originalPrice,
    finalPrice,
    savings,
    discountLabel,
    showOriginal: originalPrice > finalPrice,
  };
}
