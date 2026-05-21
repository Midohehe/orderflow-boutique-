import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
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

export default function AppleStore({ products, currencySymbol, onOpenProduct, ownerId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.15]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const [settings, setSettings] = useState<{ logo_text: string | null; hero_title: string | null; hero_subtitle: string | null; hero_image: string | null } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    supabase.from("header_settings").select("logo_text, hero_title, hero_subtitle, hero_image")
      .eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }) => data && setSettings(data as any));
  }, [ownerId]);

  const featured = products[0];
  const rest = products.slice(1);
  const heroImg = settings?.hero_image || featured?.images?.[0];
  const title = settings?.hero_title || featured?.name || settings?.logo_text || "متجرنا";

  return (
    <div dir="rtl" ref={ref} className="bg-white text-zinc-900 min-h-screen"
      style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Tajawal',sans-serif" }}>
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <motion.div style={{ scale: heroScale, opacity: heroOpacity }} className="text-center px-6 z-10">
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}
            className="text-6xl md:text-9xl font-bold tracking-tight mb-4">{title}</motion.h1>
          {settings?.hero_subtitle && (
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-2xl text-zinc-500 mb-2">{settings.hero_subtitle}</motion.p>
          )}
          {featured && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="text-lg text-zinc-400">ابتداءً من <span className="font-bold text-zinc-900">{featured.price} {currencySymbol}</span></motion.p>
          )}
        </motion.div>

        {heroImg && (
          <motion.img initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.4 }}
            src={heroImg} alt={title} className="absolute bottom-0 max-h-[50vh] object-contain drop-shadow-2xl" />
        )}
      </section>

      {featured && (
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-200">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="font-bold">{settings?.logo_text || featured.name}</div>
            <button onClick={() => onOpenProduct(featured.slug)}
              className="px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 transition">
              اطلب الآن
            </button>
          </div>
        </div>
      )}

      <section className="py-32 px-6 text-center max-w-4xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-4xl md:text-7xl font-bold tracking-tight leading-tight">
          مصممة لتدوم.<br />
          <span className="text-zinc-400">صُنعت لتُلهم.</span>
        </motion.h2>
      </section>

      {rest.length > 0 && (
        <section className="px-6 pb-24">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-4">
            {rest.map((p, i) => (
              <motion.button key={p.id} onClick={() => onOpenProduct(p.slug)}
                initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: Math.min(i, 8) * 0.08 }}
                className="text-right bg-zinc-100 rounded-3xl p-8 hover:bg-zinc-200/70 transition-colors group">
                {p.images?.[0] && (
                  <img src={p.images[0]} alt={p.name} className="w-full h-56 object-contain mb-5 group-hover:scale-105 transition-transform duration-500" />
                )}
                <div className="text-2xl font-bold mb-2">{p.name}</div>
                <div className="flex items-baseline gap-2 mb-5">
                  <span className="text-lg font-bold">{p.price} {currencySymbol}</span>
                  {p.original_price && <span className="text-sm text-zinc-500 line-through">{p.original_price}</span>}
                </div>
                <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center group-hover:scale-110 transition">
                  <Plus className="w-5 h-5" />
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      <section className="py-32 text-center bg-zinc-900 text-white">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">جاهز للتجربة؟</h2>
        <p className="text-zinc-400 mb-8">شحن لكل ليبيا · دفع عند الاستلام</p>
        {featured && (
          <button onClick={() => onOpenProduct(featured.slug)}
            className="px-10 py-4 bg-white text-zinc-900 rounded-full font-bold hover:scale-105 transition">
            اطلب الآن — {featured.price} {currencySymbol}
          </button>
        )}
      </section>
    </div>
  );
}
