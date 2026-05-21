import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Instagram, Facebook, MessageCircle, Sparkles } from "lucide-react";

interface Product { id: string; name: string; slug: string; price: number; original_price: number | null; images: string[]; }
interface Props { products: Product[]; currencySymbol: string; onOpenProduct: (slug: string) => void; ownerId?: string | null; }
interface HS { logo_text: string; logo_image: string | null; tagline: string | null; instagram_url: string | null; facebook_url: string | null; whatsapp_url: string | null; hero_image: string | null; hero_title: string | null; hero_subtitle: string | null; gallery_images: string[]; }

/** Vibrant Pop — bold gradients, playful, energetic */
export default function VibrantStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const [s, setS] = useState<HS | null>(null);
  useEffect(() => {
    const id = "vibrant-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@600;800;900&display=swap";
      document.head.appendChild(l);
    }
    if (!ownerId) return;
    supabase.from("header_settings").select("*").eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }: any) => data && setS({ ...data, gallery_images: data.gallery_images || [] }));
  }, [ownerId]);

  const heroImg = s?.hero_image || products[0]?.images?.[0];
  const heroTitle = s?.hero_title || "اشحن يومك بألوان!";
  const heroSub = s?.hero_subtitle || "تشكيلة جريئة، أسعار حلوة، توصيل لكل ليبيا.";

  return (
    <div dir="rtl" className="min-h-screen bg-[#fff7ed] text-neutral-900" style={{ fontFamily: "Cairo, sans-serif" }}>
      <header className="bg-white border-b-4 border-black sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {s?.logo_image ? <img src={s.logo_image} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-black" /> : <Sparkles className="w-6 h-6" />}
            <div className="text-xl sm:text-2xl font-black">{s?.logo_text || "POP"}</div>
          </div>
          <div className="flex items-center gap-2">
            {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-full bg-pink-500 text-white hover:scale-110 transition-transform"><Instagram className="w-4 h-4" /></a>}
            {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-full bg-blue-600 text-white hover:scale-110 transition-transform"><Facebook className="w-4 h-4" /></a>}
            {s?.whatsapp_url && <a href={s.whatsapp_url} target="_blank" rel="noopener" className="w-9 h-9 grid place-items-center rounded-full bg-green-500 text-white hover:scale-110 transition-transform"><MessageCircle className="w-4 h-4" /></a>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <div className="relative rounded-[2rem] overflow-hidden border-4 border-black p-8 sm:p-14" style={{ background: "linear-gradient(135deg, #fb923c 0%, #ec4899 50%, #8b5cf6 100%)" }}>
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-yellow-300/40 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-cyan-300/30 blur-3xl" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div className="text-white">
              <div className="inline-block bg-yellow-300 text-black font-black px-3 py-1 rounded-full text-xs mb-4 rotate-[-2deg]">جديد ✨</div>
              <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-4 drop-shadow-lg">{heroTitle}</h1>
              <p className="text-white/90 text-lg max-w-md mb-6">{heroSub}</p>
              <button onClick={() => document.getElementById("vibrant-grid")?.scrollIntoView({ behavior: "smooth" })} className="bg-black text-white font-bold px-7 py-3 rounded-full hover:bg-white hover:text-black transition-colors border-2 border-black">تسوّق الآن ←</button>
            </div>
            {heroImg && (
              <div className="aspect-square rounded-3xl overflow-hidden border-4 border-black rotate-3 hover:rotate-0 transition-transform duration-500 max-w-sm mx-auto md:ml-auto">
                <img src={heroImg} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gallery strip */}
      {s?.gallery_images && s.gallery_images.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-12">
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {s.gallery_images.map((img, i) => (
              <div key={i} className="flex-none w-40 h-40 sm:w-52 sm:h-52 rounded-2xl overflow-hidden border-2 border-black snap-start">
                <img src={img} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section id="vibrant-grid" className="max-w-7xl mx-auto px-4 sm:px-8 pb-20">
        <h2 className="text-3xl sm:text-5xl font-black mb-8 inline-block bg-black text-white px-5 py-2 rounded-full rotate-[-1deg]">منتجاتنا 🛍️</h2>
        {products.length === 0 ? (
          <div className="text-center text-neutral-400 py-16"><ShoppingBag className="w-12 h-12 mx-auto mb-3" />لا توجد منتجات</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-8">
            {products.map((p, i) => {
              const colors = ["bg-pink-200", "bg-yellow-200", "bg-cyan-200", "bg-orange-200", "bg-violet-200", "bg-green-200"];
              return (
                <button key={p.id} onClick={() => onOpenProduct(p.slug)} className="text-right group">
                  <div className={`aspect-square rounded-3xl overflow-hidden border-2 border-black ${colors[i % colors.length]} mb-3 group-hover:rotate-2 transition-transform`}>
                    {p.images[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full grid place-items-center"><ShoppingBag /></div>}
                  </div>
                  <h3 className="font-bold text-base sm:text-lg line-clamp-2 mb-1">{p.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="bg-black text-white font-black px-2 py-0.5 rounded-md text-sm">{p.price} {currencySymbol}</span>
                    {p.original_price && p.original_price > p.price && <span className="text-neutral-400 line-through text-xs">{p.original_price}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <footer className="bg-black text-white py-8 text-center font-bold">
        © {new Date().getFullYear()} {s?.logo_text || "POP"} — صُنع بحب ❤️
      </footer>
    </div>
  );
}