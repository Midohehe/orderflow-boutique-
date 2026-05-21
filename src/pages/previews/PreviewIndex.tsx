import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const themes = [
  { id: "aurora", name: "Aurora Glass", desc: "خلفية gradient متحركة وزجاجية ناعمة، scroll reveal، أزرار نابضة.", color: "from-purple-500 via-pink-500 to-amber-400" },
  { id: "cinematic", name: "Cinematic Luxe", desc: "أسود وذهبي سينمائي، نص حرف-حرف، marquee لا نهائي، parallax.", color: "from-amber-300 via-yellow-500 to-amber-700" },
  { id: "apple", name: "Apple Clean", desc: "أبيض مينيمال، صور كبيرة، حركات هادئة، إحساس Apple-like.", color: "from-zinc-200 via-zinc-100 to-white" },
];

export default function PreviewIndex() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <motion.h1 initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="text-5xl font-black mb-2 bg-gradient-to-l from-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
          معاينات التيمات الاحترافية
        </motion.h1>
        <p className="text-slate-400 mb-10">3 تيمات حقيقية مع حركات. افتح أي واحدة وعيش التجربة قبل التطبيق.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {themes.map((t, i) => (
            <motion.div key={t.id} initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay: i*0.1}}>
              <Link to={`/preview/${t.id}`} className="block group rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur hover:border-white/30 transition-all hover:scale-[1.02]">
                <div className={`h-44 bg-gradient-to-br ${t.color} relative overflow-hidden`}>
                  <motion.div className="absolute inset-0 bg-white/10" animate={{x:["-100%","100%"]}} transition={{duration:3,repeat:Infinity,ease:"linear"}} />
                </div>
                <div className="p-5">
                  <div className="text-2xl font-bold mb-2">{t.name}</div>
                  <div className="text-sm text-slate-300 mb-4">{t.desc}</div>
                  <div className="text-fuchsia-300 text-sm font-bold group-hover:translate-x-2 transition-transform">معاينة ←</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}