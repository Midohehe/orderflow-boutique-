import { useEffect } from "react";

interface StylishHeroProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  ctaText?: string;
  onCta?: () => void;
  badge?: string;
}

/**
 * Hero inspired by the "Stylish" Bootstrap template:
 * - Large image card with bottom-left overlay text on a clean white canvas
 * - Oversized serif headline (Playfair-style), uppercase CTA with bottom border
 */
export default function StylishHero({
  title,
  subtitle,
  imageUrl,
  ctaText = "Shop Now",
  onCta,
  badge,
}: StylishHeroProps) {
  // Load Playfair Display + Inter once for the scoped Stylish theme.
  useEffect(() => {
    const id = "stylish-theme-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,900&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <section
      dir="rtl"
      className="w-full bg-white px-3 sm:px-6 lg:px-10 py-4 sm:py-6"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="relative mx-auto max-w-7xl overflow-hidden">
        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-neutral-100 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-neutral-400">
              لا توجد صورة
            </div>
          )}

          {/* Soft gradient for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

          {/* Overlay text — bottom-right in RTL */}
          <div className="absolute inset-0 flex items-end">
            <div className="p-5 sm:p-10 lg:p-16 max-w-2xl text-right ml-auto">
              {badge && (
                <span className="inline-block text-[10px] sm:text-xs tracking-[0.35em] font-bold text-white/90 bg-black/40 backdrop-blur px-3 py-1 mb-3 sm:mb-4">
                  {badge}
                </span>
              )}
              <h1
                className="text-white font-black leading-[1.05] text-3xl sm:text-5xl lg:text-6xl"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-3 sm:mt-4 text-white/90 text-sm sm:text-base max-w-md mr-0 ml-auto">
                  {subtitle}
                </p>
              )}
              <button
                type="button"
                onClick={onCta}
                className="mt-5 sm:mt-7 inline-block text-white uppercase font-bold tracking-[0.25em] text-xs sm:text-sm pb-2 border-b-2 border-white hover:text-white/80 hover:border-white/60 transition-colors"
              >
                {ctaText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
