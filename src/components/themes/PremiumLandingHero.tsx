import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Crown, Sparkles, ShoppingBag } from "lucide-react";

interface Props {
  variant: "aurora" | "cinematic" | "apple";
  title: string;
  subtitle?: string;
  imageUrl?: string;
  price: string;
  originalPrice?: string;
  currencySymbol: string;
  onCta: () => void;
}

type SubProps = Omit<Props, "variant">;

export default function PremiumLandingHero({ variant, ...rest }: Props) {
  if (variant === "aurora") return <AuroraHero {...rest} />;
  if (variant === "cinematic") return <CinematicHero {...rest} />;
  return <AppleHero {...rest} />;
}

function AuroraHero({ title, subtitle, imageUrl, price, originalPrice, currencySymbol, onCta }: SubProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const imgRotate = useTransform(scrollYProgress, [0, 1], [0, 6]);

  return (
    <section ref={ref} dir="rtl" className="relative overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <motion.div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-fuchsia-600/30 blur-[120px]" animate={{ x: [0, 60, 0], y: [0, 40, 0] }} transition={{ duration: 12, repeat: Infinity }} />
        <motion.div className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/30 blur-[120px]" animate={{ x: [0, -50, 0], y: [0, 60, 0] }} transition={{ duration: 14, repeat: Infinity }} />
        <motion.div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-amber-400/20 blur-[120px]" animate={{ x: [0, 60, 0], y: [0, -50, 0] }} transition={{ duration: 16, repeat: Infinity }} />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid md:grid-cols-2 gap-8 items-center">
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur text-xs mb-5">
            <Sparkles className="w-3 h-3 text-fuchsia-300" /> عرض حصري
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black leading-tight mb-4 bg-gradient-to-l from-white via-fuchsia-200 to-amber-200 bg-clip-text text-transparent">
            {title}
          </h1>
          {subtitle && <p className="text-base sm:text-lg text-slate-300 mb-6">{subtitle}</p>}
          <div className="flex items-baseline gap-3 mb-7">
            <span className="text-3xl sm:text-5xl font-black">{price}</span>
            {originalPrice && <span className="text-lg text-slate-400 line-through">{originalPrice}</span>}
            <span className="text-fuchsia-300">{currencySymbol}</span>
          </div>
          <motion.button onClick={onCta} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="group relative overflow-hidden px-8 py-4 rounded-full bg-gradient-to-l from-fuchsia-500 to-amber-400 text-black font-bold text-base flex items-center gap-3 shadow-2xl shadow-fuchsia-500/40">
            <ShoppingBag className="w-5 h-5" /> اطلب الآن
            <motion.div className="absolute inset-0 bg-white/20" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2, repeat: Infinity }} />
          </motion.button>
        </motion.div>
        {imageUrl && (
          <motion.div style={{ y: imgY, rotate: imgRotate }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }} className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/40 to-amber-400/40 blur-3xl" />
            <img src={imageUrl} alt={title} className="relative rounded-3xl shadow-2xl w-full max-h-[420px] object-cover" />
          </motion.div>
        )}
      </div>
    </section>
  );
}

function CinematicHero({ title, subtitle, imageUrl, price, originalPrice, currencySymbol, onCta }: SubProps) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 1100); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (document.getElementById("cinematic-fonts")) return;
    const link = document.createElement("link");
    link.id = "cinematic-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Tajawal:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <section dir="rtl" className="relative bg-black text-amber-50 overflow-hidden" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
      <AnimatePresence>
        {loading && (
          <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
            className="absolute inset-0 z-30 bg-black flex items-center justify-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ duration: 1 }}>
              <Crown className="w-14 h-14 text-amber-400" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative min-h-[80vh] flex items-center justify-center px-6 py-16">
        {imageUrl && (
          <motion.img initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 0.3, scale: 1 }} transition={{ duration: 2 }}
            src={imageUrl} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        <div className="relative text-center max-w-3xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-amber-400 tracking-[0.5em] text-xs sm:text-sm mb-6">— EXCLUSIVE —</motion.div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-light mb-6 text-amber-50">{title}</h1>
          {subtitle && (
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="text-lg sm:text-xl text-amber-200/80 italic mb-8">{subtitle}</motion.p>
          )}
          <div className="flex items-baseline justify-center gap-4 mb-10">
            <span className="text-3xl sm:text-4xl text-amber-100">{price} {currencySymbol}</span>
            {originalPrice && <span className="text-amber-100/40 line-through text-lg">{originalPrice}</span>}
          </div>
          <motion.button onClick={onCta}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
            whileHover={{ scale: 1.05, letterSpacing: "0.25em" }}
            className="px-10 sm:px-12 py-4 border border-amber-400 text-amber-200 tracking-[0.2em] uppercase text-sm hover:bg-amber-400 hover:text-black transition-all">
            Order · اطلب الآن
          </motion.button>
        </div>
      </div>
      <div className="overflow-hidden border-y border-amber-900/30 py-4 bg-amber-950/10">
        <motion.div animate={{ x: ["0%", "-50%"] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="flex gap-12 whitespace-nowrap text-amber-400/80 text-lg">
          {[...Array(8)].map((_, i) => (
            <span key={i} className="flex items-center gap-12">
              ✦ HANDCRAFTED ✦ LIMITED EDITION ✦ FREE SHIPPING ✦ صناعة فاخرة ✦
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function AppleHero({ title, subtitle, imageUrl, price, originalPrice, currencySymbol, onCta }: SubProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const heroScale = useTransform(scrollYProgress, [0, 0.6], [1, 1.12]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.2]);

  return (
    <section ref={ref} dir="rtl" className="relative bg-white text-zinc-900"
      style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Tajawal',sans-serif" }}>
      <div className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden px-6">
        <motion.div style={{ scale: heroScale, opacity: heroOpacity }} className="text-center z-10">
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}
            className="text-4xl sm:text-7xl md:text-8xl font-bold tracking-tight mb-3">{title}</motion.h1>
          {subtitle && (
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-lg sm:text-2xl text-zinc-500 mb-2">{subtitle}</motion.p>
          )}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-base sm:text-lg text-zinc-400">
            ابتداءً من <span className="font-bold text-zinc-900">{price} {currencySymbol}</span>
            {originalPrice && <span className="text-zinc-400 line-through mr-2">{originalPrice}</span>}
          </motion.p>
          <motion.button onClick={onCta} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition">
            اطلب الآن
          </motion.button>
        </motion.div>
        {imageUrl && (
          <motion.img initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, delay: 0.4 }}
            src={imageUrl} alt={title} className="absolute bottom-0 max-h-[45vh] object-contain drop-shadow-2xl" />
        )}
      </div>
    </section>
  );
}