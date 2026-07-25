import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OfferRecord } from "@/lib/offers/types";
import { resolveOfferDisplayImage } from "@/lib/offers/publicApi";
import { computeOfferPriceBreakdown } from "@/lib/offers/pricingDisplay";

type Props = {
  open: boolean;
  offer: OfferRecord | null;
  currencySymbol?: string;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function OfferRuntimeDialog({
  open,
  offer,
  currencySymbol = "",
  busy,
  onAccept,
  onDecline,
}: Props) {
  const acceptGuardRef = useRef(false);
  if (!offer) return null;

  const design = offer.design;
  const pricing = offer.pricing;
  const offerProduct = (offer.products || []).find((p) => p.is_default) || offer.products?.[0];
  const image = resolveOfferDisplayImage(offer);
  const breakdown = computeOfferPriceBreakdown(pricing, offerProduct, currencySymbol);

  const discountBadge =
    breakdown?.discountLabel ||
    (pricing.mode === "percent_discount"
      ? `${pricing.percentDiscount}%`
      : pricing.mode === "fixed_discount"
        ? `${pricing.fixedDiscount} ${currencySymbol}`.trim()
        : "عرض");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          // Accept flow closes the dialog — do NOT treat as decline
          if (acceptGuardRef.current || busy) {
            acceptGuardRef.current = false;
            return;
          }
          onDecline();
        }
      }}
    >
      <DialogContent
        className="p-0 border-0 bg-transparent shadow-none max-w-[min(96vw,480px)] sm:max-w-[480px]"
        aria-describedby="offer-runtime-desc"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{design.title || offer.name}</DialogTitle>
          <DialogDescription id="offer-runtime-desc">
            {design.subtitle || design.description || "عرض خاص"}
          </DialogDescription>
        </DialogHeader>

        <div
          className="overflow-hidden"
          style={{
            background: design.background || "#fff",
            borderRadius: design.borderRadius ?? 16,
            boxShadow: design.shadow !== false ? "0 20px 50px rgba(0,0,0,0.18)" : "none",
            padding: design.spacing ?? 20,
            maxWidth: design.popupWidth || 480,
            margin: "0 auto",
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0 text-right">
              {(design.badge || breakdown?.discountLabel) && (
                <span className="inline-flex text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 mb-2">
                  {design.badge || breakdown?.discountLabel}
                </span>
              )}
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {design.title || offer.name}
              </h3>
              {design.subtitle && (
                <p className="text-sm text-slate-600 mt-1">{design.subtitle}</p>
              )}
            </div>
            {(design.showDiscountBadge !== false) && (
              <span className="shrink-0 text-sm font-black px-2.5 py-1 rounded-lg bg-rose-500 text-white">
                {discountBadge}
              </span>
            )}
          </div>

          {image ? (
            <img src={image} alt="" className="w-full h-40 object-cover rounded-xl mb-3" />
          ) : null}

          {offerProduct?.product_name && (
            <p className="text-sm font-semibold text-slate-800 mb-2">{offerProduct.product_name}</p>
          )}

          {breakdown && (breakdown.finalPrice > 0 || breakdown.originalPrice > 0 || pricing.mode === "free_product") && (
            <div className="mb-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-right">
              <div className="flex items-end justify-between gap-3">
                <div>
                  {breakdown.showOriginal && (
                    <div className="text-sm text-slate-400 line-through">
                      {breakdown.originalPrice} {currencySymbol}
                    </div>
                  )}
                  <div className="text-2xl font-black text-emerald-600 leading-none">
                    {pricing.mode === "free_product"
                      ? "مجاني"
                      : `${breakdown.finalPrice} ${currencySymbol}`.trim()}
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  {breakdown.showOriginal && (
                    <div>قبل التخفيض: {breakdown.originalPrice} {currencySymbol}</div>
                  )}
                  <div className="font-semibold text-slate-700">
                    بعد التخفيض:{" "}
                    {pricing.mode === "free_product"
                      ? "0"
                      : breakdown.finalPrice}{" "}
                    {currencySymbol}
                  </div>
                  {breakdown.savings > 0 && (pricing.showSavings !== false) && (
                    <div className="font-bold text-rose-600">
                      وفّرت {breakdown.savings} {currencySymbol}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {design.description && (
            <p className="text-sm text-slate-600 mb-3 whitespace-pre-wrap">{design.description}</p>
          )}

          {design.urgencyMessage && (
            <p className="text-xs font-semibold text-amber-700 mb-3">{design.urgencyMessage}</p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                acceptGuardRef.current = true;
                onAccept();
              }}
              className="w-full font-bold text-white py-3 rounded-xl disabled:opacity-60"
              style={{
                background:
                  design.buttonStyle === "gradient"
                    ? `linear-gradient(90deg, ${design.buttonColor || "#059669"}, #059669)`
                    : design.buttonColor || "#059669",
              }}
            >
              {busy ? "جاري الإضافة للطلب…" : design.primaryButtonText || "أضف العرض"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDecline}
              className="w-full text-sm text-slate-500 py-2"
            >
              {design.secondaryButtonText || "لا شكراً"}
            </button>
          </div>

          {(design.showTrustBadges || design.showGuarantee || design.showFreeShippingLabel) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500 justify-end">
              {design.showGuarantee && <span>✓ ضمان الاستلام</span>}
              {design.showTrustBadges && <span>✓ دفع عند الاستلام</span>}
              {design.showFreeShippingLabel && <span>✓ شحن مجاني</span>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
