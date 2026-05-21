import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Sparkles, Instagram, Facebook, MessageCircle } from "lucide-react";

interface Product { id: string; name: string; slug: string; price: number; original_price: number | null; images: string[]; }
interface Props { products: Product[]; currencySymbol: string; onOpenProduct: (slug: string) => void; ownerId?: string | null; }
interface HS { logo_text: string; logo_image: string | null; tagline: string | null; instagram_url: string | null; facebook_url: string | null; whatsapp_url: string | null; hero_image: string | null; hero_title: string | null; hero_subtitle: string | null; gallery_images: string[]; }

/** Glassmorphism Luxury — dark + gold + glass cards */
export default function LuxuryStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const [s, setS] = useState<HS | null>(null);
  useEffect(() => {
    const id = "luxury-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=Tajawal:wght@400;700&display=swap";
      document.head.appendChild(l);
    }
    if (!ownerId) return;
    supabase.from("header_settings").select("*").eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }: any) => data && setS({ ...data, gallery_images: data.gallery_images || [] }));
  }, [ownerId]);

  const heroImg = s?.hero_image || products[0]?.images?.[0];
  const heroTitle = s?.hero_title || "تجربة فاخرة";
  const heroSub = s?.hero_subtitle || "اكتشف مجموعتنا المختارة بعناية";

  return (
    <div dir="rtl" className="min-h-screen text-white" style={{ fontFamily: "Tajawal, sans-serif", background: "radial-gradient(ellipse at top, #1a1530 0%, #0a0612 60%)" }}>
      {/* Top bar */}
      <header className="border-b border-white/10 backdrop-blur-xl bg-black/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {s?.logo_image ? <img src={s.logo_image} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-amber-300/50" /> : <Sparkles className="w-6 h-6 text-amber-300" />}
            <div>
              <div className="text-lg sm:text-xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: "#e8c87a" }}>{s?.logo_text || "Luxury Store"}</div>
              {s?.tagline && <div className="text-[10px] text-white/50 tracking-[0.3em] uppercase">{s.tagline}</div>}
            </div>
          </div>
          <div className="flex items-center gap-3 text-white/60">
            {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" className="hover:text-amber-300"><Instagram className="w-4 h-4" /></a>}
            {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener" className="hover:text-amber-300"><Facebook className="w-4 h-4" /></a>}
            {s?.whatsapp_url && <a href={s.whatsapp_url} target="_blank" rel="noopener" className="hover:text-amber-300"><MessageCircle className="w-4 h-4" /></a>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <div className="relative rounded-3xl overflow-hidden border border-amber-300/20" style={{ minHeight: 360 }}>
          {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
          <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/40 to-transparent" />
          <div className="relative p-8 sm:p-16 flex flex-col justify-center min-h-[360px]">
            <div className="inline-block w-fit mb-4 px-4 py-1.5 rounded-full bg-amber-300/10 border border-amber-300/30 text-amber-200 text-xs tracking-[0.3em] uppercase">Premium Collection</div>
            <h1 className="text-4xl sm:text-6xl font-bold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: "#f4d98a" }}>{heroTitle}</h1>
            <p className="text-white/70 max-w-md text-lg">{heroSub}</p>
          </div>
        </div>
      </section>

      {/* Gallery banners */}
      {s?.gallery_images && s.gallery_images.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 mb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {s.gallery_images.slice(0, 4).map((img, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10 group">
                <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-amber-200" style={{ fontFamily: "'Cormorant Garamond', serif" }}>المجموعة</h2>
          <div className="w-16 h-px bg-amber-300/50 mx-auto mt-3" />
        </div>
        {products.length === 0 ? (
          <div className="text-center text-white/40 py-16"><ShoppingBag className="w-12 h-12 mx-auto mb-3" />لا توجد منتجات</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map(p => (
              <button key={p.id} onClick={() => onOpenProduct(p.slug)} className="group text-right backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden hover:border-amber-300/50 hover:bg-white/[0.07] transition-all">
                <div className="aspect-square overflow-hidden bg-black/30">
                  {p.images[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full grid place-items-center text-white/20"><ShoppingBag /></div>}
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-white/90 line-clamp-2 mb-2">{p.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-amber-300 font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.3rem" }}>{p.price} {currencySymbol}</span>
                    {p.original_price && p.original_price > p.price && <span className="text-white/30 line-through text-xs">{p.original_price}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-white/40 text-sm">
        © {new Date().getFullYear()} {s?.logo_text || "Luxury Store"}
      </footer>
    </div>
  );
}