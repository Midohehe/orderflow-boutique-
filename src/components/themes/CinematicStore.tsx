import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  images: string[];
}

interface Props {
  products: Product[];
  currencySymbol: string;
  onOpenProduct: (slug: string) => void;
  ownerId?: string | null;
}

function SplitText({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span className="inline-block">
      {text.split("").map((c, i) => (
        <motion.span key={i} initial={{ opacity: 0, y: 40, rotateX: -90 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: delay + i * 0.03, duration: 0.6, ease: "easeOut" }}
          className="inline-block">{c === " " ? "\u00A0" : c}</motion.span>
      ))}
    </span>
  );
}

export default function CinematicStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{ logo_text: string | null; hero_title: string | null; hero_subtitle: string | null; hero_image: string | null } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ownerId) return;
    supabase.from("header_settings").select("logo_text, hero_title, hero_subtitle, hero_image")
      .eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }) => data && setSettings(data as any));
  }, [ownerId]);

  if (!document.getElementById("cinematic-fonts")) {
    const link = document.createElement("link");
    link.id = "cinematic-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Tajawal:wght@400;700&display=swap";
    document.head.appendChild(link);
  }

  const featured = products[0];
  const rest = products.slice(1);
  const heroImg = settings?.hero_image || featured?.images?.[0];
  const title = settings?.hero_title || settings?.logo_text || featured?.name || "متجرنا";

  return (
    <div dir="rtl" className="min-h-screen bg-black text-amber-50 overflow-x-hidden" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
      <AnimatePresence>
        {loading && (
          <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ duration: 1.2 }}>
              <Crown className="w-16 h-16 text-amber-400" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && (
        <>
          <div className="relative min-h-[90vh] flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-gradient-radial from-amber-900/20 via-black to-black" />
            {heroImg && (
              <motion.img initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 0.3, scale: 1 }} transition={{ duration: 2 }}
                src={heroImg} className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

            <div className="relative text-center max-w-3xl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="text-amber-400 tracking-[0.5em] text-sm mb-6">— EXCLUSIVE —</motion.div>
              <h1 className="text-5xl md:text-8xl font-light mb-6 text-amber-50">
                <SplitText text={title} delay={0.4} />
              </h1>
              {settings?.hero_subtitle && (
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
                  className="text-2xl text-amber-200/80 italic mb-10">{settings.hero_subtitle}</motion.p>
              )}
              {featured && (
                <motion.button onClick={() => onOpenProduct(featured.slug)}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }}
                  whileHover={{ scale: 1.05, letterSpacing: "0.3em" }}
                  className="px-12 py-4 border border-amber-400 text-amber-200 tracking-[0.2em] uppercase text-sm hover:bg-amber-400 hover:text-black transition-all">
                  Discover · اكتشف
                </motion.button>
              )}
            </div>
          </div>

          <div className="overflow-hidden border-y border-amber-900/30 py-6 bg-amber-950/10">
            <motion.div animate={{ x: ["0%", "-50%"] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="flex gap-12 whitespace-nowrap text-amber-400/80 text-2xl">
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex items-center gap-12">
                  ✦ HANDCRAFTED ✦ LIMITED EDITION ✦ FREE SHIPPING ✦ صناعة فاخرة ✦
                </span>
              ))}
            </motion.div>
          </div>

          <div className="max-w-6xl mx-auto px-6 py-24">
            <div className="text-center mb-16">
              <div className="text-amber-400 tracking-[0.3em] text-xs mb-4">— THE COLLECTION —</div>
              <h2 className="text-5xl">مجموعتنا المختارة</h2>
              <div className="w-20 h-px bg-amber-400 mx-auto mt-6" />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
              {[featured, ...rest].filter(Boolean).map((p, i) => (
                <motion.button key={p!.id} onClick={() => onOpenProduct(p!.slug)}
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: Math.min(i, 8) * 0.08 }}
                  className="text-right group">
                  {p!.images?.[0] && (
                    <div className="relative mb-5 overflow-hidden">
                      <div className="absolute -inset-2 border border-amber-400/30 group-hover:border-amber-400 transition" />
                      <img src={p!.images[0]} alt={p!.name} className="relative w-full h-72 object-cover group-hover:scale-105 transition-transform duration-700" />
                    </div>
                  )}
                  <div className="text-2xl mb-2 text-amber-50">{p!.name}</div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-amber-400 text-xl">{p!.price} {currencySymbol}</span>
                    {p!.original_price && <span className="text-amber-100/40 line-through text-sm">{p!.original_price}</span>}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="text-center py-20 border-t border-amber-900/30">
            <Crown className="w-10 h-10 text-amber-400 mx-auto mb-6" />
            <div className="text-3xl mb-8">امتلكها قبل أن تنفد</div>
            {featured && (
              <button onClick={() => onOpenProduct(featured.slug)}
                className="px-16 py-5 bg-amber-400 text-black tracking-[0.2em] uppercase text-sm font-bold hover:bg-amber-300 transition">
                Order Now · اطلب الآن
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
