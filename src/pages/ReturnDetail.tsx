import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Link2, Link2Off, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ReturnRow {
  id: string;
  code: string;
  return_date: string | null;
  payment_amount: number;
  due_fees: number;
  shipment_count: number;
  safe_name: string | null;
  notes: string | null;
  received: boolean;
  shipments_synced_at: string | null;
}

interface ShipmentRow {
  id: string;
  shipment_code: string;
  ref_number: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  zone_name: string | null;
  area_name: string | null;
  status_name: string | null;
  delivered_amount: number;
  paid_amount: number;
  collected_fees: number;
  pieces_count: number;
  order_id: string | null;
}

const ReturnDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ret, setRet] = useState<ReturnRow | null>(null);
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const sb = supabase as any;
    const [rRes, shRes] = await Promise.all([
      sb.from("returns").select("*").eq("id", id).maybeSingle(),
      sb.from("return_shipments").select("*").eq("return_id", id)
        .order("shipment_code"),
    ]);
    if (rRes.error) toast({ title: "خطأ", description: rRes.error.message, variant: "destructive" });
    setRet(rRes.data as ReturnRow | null);
    setRows((shRes.data as ShipmentRow[]) || []);
    setLoading(false);
    if (rRes.data && !(rRes.data as ReturnRow).shipments_synced_at) {
      syncShipments(true);
    }
  };

  const syncShipments = async (silent = false) => {
    if (!id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-return-shipments", {
        body: { return_id: id },
      });
      if (error) throw error;
      if (!silent) {
        toast({
          title: "تم تحديث الشحنات",
          description: `${data?.count ?? 0} شحنة، مرتبط منها ${data?.linked ?? 0} بطلبات في النظام`,
        });
      }
      const sb = supabase as any;
      const { data: sh } = await sb
        .from("return_shipments").select("*")
        .eq("return_id", id).order("shipment_code");
      setRows((sh as ShipmentRow[]) || []);
      const { data: r } = await sb.from("returns").select("*").eq("id", id).maybeSingle();
      setRet(r as ReturnRow | null);
    } catch (e: any) {
      toast({ title: "تعذر التحديث", description: e?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const setReceived = async (received: boolean) => {
    if (!id) return;
    setMarking(true);
    try {
      const { data, error } = await supabase.functions.invoke("receive-return", {
        body: { return_id: id, received },
      });
      if (error) throw error;
      toast({
        title: received ? "تم تأكيد الاستلام" : "تم التراجع",
        description: `تم تحديث ${data?.updated_orders ?? 0} طلب`,
      });
      await load();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message, variant: "destructive" });
    } finally {
      setMarking(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const linkedCount = rows.filter((r) => r.order_id).length;

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!ret) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        المرتجع غير موجود.
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/returns")}>عودة</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/returns")}>
            <ArrowRight className="w-4 h-4 ml-1" />
            عودة
          </Button>
          <h1 className="text-2xl font-bold">مرتجع {ret.code}</h1>
          {ret.received ? (
            <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10">
              <CheckCircle2 className="w-3 h-3 ml-1" />
              تم الاستلام
            </Badge>
          ) : (
            <Badge variant="secondary">قيد الاستلام</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => syncShipments(false)} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
            تحديث الشحنات
          </Button>
          {ret.received ? (
            <Button variant="outline" onClick={() => setReceived(false)} disabled={marking}>
              <Undo2 className="w-4 h-4 ml-2" />
              تراجع عن الاستلام
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={marking || rows.length === 0}>
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                  تأكيد استلام المرتجع
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد استلام المرتجع</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم تأشير {linkedCount} طلب من أصل {rows.length} شحنة كـ "تم استلام المرتجع".
                    هل تريد المتابعة؟
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setReceived(true)}>
                    نعم، تم الاستلام
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">القيمة</p>
          <p className="text-lg font-bold">{Number(ret.payment_amount).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">رسوم الشحن</p>
          <p className="text-lg font-bold">{Number(ret.due_fees).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">عدد الشحنات</p>
          <p className="text-lg font-bold">{ret.shipment_count}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">مرتبط بالنظام</p>
          <p className="text-lg font-bold">{linkedCount} / {rows.length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الشحنات المرتجعة</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              لا توجد شحنات. اضغط "تحديث الشحنات".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">كود الشحنة</TableHead>
                    <TableHead className="text-right">المرجع</TableHead>
                    <TableHead className="text-right">المستلم</TableHead>
                    <TableHead className="text-right">الوجهة</TableHead>
                    <TableHead className="text-right">القيمة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الربط</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.shipment_code}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.ref_number || "—"}</TableCell>
                      <TableCell>
                        <div>{r.recipient_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.recipient_phone || ""}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {[r.zone_name, r.area_name].filter(Boolean).join(" - ") || "—"}
                      </TableCell>
                      <TableCell>{Number(r.delivered_amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.status_name || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.order_id ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10">
                            <Link2 className="w-3 h-3 ml-1" />
                            مرتبط
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Link2Off className="w-3 h-3 ml-1" />
                            غير مرتبط
                          </Badge>
                        )}
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

export default ReturnDetail;