import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, BarChart3, Truck, CreditCard, Layers, ShieldCheck, ArrowLeft } from "lucide-react";

const features = [
  { num: "01", title: "صفحات هبوط احترافية", desc: "أنشئ صفحات منتجات جذابة تحوّل الزوار إلى عملاء.", icon: ShoppingCart },
  { num: "02", title: "تحليلات وبكسلات", desc: "تكامل مع فيسبوك، تيك توك، سناب وجوجل لقياس كل تحويل.", icon: BarChart3 },
  { num: "03", title: "إدارة شحن وطلبات", desc: "تابع طلباتك، حالات الشحن والمرتجعات في مكان واحد.", icon: Truck },
  { num: "04", title: "محاسبة متكاملة", desc: "خزائن، مصاريف، مشتريات وأرباح دقيقة لكل منتج.", icon: CreditCard },
  { num: "05", title: "متغيرات لا محدودة", desc: "ألوان، مقاسات وأسعار مرنة لكل منتج.", icon: Layers },
  { num: "06", title: "أمان وموثوقية", desc: "بياناتك محمية وصلاحيات دقيقة لكل مستخدم.", icon: ShieldCheck },
];

export default function Home() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Nav — thin Swiss bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-foreground/10">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-foreground" />
            <span className="font-display text-lg tracking-tight">وصلة</span>
            <span className="eyebrow hidden sm:inline-block mr-3 pr-3 border-r border-border">commerce os / v.2026</span>
          </div>
          <Link to="/login">
            <Button variant="default" className="rounded-none h-9 gap-2 font-semibold">
              تسجيل الدخول
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero — editorial split */}
      <section className="border-b border-foreground/10">
        <div className="max-w-[1400px] mx-auto px-6 py-16 md:py-24 grid md:grid-cols-12 gap-8">
          <div className="md:col-span-8">
            <div className="eyebrow mb-6 flex items-center gap-3">
              <span className="num">№ 001</span>
              <span className="w-10 h-px bg-foreground/40" />
              <span>منصة عربية لإدارة التجارة</span>
            </div>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight">
              أطلق متجرك.
              <br />
              تابع طلباتك.
              <br />
              <span className="text-accent">احسب أرباحك.</span>
            </h1>
            <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              صفحات هبوط، إدارة طلبات، تتبع شحنات، ومحاسبة دقيقة — كل ذلك من لوحة تحكم واحدة، بأسلوب يحترم وقتك.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link to="/login">
                <Button size="lg" className="rounded-none h-12 px-6 font-semibold gap-2">
                  ابدأ الآن
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#features" className="eyebrow hover:text-foreground transition-colors">↓ استكشف</a>
            </div>
          </div>

          {/* Index card — meta grid */}
          <aside className="md:col-span-4 md:border-r md:border-foreground/10 md:pr-6">
            <div className="rule mb-4" />
            <div className="space-y-3 num text-sm">
              {[
                ["النسخة", "26.05"],
                ["السوق", "ليبيا / MENA"],
                ["اللغة", "عربي — RTL"],
                ["الحالة", "● نشط"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-foreground/5 pb-2">
                  <span className="text-muted-foreground font-sans">{k}</span>
                  <span className="text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {/* Features — numbered Swiss grid */}
      <section id="features" className="border-b border-foreground/10">
        <div className="max-w-[1400px] mx-auto px-6 py-20">
          <div className="flex items-end justify-between mb-12 border-b border-foreground/90 pb-4">
            <div>
              <span className="eyebrow">§ 02 — القدرات</span>
              <h2 className="font-display text-3xl md:text-5xl mt-2">كل ما تحتاجه. لا أكثر.</h2>
            </div>
            <span className="num text-sm text-muted-foreground hidden md:inline">06 / 06</span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
            {features.map((f) => (
              <div key={f.title} className="bg-background p-8 group hover:bg-foreground hover:text-background transition-colors">
                <div className="flex items-center justify-between mb-10">
                  <span className="num text-3xl text-muted-foreground group-hover:text-background/60">{f.num}</span>
                  <f.icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <h3 className="font-display text-xl mb-3 leading-tight">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground group-hover:text-background/70">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — bold inverted band */}
      <section className="bg-foreground text-background">
        <div className="max-w-[1400px] mx-auto px-6 py-24 grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <span className="eyebrow text-background/60">§ 03 — ابدأ الآن</span>
            <h2 className="font-display text-4xl md:text-6xl mt-3 leading-[0.95]">
              متجرك يستحق<br />نظامًا جديًا.
            </h2>
          </div>
          <div className="md:col-span-4 md:text-left">
            <Link to="/login">
              <Button size="lg" variant="secondary" className="rounded-none h-12 px-6 font-semibold gap-2 bg-background text-foreground hover:bg-accent hover:text-accent-foreground">
                تسجيل الدخول
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-foreground/10">
        <div className="max-w-[1400px] mx-auto px-6 py-6 flex items-center justify-between eyebrow">
          <span>© {new Date().getFullYear()} وصلة</span>
          <span className="num">was-la.com</span>
        </div>
      </footer>
    </div>
  );
}