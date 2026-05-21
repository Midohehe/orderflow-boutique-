interface StylishDiscountBannerProps {
  title?: string;
  description?: string;
  bigText?: string;
  ctaText?: string;
  onCta?: () => void;
}

export default function StylishDiscountBanner({
  title = "خصم 10٪ على أول طلب",
  description = "اشترك لتحصل على خصومات حصرية على جميع المشتريات",
  bigText = "10% OFF",
  ctaText = "تواصل معنا",
  onCta,
}: StylishDiscountBannerProps) {
  return (
    <section dir="rtl" className="bg-white py-6 sm:py-10 px-3 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="relative bg-neutral-100 px-5 sm:px-10 py-8 sm:py-12 overflow-hidden">
          <div
            className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 font-black text-neutral-200 select-none pointer-events-none"
            style={{ fontSize: "clamp(80px, 14vw, 180px)", lineHeight: 1, letterSpacing: "-0.05em", fontFamily: "'Playfair Display', serif" }}
          >
            {bigText}
          </div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-10">
            <div className="text-right">
              <h2
                className="text-2xl sm:text-3xl font-bold text-black"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {title}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-neutral-600">{description}</p>
            </div>
            <button
              type="button"
              onClick={onCta}
              className="bg-black text-white uppercase font-bold tracking-[0.2em] text-xs sm:text-sm px-6 sm:px-8 py-3 sm:py-4 hover:bg-neutral-800 transition-colors"
            >
              {ctaText}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
