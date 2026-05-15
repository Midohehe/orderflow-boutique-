import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Rocket, ShoppingCart, BarChart3, Truck, CreditCard, Layers, Zap, ShieldCheck, LogIn } from "lucide-react";

const features = [
  { icon: ShoppingCart, title: "صفحات هبوط احترافية", desc: "أنشئ صفحات منتجات جذابة تحوّل الزوار إلى عملاء." },
  { icon: BarChart3, title: "تحليلات وبكسلات", desc: "تكامل مع فيسبوك، تيك توك، سناب وجوجل لقياس كل تحويل." },
  { icon: Truck, title: "إدارة شحن وطلبات", desc: "تابع طلباتك، حالات الشحن والمرتجعات في مكان واحد." },
  { icon: CreditCard, title: "محاسبة متكاملة", desc: "خزائن، مصاريف، مشتريات وأرباح دقيقة لكل منتج." },
  { icon: Layers, title: "متغيرات لا محدودة", desc: "ألوان، مقاسات وأسعار مرنة لكل منتج." },
  { icon: ShieldCheck, title: "أمان وموثوقية", desc: "بياناتك محمية وصلاحيات دقيقة لكل مستخدم." },
];

export default function Home() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow">
              <Rocket className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">وصلة</span>
          </div>
          <Link to="/login">
            <Button className="gap-2">
              <LogIn className="w-4 h-4" />
              تسجيل الدخول
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Zap className="w-4 h-4" />
          منصة وصلة لإدارة المتاجر وصفحات الهبوط
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
          أطلق متجرك واربط <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">طلباتك</span>
          <br /> في دقائق معدودة
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          منصة عربية متكاملة لإنشاء صفحات هبوط، إدارة الطلبات، تتبع الشحنات، ومحاسبة دقيقة لكل منتج، كل ذلك من لوحة تحكم واحدة.
        </p>
        <Link to="/login">
          <Button size="lg" className="gap-2 text-lg h-14 px-8">
            <LogIn className="w-5 h-5" />
            ابدأ الآن - تسجيل الدخول
          </Button>
        </Link>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">كل ما تحتاجه لإدارة تجارتك</h2>
          <p className="text-muted-foreground">أدوات قوية، واجهة عربية، وتجربة سلسة.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-emerald-600 p-10 md:p-16 text-center text-primary-foreground shadow-xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">جاهز لتنطلق مع وصلة؟</h2>
          <p className="text-primary-foreground/90 mb-8 max-w-xl mx-auto">سجّل دخولك الآن وابدأ بإدارة متجرك وطلباتك باحترافية.</p>
          <Link to="/login">
            <Button size="lg" variant="secondary" className="gap-2 h-14 px-8 text-lg">
              <LogIn className="w-5 h-5" />
              تسجيل الدخول
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} وصلة. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}