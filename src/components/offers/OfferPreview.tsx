import type { OfferDesign, OfferPricing } from "@/lib/offers/types";

export function OfferPreview({
  design,
  pricing,
}: {
  design: OfferDesign;
  pricing: OfferPricing;
}) {
  const discountLabel =
    pricing.mode === "percent_discount"
      ? `${pricing.percentDiscount}%`
      : pricing.mode === "fixed_discount"
        ? `${pricing.fixedDiscount}`
        : pricing.mode === "free_product"
          ? "مجاني"
          : "عرض";

  return (
    <div
      className="border overflow-hidden transition-all"
      style={{
        background: design.background || "#fff",
        borderRadius: design.borderRadius,
        boxShadow: design.shadow ? "0 20px 50px rgba(0,0,0,0.12)" : "none",
        maxWidth: Math.min(design.popupWidth || 480, 420),
        padding: design.spacing,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          {design.badge && (
            <span className="inline-flex text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 mb-2">
              {design.badge}
            </span>
          )}
          <h3 className="text-lg font-black text-slate-900 leading-tight">{design.title || "عنوان العرض"}</h3>
          {design.subtitle && (
            <p className="text-sm text-slate-600 mt-1">{design.subtitle}</p>
          )}
        </div>
        {design.showDiscountBadge && (
          <span className="shrink-0 text-sm font-black px-2.5 py-1 rounded-lg bg-rose-500 text-white">
            {discountLabel}
          </span>
        )}
      </div>

      {design.image ? (
        <img src={design.image} alt="" className="w-full h-36 object-cover rounded-xl mb-3" />
      ) : (
        <div className="w-full h-28 rounded-xl mb-3 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 text-sm">
          صورة العرض
        </div>
      )}

      {design.description && (
        <p className="text-sm text-slate-600 mb-3 whitespace-pre-wrap">{design.description}</p>
      )}

      {design.showCountdown && (
        <div className="mb-3 text-center text-xs font-bold text-rose-600 bg-rose-50 rounded-lg py-2">
          ⏱ ينتهي خلال {design.countdownMinutes} دقيقة
        </div>
      )}

      {design.urgencyMessage && (
        <p className="text-xs font-semibold text-amber-700 mb-3">{design.urgencyMessage}</p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="w-full font-bold text-white py-2.5 rounded-xl"
          style={{
            background:
              design.buttonStyle === "gradient"
                ? `linear-gradient(90deg, ${design.buttonColor}, #059669)`
                : design.buttonColor,
          }}
        >
          {design.primaryButtonText || "أضف العرض"}
        </button>
        <button type="button" className="w-full text-sm text-slate-500 py-1.5">
          {design.secondaryButtonText || "لا شكراً"}
        </button>
      </div>

      {(design.showTrustBadges || design.showGuarantee) && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
          {design.showGuarantee && <span>✓ ضمان الاستلام</span>}
          {design.showTrustBadges && <span>✓ دفع عند الاستلام</span>}
          {design.showFreeShippingLabel && <span>✓ شحن مجاني</span>}
        </div>
      )}
    </div>
  );
}
