import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Instagram, Facebook, MessageCircle, Heart } from "lucide-react";

interface Product { id: string; name: string; slug: string; price: number; original_price: number | null; images: string[]; }
interface Props { products: Product[]; currencySymbol: string; onOpenProduct: (slug: string) => void; ownerId?: string | null; }
interface HS { logo_text: string; logo_image: string | null; tagline: string | null; instagram_url: string | null; facebook_url: string | null; whatsapp_url: string | null; hero_image: string | null; hero_title: string | null; hero_subtitle: string | null; gallery_images: string[]; }

/** Boutique — وردي ناعم، خطوط رفيعة، أنوثة راقية */
export default function BoutiqueStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const [s, setS] = useState<HS | null>(null);
  useEffect(() => {
    const id = "boutique-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Tajawal:wght@300;400;500;700&display=swap";
      document.head.appendChild(l);
    }
    if (!ownerId) return;
    supabase.from("header_settings").select("*").eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }: any) => data && setS({ ...data, gallery_images: data.gallery_images || [] }));
  }, [ownerId]);

  const heroImg = s?.hero_image || products[0]?.images?.[0];
  const heroTitle = s?.hero_title || "أناقة تُحكى بهدوء";
  const heroSub = s?.hero_subtitle || "قطع مختارة بعناية لتُبرز جمالك الطبيعي.";

  return (
    <div dir="rtl" className="min-h-screen bg-[#fdf6f4] text-neutral-800" style={{ fontFamily: "Tajawal, sans-serif" }}>
      <header className="bg-[#fdf6f4]/90 backdrop-blur sticky top-0 z-40 border-b border-pink-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {s?.logo_image
              ? <img src={s.logo_image} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-pink-300/60" />
              : <div className="w-10 h-10 rounded-full grid place-items-center bg-pink-200/60 text-pink-700"><Heart className="w-4 h-4" /></div>}
            <div>
              <div className="text-2xl tracking-wide text-pink-900" style={{ fontFamily: "Cormorant Garamond, serif", fontStyle: "italic" }}>{s?.logo_text || "Boutique"}</div>
              {s?.tagline && <div className="text-[11px] text-pink-700/70 tracking-widest uppercase">{s.tagline}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-full text-pink-700 hover:bg-pink-100 transition-colors"><Instagram className="w-4 h-4" /></a>}
            {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-full text-pink-700 hover:bg-pink-100 transition-colors"><Facebook className="w-4 h-4" /></a>}
            {s?.whatsapp_url && <a href={s.whatsapp_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-full text-pink-700 hover:bg-pink-100 transition-colors"><MessageCircle className="w-4 h-4" /></a>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs tracking-[0.3em] uppercase text-pink-600 mb-5">مجموعة الموسم</div>
            <h1 className="text-5xl sm:text-6xl leading-tight mb-5 text-pink-950" style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 500 }}>{heroTitle}</h1>
            <div className="w-16 h-px bg-pink-400 mb-5" />
            <p className="text-neutral-600 text-base max-w-md mb-7 leading-relaxed">{heroSub}</p>
            <button onClick={() => document.getElementById("boutique-grid")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-block bg-pink-900 hover:bg-pink-800 text-white px-8 py-3 rounded-full text-sm tracking-widest uppercase transition-colors">
              اكتشفي المجموعة
            </button>
          </div>
          {heroImg && (
            <div className="relative">
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-pink-200/50" />
              <div className="relative aspect-[4/5] rounded-full overflow-hidden bg-pink-100 max-w-sm mx-auto" style={{ borderRadius: "48% 52% 50% 50% / 45% 45% 55% 55%" }}>
                <img src={heroImg} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Gallery */}
      {s?.gallery_images && s.gallery_images.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-10">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {s.gallery_images.map((img, i) => (
              <div key={i} className="flex-none w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden ring-1 ring-pink-200">
                <img src={img} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section id="boutique-grid" className="max-w-6xl mx-auto px-4 sm:px-8 pb-20">
        <div className="text-center mb-12">
          <div className="text-xs tracking-[0.3em] uppercase text-pink-600 mb-2">Collection</div>
          <h2 className="text-4xl sm:text-5xl text-pink-950" style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 500 }}>قطعنا المختارة</h2>
          <div className="w-12 h-px bg-pink-400 mx-auto mt-4" />
        </div>
        {products.length === 0 ? (
          <div className="text-center text-neutral-400 py-16"><ShoppingBag className="w-12 h-12 mx-auto mb-3" />لا توجد منتجات</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {products.map((p) => (
              <button key={p.id} onClick={() => onOpenProduct(p.slug)} className="text-center group">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-pink-50 mb-4 ring-1 ring-pink-100">
                  {p.images[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /> : <div className="w-full h-full grid place-items-center text-pink-300"><ShoppingBag /></div>}
                </div>
                <h3 className="text-pink-950 text-lg sm:text-xl line-clamp-2 mb-1" style={{ fontFamily: "Cormorant Garamond, serif" }}>{p.name}</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-pink-800 font-medium">{p.price} {currencySymbol}</span>
                  {p.original_price && p.original_price > p.price && <span className="text-neutral-400 line-through text-xs">{p.original_price}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-pink-200/60 py-8 text-center text-pink-700/70 text-sm tracking-wider">
        © {new Date().getFullYear()} {s?.logo_text || "Boutique"} — صُمم بشغف
      </footer>
    </div>
  );
}