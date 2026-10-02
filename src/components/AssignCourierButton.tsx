import { useEffect, useState } from "react";
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
  const { data = [], isLoading, isError, refetch } = useCouriers(storeId);
  useEffect(() => { setOpen(false); setCourierId(""); }, [storeId]);
  const courier = data.find(row => row.id === courierId && row.active);
  async function assign() {
    if (!courier || busy) return;
    setBusy(true);
    try {
      const { data: count, error } = await supabase.rpc("assign_courier_orders", { _courier_id: courier.id, _order_ids: orderIds });
      if (error) throw error;
      toast({ title: `تم ربط ${count} طلب بالمندوب ${courier.name}` });
      setOpen(false); onDone();
    } catch (error) { toast({ title: "تعذّر ربط الطلبات", description: error instanceof Error ? error.message : (error as { message?: string }).message, variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <>
    <Button disabled={!storeId || !orderIds.length} onClick={() => setOpen(true)}><Truck className="w-4 h-4 ml-2" />إضافة لمندوب ({orderIds.length})</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent dir="rtl">
      <DialogTitle>إضافة الطلبات لمندوب</DialogTitle>
      <DialogDescription>سيتم ربط {orderIds.length} طلب بالمندوب وتثبيت سعر التوصيل الحالي. الطلبات قيد الانتظار ستنتقل إلى تم الشحن.</DialogDescription>
      {isLoading ? <p>جاري تحميل المناديب...</p> : isError ? <Button onClick={() => void refetch()}>إعادة تحميل المناديب</Button> : <>
        <select aria-label="اختيار المندوب" className="w-full border rounded-md p-2 bg-background" value={courierId} disabled={busy} onChange={e => setCourierId(e.target.value)}>
          <option value="">اختر المندوب</option>{data.filter(row => row.active).map(row => <option key={row.id} value={row.id}>{row.name} — توصيل {row.delivery_fee}</option>)}
        </select>
        {!data.some(row => row.active) && <Link className="underline" to="/dashboard/couriers">إضافة مندوب أولًا</Link>}
        <p className="text-sm text-muted-foreground">الطلبات المرتبطة بمندوب أو شركة شحن، المقفلة أو المسددة لا يمكن إسنادها. الحد الأقصى 500 طلب في العملية.</p>
        <Button disabled={busy || !courier || !orderIds.length || orderIds.length > 500} onClick={() => void assign()}>{busy ? "جاري الإضافة..." : "تأكيد الإضافة"}</Button>
      </>}
    </DialogContent></Dialog>
  </>;
}
