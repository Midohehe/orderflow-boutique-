import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Truck, Package, MapPin, AlertTriangle, TrendingUp, RotateCcw, Clock, BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useStoreContext } from "@/hooks/useStoreContext";

interface OrderRow {
  id: string;
  order_code: string | null;
  status: string;
  confirmation_status: string | null;
  city: string | null;
  matched_zone_name: string | null;
  carrier_status: string | null;
  price: number;
  settlement_received: boolean | null;
  created_at: string;
  updated_at: string;
  customer_name: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "قيد المعالجة",
  shipped: "جاري التوصيل",
  delivered: "تم الاستلام",
  settled: "تم التسوية",
  cancelled: "ملغي",
  unpacked: "تم التفريغ",
  returned_received: "مرتجع",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const daysBetween = (from: string, to: string) =>
  Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));

const fmt = (n: number) => Number(n || 0).toLocaleString("ar-LY", { maximumFractionDigits: 1 });

const defaultFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
};

const ShippingKPI = () => {
  const { activeStoreId } = useStoreContext();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [codeCategory, setCodeCategory] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!activeStoreId) return;
    (async () => {
      setLoading(true);
      try {
        const fetchAll = async () => {
          const out: OrderRow[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase
              .from("orders")
              .select("id, order_code, status, confirmation_status, city, matched_zone_name, carrier_status, price, settlement_received, created_at, updated_at, customer_name")
              .eq("store_id", activeStoreId)
              .eq("is_deleted", false)
              .gte("created_at", `${dateFrom}T00:00:00`)
              .lte("created_at", `${dateTo}T23:59:59`)
              .order("created_at", { ascending: false })
              .range(from, from + 999);
            if (error) throw error;
            if (!data?.length) break;
            out.push(...(data as OrderRow[]));
            if (data.length < 1000) break;
          }
          return out;
        };
        const [{ data: mappings }, rows] = await Promise.all([
          supabase.from("carrier_status_mappings").select("status_code, category"),
          fetchAll(),
        ]);
        const catMap: Record<string, string> = {};
        (mappings || []).forEach((m: any) => {
          if (m.status_code && m.category) catMap[String(m.status_code).toUpperCase()] = m.category;
        });
        setCodeCategory(catMap);
        setOrders(rows);
      } catch (e: any) {
        toast({ title: "تعذر التحميل", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [activeStoreId, dateFrom, dateTo]);

  const carrierCategory = (raw: string | null): string => {
    const s = (raw || "").trim();
    const m = s.match(/\(([^)]+)\)\s*$/);
    const code = (m ? m[1] : s).trim().toUpperCase();
    return codeCategory[code] || "in_progress";
  };

  const metrics = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    const daily: Record<string, number> = {};
    let shipped = 0;
    let delivered = 0;
    let returned = 0;
    let deliveryHours = 0;
    let deliveryCount = 0;

    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      const city = (o.matched_zone_name || o.city || "غير محدد").trim() || "غير محدد";
      byCity[city] = (byCity[city] || 0) + 1;
      const day = o.created_at.slice(0, 10);
      daily[day] = (daily[day] || 0) + 1;

      if (o.status === "shipped" || o.carrier_status) shipped++;
      if (o.status === "delivered" || o.status === "settled") {
        delivered++;
        deliveryHours += daysBetween(o.created_at, o.updated_at) * 24;
        deliveryCount++;
      }
      if (o.status === "returned_received" || carrierCategory(o.carrier_status) === "returned") returned++;
    });

    const statusChart = Object.entries(byStatus)
      .map(([status, count]) => ({ name: STATUS_LABELS[status] || status, count, status }))
      .sort((a, b) => b.count - a.count);

    const cityChart = Object.entries(byCity)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const dailyChart = Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("ar-LY", { month: "short", day: "numeric" }),
        count,
      }));

    const deliveryRate = shipped > 0 ? (delivered / shipped) * 100 : 0;
    const returnRate = delivered > 0 ? (returned / delivered) * 100 : 0;
    const avgDeliveryDays = deliveryCount > 0 ? deliveryHours / deliveryCount / 24 : 0;

    const now = Date.now();
    const stuck = orders.filter((o) => {
      const days = (now - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      if (o.status === "pending" && days > 3) return true;
      if (o.status === "shipped" && days > 7) return true;
      if (o.status === "delivered" && !o.settlement_received && days > 14) return true;
      return false;
    }).map((o) => ({
      ...o,
      daysStuck: Math.floor((now - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
      reason:
        o.status === "pending" ? "بانتظار التأكيد/الشحن > 3 أيام"
        : o.status === "shipped" ? "قيد التوصيل > 7 أيام"
        : "مسلّم دون تسوية > 14 يوم",
    })).sort((a, b) => b.daysStuck - a.daysStuck).slice(0, 20);

    return { statusChart, cityChart, dailyChart, deliveryRate, returnRate, avgDeliveryDays, stuck, total: orders.length };
  }, [orders, codeCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={Truck}
        title="مؤشرات الشحن"
        description="تحليل الطلبات حسب الحالة والمدينة ومعدلات التسليم والمرتجعات"
        iconGradient="from-sky-500 to-blue-600"
      />

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <Label className="text-xs">إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" />
          </div>
          <Button variant="outline" size="sm" className="h-9" onClick={() => { setDateFrom(defaultFrom()); setDateTo(new Date().toISOString().slice(0, 10)); }}>
            آخر 90 يوم
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">إجمالي الطلبات</p><p className="text-2xl font-bold">{metrics.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />معدل التسليم</p><p className="text-2xl font-bold text-emerald-600">{fmt(metrics.deliveryRate)}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><RotateCcw className="w-3 h-3" />معدل المرتجعات</p><p className="text-2xl font-bold text-amber-600">{fmt(metrics.returnRate)}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />متوسط أيام التسليم</p><p className="text-2xl font-bold">{fmt(metrics.avgDeliveryDays)}</p></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" />الطلبات حسب الحالة</CardTitle></CardHeader>
          <CardContent className="h-72">
            {metrics.statusChart.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.statusChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" />أعلى 10 مدن</CardTitle></CardHeader>
          <CardContent className="h-72">
            {metrics.cityChart.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={metrics.cityChart} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {metrics.cityChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">الطلبات اليومية (آخر 30 يوم)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.dailyChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" name="طلبات" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {metrics.stuck.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              طلبات متعثرة ({metrics.stuck.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطلب</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                    <TableHead className="text-right">أيام التوقف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.stuck.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono">{o.order_code || o.id.slice(0, 8)}</TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell>{STATUS_LABELS[o.status] || o.status}</TableCell>
                      <TableCell className="text-amber-700 text-sm">{o.reason}</TableCell>
                      <TableCell className="font-bold">{o.daysStuck}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShippingKPI;
