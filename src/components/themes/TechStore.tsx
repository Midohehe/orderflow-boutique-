import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Instagram, Facebook, MessageCircle, Zap, ArrowLeft } from "lucide-react";

interface Product { id: string; name: string; slug: string; price: number; original_price: number | null; images: string[]; }
interface Props { products: Product[]; currencySymbol: string; onOpenProduct: (slug: string) => void; ownerId?: string | null; }
interface HS { logo_text: string; logo_image: string | null; tagline: string | null; instagram_url: string | null; facebook_url: string | null; whatsapp_url: string | null; hero_image: string | null; hero_title: string | null; hero_subtitle: string | null; gallery_images: string[]; }

/** Modern Tech Grid — Bento layout, neon accent, mono font */
export default function TechStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const [s, setS] = useState<HS | null>(null);
  useEffect(() => {
    const id = "tech-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Tajawal:wght@400;700;900&display=swap";
      document.head.appendChild(l);
    }
    if (!ownerId) return;
    supabase.from("header_settings").select("*").eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }: any) => data && setS({ ...data, gallery_images: data.gallery_images || [] }));
  }, [ownerId]);

  const heroImg = s?.hero_image || products[0]?.images?.[0];
  const heroTitle = s?.hero_title || "تكنولوجيا المستقبل";
  const heroSub = s?.hero_subtitle || "أحدث المنتجات بأداء استثنائي";

  return (
    <div dir="rtl" className="min-h-screen bg-[#09090b] text-zinc-100" style={{ fontFamily: "Tajawal, sans-serif" }}>
      <header className="border-b border-zinc-800 sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {s?.logo_image ? <img src={s.logo_image} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <Zap className="w-6 h-6 text-emerald-400" />}
            <div>
              <div className="text-lg font-bold">{s?.logo_text || "TECH"}</div>
              <div className="text-[10px] text-emerald-400/80" style={{ fontFamily: "'JetBrains Mono', monospace" }}>// online</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-zinc-500">
            {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" className="hover:text-emerald-400"><Instagram className="w-4 h-4" /></a>}
            {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener" className="hover:text-emerald-400"><Facebook className="w-4 h-4" /></a>}
            {s?.whatsapp_url && <a href={s.whatsapp_url} target="_blank" rel="noopener" className="hover:text-emerald-400"><MessageCircle className="w-4 h-4" /></a>}
          </div>
        </div>
      </header>

      {/* Bento Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-4 grid-rows-2 gap-3 sm:gap-4 h-[420px] sm:h-[480px]">
          {/* Big hero */}
          <div className="col-span-4 md:col-span-3 row-span-2 relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
            {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
            <div className="absolute inset-0 bg-gradient-to-tl from-zinc-950 via-zinc-950/40 to-transparent" />
            <div className="relative h-full p-6 sm:p-10 flex flex-col justify-end">
              <div className="inline-flex items-center gap-2 w-fit mb-4 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> NEW_DROP
              </div>
              <h1 className="text-4xl sm:text-6xl font-black mb-3 leading-tight">{heroTitle}</h1>
              <p className="text-zinc-400 max-w-md">{heroSub}</p>
            </div>
          </div>
          {/* Stat cards */}
          <div className="hidden md:flex rounded-2xl border border-zinc-800 bg-gradient-to-br from-emerald-500/10 to-transparent p-5 flex-col justify-between">
            <div className="text-emerald-400 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>// shipping</div>
            <div>
              <div className="text-3xl font-black">100%</div>
              <div className="text-xs text-zinc-500">توصيل لكل ليبيا</div>
            </div>
          </div>
          <div className="hidden md:flex rounded-2xl border border-zinc-800 bg-zinc-900 p-5 flex-col justify-between">
            <div className="text-emerald-400 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>// items</div>
            <div>
              <div className="text-3xl font-black">{products.length}</div>
              <div className="text-xs text-zinc-500">منتج متوفر</div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      {s?.gallery_images && s.gallery_images.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-8">
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {s.gallery_images.slice(0, 6).map((img, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-zinc-800">
                <img src={img} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-20">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-black">المنتجات</h2>
          <span className="text-xs text-emerald-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>[{String(products.length).padStart(3, "0")}]</span>
        </div>
        {products.length === 0 ? (
          <div className="text-center text-zinc-600 py-16"><ShoppingBag className="w-12 h-12 mx-auto mb-3" />لا توجد منتجات</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {products.map(p => (
              <button key={p.id} onClick={() => onOpenProduct(p.slug)} className="text-right group rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/50 hover:border-emerald-400/50 hover:bg-zinc-900 transition-all">
                <div className="aspect-square overflow-hidden bg-zinc-950 relative">
                  {p.images[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full grid place-items-center text-zinc-700"><ShoppingBag /></div>}
                  {p.original_price && p.original_price > p.price && (
                    <div className="absolute top-2 right-2 bg-emerald-400 text-black text-[10px] font-bold px-2 py-0.5 rounded" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      -{Math.round((1 - p.price / p.original_price) * 100)}%
                    </div>
                  )}
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="text-sm font-semibold line-clamp-2 mb-2 min-h-[2.5rem]">{p.name}</h3>
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-emerald-400 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.price}</span>
                      <span className="text-xs text-zinc-500">{currencySymbol}</span>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-800 py-8 text-center text-zinc-500 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        // © {new Date().getFullYear()} {s?.logo_text || "TECH"} — all systems operational
      </footer>
    </div>
  );
}