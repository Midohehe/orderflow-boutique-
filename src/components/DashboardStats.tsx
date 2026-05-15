import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Eye, CreditCard, TrendingUp, Loader2, Globe, Calendar, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Stats {
  newOrders: number;
  totalVisits: number;
  checkoutStarts: number;
  conversionRate: number;
}

interface SourceStats {
  source: string;
  visits: number;
  checkouts: number;
  conversionRate: number;
  lastVisit: string | null;
}

interface Product {
  slug: string;
  name: string;
}

interface DailyStats {
  date: string;
  visits: number;
  checkouts: number;
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
  const [stats, setStats] = useState<Stats>({
    newOrders: 0,
    totalVisits: 0,
    checkoutStarts: 0,
    conversionRate: 0,
  });
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: ordersData } = await supabase
        .from("orders")
        .select("product_name")
        .eq("owner_id", user.id);
      const orderedNames = new Set((ordersData || []).map(o => o.product_name).filter(Boolean));
      if (orderedNames.size === 0) {
        setProducts([]);
        return;
      }
      const { data } = await supabase
        .from("products")
        .select("slug, name")
        .eq("owner_id", user.id);
      setProducts((data || []).filter(p => orderedNames.has(p.name)));
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get orders count (pending = new orders)
        const { count: ordersCount } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        // Build query for page views based on selected product
        let pageViewsQuery = supabase
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "page_view");
        
        if (selectedProduct !== "all") {
          pageViewsQuery = pageViewsQuery.eq("product_slug", selectedProduct);
        }
        
        const { count: pageViews } = await pageViewsQuery;

        // Build query for checkout starts based on selected product
        let checkoutStartsQuery = supabase
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "checkout_start");
        
        if (selectedProduct !== "all") {
          checkoutStartsQuery = checkoutStartsQuery.eq("product_slug", selectedProduct);
        }
        
        const { count: checkoutStarts } = await checkoutStartsQuery;

        // Get total orders for conversion rate
        const { count: totalOrders } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true });

        const visits = pageViews || 0;
        const orders = totalOrders || 0;
        const conversionRate = visits > 0 ? (orders / visits) * 100 : 0;

        setStats({
          newOrders: ordersCount || 0,
          totalVisits: visits,
          checkoutStarts: checkoutStarts || 0,
          conversionRate: Math.round(conversionRate * 100) / 100,
        });

        // Fetch source-based statistics with timestamps and product filter
        let pageViewEventsQuery = supabase
          .from("analytics_events")
          .select("utm_source, created_at")
          .eq("event_type", "page_view");
        
        if (selectedProduct !== "all") {
          pageViewEventsQuery = pageViewEventsQuery.eq("product_slug", selectedProduct);
        }
        
        const { data: pageViewEvents } = await pageViewEventsQuery;

        let checkoutEventsQuery = supabase
          .from("analytics_events")
          .select("utm_source")
          .eq("event_type", "checkout_start");
        
        if (selectedProduct !== "all") {
          checkoutEventsQuery = checkoutEventsQuery.eq("product_slug", selectedProduct);
        }
        
        const { data: checkoutEvents } = await checkoutEventsQuery;

        // Group by source with last visit tracking
        const sourceVisitCounts: Record<string, number> = {};
        const sourceCheckoutCounts: Record<string, number> = {};
        const sourceLastVisit: Record<string, string> = {};

        (pageViewEvents || []).forEach(event => {
          const source = event.utm_source || "direct";
          sourceVisitCounts[source] = (sourceVisitCounts[source] || 0) + 1;
          
          // Track last visit time
          if (!sourceLastVisit[source] || event.created_at > sourceLastVisit[source]) {
            sourceLastVisit[source] = event.created_at;
          }
        });

        (checkoutEvents || []).forEach(event => {
          const source = event.utm_source || "direct";
          sourceCheckoutCounts[source] = (sourceCheckoutCounts[source] || 0) + 1;
        });

        // Combine into source stats
        const allSources = new Set([...Object.keys(sourceVisitCounts), ...Object.keys(sourceCheckoutCounts)]);
        const combinedSourceStats: SourceStats[] = Array.from(allSources).map(source => {
          const visitsCount = sourceVisitCounts[source] || 0;
          const checkoutsCount = sourceCheckoutCounts[source] || 0;
          return {
            source,
            visits: visitsCount,
            checkouts: checkoutsCount,
            conversionRate: visitsCount > 0 ? Math.round((checkoutsCount / visitsCount) * 100 * 100) / 100 : 0,
            lastVisit: sourceLastVisit[source] || null,
          };
        }).sort((a, b) => b.visits - a.visits);

        setSourceStats(combinedSourceStats);

        // Calculate daily stats for the last 7 days
        const last7Days: DailyStats[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = startOfDay(subDays(new Date(), i));
          const dateStr = format(date, "yyyy-MM-dd");
          const displayDate = format(date, "d MMM", { locale: ar });
          
          const dayVisits = (pageViewEvents || []).filter(e => 
            e.created_at && e.created_at.startsWith(dateStr)
          ).length;
          
          const dayCheckouts = (checkoutEvents || []).filter(e => {
            // We need created_at for checkout events too
            return false; // Will be updated below
          }).length;
          
          last7Days.push({
            date: displayDate,
            visits: dayVisits,
            checkouts: 0,
          });
        }

        // Fetch checkout events with timestamps for chart
        let checkoutEventsWithTimeQuery = supabase
          .from("analytics_events")
          .select("utm_source, created_at")
          .eq("event_type", "checkout_start");
        
        if (selectedProduct !== "all") {
          checkoutEventsWithTimeQuery = checkoutEventsWithTimeQuery.eq("product_slug", selectedProduct);
        }
        
        const { data: checkoutEventsWithTime } = await checkoutEventsWithTimeQuery;

        // Update daily stats with checkout data
        for (let i = 6; i >= 0; i--) {
          const date = startOfDay(subDays(new Date(), i));
          const dateStr = format(date, "yyyy-MM-dd");
          
          const dayCheckouts = (checkoutEventsWithTime || []).filter(e => 
            e.created_at && e.created_at.startsWith(dateStr)
          ).length;
          
          last7Days[6 - i].checkouts = dayCheckouts;
        }

        setDailyStats(last7Days);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedProduct]);

  const formatLastVisit = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "d MMM yyyy - HH:mm", { locale: ar });
    } catch {
      return "—";
    }
  };

  const statCards = [
    { code: "01", title: "الطلبيات الجديدة", value: stats.newOrders, icon: ShoppingCart },
    { code: "02", title: "إجمالي الزيارات", value: stats.totalVisits, icon: Eye },
    { code: "03", title: "بدء الشراء", value: stats.checkoutStarts, icon: CreditCard },
    { code: "04", title: "معدل التحويل", value: `${stats.conversionRate}%`, icon: TrendingUp },
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
      {/* Main Stats — Swiss editorial grid */}
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

      {/* Visits & Conversions Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            الزيارات والتحويلات (آخر 7 أيام)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyStats.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      direction: 'rtl'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend 
                    wrapperStyle={{ direction: 'rtl' }}
                    formatter={(value) => value === 'visits' ? 'الزيارات' : 'بدء الشراء'}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="visits" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                    name="visits"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="checkouts" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--accent))' }}
                    name="checkouts"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              لا توجد بيانات للعرض
            </div>
          )}
        </CardContent>
      </Card>

      {/* Traffic Sources */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              مصادر الزيارات
            </CardTitle>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="اختر المنتج" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المنتجات</SelectItem>
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
                const percentage = stats.totalVisits > 0 
                  ? Math.round((sourceStat.visits / stats.totalVisits) * 100) 
                  : 0;
                
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
              لا توجد بيانات زيارات {selectedProduct !== "all" ? "لهذا المنتج" : ""}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardStats;
