import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Star, Plus } from "lucide-react";
import { demoProduct as P } from "./PreviewData";

export default function PreviewApple() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.15]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div dir="rtl" ref={ref} className="bg-white text-zinc-900 min-h-screen" style={{fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Tajawal',sans-serif"}}>
      {/* Hero */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <motion.div style={{ scale: heroScale, opacity: heroOpacity }} className="text-center px-6">
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}
            className="text-7xl md:text-9xl font-bold tracking-tight mb-4">{P.name}</motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-2xl text-zinc-500 mb-2">{P.tagline}</motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="text-lg text-zinc-400">ابتداءً من <span className="font-bold text-zinc-900">{P.price} {P.currency}</span></motion.p>
        </motion.div>

        <motion.img initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.4 }}
          src={P.image} className="absolute bottom-0 max-h-[55vh] object-contain drop-shadow-2xl" />
      </section>

      {/* Sticky CTA */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="font-bold">{P.name}</div>
          <button className="px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 transition">اطلب الآن</button>
        </div>
      </div>

      {/* Big statement */}
      <section className="py-32 px-6 text-center max-w-4xl mx-auto">
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
          مصممة لتدوم.<br/>
          <span className="text-zinc-400">صُنعت لتُلهم.</span>
        </motion.h2>
      </section>

      {/* Feature cards */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-4">
          {P.features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="bg-zinc-100 rounded-3xl p-10 hover:bg-zinc-200/70 transition-colors group">
              <div className="text-3xl font-bold mb-3">{f.title}</div>
              <p className="text-zinc-600 text-lg mb-6">{f.desc}</p>
              <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center group-hover:scale-110 transition">
                <Plus className="w-5 h-5" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Image showcase */}
      <section className="px-6 py-24 bg-zinc-50">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto rounded-3xl overflow-hidden">
          <img src={P.image3} className="w-full h-[60vh] object-cover" />
        </motion.div>
      </section>

      {/* Reviews */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <h2 className="text-4xl font-bold mb-12 text-center">آراء العملاء</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {P.reviews_list.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl border border-zinc-200">
              <div className="flex gap-0.5 mb-3">{[...Array(5)].map((_,i)=><Star key={i} className="w-4 h-4 fill-zinc-900 text-zinc-900"/>)}</div>
              <p className="text-zinc-700 mb-3">{r.text}</p>
              <div className="text-sm font-bold">{r.name}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 text-center bg-zinc-900 text-white">
        <h2 className="text-5xl font-bold mb-4">جاهز للتجربة؟</h2>
        <p className="text-zinc-400 mb-8">شحن مجاني · دفع عند الاستلام · ضمان سنة</p>
        <button className="px-10 py-4 bg-white text-zinc-900 rounded-full font-bold hover:scale-105 transition">اطلب الآن — {P.price} {P.currency}</button>
      </section>
    </div>
  );
}