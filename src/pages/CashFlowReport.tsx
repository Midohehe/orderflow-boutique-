import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, Loader2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";

interface CashFlowRow {
  movement_type: string;
  total: number;
  count_movements: number;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: "إيداع",
  expense: "مصروف",
  purchase: "مشتريات",
  ad_topup: "شحن إعلانات",
  settlement: "تسوية",
  settlement_reversal: "عكس تسوية",
  return_refund: "استرداد مرتجع",
  adjustment: "تعديل",
  other: "أخرى",
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

const CashFlowReport = () => {
  const { activeStoreId } = useStoreContext();
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<CashFlowRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!activeStoreId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("cash_flow_report", {
      _store_id: activeStoreId,
      _from: from,
      _to: to,
    });
    setLoading(false);
    if (error) {
      toast({ title: "تعذر التحميل", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data as CashFlowRow[]) || []);
  };

  useEffect(() => { load(); }, [activeStoreId]);

  const summary = useMemo(() => {
    const inflow = rows.filter((r) => Number(r.total) > 0).reduce((s, r) => s + Number(r.total), 0);
    const outflow = rows.filter((r) => Number(r.total) < 0).reduce((s, r) => s + Math.abs(Number(r.total)), 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [rows]);

  const chartData = useMemo(
    () => rows.map((r) => ({
      name: TYPE_LABELS[r.movement_type] || r.movement_type,
      total: Number(r.total),
      count: r.count_movements,
      fill: Number(r.total) >= 0 ? "#10b981" : "#ef4444",
    })),
    [rows],
  );

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={Wallet}
        title="تقرير التدفق النقدي"
        description="حركات الخزائن مجمّعة حسب النوع"
        iconGradient="from-violet-500 to-purple-600"
      />

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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تحديث"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowUpCircle className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">إجمالي التدفقات الداخلة</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(summary.inflow)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowDownCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">إجمالي التدفقات الخارجة</p>
              <p className="text-xl font-bold text-red-500">{fmt(summary.outflow)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">صافي التدفق</p>
            <p className={`text-xl font-bold ${summary.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(summary.net)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">التدفق حسب نوع الحركة</CardTitle></CardHeader>
        <CardContent className="h-80">
          {chartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">لا توجد حركات في هذه الفترة</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => fmt(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" name="المبلغ">
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">تفاصيل الحركات</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">عدد الحركات</TableHead>
                  <TableHead className="text-right">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.movement_type}>
                    <TableCell>{TYPE_LABELS[r.movement_type] || r.movement_type}</TableCell>
                    <TableCell>{r.count_movements}</TableCell>
                    <TableCell className={Number(r.total) >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                      {fmt(Number(r.total))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CashFlowReport;
