import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Star, ShoppingBag, Check, Shield, Truck, Sparkles } from "lucide-react";
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

interface HeaderSettings {
  logo_text: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image: string | null;
}

export default function AuroraStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const imgY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const imgRotate = useTransform(scrollYProgress, [0, 1], [0, 8]);

  const [settings, setSettings] = useState<HeaderSettings | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    supabase.from("header_settings")
      .select("logo_text, hero_title, hero_subtitle, hero_image")
      .eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }) => data && setSettings(data as any));
  }, [ownerId]);

  const featured = products[0];
  const rest = products.slice(1);
  const heroImg = settings?.hero_image || featured?.images?.[0];

  return (
    <div dir="rtl" ref={ref} className="min-h-screen bg-slate-950 text-white overflow-x-hidden relative">
      <div className="fixed inset-0 pointer-events-none">
        <motion.div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-fuchsia-600/30 blur-[120px]" animate={{ x: [0, 80, 0], y: [0, 40, 0] }} transition={{ duration: 12, repeat: Infinity }} />
        <motion.div className="absolute top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/30 blur-[120px]" animate={{ x: [0, -60, 0], y: [0, 80, 0] }} transition={{ duration: 14, repeat: Infinity }} />
        <motion.div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-amber-400/20 blur-[120px]" animate={{ x: [0, 60, 0], y: [0, -60, 0] }} transition={{ duration: 16, repeat: Infinity }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          <div className="text-xl font-black bg-gradient-to-l from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
            {settings?.logo_text || "متجري"}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur text-xs">
            <Sparkles className="w-3 h-3 text-fuchsia-300" /> {products.length} منتج
          </div>
        </div>

        {featured && (
          <div className="grid md:grid-cols-2 gap-10 items-center min-h-[70vh]">
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
              <h1 className="text-5xl md:text-7xl font-black leading-tight mb-4 bg-gradient-to-l from-white via-fuchsia-200 to-amber-200 bg-clip-text text-transparent">
                {settings?.hero_title || featured.name}
              </h1>
              <p className="text-xl text-slate-300 mb-6">{settings?.hero_subtitle || "اكتشف مجموعتنا المختارة بعناية"}</p>
              <div className="flex items-baseline gap-3 mb-8">
                <span className="text-5xl font-black">{featured.price}</span>
                {featured.original_price && <span className="text-xl text-slate-400 line-through">{featured.original_price}</span>}
                <span className="text-fuchsia-300">{currencySymbol}</span>
              </div>
              <motion.button onClick={() => onOpenProduct(featured.slug)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="group relative overflow-hidden px-8 py-4 rounded-full bg-gradient-to-l from-fuchsia-500 to-amber-400 text-black font-bold text-lg flex items-center gap-3 shadow-2xl shadow-fuchsia-500/40">
                <ShoppingBag className="w-5 h-5" /> اطلب الآن
                <motion.div className="absolute inset-0 bg-white/20" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2, repeat: Infinity }} />
              </motion.button>
            </motion.div>

            {heroImg && (
              <motion.div style={{ y: imgY, rotate: imgRotate }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/40 to-amber-400/40 blur-3xl" />
                <img src={heroImg} alt={featured.name} className="relative rounded-3xl shadow-2xl w-full h-[420px] object-cover" />
              </motion.div>
            )}
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-24">
            <h2 className="text-3xl font-bold text-center mb-10">المنتجات</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rest.map((p, i) => (
                <motion.button key={p.id} onClick={() => onOpenProduct(p.slug)}
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: Math.min(i, 8) * 0.05 }}
                  className="text-right p-4 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:border-fuchsia-400/50 hover:bg-white/10 transition-all group">
                  {p.images?.[0] && (
                    <div className="overflow-hidden rounded-xl mb-3">
                      <img src={p.images[0]} alt={p.name} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  )}
                  <div className="font-bold text-lg mb-1">{p.name}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-fuchsia-300 font-bold">{p.price} {currencySymbol}</span>
                    {p.original_price && <span className="text-xs text-slate-400 line-through">{p.original_price}</span>}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-6 mt-16 text-slate-300">
          <div className="flex items-center gap-2"><Truck className="w-5 h-5 text-fuchsia-300" /> شحن لكل ليبيا</div>
          <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-300" /> ضمان الجودة</div>
          <div className="flex items-center gap-2"><Check className="w-5 h-5 text-cyan-300" /> دفع عند الاستلام</div>
        </div>
        <div className="h-20" />
      </div>
    </div>
  );
}
