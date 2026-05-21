import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Instagram, Facebook, MessageCircle, Gamepad2 } from "lucide-react";

interface Product { id: string; name: string; slug: string; price: number; original_price: number | null; images: string[]; }
interface Props { products: Product[]; currencySymbol: string; onOpenProduct: (slug: string) => void; ownerId?: string | null; }
interface HS { logo_text: string; logo_image: string | null; tagline: string | null; instagram_url: string | null; facebook_url: string | null; whatsapp_url: string | null; hero_image: string | null; hero_title: string | null; hero_subtitle: string | null; gallery_images: string[]; }

/** Gaming — بنفسجي/سيان نيون، شبكة، Glow */
export default function GamingStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const [s, setS] = useState<HS | null>(null);
  useEffect(() => {
    const id = "gaming-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@600;800;900&family=Orbitron:wght@600;800&display=swap";
      document.head.appendChild(l);
    }
    if (!ownerId) return;
    supabase.from("header_settings").select("*").eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }: any) => data && setS({ ...data, gallery_images: data.gallery_images || [] }));
  }, [ownerId]);

  const heroImg = s?.hero_image || products[0]?.images?.[0];
  const heroTitle = s?.hero_title || "ادخل عالم اللعب";
  const heroSub = s?.hero_subtitle || "أحدث الأجهزة والإكسسوارات لتجربة احترافية.";

  const grid = "linear-gradient(rgba(139,92,246,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.08) 1px, transparent 1px)";

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden" style={{ fontFamily: "Cairo, sans-serif" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: grid, backgroundSize: "40px 40px" }} />
      <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full bg-violet-600/20 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 rounded-full bg-cyan-500/20 blur-[120px] pointer-events-none" />

      <header className="relative z-40 bg-[#0a0a14]/80 backdrop-blur border-b border-violet-500/30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {s?.logo_image ? <img src={s.logo_image} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-cyan-400" /> : <Gamepad2 className="w-6 h-6 text-cyan-400" />}
            <div className="text-xl sm:text-2xl font-black tracking-wider" style={{ fontFamily: "Orbitron, sans-serif", textShadow: "0 0 12px rgba(34,211,238,.6)" }}>{s?.logo_text || "GAMER"}</div>
          </div>
          <div className="flex items-center gap-2">
            {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-md border border-violet-500/50 hover:border-cyan-400 hover:text-cyan-400 transition-colors"><Instagram className="w-4 h-4" /></a>}
            {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-md border border-violet-500/50 hover:border-cyan-400 hover:text-cyan-400 transition-colors"><Facebook className="w-4 h-4" /></a>}
            {s?.whatsapp_url && <a href={s.whatsapp_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-md border border-violet-500/50 hover:border-cyan-400 hover:text-cyan-400 transition-colors"><MessageCircle className="w-4 h-4" /></a>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-block px-3 py-1 mb-5 text-xs font-bold tracking-widest uppercase border border-cyan-400/50 text-cyan-400 rounded" style={{ boxShadow: "0 0 20px rgba(34,211,238,.3)" }}>● Online</div>
            <h1 className="text-5xl sm:text-7xl font-black leading-tight mb-5" style={{ fontFamily: "Orbitron, sans-serif" }}>
              <span className="bg-gradient-to-l from-cyan-400 to-violet-500 bg-clip-text text-transparent">{heroTitle}</span>
            </h1>
            <p className="text-neutral-300 text-lg max-w-md mb-7">{heroSub}</p>
            <button onClick={() => document.getElementById("gaming-grid")?.scrollIntoView({ behavior: "smooth" })}
              className="relative inline-block px-8 py-4 font-black uppercase tracking-wider bg-gradient-to-l from-violet-600 to-cyan-500 text-white rounded-md hover:scale-105 transition-transform"
              style={{ boxShadow: "0 0 30px rgba(139,92,246,.5)" }}>
              ابدأ التسوّق
            </button>
          </div>
          {heroImg && (
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-l from-violet-500 to-cyan-400 blur-md opacity-70" />
              <div className="relative aspect-square rounded-2xl overflow-hidden border border-cyan-400/30">
                <img src={heroImg} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Gallery */}
      {s?.gallery_images && s.gallery_images.length > 0 && (
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pb-10">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {s.gallery_images.map((img, i) => (
              <div key={i} className="flex-none w-44 h-44 sm:w-52 sm:h-52 rounded-xl overflow-hidden border border-violet-500/40 hover:border-cyan-400 transition-colors">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section id="gaming-grid" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pb-20">
        <h2 className="text-3xl sm:text-4xl font-black mb-8" style={{ fontFamily: "Orbitron, sans-serif" }}>
          <span className="text-cyan-400">&gt;</span> المنتجات
        </h2>
        {products.length === 0 ? (
          <div className="text-center text-neutral-500 py-16"><ShoppingBag className="w-12 h-12 mx-auto mb-3" />لا توجد منتجات</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <button key={p.id} onClick={() => onOpenProduct(p.slug)} className="text-right group relative rounded-xl p-3 bg-gradient-to-b from-violet-950/40 to-transparent border border-violet-500/30 hover:border-cyan-400/70 transition-all" style={{ boxShadow: "inset 0 0 20px rgba(139,92,246,.1)" }}>
                <div className="aspect-square overflow-hidden rounded-lg bg-black mb-3 relative">
                  {p.images[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full grid place-items-center text-neutral-700"><ShoppingBag /></div>}
                </div>
                <h3 className="font-bold text-sm sm:text-base line-clamp-2 mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-cyan-400 font-black" style={{ textShadow: "0 0 10px rgba(34,211,238,.5)" }}>{p.price} {currencySymbol}</span>
                  {p.original_price && p.original_price > p.price && <span className="text-neutral-500 line-through text-xs">{p.original_price}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="relative z-10 border-t border-violet-500/30 py-8 text-center text-neutral-500 text-sm">
        © {new Date().getFullYear()} {s?.logo_text || "GAMER"} — <span className="text-cyan-400">Level Up</span>
      </footer>
    </div>
  );
}