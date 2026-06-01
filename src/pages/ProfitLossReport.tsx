import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TrendingUp, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";

interface PLData {
  revenue: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  purchases: number;
  returns_refunded: number;
  net_profit: number;
  orders_count: number;
  delivered_count: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ar-LY", { maximumFractionDigits: 2 });

const ProfitLossReport = () => {
  const { activeStoreId } = useStoreContext();
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = async () => {
    if (!activeStoreId) return;
    setLoading(true);
    const { data: res, error } = await (supabase as any).rpc("profit_loss_report", {
      _store_id: activeStoreId, _from: from, _to: to,
    });
    setLoading(false);
    if (error) { toast({ title: "تعذر التحميل", description: error.message, variant: "destructive" }); return; }
    setData(res as PLData);
  };

  useEffect(() => { load(); }, [activeStoreId]);

  const closePeriod = async () => {
    if (!activeStoreId) return;
    if (!confirm(`إغلاق الفترة من ${from} إلى ${to}؟\nلن يمكن تعديل حركات الخزائن في هذه الفترة لاحقاً.`)) return;
    setClosing(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("accounting_periods").insert({
      store_id: activeStoreId, period_start: from, period_end: to, closed_by: u.user?.id,
    });
    setClosing(false);
    if (error) { toast({ title: "تعذر الإغلاق", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم إغلاق الفترة" });
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader icon={TrendingUp} title="تقرير الأرباح والخسائر" description="ملخص مالي لفترة محددة" iconGradient="from-emerald-500 to-teal-600" />

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div>
            <Label>من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
            تحديث
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={closePeriod} disabled={closing}>
            <Lock className="w-4 h-4 ml-2" />
            إغلاق هذه الفترة
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="إجمالي الإيرادات (مسلّمة)" value={fmt(data.revenue)} note={`${data.delivered_count} طلب مسلّم`} color="text-emerald-600" />
          <StatCard label="تكلفة البضاعة المباعة" value={fmt(data.cogs)} color="text-orange-600" />
          <StatCard label="مجمل الربح" value={fmt(data.gross_profit)} color="text-emerald-700" big />
          <StatCard label="المصاريف" value={fmt(data.expenses)} color="text-red-600" />
          <StatCard label="المشتريات" value={fmt(data.purchases)} color="text-amber-600" />
          <StatCard label="مرتجعات مُعادة" value={fmt(data.returns_refunded)} color="text-red-500" />
          <Card className="md:col-span-2 lg:col-span-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200">
            <CardHeader><CardTitle className="text-sm text-muted-foreground">صافي الربح</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-4xl font-extrabold ${data.net_profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(data.net_profit)}</div>
              <div className="text-xs text-muted-foreground mt-1">= الإيرادات − التكلفة − المصاريف − المرتجعات</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, note, color = "text-foreground", big = false }: { label: string; value: string; note?: string; color?: string; big?: boolean }) => (
  <Card>
    <CardHeader><CardTitle className="text-sm text-muted-foreground font-normal">{label}</CardTitle></CardHeader>
    <CardContent>
      <div className={`${big ? "text-3xl" : "text-2xl"} font-bold ${color}`}>{value}</div>
      {note && <div className="text-xs text-muted-foreground mt-1">{note}</div>}
    </CardContent>
  </Card>
);

export default ProfitLossReport;