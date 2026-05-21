import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Instagram, Facebook, MessageCircle, Zap, ArrowLeft } from "lucide-react";

interface Product { id: string; name: string; slug: string; price: number; original_price: number | null; images: string[]; }
interface Props { products: Product[]; currencySymbol: string; onOpenProduct: (slug: string) => void; ownerId?: string | null; }
interface HS { logo_text: string; logo_image: string | null; tagline: string | null; instagram_url: string | null; facebook_url: string | null; whatsapp_url: string | null; hero_image: string | null; hero_title: string | null; hero_subtitle: string | null; gallery_images: string[]; }

/** Sport — أسود/برتقالي، خطوط قطرية حادة، طاقة رياضية */
export default function SportStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const [s, setS] = useState<HS | null>(null);
  useEffect(() => {
    const id = "sport-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&display=swap";
      document.head.appendChild(l);
    }
    if (!ownerId) return;
    supabase.from("header_settings").select("*").eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }: any) => data && setS({ ...data, gallery_images: data.gallery_images || [] }));
  }, [ownerId]);

  const heroImg = s?.hero_image || products[0]?.images?.[0];
  const heroTitle = s?.hero_title || "تحرك أسرع. اربح أقوى.";
  const heroSub = s?.hero_subtitle || "تشكيلة رياضية لكل بطل — من التمرين للملعب.";

  return (
    <div dir="rtl" className="min-h-screen bg-neutral-950 text-white" style={{ fontFamily: "Cairo, sans-serif" }}>
      <header className="bg-neutral-950/95 backdrop-blur sticky top-0 z-40 border-b border-orange-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {s?.logo_image ? <img src={s.logo_image} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-500" /> : <Zap className="w-6 h-6 text-orange-500" />}
            <div className="text-xl sm:text-2xl font-black tracking-tight uppercase">{s?.logo_text || "SPORT"}</div>
          </div>
          <div className="flex items-center gap-2">
            {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center bg-neutral-800 hover:bg-orange-500 transition-colors"><Instagram className="w-4 h-4" /></a>}
            {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center bg-neutral-800 hover:bg-orange-500 transition-colors"><Facebook className="w-4 h-4" /></a>}
            {s?.whatsapp_url && <a href={s.whatsapp_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center bg-neutral-800 hover:bg-orange-500 transition-colors"><MessageCircle className="w-4 h-4" /></a>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-orange-500/20">
        <div className="absolute inset-0" style={{ background: "linear-gradient(115deg, #f97316 0%, #f97316 40%, transparent 40%, transparent 100%)", opacity: 0.15 }} />
        <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-l from-transparent to-orange-500/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-1 bg-orange-500 text-black font-black px-3 py-1 text-xs uppercase tracking-widest mb-5">
              <Zap className="w-3 h-3" />Performance
            </div>
            <h1 className="text-5xl sm:text-7xl font-black leading-[0.95] uppercase mb-5">{heroTitle}</h1>
            <p className="text-neutral-300 text-lg max-w-md mb-7">{heroSub}</p>
            <button onClick={() => document.getElementById("sport-grid")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-black font-black uppercase tracking-wider px-7 py-4 transition-colors">
              تسوّق الآن <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
          {heroImg && (
            <div className="relative">
              <div className="absolute -inset-2 bg-orange-500" style={{ clipPath: "polygon(0 10%, 100% 0, 100% 90%, 0 100%)" }} />
              <div className="relative aspect-[4/5] overflow-hidden" style={{ clipPath: "polygon(0 10%, 100% 0, 100% 90%, 0 100%)" }}>
                <img src={heroImg} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Gallery */}
      {s?.gallery_images && s.gallery_images.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {s.gallery_images.map((img, i) => (
              <div key={i} className="flex-none w-44 h-44 sm:w-56 sm:h-56 overflow-hidden ring-1 ring-orange-500/30 hover:ring-orange-500 transition-all">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section id="sport-grid" className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
        <div className="flex items-end justify-between mb-10 border-b border-orange-500/30 pb-4">
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">المجموعة <span className="text-orange-500">/</span> Shop</h2>
          <span className="text-neutral-500 text-sm">{products.length} منتج</span>
        </div>
        {products.length === 0 ? (
          <div className="text-center text-neutral-500 py-16"><ShoppingBag className="w-12 h-12 mx-auto mb-3" />لا توجد منتجات</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <button key={p.id} onClick={() => onOpenProduct(p.slug)} className="text-right group relative">
                <div className="aspect-[4/5] overflow-hidden bg-neutral-900 mb-3 relative">
                  {p.images[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full grid place-items-center text-neutral-700"><ShoppingBag /></div>}
                  <div className="absolute inset-x-0 bottom-0 h-0 group-hover:h-1 bg-orange-500 transition-all duration-300" />
                </div>
                <h3 className="font-bold text-sm sm:text-base line-clamp-2 mb-1 uppercase">{p.name}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-orange-500 font-black">{p.price} {currencySymbol}</span>
                  {p.original_price && p.original_price > p.price && <span className="text-neutral-500 line-through text-xs">{p.original_price}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="bg-black border-t border-orange-500/30 py-8 text-center text-neutral-500 text-sm uppercase tracking-widest">
        © {new Date().getFullYear()} {s?.logo_text || "SPORT"} — Built for champions
      </footer>
    </div>
  );
}