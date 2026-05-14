import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowRight, CheckCircle2, Loader2, Link2, Link2Off, Undo2, ScanLine, Trash2, RefreshCw } from "lucide-react";
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
  const [marking, setMarking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef<HTMLInputElement | null>(null);

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
          title: "تم الجلب",
          description: `${data?.count ?? 0} شحنة، مرتبطة: ${data?.linked ?? 0}`,
        });
      }
      await load();
    } catch (e: any) {
      if (!silent) toast({ title: "تعذر الجلب", description: e?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleScan = async (raw: string) => {
    if (!id || !ret) return;
    const code = raw.trim();
    if (!code) return;
    setScanning(true);
    try {
      const sb = supabase as any;
      // 1) منع التكرار
      const dup = rows.find(
        (r) =>
          r.shipment_code?.toLowerCase() === code.toLowerCase() ||
          r.ref_number?.toLowerCase() === code.toLowerCase() ||
          (r.order_id && r.order_id.toLowerCase().startsWith(code.toLowerCase())),
      );
      if (dup) {
        toast({ title: "موجود مسبقاً", description: `الكود ${code} مضاف مسبقاً للمرتجع`, variant: "destructive" });
        return;
      }
      // 2) ابحث عن الطلب: shipping_id / shipping_reference / id (UUID أو أول 12 خانة)
      const codeUpper = code.toUpperCase();
      const filters = [
        `shipping_id.eq.${code}`,
        `shipping_reference.eq.${code}`,
      ];
      const { data: ordersByCode } = await sb
        .from("orders")
        .select("id, customer_name, phone, city, price, product_name, shipping_id, shipping_reference")
        .or(filters.join(","))
        .eq("shipped_to_company", true)
        .limit(5);
      let order = (ordersByCode || [])[0] as any;
      if (!order) {
        // ابحث بمعرف النظام (UUID كامل أو أول 12 خانة)
        const isUuid = /^[0-9a-f-]{30,}$/i.test(code);
        if (isUuid) {
          const { data: byId } = await sb.from("orders").select("*").eq("id", code).eq("shipped_to_company", true).maybeSingle();
          order = byId;
        } else {
          const { data: all } = await sb.from("orders").select("id, customer_name, phone, city, price, product_name, shipping_id, shipping_reference").eq("shipped_to_company", true);
          order = (all || []).find((o: any) => o.id.slice(0, 12).toUpperCase() === codeUpper);
        }
      }
      if (!order) {
        toast({ title: "غير موجود", description: `لم يتم العثور على طلب مُرسَل لشركة الشحن بالكود ${code}`, variant: "destructive" });
        return;
      }
      // 3) أضف صف return_shipments
      const { error: insErr } = await sb.from("return_shipments").insert({
        return_id: id,
        shipment_code: order.shipping_id || code,
        ref_number: order.shipping_reference || order.id.slice(0, 12).toUpperCase(),
        recipient_name: order.customer_name,
        recipient_phone: order.phone,
        zone_name: order.city,
        area_name: null,
        status_name: "مرتجع (يدوي)",
        status_code: "RTRN_MANUAL",
        delivered_amount: 0,
        paid_amount: 0,
        collected_fees: 0,
        pieces_count: 1,
        weight: 0,
        order_id: order.id,
      });
      if (insErr) throw insErr;
      toast({ title: "تمت الإضافة", description: `${order.customer_name || code}` });
      setScanValue("");
      // أعد التحميل
      const { data: sh } = await sb
        .from("return_shipments").select("*")
        .eq("return_id", id).order("shipment_code");
      setRows((sh as ShipmentRow[]) || []);
      setTimeout(() => scanRef.current?.focus(), 50);
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const removeRow = async (rowId: string) => {
    const sb = supabase as any;
    const { error } = await sb.from("return_shipments").delete().eq("id", rowId);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== rowId));
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

  // أول ما تفتح القائمة وما فيهاش شحنات بعد، اجلبها تلقائياً
  useEffect(() => {
    if (ret && !ret.shipments_synced_at && rows.length === 0 && !syncing) {
      syncShipments(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ret?.id]);

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
            جلب الشحنات
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="w-4 h-4" />
            مسح / إدخال كود الشحنة أو رقم الطلب المحلي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScan(scanValue);
            }}
            className="flex items-center gap-2"
          >
            <Input
              ref={scanRef}
              autoFocus
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder="امسح الباركود أو اكتب الكود ثم اضغط Enter"
              disabled={scanning || ret.received}
              className="text-right"
            />
            <Button type="submit" disabled={scanning || !scanValue.trim() || ret.received}>
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : "إضافة"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            يقبل: كود شركة الشحن، المرجع، أو معرّف الطلب في النظام (الكامل أو أول 12 خانة).
          </p>
        </CardContent>
      </Card>

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
              لا توجد شحنات. امسح كود شحنة أو اكتب رقم الطلب لإضافته.
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
                    <TableHead className="text-right"></TableHead>
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
                      <TableCell>
                        {!ret.received && (
                          <Button variant="ghost" size="icon" onClick={() => removeRow(r.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
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