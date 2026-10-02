import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useCouriers } from "@/hooks/useCouriers";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Truck } from "lucide-react";

export function AssignCourierButton({ storeId, orderIds, onDone }: { storeId: string | null; orderIds: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [courierId, setCourierId] = useState("");
  const [busy, setBusy] = useState(false);
  const [shippingMode, setShippingMode] = useState<"included" | "excluded" | "">("");
  const totals = useQuery({
    queryKey: ["courier-assignment-preview", storeId, orderIds],
    enabled: open && !!storeId && orderIds.length > 0 && orderIds.length <= 500,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id,price").eq("store_id", storeId!).in("id", orderIds);
      if (error) throw error;
      if (data.length !== new Set(orderIds).size) throw new Error("بعض الطلبات غير متاحة");
      return { count: data.length, price: data.reduce((sum, row) => sum + Number(row.price || 0), 0) };
    },
  });
  const { data = [], isLoading, isError, refetch } = useCouriers(storeId);
  useEffect(() => { setOpen(false); setCourierId(""); }, [storeId]);
  const courier = data.find(row => row.id === courierId && row.active);
  async function assign() {
    if (!courier || busy || !shippingMode || !totals.data || totals.isError) return;
    setBusy(true);
    try {
      const { data: count, error } = await supabase.rpc("assign_courier_orders_with_shipping", { _courier_id: courier.id, _order_ids: orderIds, _shipping_mode: shippingMode });
      if (error) throw error;
      toast({ title: `تم ربط ${count} طلب بالمندوب ${courier.name}` });
      setOpen(false); onDone();
    } catch (error) { toast({ title: "تعذّر ربط الطلبات", description: error instanceof Error ? error.message : (error as { message?: string }).message, variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <>
    <Button disabled={!storeId || !orderIds.length} onClick={() => { setShippingMode(""); setOpen(true); }}><Truck className="w-4 h-4 ml-2" />إضافة لمندوب ({orderIds.length})</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto">
      <DialogTitle>إضافة الطلبات لمندوب</DialogTitle>
      <DialogDescription>سيتم ربط {orderIds.length} طلب بالمندوب وتثبيت سعر التوصيل الحالي. الطلبات ستنتقل إلى لدى مندوب، وسيُنشأ كود باتش موحّد لهذه المجموعة.</DialogDescription>
      {isLoading ? <p>جاري تحميل المناديب...</p> : isError ? <Button onClick={() => void refetch()}>إعادة تحميل المناديب</Button> : <>
        <select aria-label="اختيار المندوب" className="w-full border rounded-md p-2 bg-background" value={courierId} disabled={busy} onChange={e => setCourierId(e.target.value)}>
          <option value="">اختر المندوب</option>{data.filter(row => row.active).map(row => <option key={row.id} value={row.id}>{row.name} — توصيل {row.delivery_fee}</option>)}
        </select>
        {!data.some(row => row.active) && <Link className="underline" to="/dashboard/couriers">إضافة مندوب أولًا</Link>}
        <fieldset disabled={busy} className="space-y-3 rounded-md border p-3">
          <legend className="px-1 font-semibold">مصاريف الشحن</legend>
          <label className="flex gap-2 items-start"><input type="radio" name="courier-shipping" checked={shippingMode === "included"} onChange={() => setShippingMode("included")} /><span>شامل مصاريف الشحن <small className="block text-muted-foreground">العميل يدفع قيمة الطلب، وتُخصم أجرة المندوب منها.</small></span></label>
          <label className="flex gap-2 items-start"><input type="radio" name="courier-shipping" checked={shippingMode === "excluded"} onChange={() => setShippingMode("excluded")} /><span>غير شامل مصاريف الشحن <small className="block text-muted-foreground">تُضاف أجرة المندوب إلى قيمة الطلب ويدفعها العميل.</small></span></label>
        </fieldset>
        <p className="text-xs text-muted-foreground">يُطبّق الاختيار على كل الطلبات المحددة ويستبدل رسوم الشحن السابقة، حتى لا تُحسب مرتين.</p>
        {totals.isFetching && <p className="text-sm">جاري حساب المبالغ...</p>}
        {totals.isError && <Button variant="outline" onClick={() => void totals.refetch()}>تعذّر تحميل قيم الطلبات — إعادة المحاولة</Button>}
        {courier && shippingMode && totals.data && !totals.isError && (() => {
          const fees = Number(courier.delivery_fee) * totals.data.count;
          const collected = totals.data.price + (shippingMode === "excluded" ? fees : 0);
          return <div className="rounded-md bg-muted p-3 text-sm space-y-1"><p>التحصيل من العملاء: <strong>{collected.toFixed(2)}</strong></p><p>أجرة المندوب: <strong>{fees.toFixed(2)}</strong></p><p>الصافي عند التسوية: <strong>{(collected - fees).toFixed(2)}</strong></p></div>;
        })()}
        <p className="text-sm text-muted-foreground">الطلبات المرتبطة بمندوب أو شركة شحن، المقفلة أو المسددة لا يمكن إسنادها. الحد الأقصى 500 طلب في العملية.</p>
        <Button disabled={busy || !courier || !shippingMode || !totals.data || totals.isFetching || totals.isError || !orderIds.length || orderIds.length > 500} onClick={() => void assign()}>{busy ? "جاري الإضافة..." : "تأكيد الإضافة"}</Button>
      </>}
    </DialogContent></Dialog>
  </>;
}
