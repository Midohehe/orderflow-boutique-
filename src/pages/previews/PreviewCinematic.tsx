import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Star, ShoppingBag, Crown } from "lucide-react";
import { demoProduct as P } from "./PreviewData";

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

export default function PreviewCinematic() {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 1600); return () => clearTimeout(t); }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-black text-amber-50 overflow-x-hidden" style={{fontFamily:"'Cormorant Garamond', serif"}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Tajawal:wght@400;700&display=swap" />

      <AnimatePresence>
        {loading && (
          <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ duration: 1.2 }}>
              <Crown className="w-16 h-16 text-amber-400" />
            </motion.div>
            <motion.div initial={{ width: 0 }} animate={{ width: "200px" }} transition={{ duration: 1.4 }}
              className="absolute bottom-1/3 h-px bg-gradient-to-l from-transparent via-amber-400 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && (
        <>
          {/* Hero */}
          <div className="relative min-h-screen flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-gradient-radial from-amber-900/20 via-black to-black" />
            <motion.img initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 0.3, scale: 1 }} transition={{ duration: 2 }}
              src={P.image} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

            <div className="relative text-center max-w-3xl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="text-amber-400 tracking-[0.5em] text-sm mb-6">— EXCLUSIVE —</motion.div>
              <h1 className="text-6xl md:text-8xl font-light mb-6 text-amber-50" style={{fontFamily:"'Cormorant Garamond',serif"}}>
                <SplitText text={P.name} delay={0.4} />
              </h1>
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
                className="text-2xl text-amber-200/80 italic mb-10">{P.tagline}</motion.p>
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }}
                whileHover={{ scale: 1.05, letterSpacing: "0.3em" }}
                className="px-12 py-4 border border-amber-400 text-amber-200 tracking-[0.2em] uppercase text-sm hover:bg-amber-400 hover:text-black transition-all">
                Discover · اكتشف
              </motion.button>
            </div>
          </div>

          {/* Marquee */}
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

          {/* Product detail */}
          <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="text-amber-400 tracking-[0.3em] text-xs mb-4">— THE PRODUCT —</div>
              <h2 className="text-5xl mb-6">قطعة فنية بإمضاء الحرفية</h2>
              <div className="w-20 h-px bg-amber-400 mb-6" />
              <p className="text-amber-100/70 text-lg leading-loose mb-8">
                مصممة لمن يدركون أن التميز لا يُشترى، بل يُختار بعناية. كل تفصيلة فيها قصة، وكل خط رسم بيد فنان.
              </p>
              <div className="flex items-baseline gap-4">
                <span className="text-amber-400 text-sm">السعر</span>
                <span className="text-4xl text-amber-100">{P.price} {P.currency}</span>
                <span className="text-amber-100/40 line-through">{P.oldPrice}</span>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
              <div className="relative">
                <div className="absolute -inset-4 border border-amber-400/30" />
                <img src={P.image2} className="relative" />
              </div>
            </motion.div>
          </div>

          {/* Features as numbered list */}
          <div className="max-w-4xl mx-auto px-6 pb-24">
            {P.features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="grid grid-cols-[80px_1fr] gap-8 py-8 border-b border-amber-900/30">
                <div className="text-5xl text-amber-400/60 font-light">0{i+1}</div>
                <div>
                  <div className="text-2xl mb-2">{f.title}</div>
                  <div className="text-amber-100/60">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center py-20 border-t border-amber-900/30">
            <Crown className="w-10 h-10 text-amber-400 mx-auto mb-6" />
            <div className="text-3xl mb-8">امتلكها قبل أن تنفد</div>
            <button className="px-16 py-5 bg-amber-400 text-black tracking-[0.2em] uppercase text-sm font-bold hover:bg-amber-300 transition">
              Order Now · اطلب الآن
            </button>
          </div>
        </>
      )}
    </div>
  );
}