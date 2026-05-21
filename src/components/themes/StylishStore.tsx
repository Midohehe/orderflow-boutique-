import { useEffect } from "react";
import StylishHero from "./StylishHero";
import StylishDiscountBanner from "./StylishDiscountBanner";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  images: string[];
}

interface StylishStoreProps {
  products: Product[];
  currencySymbol: string;
  onOpenProduct: (slug: string) => void;
  storeName?: string;
}

/**
 * Full "Stylish" template applied to the store page:
 * - White editorial canvas, Playfair serif headlines, Inter body
 * - Hero with overlay text, discount banner, "Featured" + "Latest" sections,
 *   product cards with uppercase CTA and price treatment.
 */
export default function StylishStore({
  products,
  currencySymbol,
  onOpenProduct,
  storeName,
}: StylishStoreProps) {
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

  const featured = products.slice(0, 10);
  const latest = products.slice(10, 20);

  const Section = ({
    title,
    items,
  }: {
    title: string;
    items: Product[];
  }) => {
    if (items.length === 0) return null;
    return (
      <section dir="rtl" className="bg-white py-8 sm:py-14 px-3 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-6 sm:mb-10 border-b border-neutral-200 pb-4">
            <h2
              className="text-2xl sm:text-3xl font-bold uppercase tracking-wide text-black"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {title}
            </h2>
            <span className="text-[11px] tracking-[0.3em] font-bold uppercase text-neutral-500">
              {items.length} منتج
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {items.map((p) => {
              const hasDiscount = p.original_price && p.original_price > p.price;
              const discount = hasDiscount
                ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100)
                : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenProduct(p.slug)}
                  className="group text-right block"
                >
                  <div className="relative aspect-[3/4] bg-neutral-100 overflow-hidden">
                    {p.images?.[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-neutral-300 text-sm">
                        لا توجد صورة
                      </div>
                    )}
                    {hasDiscount && (
                      <span className="absolute top-3 right-3 bg-black text-white text-[10px] tracking-[0.2em] font-bold uppercase px-2 py-1">
                        -{discount}%
                      </span>
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-black text-white text-[11px] tracking-[0.25em] font-bold uppercase text-center py-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      عرض المنتج
                    </span>
                  </div>
                  <div className="pt-3 sm:pt-4">
                    <h3
                      className="text-sm sm:text-base font-bold text-black line-clamp-2 group-hover:opacity-70 transition-opacity"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 sm:mt-2">
                      <span className="text-sm sm:text-base font-bold text-black">
                        {p.price} {currencySymbol}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-neutral-400 line-through">
                          {p.original_price} {currencySymbol}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <StylishHero
        title={storeName ? `${storeName} — مجموعة الموسم` : "مجموعتنا الجديدة"}
        subtitle="اكتشف أحدث المنتجات بأسعار مميّزة · الدفع عند الاستلام · شحن لكل ليبيا"
        imageUrl={products[0]?.images?.[0]}
        ctaText="تسوّق الآن"
        badge="عروض الموسم"
        onCta={() => {
          document.getElementById("stylish-featured")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div id="stylish-featured">
        <Section title="منتجات مميزة" items={featured} />
      </div>

      <StylishDiscountBanner
        onCta={() => {
          document.getElementById("stylish-latest")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div id="stylish-latest">
        <Section title="أحدث المنتجات" items={latest.length > 0 ? latest : []} />
      </div>

      {/* Footer strip */}
      <section dir="rtl" className="bg-black text-white py-10 px-3 sm:px-6 lg:px-10 mt-6">
        <div className="mx-auto max-w-7xl grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-right">
          {[
            { t: "شحن لكل ليبيا", d: "توصيل سريع لجميع المدن" },
            { t: "الدفع عند الاستلام", d: "ادفع عند وصول طلبك" },
            { t: "استبدال مجاني", d: "خلال 7 أيام من الاستلام" },
          ].map((b) => (
            <div key={b.t}>
              <h3
                className="text-lg font-bold uppercase tracking-wider"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {b.t}
              </h3>
              <p className="text-sm text-white/70 mt-1">{b.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
