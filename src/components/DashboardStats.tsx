import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Eye, CreditCard, TrendingUp, Loader2, Globe, Calendar, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useStoreContext } from "@/hooks/useStoreContext";

interface Stats {
  pendingOrders: number;
  uniqueVisits: number;
  checkoutStarts: number;
  orders: number;
  conversionRate: number;
  checkoutRate: number;
}

interface SourceStats {
  source: string;
  visits: number;
  checkouts: number;
  orders: number;
  conversionRate: number;
  lastVisit: string | null;
}

interface DailyStats {
  date: string;
  visits: number;
  checkouts: number;
  orders: number;
}

interface Product {
  slug: string;
  name: string;
}

const sourceLabels: Record<string, string> = {
  facebook: "فيسبوك",
  instagram: "انستغرام",
  tiktok: "تيك توك",
  google: "جوجل",
  twitter: "تويتر",
  snapchat: "سناب شات",
  direct: "مباشر",
};

const sourceColors: Record<string, string> = {
  facebook: "bg-blue-500",
  instagram: "bg-pink-500",
  tiktok: "bg-gray-800",
  google: "bg-red-500",
  twitter: "bg-sky-500",
  snapchat: "bg-yellow-400",
  direct: "bg-green-500",
};

const DashboardStats = () => {
  const { activeStoreId } = useStoreContext();
  const [stats, setStats] = useState<Stats>({
    pendingOrders: 0,
    uniqueVisits: 0,
    checkoutStarts: 0,
    orders: 0,
    conversionRate: 0,
    checkoutRate: 0,
  });
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [daysRange, setDaysRange] = useState<string>("7");
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!activeStoreId) {
        setProducts([]);
        return;
      }
      const { data } = await supabase
        .from("landing_pages")
        .select("slug, title, product_id, products(name)")
        .eq("store_id", activeStoreId)
        .eq("is_visible", true);
      const list: Product[] = (data || [])
        .filter((lp: any) => lp.slug)
        .map((lp: any) => ({
          slug: lp.slug as string,
          name: (lp.title || lp.products?.name || lp.slug) as string,
        }));
      setProducts(list);
    };
    fetchProducts();
  }, [activeStoreId]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!activeStoreId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const days = Number(daysRange) || 7;
        const productSlug = selectedProduct === "all" ? null : selectedProduct;

        const { data, error } = await supabase.rpc("get_store_analytics", {
          _store_id: activeStoreId,
          _days: days,
          _product_slug: productSlug,
        });

        if (error) throw error;

        const payload = data as {
          summary?: {
            unique_visits?: number;
            checkout_starts?: number;
            orders?: number;
            conversion_rate?: number;
            checkout_rate?: number;
          };
          daily?: Array<{ date: string; visits: number; checkouts: number; orders: number }>;
          sources?: Array<{
            source: string;
            visits: number;
            checkouts: number;
            orders: number;
            conversion_rate: number;
            last_visit: string | null;
          }>;
          pending_orders?: number;
        };

        const summary = payload?.summary || {};
        setStats({
          pendingOrders: Number(payload?.pending_orders ?? 0),
          uniqueVisits: Number(summary.unique_visits ?? 0),
          checkoutStarts: Number(summary.checkout_starts ?? 0),
          orders: Number(summary.orders ?? 0),
          conversionRate: Number(summary.conversion_rate ?? 0),
          checkoutRate: Number(summary.checkout_rate ?? 0),
        });

        setSourceStats(
          (payload?.sources || []).map((s) => ({
            source: s.source,
            visits: Number(s.visits ?? 0),
            checkouts: Number(s.checkouts ?? 0),
            orders: Number(s.orders ?? 0),
            conversionRate: Number(s.conversion_rate ?? 0),
            lastVisit: s.last_visit,
          }))
        );

        setDailyStats(
          (payload?.daily || []).map((d) => ({
            date: format(parseISO(String(d.date).slice(0, 10)), "d MMM", { locale: ar }),
            visits: Number(d.visits ?? 0),
            checkouts: Number(d.checkouts ?? 0),
            orders: Number(d.orders ?? 0),
          }))
        );
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedProduct, activeStoreId, daysRange]);

  const formatLastVisit = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "d MMM yyyy - HH:mm", { locale: ar });
    } catch {
      return "—";
    }
  };

  const statCards = [
    { code: "01", title: "طلبات جديدة (معلّقة)", value: stats.pendingOrders, icon: ShoppingCart },
    { code: "02", title: `زيارات فريدة (${daysRange} يوم)`, value: stats.uniqueVisits, icon: Eye },
    { code: "03", title: "بدء الشراء", value: stats.checkoutStarts, icon: CreditCard },
    { code: "04", title: "معدل التحويل (طلبات/زيارات)", value: `${stats.conversionRate}%`, icon: TrendingUp },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex flex-wrap items-center gap-3 justify-end">
        <Select value={daysRange} onValueChange={setDaysRange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="14">آخر 14 يوم</SelectItem>
            <SelectItem value="30">آخر 30 يوم</SelectItem>
            <SelectItem value="90">آخر 90 يوم</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
        {statCards.map((stat) => (
          <div key={stat.title} className="bg-card p-5 flex flex-col justify-between min-h-[140px] relative group">
            <div className="flex items-start justify-between">
              <span className="eyebrow">{stat.code} / {stat.title}</span>
              <stat.icon className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
            </div>
            <div className="num font-display text-4xl md:text-5xl text-foreground leading-none mt-6">
              {stat.value}
            </div>
            <div className="absolute bottom-0 right-0 h-px w-0 bg-accent transition-all duration-500 group-hover:w-full" />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        معدل بدء الشراء: {stats.checkoutRate}% — الطلبات المحسوبة من قاعدة البيانات مع UTM المحفوظ على كل طلب (مصدر حقيقي من البيكسل/الرابط).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            الزيارات والتحويلات ({daysRange} أيام)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyStats.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      direction: "rtl",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend
                    wrapperStyle={{ direction: "rtl" }}
                    formatter={(value) =>
                      value === "visits" ? "زيارات فريدة" : value === "checkouts" ? "بدء شراء" : "طلبات"
                    }
                  />
                  <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} name="visits" />
                  <Line type="monotone" dataKey="checkouts" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))" }} name="checkouts" />
                  <Line type="monotone" dataKey="orders" stroke="#16a34a" strokeWidth={2} dot={{ fill: "#16a34a" }} name="orders" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">لا توجد بيانات للعرض</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              مصادر الزيارات والتحويل
            </CardTitle>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="اختر صفحة/منتج" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الصفحات</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.slug} value={product.slug}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sourceStats.length > 0 ? (
            <div className="space-y-4">
              {sourceStats.map((sourceStat) => {
                const percentage =
                  stats.uniqueVisits > 0 ? Math.round((sourceStat.visits / stats.uniqueVisits) * 100) : 0;

                return (
                  <div key={sourceStat.source} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${sourceColors[sourceStat.source] || "bg-gray-400"}`} />
                        <span className="font-medium">{sourceLabels[sourceStat.source] || sourceStat.source}</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground flex-wrap justify-end">
                        <span>{sourceStat.visits} زيارة</span>
                        <span>{sourceStat.checkouts} بدء شراء</span>
                        <span>{sourceStat.orders} طلب</span>
                        <span className="text-primary font-medium">{sourceStat.conversionRate}% تحويل</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>آخر زيارة: {formatLastVisit(sourceStat.lastVisit)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${sourceColors[sourceStat.source] || "bg-gray-400"}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              لا توجد بيانات زيارات {selectedProduct !== "all" ? "لهذه الصفحة" : ""}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardStats;
