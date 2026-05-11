import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, ChevronLeft, CheckCircle2, Undo2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ReturnRow {
  id: string;
  external_id: number;
  code: string;
  return_date: string | null;
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

interface RtrnOrderRow {
  id: string;
  customer_name: string;
  phone: string;
  product_name: string;
  quantity: number;
  price: number;
  shipping_reference: string | null;
  carrier_status: string | null;
  carrier_status_updated_at: string | null;
  status: string;
}

const Returns = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rtrnRows, setRtrnRows] = useState<RtrnOrderRow[]>([]);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: ord, error: oErr }] = await Promise.all([
      (supabase as any).from("returns").select("*").order("return_date", { ascending: false }),
      (supabase as any).from("orders")
        .select("id, customer_name, phone, product_name, quantity, price, shipping_reference, carrier_status, carrier_status_updated_at, status")
        .ilike("carrier_status", "%RTRN%")
        .neq("status", "returned_received")
        .order("carrier_status_updated_at", { ascending: false }),
    ]);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else setRows((data as ReturnRow[]) || []);
    if (oErr) console.error(oErr);
    else setRtrnRows((ord as RtrnOrderRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const receiveRtrnOrder = async (orderId: string) => {
    setReceivingId(orderId);
    try {
      const { error: fErr } = await supabase.functions.invoke("apply-order-stock", {
        body: { order_id: orderId, reason: "return_received" },
      });
      if (fErr) throw fErr;
      const { error: uErr } = await (supabase as any).from("orders")
        .update({ status: "returned_received" }).eq("id", orderId);
      if (uErr) throw uErr;
      toast({ title: "تم الاستلام", description: "أُعيدت الكمية للمخزون" });
      await load();
    } catch (e: any) {
      toast({ title: "تعذر الاستلام", description: e?.message || "", variant: "destructive" });
    } finally {
      setReceivingId(null);
    }
  };

  const refreshFromCarrier = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-returns");
      if (error) throw error;
      toast({
        title: "تم التحديث",
        description: `تم جلب ${data?.count ?? 0} مرتجع من شركة الشحن`,
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
      acc.amount += Number(r.payment_amount);
      if (!r.received) acc.pending += Number(r.payment_amount);
      acc.received += r.received ? Number(r.payment_amount) : 0;
      return acc;
    },
    { amount: 0, pending: 0, received: 0 },
  );

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">استلام المرتجعات</h1>
          <p className="text-muted-foreground">قوائم استلام البضاعة المرتجعة من شركة الشحن</p>
        </div>
        <Button onClick={refreshFromCarrier} disabled={syncing}>
          {syncing ? (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 ml-2" />
          )}
          تحديث من شركة الشحن
        </Button>
      </div>

      <Tabs defaultValue="lists" className="w-full">
        <TabsList>
          <TabsTrigger value="lists">قوائم المرتجعات</TabsTrigger>
          <TabsTrigger value="rtrn">
            طلبات قيد الاستلام (RTRN)
            {rtrnRows.length > 0 && (
              <Badge variant="secondary" className="mr-2">{rtrnRows.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Undo2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي القيم</p>
              <p className="text-lg font-bold">{totals.amount.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Undo2 className="w-5 h-5 text-orange-500" />
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
          <CardTitle>قائمة المرتجعات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              لا توجد قوائم مرتجعات. اضغط "تحديث من شركة الشحن" لجلبها.
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
                    <TableHead className="text-right">القيمة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.code}</TableCell>
                      <TableCell>
                        {r.return_date
                          ? new Date(r.return_date).toLocaleDateString("ar-LY")
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
                          onClick={() => navigate(`/dashboard/returns/${r.id}`)}
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
        </TabsContent>

        <TabsContent value="rtrn">
          <Card>
            <CardHeader>
              <CardTitle>طلبات بحالة "تم الإرجاع للراسل" (RTRN)</CardTitle>
              <p className="text-sm text-muted-foreground">عند الاستلام تُعاد الكمية للمخزون وتُسجل حركة المنتجات</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : rtrnRows.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">لا توجد طلبات بهذه الحالة حالياً.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المرجع</TableHead>
                        <TableHead className="text-right">العميل</TableHead>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right">آخر تحديث</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rtrnRows.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.shipping_reference || "—"}</TableCell>
                          <TableCell>{o.customer_name}</TableCell>
                          <TableCell>{o.product_name}</TableCell>
                          <TableCell>{o.quantity}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {o.carrier_status_updated_at ? new Date(o.carrier_status_updated_at).toLocaleString("ar-LY") : "—"}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" disabled={receivingId === o.id} onClick={() => receiveRtrnOrder(o.id)}>
                              {receivingId === o.id ? (
                                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 ml-1" />
                              )}
                              تم الاستلام
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Returns;