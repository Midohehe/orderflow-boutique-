import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, TrendingUp, DollarSign, ShoppingCart, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = {
  key: string;
  name: string;
  status?: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  delivered: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
  ctr: number | null;
};

const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString("ar-LY", { maximumFractionDigits: d }) : "—");

export default function FacebookPerformance() {
  const { activeStoreId, activeStore } = useStoreContext() as any;
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState<number>(30);
  const [level, setLevel] = useState<"campaign" | "ad">("campaign");
  const [insights, setInsights] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const load = async () => {
    if (!activeStoreId) { setLoading(false); return; }
    setLoading(true);
    const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const [ins, camp, ad, ord] = await Promise.all([
      supabase.from("fb_insights_daily" as any).select("*").eq("store_id", activeStoreId).gte("date", sinceDate),
      supabase.from("fb_campaigns" as any).select("*").eq("store_id", activeStoreId),
      supabase.from("fb_ads" as any).select("*").eq("store_id", activeStoreId),
      supabase.from("orders").select("id,status,price,quantity,fb_campaign_id,fb_ad_id,utm_campaign,utm_content,created_at")
        .eq("store_id", activeStoreId).gte("created_at", sinceDate + "T00:00:00").eq("is_deleted", false),
    ]);
    setInsights((ins.data as any[]) || []);
    setCampaigns((camp.data as any[]) || []);
    setAds((ad.data as any[]) || []);
    setOrders((ord.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeStoreId, days]);

  const sync = async () => {
    if (!activeStoreId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("facebook-sync-insights", {
        body: { store_id: activeStoreId, days },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "تمت المزامنة", description: `حملات: ${(data as any).campaigns} • إعلانات: ${(data as any).ads} • أيام: ${(data as any).insights}` });
      await load();
    } catch (e: any) {
      toast({ title: "فشلت المزامنة", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const rows = useMemo<Row[]>(() => {
    const groupKey = (i: any) => level === "campaign" ? (i.fb_campaign_id || "—") : (i.fb_ad_id || "—");
    const nameOf = (key: string) => {
      if (level === "campaign") return campaigns.find((c) => c.fb_campaign_id === key)?.name || key;
      return ads.find((a) => a.fb_ad_id === key)?.name || key;
    };
    const statusOf = (key: string) => {
      if (level === "campaign") return campaigns.find((c) => c.fb_campaign_id === key)?.status;
      return ads.find((a) => a.fb_ad_id === key)?.status;
    };
    const map = new Map<string, Row>();
    // FB spend
    for (const i of insights) {
      const k = groupKey(i);
      const r = map.get(k) || { key: k, name: nameOf(k), status: statusOf(k), spend: 0, impressions: 0, clicks: 0, orders: 0, delivered: 0, revenue: 0, cpa: null, roas: null, ctr: null };
      r.spend += Number(i.spend) || 0;
      r.impressions += Number(i.impressions) || 0;
      r.clicks += Number(i.clicks) || 0;
      map.set(k, r);
    }
    // Orders attribution
    const deliveredStatuses = new Set(["delivered", "تم التسليم", "تم_التسليم"]);
    for (const o of orders) {
      const k = level === "campaign" ? (o.fb_campaign_id || o.utm_campaign || "—") : (o.fb_ad_id || o.utm_content || "—");
      if (k === "—") continue;
      const r = map.get(k) || { key: k, name: nameOf(k), status: statusOf(k), spend: 0, impressions: 0, clicks: 0, orders: 0, delivered: 0, revenue: 0, cpa: null, roas: null, ctr: null };
      r.orders += 1;
      if (deliveredStatuses.has(String(o.status).toLowerCase())) {
        r.delivered += 1;
        r.revenue += Number(o.price) || 0;
      }
      map.set(k, r);
    }
    const list = Array.from(map.values()).map((r) => ({
      ...r,
      ctr: r.impressions ? (r.clicks / r.impressions) * 100 : null,
      cpa: r.delivered ? r.spend / r.delivered : null,
      roas: r.spend ? r.revenue / r.spend : null,
    }));
    return list.sort((a, b) => b.spend - a.spend);
  }, [insights, campaigns, ads, orders, level]);

  const totals = useMemo(() => {
    const t = rows.reduce((acc, r) => ({
      spend: acc.spend + r.spend, orders: acc.orders + r.orders,
      delivered: acc.delivered + r.delivered, revenue: acc.revenue + r.revenue,
      clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions,
    }), { spend: 0, orders: 0, delivered: 0, revenue: 0, clicks: 0, impressions: 0 });
    return {
      ...t,
      profit: t.revenue - t.spend,
      roas: t.spend ? t.revenue / t.spend : 0,
      cpa: t.delivered ? t.spend / t.delivered : 0,
    };
  }, [rows]);

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-white flex items-center justify-center shadow-md">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">أداء إعلانات فيسبوك</h1>
            <p className="text-sm text-muted-foreground">ربحية الحملات والإعلانات{activeStore?.name ? `: ${activeStore.name}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">آخر 7 أيام</SelectItem>
              <SelectItem value="14">آخر 14 يوم</SelectItem>
              <SelectItem value="30">آخر 30 يوم</SelectItem>
              <SelectItem value="60">آخر 60 يوم</SelectItem>
              <SelectItem value="90">آخر 90 يوم</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={sync} disabled={syncing || !activeStoreId} className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            مزامنة من فيسبوك
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={DollarSign} label="الإنفاق" value={fmt(totals.spend)} accent="from-red-500 to-orange-500" />
        <KPI icon={ShoppingCart} label="الطلبات / المُسلَّم" value={`${totals.orders} / ${totals.delivered}`} accent="from-blue-500 to-cyan-500" />
        <KPI icon={TrendingUp} label="ROAS" value={fmt(totals.roas)} accent="from-emerald-500 to-teal-500" />
        <KPI icon={Target} label="صافي الربح" value={fmt(totals.profit)} accent={totals.profit >= 0 ? "from-emerald-500 to-green-600" : "from-rose-500 to-red-600"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>التفاصيل</CardTitle>
          <Tabs value={level} onValueChange={(v) => setLevel(v as any)}>
            <TabsList>
              <TabsTrigger value="campaign">حسب الحملة</TabsTrigger>
              <TabsTrigger value="ad">حسب الإعلان</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              لا توجد بيانات بعد. اضغط "مزامنة من فيسبوك" لجلب الحملات.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{level === "campaign" ? "الحملة" : "الإعلان"}</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإنفاق</TableHead>
                    <TableHead className="text-right">الظهور</TableHead>
                    <TableHead className="text-right">النقرات</TableHead>
                    <TableHead className="text-right">CTR%</TableHead>
                    <TableHead className="text-right">الطلبات</TableHead>
                    <TableHead className="text-right">المُسلَّم</TableHead>
                    <TableHead className="text-right">الإيراد</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">الربح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const profit = r.revenue - r.spend;
                    return (
                      <TableRow key={r.key}>
                        <TableCell className="font-medium max-w-[260px] truncate" title={r.name}>{r.name}</TableCell>
                        <TableCell>{r.status ? <Badge variant={r.status === "ACTIVE" ? "default" : "secondary"}>{r.status}</Badge> : "—"}</TableCell>
                        <TableCell>{fmt(r.spend)}</TableCell>
                        <TableCell>{fmt(r.impressions, 0)}</TableCell>
                        <TableCell>{fmt(r.clicks, 0)}</TableCell>
                        <TableCell>{r.ctr !== null ? fmt(r.ctr) : "—"}</TableCell>
                        <TableCell>{r.orders}</TableCell>
                        <TableCell>{r.delivered}</TableCell>
                        <TableCell>{fmt(r.revenue)}</TableCell>
                        <TableCell>{r.cpa !== null ? fmt(r.cpa) : "—"}</TableCell>
                        <TableCell className={r.roas !== null && r.roas >= 1 ? "text-emerald-600 font-semibold" : "text-rose-600"}>
                          {r.roas !== null ? fmt(r.roas) : "—"}
                        </TableCell>
                        <TableCell className={profit >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{fmt(profit)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">كيف تربط إعلاناتك بصفحات الهبوط؟</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>عند إنشاء الإعلان في فيسبوك، أضف هذه المعاملات لرابط صفحة الهبوط (URL parameters):</p>
          <pre dir="ltr" className="bg-muted p-3 rounded-md text-xs overflow-x-auto">utm_source=facebook{"\n"}utm_medium=paid{"\n"}utm_campaign={"{{campaign.id}}"}{"\n"}utm_term={"{{adset.id}}"}{"\n"}utm_content={"{{ad.id}}"}</pre>
          <p>فيسبوك سيستبدلها تلقائياً بمعرفات الحملة/المجموعة/الإعلان، وسيُربط كل طلب بمصدره فيظهر الربح الحقيقي هنا.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ icon: Icon, label, value, accent }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent} text-white flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}