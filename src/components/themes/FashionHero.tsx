import { ArrowLeft } from "lucide-react";

interface FashionHeroProps {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  primaryCtaText?: string;
  secondaryCtaText?: string;
  onPrimaryCta?: () => void;
  onSecondaryCta?: () => void;
  sideTextRight?: string; // appears on the right (in RTL the "outer" right edge)
  sideTextLeft?: string;
}

/**
 * Hero inspired by the editorial "Fashion Sale" layout:
 * - Bold framed canvas on a warm neutral background
 * - Large image on one side, oversized headline + two CTAs on the other
 * - Vertical micro-copy on both outer edges
 *
 * Uses scoped CSS variables so the component looks consistent on both /p/:slug
 * and /store regardless of the surrounding app theme.
 */
export default function FashionHero({
  title,
  subtitle,
  description,
  imageUrl,
  primaryCtaText = "اشترِ الآن",
  secondaryCtaText,
  onPrimaryCta,
  onSecondaryCta,
  sideTextRight = "أحدث المجموعات",
  sideTextLeft = "تخفيضات الموسم",
}: FashionHeroProps) {
  return (
    <section
      dir="rtl"
      className="w-full px-3 sm:px-6 lg:px-10 py-6 sm:py-10"
      style={{ background: "#d6c9b6" }}
    >
      <div
        className="relative mx-auto max-w-7xl border-2 border-black/90 bg-[#d6c9b6] px-4 sm:px-8 lg:px-14 py-8 sm:py-12 lg:py-16 overflow-hidden"
      >
        {/* Top nav row (decorative — real header is rendered separately) */}
        <div className="hidden md:flex items-center justify-between text-[11px] tracking-[0.25em] font-bold text-black/80 mb-10 lg:mb-14">
          <span className="opacity-0 select-none">.</span>
          <span className="opacity-0 select-none">.</span>
        </div>

        {/* Vertical side ticker — right edge (RTL outer) */}
        <div className="hidden md:flex absolute top-1/2 right-2 lg:right-4 -translate-y-1/2 items-center gap-3">
          <span className="block w-px h-12 bg-black/70" />
          <span
            className="text-[10px] tracking-[0.35em] font-bold text-black/80 whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {sideTextRight}
          </span>
          <span className="block w-px h-12 bg-black/70" />
        </div>
        {/* Vertical side ticker — left edge */}
        <div className="hidden md:flex absolute top-1/2 left-2 lg:left-4 -translate-y-1/2 items-center gap-3">
          <span className="block w-px h-12 bg-black/70" />
          <span
            className="text-[10px] tracking-[0.35em] font-bold text-black/80 whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {sideTextLeft}
          </span>
          <span className="block w-px h-12 bg-black/70" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          {/* Text column — RTL: right side */}
          <div className="order-2 lg:order-1 text-right">
            {subtitle && (
              <p className="text-xs sm:text-sm font-bold tracking-[0.25em] text-black/70 mb-3">
                {subtitle}
              </p>
            )}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.05] text-black tracking-tight">
              {title}
            </h1>
            <div className="my-5 sm:my-7 h-px w-24 bg-black/80" />
            {description && (
              <p className="text-sm sm:text-base text-black/75 leading-relaxed max-w-md mb-6 sm:mb-8">
                {description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <button
                type="button"
                onClick={onPrimaryCta}
                className="group inline-flex items-center gap-2 border-2 border-black bg-transparent text-black font-bold tracking-wider text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 hover:bg-black hover:text-[#d6c9b6] transition-colors"
              >
                {primaryCtaText}
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </button>
              {secondaryCtaText && (
                <button
                  type="button"
                  onClick={onSecondaryCta}
                  className="inline-flex items-center gap-2 bg-white/70 text-black font-bold tracking-wider text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 hover:bg-white transition-colors"
                >
                  {secondaryCtaText}
                </button>
              )}
            </div>
          </div>

          {/* Image column — RTL: left side */}
          <div className="order-1 lg:order-2 relative">
            {/* Decorative tiny shapes */}
            <div className="hidden lg:block absolute -top-4 -left-6 w-3 h-3 border border-black/80 rotate-45" />
            <div className="hidden lg:block absolute bottom-6 -right-4 w-2 h-2 bg-black/80" />
            <div className="hidden lg:block absolute top-1/3 -left-8 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-black/80" />

            <div className="aspect-[4/5] w-full max-w-md mx-auto bg-black/5 overflow-hidden relative">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-black/40 text-sm">
                  لا توجد صورة
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
