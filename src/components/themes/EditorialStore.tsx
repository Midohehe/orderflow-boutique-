import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Instagram, Facebook, MessageCircle } from "lucide-react";

interface Product { id: string; name: string; slug: string; price: number; original_price: number | null; images: string[]; }
interface Props { products: Product[]; currencySymbol: string; onOpenProduct: (slug: string) => void; ownerId?: string | null; }
interface HS { logo_text: string; logo_image: string | null; tagline: string | null; instagram_url: string | null; facebook_url: string | null; whatsapp_url: string | null; hero_image: string | null; hero_title: string | null; hero_subtitle: string | null; gallery_images: string[]; }

/** Minimal Editorial — Swiss/magazine layout, ample whitespace */
export default function EditorialStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const [s, setS] = useState<HS | null>(null);
  useEffect(() => {
    const id = "editorial-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@300;400;600&display=swap";
      document.head.appendChild(l);
    }
    if (!ownerId) return;
    supabase.from("header_settings").select("*").eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }: any) => data && setS({ ...data, gallery_images: data.gallery_images || [] }));
  }, [ownerId]);

  const heroImg = s?.hero_image || products[0]?.images?.[0];
  const heroTitle = s?.hero_title || "إصدار جديد";
  const heroSub = s?.hero_subtitle || "مجموعة محدودة لهذا الموسم";

  return (
    <div dir="rtl" className="min-h-screen bg-[#fafaf7] text-neutral-900" style={{ fontFamily: "Inter, sans-serif" }}>
      <header className="border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
          <div className="text-xs tracking-[0.4em] uppercase text-neutral-500">Issue 01 · {new Date().getFullYear()}</div>
          <div className="text-xl sm:text-2xl" style={{ fontFamily: "'DM Serif Display', serif" }}>{s?.logo_text || "Editorial"}</div>
          <div className="flex items-center gap-3 text-neutral-400">
            {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" className="hover:text-black"><Instagram className="w-4 h-4" /></a>}
            {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener" className="hover:text-black"><Facebook className="w-4 h-4" /></a>}
            {s?.whatsapp_url && <a href={s.whatsapp_url} target="_blank" rel="noopener" className="hover:text-black"><MessageCircle className="w-4 h-4" /></a>}
          </div>
        </div>
      </header>

      {/* Hero — split */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-16 sm:py-24 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <div className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-6">— Feature</div>
          <h1 className="text-5xl sm:text-7xl leading-[1.05] mb-6" style={{ fontFamily: "'DM Serif Display', serif" }}>{heroTitle}</h1>
          <p className="text-neutral-600 text-lg max-w-md leading-relaxed">{heroSub}</p>
          <div className="mt-8 h-px w-24 bg-neutral-900" />
        </div>
        <div className="aspect-[4/5] bg-neutral-200 overflow-hidden">
          {heroImg && <img src={heroImg} alt="" className="w-full h-full object-cover" />}
        </div>
      </section>

      {/* Gallery */}
      {s?.gallery_images && s.gallery_images.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 sm:px-10 pb-16">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {s.gallery_images.slice(0, 6).map((img, i) => (
              <div key={i} className="aspect-square overflow-hidden bg-neutral-200">
                <img src={img} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pb-24">
        <div className="flex items-baseline justify-between border-b border-neutral-900 pb-4 mb-10">
          <h2 className="text-3xl sm:text-4xl" style={{ fontFamily: "'DM Serif Display', serif" }}>المنتجات</h2>
          <div className="text-xs tracking-[0.3em] uppercase text-neutral-500">{products.length} item{products.length !== 1 ? "s" : ""}</div>
        </div>
        {products.length === 0 ? (
          <div className="text-center text-neutral-400 py-16"><ShoppingBag className="w-12 h-12 mx-auto mb-3" />لا توجد منتجات</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {products.map(p => (
              <button key={p.id} onClick={() => onOpenProduct(p.slug)} className="text-right group">
                <div className="aspect-[3/4] overflow-hidden bg-neutral-200 mb-4">
                  {p.images[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /> : <div className="w-full h-full grid place-items-center text-neutral-300"><ShoppingBag /></div>}
                </div>
                <h3 className="text-base sm:text-lg font-light tracking-wide mb-1 line-clamp-1" style={{ fontFamily: "'DM Serif Display', serif" }}>{p.name}</h3>
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{p.price} {currencySymbol}</span>
                  {p.original_price && p.original_price > p.price && <span className="text-neutral-400 line-through">{p.original_price}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-neutral-200 py-8 text-center text-xs tracking-[0.3em] uppercase text-neutral-500">
        © {new Date().getFullYear()} {s?.logo_text || "Editorial"}
      </footer>
    </div>
  );
}