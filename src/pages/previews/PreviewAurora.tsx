import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Star, ShoppingBag, Check, Shield, Truck, Sparkles } from "lucide-react";
import { demoProduct as P } from "./PreviewData";

export default function PreviewAurora() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const imgY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const imgRotate = useTransform(scrollYProgress, [0, 1], [0, 8]);

  return (
    <div dir="rtl" ref={ref} className="min-h-screen bg-slate-950 text-white overflow-x-hidden relative">
      {/* animated mesh background */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-fuchsia-600/30 blur-[120px]" animate={{x:[0,80,0],y:[0,40,0]}} transition={{duration:12,repeat:Infinity}} />
        <motion.div className="absolute top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/30 blur-[120px]" animate={{x:[0,-60,0],y:[0,80,0]}} transition={{duration:14,repeat:Infinity}} />
        <motion.div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-amber-400/20 blur-[120px]" animate={{x:[0,60,0],y:[0,-60,0]}} transition={{duration:16,repeat:Infinity}} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="grid md:grid-cols-2 gap-10 items-center min-h-[80vh]">
          <motion.div initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} transition={{duration:0.8}}>
            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur text-sm mb-6">
              <Sparkles className="w-3 h-3 text-fuchsia-300" /> إصدار محدود
            </motion.div>
            <h1 className="text-6xl md:text-7xl font-black leading-tight mb-4 bg-gradient-to-l from-white via-fuchsia-200 to-amber-200 bg-clip-text text-transparent">
              {P.name}
            </h1>
            <p className="text-xl text-slate-300 mb-6">{P.tagline}</p>
            <div className="flex items-center gap-2 mb-8">
              {[...Array(5)].map((_,i)=><Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />)}
              <span className="text-slate-300 text-sm">{P.rating} ({P.reviews} تقييم)</span>
            </div>
            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-5xl font-black">{P.price}</span>
              <span className="text-xl text-slate-400 line-through">{P.oldPrice}</span>
              <span className="text-fuchsia-300">{P.currency}</span>
            </div>
            <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} className="group relative overflow-hidden px-8 py-4 rounded-full bg-gradient-to-l from-fuchsia-500 to-amber-400 text-black font-bold text-lg flex items-center gap-3 shadow-2xl shadow-fuchsia-500/40">
              <ShoppingBag className="w-5 h-5" /> اطلب الآن — شحن مجاني
              <motion.div className="absolute inset-0 bg-white/20" animate={{x:["-100%","100%"]}} transition={{duration:2,repeat:Infinity}} />
            </motion.button>
          </motion.div>

          <motion.div style={{y:imgY,rotate:imgRotate}} initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{duration:1}} className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/40 to-amber-400/40 blur-3xl" />
            <img src={P.image} alt={P.name} className="relative rounded-3xl shadow-2xl" />
          </motion.div>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-20">
          {P.features.map((f, i) => (
            <motion.div key={i} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.1}}
              className="p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:border-fuchsia-400/50 hover:bg-white/10 transition-all">
              <Check className="w-8 h-8 text-fuchsia-300 mb-3" />
              <div className="font-bold text-lg mb-1">{f.title}</div>
              <div className="text-sm text-slate-400">{f.desc}</div>
            </motion.div>
          ))}
        </div>

        {/* Trust */}
        <div className="flex flex-wrap justify-center gap-6 mt-16 text-slate-300">
          <div className="flex items-center gap-2"><Truck className="w-5 h-5 text-fuchsia-300"/> شحن مجاني</div>
          <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-300"/> ضمان سنة</div>
          <div className="flex items-center gap-2"><Check className="w-5 h-5 text-cyan-300"/> دفع عند الاستلام</div>
        </div>

        {/* Reviews */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-10">آراء عملائنا</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {P.reviews_list.map((r, i) => (
              <motion.div key={i} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.15}}
                className="p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10">
                <div className="flex gap-1 mb-3">{[...Array(5)].map((_,i)=><Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400"/>)}</div>
                <p className="text-slate-300 mb-3">{r.text}</p>
                <div className="text-sm font-bold text-fuchsia-300">{r.name}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="h-20" />
      </div>
    </div>
  );
}