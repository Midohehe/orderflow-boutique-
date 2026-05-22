import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, ChevronLeft, CheckCircle2, Wallet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useStoreContext } from "@/hooks/useStoreContext";

interface Settlement {
  id: string;
  external_id: number;
  code: string;
  settlement_date: string | null;
  payment_amount: number;
  due_fees: number;
  shipment_count: number;
  customer_name: string | null;
  safe_name: string | null;
  notes: string | null;
  approved: boolean;
  received: boolean;
  received_at: string | null;
  shipments_synced_at: string | null;
}

const Settlements = () => {
  const navigate = useNavigate();
  const { activeStoreId } = useStoreContext();
  const [rows, setRows] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    if (!activeStoreId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("settlements")
      .select("*")
      .or(`store_id.eq.${activeStoreId},store_id.is.null`)
      .order("settlement_date", { ascending: false });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setRows((data as Settlement[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeStoreId]);

  const refreshFromCarrier = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-settlements");
      if (error) throw error;
      toast({
        title: "تم التحديث",
        description: `تم جلب ${data?.count ?? 0} تسوية من شركة الشحن`,
      });
      await load();
    } catch (e: any) {
      toast({
        title: "تعذر التحديث",
        description: e?.message || "تأكد من إعدادات شركة الشحن",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const totals = rows.reduce(
    (acc, r) => {
      acc.payment += Number(r.payment_amount);
      if (!r.received) acc.pending += Number(r.payment_amount);
      acc.received += r.received ? Number(r.payment_amount) : 0;
      return acc;
    },
    { payment: 0, pending: 0, received: 0 },
  );

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={Wallet}
        title="استلام التسويات المالية"
        description="سداد مستحقات العملاء من شركة الشحن"
        iconGradient="from-emerald-500 to-green-600"
        action={
          <Button onClick={refreshFromCarrier} disabled={syncing} className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700">
            {syncing ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 ml-2" />
            )}
            تحديث من شركة الشحن
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي التسويات</p>
              <p className="text-lg font-bold">{totals.payment.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Wallet className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">قيد الاستلام</p>
              <p className="text-lg font-bold">{totals.pending.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">تم استلامها</p>
              <p className="text-lg font-bold">{totals.received.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة التسويات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              لا توجد تسويات بعد. اضغط "تحديث من شركة الشحن" لجلبها.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الخزينة</TableHead>
                    <TableHead className="text-right">عدد الشحنات</TableHead>
                    <TableHead className="text-right">المبلغ المستحق</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.code}</TableCell>
                      <TableCell>
                        {r.settlement_date
                          ? new Date(r.settlement_date).toLocaleDateString("ar-LY")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.safe_name || "—"}</TableCell>
                      <TableCell>{r.shipment_count}</TableCell>
                      <TableCell className="font-bold">
                        {Number(r.payment_amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {r.received ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10">
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            تم الاستلام
                          </Badge>
                        ) : (
                          <Badge variant="secondary">قيد الاستلام</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/dashboard/settlements/${r.id}`)}
                        >
                          عرض الشحنات
                          <ChevronLeft className="w-4 h-4 mr-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settlements;