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
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Link2, Link2Off, Undo2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useStoreContext } from "@/hooks/useStoreContext";

interface Settlement {
  id: string;
  code: string;
  settlement_date: string | null;
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

const SettlementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeStoreId } = useStoreContext();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [safes, setSafes] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [selectedSafeId, setSelectedSafeId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const syncShipments = async (silent = false) => {
    if (!id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-settlement-shipments", {
        body: { settlement_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      if (data?.ok === false && data?.error) throw new Error(String(data.error));
      if (!silent) {
        toast({
          title: "تم تحديث الشحنات",
          description: `${data?.count ?? 0} شحنة، مرتبط منها ${data?.linked ?? 0} بطلبات في النظام`,
        });
      }
      const { data: sh, error: shErr } = await supabase
        .from("settlement_shipments").select("*")
        .eq("settlement_id", id).order("shipment_code");
      if (shErr) throw shErr;
      setRows((sh as ShipmentRow[]) || []);
      const { data: s } = await supabase.from("settlements").select("*").eq("id", id).maybeSingle();
      setSettlement(s as Settlement | null);
      const carrierCount = Number(s?.shipment_count ?? settlement?.shipment_count ?? 0);
      if ((data?.count ?? 0) === 0 && carrierCount > 0) {
        const detail = data?.error
          ? String(data.error)
          : data?.debug?.[0]?.message
            ? String(data.debug[0].message)
            : "تأكد من إعدادات شركة الشحن أو اضغط تحديث الشحنات مرة أخرى";
        toast({
          title: "لم تُجلب شحنات",
          description: detail,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "تعذر التحديث", description: e?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    let safesQuery = supabase.from("safes").select("id, name, balance").order("created_at");
    if (activeStoreId) safesQuery = safesQuery.eq("store_id", activeStoreId);
    const [sRes, shRes, safesRes] = await Promise.all([
      supabase.from("settlements").select("*").eq("id", id).maybeSingle(),
      supabase.from("settlement_shipments").select("*").eq("settlement_id", id)
        .order("shipment_code"),
      safesQuery,
    ]);
    if (sRes.error) toast({ title: "خطأ", description: sRes.error.message, variant: "destructive" });
    if (shRes.error) toast({ title: "خطأ", description: shRes.error.message, variant: "destructive" });
    const settlementRow = sRes.data as Settlement | null;
    const shipmentRows = (shRes.data as ShipmentRow[]) || [];
    setSettlement(settlementRow);
    setRows(shipmentRows);
    setSafes((safesRes.data as any[]) || []);
    setLoading(false);

    const needsSync =
      settlementRow &&
      shipmentRows.length === 0 &&
      Number(settlementRow.shipment_count) > 0;
    if (needsSync) {
      await syncShipments(true);
    }
  };

  const setReceived = async (received: boolean, safeId?: string) => {
    if (!id) return;
    setMarking(true);
    try {
      const { data, error } = await supabase.functions.invoke("receive-settlement", {
        body: { settlement_id: id, received, safe_id: safeId || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      const recon = (data as any)?.reconciliation;
      let description = `تم تحديث ${data?.updated_orders ?? 0} طلب`;
      if (received && recon && !recon.ok) {
        description = `تم التحديث مع تنبيه: فرق ${Number(recon.delta).toFixed(2)} بين مبلغ التسوية (${Number(recon.payment_amount).toFixed(2)}) ومجموع الشحنات المرتبطة (${Number(recon.linked_shipments_sum).toFixed(2)})`;
      }
      toast({
        title: received ? "تم تأكيد الاستلام" : "تم التراجع",
        description,
        variant: received && recon && !recon.ok ? "destructive" : undefined,
      });
      setConfirmOpen(false);
      setSelectedSafeId("");
      await load();
    } catch (e: any) {
      let message = e?.message || "حدث خطأ غير متوقع";
      if (e?.context && typeof e.context.json === "function") {
        try {
          const body = await e.context.json();
          if (body?.error) message = String(body.error);
        } catch { /* ignore parse errors */ }
      }
      toast({ title: "خطأ", description: message, variant: "destructive" });
    } finally {
      setMarking(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeStoreId]);

  const linkedCount = rows.filter((r) => r.order_id).length;
  const linkedPaidSum = rows
    .filter((r) => r.order_id)
    .reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const paymentAmount = Number(settlement?.payment_amount || 0);
  const reconDelta = paymentAmount - linkedPaidSum;
  const reconOk = paymentAmount === 0 || linkedPaidSum === 0
    || Math.abs(reconDelta) <= Math.max(1, paymentAmount * 0.02);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        التسوية غير موجودة.
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/settlements")}>عودة</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/settlements")}>
            <ArrowRight className="w-4 h-4 ml-1" />
            عودة
          </Button>
          <h1 className="text-2xl font-bold">تسوية {settlement.code}</h1>
          {settlement.received ? (
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
          {settlement.received ? (
            <Button variant="outline" onClick={() => setReceived(false)} disabled={marking}>
              <Undo2 className="w-4 h-4 ml-2" />
              تراجع عن الاستلام
            </Button>
          ) : (
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <Button disabled={marking || rows.length === 0} onClick={() => setConfirmOpen(true)}>
                <CheckCircle2 className="w-4 h-4 ml-2" />
                تأكيد استلام التسوية
              </Button>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد استلام التسوية المالية</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم تأشير {linkedCount} طلب من أصل {rows.length} شحنة كمستلم مالياً،
                    وستظهر مبالغها في الخزنة. هل تريد المتابعة؟
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <Label>الخزينة المستلمة فيها المبلغ</Label>
                  {safes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد خزائن. أضف خزينة من تبويب الخزائن أولاً.</p>
                  ) : (
                    <Select value={selectedSafeId} onValueChange={setSelectedSafeId}>
                      <SelectTrigger><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
                      <SelectContent>
                        {safes.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({Number(s.balance).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    سيتم إيداع {paymentAmount.toFixed(2)} في الخزينة المختارة.
                    {linkedPaidSum > 0 && (
                      <> مجموع الشحنات المرتبطة: {linkedPaidSum.toFixed(2)}
                        {!reconOk && ` (فرق ${reconDelta.toFixed(2)})`}
                      </>
                    )}
                  </p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!selectedSafeId || marking}
                    onClick={(e) => { e.preventDefault(); setReceived(true, selectedSafeId); }}
                  >
                    نعم، تم الاستلام
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">المبلغ المستحق</p>
          <p className="text-lg font-bold">{paymentAmount.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">مجموع الشحنات المرتبطة</p>
          <p className={`text-lg font-bold ${reconOk ? "" : "text-amber-600"}`}>{linkedPaidSum.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">رسوم الشحن</p>
          <p className="text-lg font-bold">{Number(settlement.due_fees).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">عدد الشحنات (شركة الشحن)</p>
          <p className="text-lg font-bold">{settlement.shipment_count}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">مرتبط بالنظام</p>
          <p className="text-lg font-bold">{linkedCount} / {rows.length}</p>
        </CardContent></Card>
      </div>

      {!reconOk && !settlement.received && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            تنبيه مطابقة: فرق {reconDelta.toFixed(2)} بين مبلغ التسوية ومجموع المدفوع في الشحنات المرتبطة.
            راجع الشحنات قبل التأكيد.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>الشحنات</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground space-y-3">
              <p>
                لا توجد شحنات محفوظة
                {settlement.shipment_count > 0
                  ? ` (شركة الشحن تُظهر ${settlement.shipment_count} شحنة في هذه التسوية).`
                  : "."}
              </p>
              <Button variant="outline" onClick={() => syncShipments(false)} disabled={syncing}>
                {syncing ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
                جلب الشحنات من شركة الشحن
              </Button>
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
                    <TableHead className="text-right">المدفوع</TableHead>
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
                      <TableCell className="font-semibold">{Number(r.paid_amount).toFixed(2)}</TableCell>
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

export default SettlementDetail;
