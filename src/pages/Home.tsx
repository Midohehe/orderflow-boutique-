import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, BarChart3, Truck, CreditCard, Layers, ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import { PWAInstallButton } from "@/components/PWAInstallPrompt";

const features = [
  { title: "صفحات هبوط احترافية", desc: "أنشئ صفحات منتجات جذابة تحوّل الزوار إلى عملاء.", icon: ShoppingCart },
  { title: "تحليلات وبكسلات", desc: "تكامل مع فيسبوك، تيك توك، سناب وجوجل لقياس كل تحويل.", icon: BarChart3 },
  { title: "إدارة شحن وطلبات", desc: "تابع طلباتك، حالات الشحن والمرتجعات في مكان واحد.", icon: Truck },
  { title: "محاسبة متكاملة", desc: "خزائن، مصاريف، مشتريات وأرباح دقيقة لكل منتج.", icon: CreditCard },
  { title: "متغيرات لا محدودة", desc: "ألوان، مقاسات وأسعار مرنة لكل منتج.", icon: Layers },
  { title: "أمان وموثوقية", desc: "بياناتك محمية وصلاحيات دقيقة لكل مستخدم.", icon: ShieldCheck },
];

export default function Home() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-foreground text-background grid place-items-center font-display text-sm">و</div>
            <span className="font-display text-lg">وصلة</span>
          </div>
          <div className="flex items-center gap-2">
            <PWAInstallButton className="h-9 rounded-md" />
            <Link to="/login">
            <Button variant="default" className="h-9 gap-2 rounded-md font-medium bg-foreground hover:bg-foreground/90 text-background">
              تسجيل الدخول
              <ArrowLeft className="w-4 h-4" />
            </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section>
        <div className="max-w-[1180px] mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-secondary border border-border/60 rounded-full px-3.5 py-1.5 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            منصة عربية لإدارة التجارة
          </span>
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl leading-[1.05] tracking-tight max-w-4xl mx-auto">
            مساحة هادئة <span className="italic text-accent text-slate-400">لإدارة</span> متجرك بالكامل.
          </h1>
          <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            صفحات هبوط، طلبات، شحنات، ومحاسبة دقيقة — كل ذلك من لوحة تحكم واحدة بأسلوب يحترم وقتك.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg" className="h-11 px-6 rounded-md font-medium bg-foreground hover:bg-foreground/90 text-background gap-2">
                ابدأ الآن
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="ghost" className="h-11 px-5 rounded-md font-medium text-foreground/70 hover:text-foreground">
                استكشف الميزات
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-secondary/40">
        <div className="max-w-[1180px] mx-auto px-6 py-24">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <span className="text-sm text-accent font-medium">القدرات</span>
            <h2 className="font-display text-3xl md:text-5xl mt-3 leading-tight">كل ما تحتاجه. لا أكثر.</h2>
            <p className="mt-4 text-muted-foreground">أدوات مدروسة، مرتبة بعناية، تشتغل بصمت لتترك لك التركيز على متجرك.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-card border border-border/60 rounded-xl p-7 hover:border-accent/40 hover:shadow-[0_4px_24px_-12px_hsl(var(--accent)/0.25)] transition-all"
              >
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-secondary group-hover:bg-accent/10 text-foreground/70 group-hover:text-accent transition-colors mb-5">
                  <f.icon className="w-5 h-5" strokeWidth={1.75} />
                </span>
                <h3 className="font-display text-lg mb-2 leading-tight">{f.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="max-w-[1180px] mx-auto px-6 py-24 text-center">
          <h2 className="font-display text-4xl md:text-5xl leading-tight max-w-2xl mx-auto">
            متجرك يستحق نظامًا <span className="italic text-accent text-slate-400">هادئًا</span> وجادًا.
          </h2>
          <div className="mt-8">
            <Link to="/login">
              <Button size="lg" className="h-11 px-7 rounded-md font-medium bg-foreground hover:bg-foreground/90 text-background gap-2">
                تسجيل الدخول
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="max-w-[1180px] mx-auto px-6 py-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} وصلة</span>
          <span>was-la.com</span>
        </div>
      </footer>
    </div>
  );
}