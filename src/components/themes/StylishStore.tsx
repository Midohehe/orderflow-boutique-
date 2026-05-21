import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ShoppingBag, Heart, User, Menu, X, Phone, Mail,
  Instagram, Facebook, MessageCircle, Music2, Star, ChevronLeft, ChevronRight,
  Truck, RefreshCw, ShieldCheck, CreditCard,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  images: string[];
}

interface StylishStoreProps {
  products: Product[];
  currencySymbol: string;
  onOpenProduct: (slug: string) => void;
  ownerId?: string | null;
}

interface HeaderSettings {
  logo_text: string;
  logo_image: string | null;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  tiktok_url: string | null;
}

const SERIF = "'Playfair Display', serif";
const SANS = "Inter, sans-serif";

export default function StylishStore({
  products, currencySymbol, onOpenProduct, ownerId,
}: StylishStoreProps) {
  const [settings, setSettings] = useState<HeaderSettings | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [slide, setSlide] = useState(0);
  const [quickView, setQuickView] = useState<Product | null>(null);

  // Fonts + settings
  useEffect(() => {
    if (!document.getElementById("stylish-theme-fonts")) {
      const link = document.createElement("link");
      link.id = "stylish-theme-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,900&display=swap";
      document.head.appendChild(link);
    }
    if (!ownerId) return;
    supabase.from("header_settings")
      .select("logo_text, logo_image, tagline, phone, email, instagram_url, facebook_url, whatsapp_url, tiktok_url")
      .eq("owner_id", ownerId).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setSettings(data as HeaderSettings); });
  }, [ownerId]);

  const slides = useMemo(() => products.slice(0, 3), [products]);
  const featured = useMemo(() => products.slice(0, 10), [products]);
  const latest = useMemo(() => products.slice(10, 20), [products]);
  const insta = useMemo(
    () => products.flatMap((p) => p.images || []).slice(0, 6),
    [products]
  );

  // Auto-rotate carousel
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [] as Product[];
    const q = query.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, products]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  const social = [
    { url: settings?.instagram_url, Icon: Instagram, label: "Instagram" },
    { url: settings?.facebook_url, Icon: Facebook, label: "Facebook" },
    { url: settings?.tiktok_url, Icon: Music2, label: "TikTok" },
    { url: settings?.whatsapp_url, Icon: MessageCircle, label: "WhatsApp" },
  ].filter((s) => s.url);

  const navItems = [
    { id: "stylish-home", label: "الرئيسية" },
    { id: "stylish-featured", label: "مميزة" },
    { id: "stylish-categories", label: "الأقسام" },
    { id: "stylish-latest", label: "الأحدث" },
    { id: "stylish-contact", label: "تواصل" },
  ];

  return (
    <div className="bg-white text-black" dir="rtl" style={{ fontFamily: SANS }} id="stylish-home">
      {/* ===== Top utility bar ===== */}
      <div className="bg-black text-white text-xs">
        <div className="mx-auto max-w-7xl px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 opacity-90">
            <span className="hidden sm:inline">شحن مجاني للطلبات فوق 300 {currencySymbol}</span>
            {settings?.phone && (
              <a href={`tel:${settings.phone}`} className="flex items-center gap-1.5 hover:opacity-80">
                <Phone className="w-3 h-3" /><span dir="ltr">{settings.phone}</span>
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            {social.map(({ url, Icon, label }) => (
              <a key={label} href={url!} target="_blank" rel="noopener noreferrer" aria-label={label} className="hover:opacity-80">
                <Icon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Main Header ===== */}
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between gap-4">
          <button className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="القائمة">
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 min-w-0">
            {settings?.logo_image && (
              <img src={settings.logo_image} alt="" className="w-10 h-10 rounded-full object-cover" />
            )}
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider truncate" style={{ fontFamily: SERIF }}>
              {settings?.logo_text || "STORE"}
            </h1>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-bold uppercase tracking-wider">
            {navItems.map((n) => (
              <button key={n.id} onClick={() => scrollTo(n.id)} className="hover:opacity-60 transition-opacity">
                {n.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={() => setSearchOpen(true)} aria-label="بحث"><Search className="w-5 h-5" /></button>
            <button aria-label="المفضلة" className="hidden sm:block"><Heart className="w-5 h-5" /></button>
            <button aria-label="الحساب" className="hidden sm:block"><User className="w-5 h-5" /></button>
            <button aria-label="السلة" className="relative"><ShoppingBag className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      {/* ===== Mobile menu drawer ===== */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setMenuOpen(false)}>
          <aside className="absolute right-0 top-0 h-full w-72 bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <span className="font-black uppercase" style={{ fontFamily: SERIF }}>القائمة</span>
              <button onClick={() => setMenuOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex flex-col gap-4 font-bold uppercase tracking-wider text-sm">
              {navItems.map((n) => (
                <button key={n.id} onClick={() => scrollTo(n.id)} className="text-right py-2 border-b border-neutral-100">
                  {n.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ===== Search overlay ===== */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col p-6" onClick={() => setSearchOpen(false)}>
          <button onClick={() => setSearchOpen(false)} className="self-end text-white mb-8"><X className="w-6 h-6" /></button>
          <div className="max-w-2xl w-full mx-auto" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="w-full bg-transparent border-b-2 border-white text-white text-2xl py-4 outline-none placeholder:text-white/40"
            />
            <div className="mt-6 space-y-2">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => { setSearchOpen(false); onOpenProduct(p.slug); }}
                  className="flex items-center gap-4 w-full text-right p-3 hover:bg-white/10 text-white">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="w-12 h-12 object-cover" />}
                  <div className="flex-1">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-sm opacity-70">{p.price} {currencySymbol}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== Hero Carousel ===== */}
      {slides.length > 0 && (
        <section className="px-3 sm:px-6 lg:px-10 py-4 sm:py-6">
          <div className="relative mx-auto max-w-7xl overflow-hidden aspect-[16/9] sm:aspect-[21/9] bg-neutral-100">
            {slides.map((p, i) => (
              <div key={p.id}
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: i === slide ? 1 : 0 }}>
                {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                <div className="absolute inset-0 flex items-end">
                  <div className="p-5 sm:p-10 lg:p-16 max-w-2xl text-right ml-auto">
                    <span className="inline-block text-[10px] sm:text-xs tracking-[0.35em] font-bold text-white bg-black/40 px-3 py-1 mb-3">
                      مجموعة جديدة
                    </span>
                    <h2 className="text-white text-3xl sm:text-5xl lg:text-6xl font-black leading-tight" style={{ fontFamily: SERIF }}>
                      {p.name}
                    </h2>
                    <button onClick={() => onOpenProduct(p.slug)}
                      className="mt-5 text-white uppercase font-bold tracking-[0.25em] text-xs sm:text-sm pb-2 border-b-2 border-white">
                      تسوّق الآن
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {slides.length > 1 && (
              <>
                <button onClick={() => setSlide((s) => (s - 1 + slides.length) % slides.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2"><ChevronRight className="w-5 h-5" /></button>
                <button onClick={() => setSlide((s) => (s + 1) % slides.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2"><ChevronLeft className="w-5 h-5" /></button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {slides.map((_, i) => (
                    <button key={i} onClick={() => setSlide(i)}
                      className={`w-8 h-1 ${i === slide ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* ===== Benefits strip ===== */}
      <section className="bg-neutral-50 py-6 sm:py-8 px-4">
        <div className="mx-auto max-w-7xl grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[
            { Icon: Truck, t: "شحن لكل ليبيا", d: "توصيل سريع" },
            { Icon: CreditCard, t: "الدفع عند الاستلام", d: "ادفع عند الوصول" },
            { Icon: RefreshCw, t: "استبدال مجاني", d: "خلال 7 أيام" },
            { Icon: ShieldCheck, t: "ضمان الجودة", d: "منتجات أصلية" },
          ].map((b) => (
            <div key={b.t} className="flex items-center gap-3">
              <b.Icon className="w-7 h-7 text-black shrink-0" strokeWidth={1.5} />
              <div>
                <div className="font-bold text-sm uppercase" style={{ fontFamily: SERIF }}>{b.t}</div>
                <div className="text-xs text-neutral-500">{b.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Categories strip ===== */}
      {featured.length >= 3 && (
        <section id="stylish-categories" className="px-3 sm:px-6 lg:px-10 py-10 sm:py-14">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide" style={{ fontFamily: SERIF }}>تسوّق حسب الاهتمام</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {featured.slice(0, 3).map((p, idx) => (
                <button key={p.id} onClick={() => onOpenProduct(p.slug)}
                  className="group relative aspect-[4/5] sm:aspect-[3/4] overflow-hidden bg-neutral-100">
                  {p.images?.[0] && <img src={p.images[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-6 right-6 text-right">
                    <div className="text-white text-xs uppercase tracking-[0.3em] mb-1 opacity-80">{["مميزة", "الأكثر مبيعاً", "وصل حديثاً"][idx]}</div>
                    <div className="text-white text-xl font-bold uppercase" style={{ fontFamily: SERIF }}>{p.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== Featured products ===== */}
      <Section
        id="stylish-featured" title="منتجات مميزة" items={featured}
        currencySymbol={currencySymbol} onOpenProduct={onOpenProduct}
        onQuickView={setQuickView} markNew
      />

      {/* ===== Discount banner ===== */}
      <section className="bg-white py-8 px-3 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl bg-neutral-100 px-5 sm:px-10 py-8 sm:py-12 relative overflow-hidden">
          <div className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 font-black text-neutral-200 select-none pointer-events-none"
            style={{ fontSize: "clamp(80px,14vw,180px)", lineHeight: 1, letterSpacing: "-0.05em", fontFamily: SERIF }}>
            10% OFF
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: SERIF }}>خصم 10٪ على أول طلب</h2>
              <p className="mt-2 text-sm text-neutral-600">اشترك واحصل على عروض حصرية</p>
            </div>
            <button onClick={() => scrollTo("stylish-newsletter")}
              className="bg-black text-white uppercase font-bold tracking-[0.2em] text-xs sm:text-sm px-6 sm:px-8 py-3 sm:py-4">
              اشترك الآن
            </button>
          </div>
        </div>
      </section>

      {/* ===== Latest products ===== */}
      <Section
        id="stylish-latest" title="أحدث المنتجات" items={latest}
        currencySymbol={currencySymbol} onOpenProduct={onOpenProduct}
        onQuickView={setQuickView}
      />

      {/* ===== Testimonials ===== */}
      <section className="bg-neutral-50 py-12 sm:py-16 px-4">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide mb-10" style={{ fontFamily: SERIF }}>آراء عملائنا</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "أحمد م.", text: "جودة ممتازة ووصلت بسرعة، شكراً لكم!" },
              { name: "سارة ع.", text: "تجربة شراء رائعة، سأعود مرة أخرى." },
              { name: "محمد ك.", text: "أسعار مناسبة وخدمة احترافية." },
            ].map((r) => (
              <div key={r.name} className="bg-white p-6 border border-neutral-200">
                <div className="flex justify-center gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-black text-black" />)}
                </div>
                <p className="text-sm text-neutral-700 italic mb-4">"{r.text}"</p>
                <div className="font-bold text-sm uppercase" style={{ fontFamily: SERIF }}>{r.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Instagram gallery ===== */}
      {insta.length >= 3 && (
        <section className="py-12 px-3 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-8">
              <div className="text-xs tracking-[0.3em] text-neutral-500 mb-2">@{settings?.logo_text?.toLowerCase().replace(/\s+/g, "") || "store"}</div>
              <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide" style={{ fontFamily: SERIF }}>تابعنا على انستجرام</h2>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {insta.map((img, i) => (
                <a key={i} href={settings?.instagram_url || "#"} target="_blank" rel="noopener noreferrer"
                  className="aspect-square overflow-hidden bg-neutral-100 group relative">
                  <img src={img} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 grid place-items-center transition-colors">
                    <Instagram className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== Newsletter ===== */}
      <section id="stylish-newsletter" className="bg-black text-white py-14 px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide mb-3" style={{ fontFamily: SERIF }}>اشترك في النشرة</h2>
          <p className="text-sm text-white/70 mb-6">احصل على عروض حصرية وآخر التحديثات</p>
          <form onSubmit={(e) => { e.preventDefault(); alert("شكراً لاشتراكك!"); }}
            className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <input type="email" required placeholder="بريدك الإلكتروني" dir="ltr"
              className="flex-1 bg-transparent border border-white/40 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-white" />
            <button className="bg-white text-black font-bold uppercase tracking-[0.2em] text-xs px-6 py-3">اشترك</button>
          </form>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer id="stylish-contact" className="bg-neutral-900 text-white pt-14 pb-6 px-4">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-xl font-black uppercase tracking-wider mb-3" style={{ fontFamily: SERIF }}>{settings?.logo_text || "STORE"}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{settings?.tagline || "متجرك الموثوق لأفضل المنتجات بأسعار مميّزة."}</p>
            <div className="flex gap-3 mt-4">
              {social.map(({ url, Icon, label }) => (
                <a key={label} href={url!} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="w-9 h-9 grid place-items-center border border-white/30 hover:bg-white hover:text-black transition-colors">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4">روابط</h4>
            <ul className="space-y-2 text-sm text-white/60">
              {navItems.map((n) => (
                <li key={n.id}><button onClick={() => scrollTo(n.id)} className="hover:text-white">{n.label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4">تواصل</h4>
            <ul className="space-y-2 text-sm text-white/60">
              {settings?.phone && <li className="flex items-center gap-2"><Phone className="w-4 h-4" /><span dir="ltr">{settings.phone}</span></li>}
              {settings?.email && <li className="flex items-center gap-2"><Mail className="w-4 h-4" /><span dir="ltr">{settings.email}</span></li>}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4">طرق الدفع</h4>
            <div className="flex flex-wrap gap-2">
              {["VISA", "MC", "COD"].map((p) => (
                <span key={p} className="text-xs font-bold border border-white/30 px-2 py-1">{p}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} {settings?.logo_text || "STORE"} — جميع الحقوق محفوظة
        </div>
      </footer>

      {/* ===== Quick view modal ===== */}
      {quickView && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setQuickView(null)}>
          <div className="bg-white max-w-3xl w-full max-h-[90vh] overflow-auto grid grid-cols-1 md:grid-cols-2 gap-0"
            onClick={(e) => e.stopPropagation()}>
            <div className="aspect-square bg-neutral-100">
              {quickView.images?.[0] && <img src={quickView.images[0]} alt={quickView.name} className="w-full h-full object-cover" />}
            </div>
            <div className="p-6 sm:p-8 relative">
              <button onClick={() => setQuickView(null)} className="absolute top-4 left-4"><X className="w-5 h-5" /></button>
              <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: SERIF }}>{quickView.name}</h3>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold">{quickView.price} {currencySymbol}</span>
                {quickView.original_price && quickView.original_price > quickView.price && (
                  <span className="text-sm text-neutral-400 line-through">{quickView.original_price} {currencySymbol}</span>
                )}
              </div>
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-black text-black" />)}
              </div>
              <p className="text-sm text-neutral-600 mb-6">منتج عالي الجودة، الدفع عند الاستلام مع توصيل لكل ليبيا.</p>
              <button onClick={() => { setQuickView(null); onOpenProduct(quickView.slug); }}
                className="w-full bg-black text-white uppercase font-bold tracking-[0.2em] text-sm py-4 hover:bg-neutral-800">
                اطلب الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Section with product grid ===== */
function Section({
  id, title, items, currencySymbol, onOpenProduct, onQuickView, markNew,
}: {
  id: string; title: string; items: Product[]; currencySymbol: string;
  onOpenProduct: (slug: string) => void;
  onQuickView: (p: Product) => void;
  markNew?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section id={id} className="bg-white py-10 sm:py-14 px-3 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6 sm:mb-10 border-b border-neutral-200 pb-4">
          <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide" style={{ fontFamily: SERIF }}>{title}</h2>
          <span className="text-[11px] tracking-[0.3em] font-bold uppercase text-neutral-500">{items.length} منتج</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {items.map((p, idx) => <ProductCard key={p.id} p={p} idx={idx} currencySymbol={currencySymbol}
            onOpenProduct={onOpenProduct} onQuickView={onQuickView} markNew={markNew} />)}
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  p, idx, currencySymbol, onOpenProduct, onQuickView, markNew,
}: {
  p: Product; idx: number; currencySymbol: string;
  onOpenProduct: (slug: string) => void;
  onQuickView: (p: Product) => void;
  markNew?: boolean;
}) {
  const hasDiscount = p.original_price && p.original_price > p.price;
  const discount = hasDiscount ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100) : 0;
  const hoverImg = p.images?.[1];

  return (
    <div className="group text-right">
      <div className="relative aspect-[3/4] bg-neutral-100 overflow-hidden cursor-pointer"
        onClick={() => onOpenProduct(p.slug)}>
        {p.images?.[0] && (
          <img src={p.images[0]} alt={p.name} loading="lazy"
            className={`w-full h-full object-cover transition-opacity duration-300 ${hoverImg ? "group-hover:opacity-0" : "group-hover:scale-105"}`} />
        )}
        {hoverImg && (
          <img src={hoverImg} alt="" loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}

        {/* badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {hasDiscount && (
            <span className="bg-black text-white text-[10px] tracking-[0.2em] font-bold uppercase px-2 py-1">-{discount}%</span>
          )}
          {markNew && idx < 3 && !hasDiscount && (
            <span className="bg-white text-black text-[10px] tracking-[0.2em] font-bold uppercase px-2 py-1">جديد</span>
          )}
        </div>

        {/* hover actions */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onQuickView(p); }}
            className="bg-white p-2 hover:bg-black hover:text-white transition-colors" aria-label="معاينة سريعة">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={(e) => e.stopPropagation()}
            className="bg-white p-2 hover:bg-black hover:text-white transition-colors" aria-label="مفضلة">
            <Heart className="w-4 h-4" />
          </button>
        </div>

        <button onClick={(e) => { e.stopPropagation(); onOpenProduct(p.slug); }}
          className="absolute bottom-0 inset-x-0 bg-black text-white text-[11px] tracking-[0.25em] font-bold uppercase text-center py-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          اطلب الآن
        </button>
      </div>

      <div className="pt-3 sm:pt-4">
        <div className="flex gap-0.5 mb-1">
          {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-black text-black" />)}
        </div>
        <h3 onClick={() => onOpenProduct(p.slug)}
          className="text-sm sm:text-base font-bold text-black line-clamp-2 cursor-pointer hover:opacity-70 transition-opacity"
          style={{ fontFamily: SERIF }}>
          {p.name}
        </h3>
        <div className="flex items-center gap-2 mt-1 sm:mt-2">
          <span className="text-sm sm:text-base font-bold">{p.price} {currencySymbol}</span>
          {hasDiscount && (
            <span className="text-xs text-neutral-400 line-through">{p.original_price} {currencySymbol}</span>
          )}
        </div>
      </div>
    </div>
  );
}
