import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Truck, Plus } from "lucide-react";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useCouriers } from "@/hooks/useCouriers";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

export default function Couriers() {
  const { activeStoreId } = useStoreContext();
  return <CourierList key={activeStoreId} storeId={activeStoreId} />;
}
function CourierList({ storeId }: { storeId: string | null }) {
  const { data: rows = [], isLoading, isError, refetch } = useCouriers(storeId);
  const cache = useQueryClient();
  const [form, setForm] = useState<{ id?: string; name: string; phone: string; fee: string; active: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!storeId || !form || busy) return;
    const fee = Number(form.fee);
    if (!form.name.trim() || !form.fee.trim() || !Number.isFinite(fee) || fee < 0 || fee > 9999999999.99 || Math.abs(fee * 100 - Math.round(fee * 100)) > 0.001) return;
    setBusy(true);
    try {
      const values = { name: form.name.trim(), phone: form.phone.trim(), delivery_fee: fee, active: form.active };
      const request = form.id ? supabase.from("couriers").update(values).eq("id", form.id).eq("store_id", storeId) : supabase.from("couriers").insert({ ...values, store_id: storeId });
      const { error } = await request.select("id").single();
      if (error) throw error;
      await cache.invalidateQueries({ queryKey: ["couriers", storeId] });
      setForm(null); toast({ title: "تم حفظ المندوب" });
    } catch { toast({ title: "تعذّر حفظ المندوب", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6" dir="rtl">
    <PageHeader icon={Truck} title="المناديب" description="إدارة مناديب المتجر وسعر توصيل ثابت لكل المناطق." />
    <Button disabled={!storeId} onClick={() => setForm({ name: "", phone: "", fee: "0", active: true })}><Plus className="w-4 h-4 ml-2" />إضافة مندوب</Button>
    <p className="text-sm text-muted-foreground">السعر ثابت لكل طلب مسلّم، ويُخصم من التحصيل عند التسوية. تعديل السعر يطبق على الطلبات التي تُسند لاحقًا فقط. استلام المرتجع بدون رسوم.</p>
    {isLoading && <p>جاري التحميل...</p>}
    {isError && <Button variant="outline" onClick={() => void refetch()}>تعذّر التحميل — إعادة المحاولة</Button>}
    {!isLoading && !isError && !rows.length && <p>لم تتم إضافة مناديب لهذا المتجر بعد.</p>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{rows.map(row => <Card key={row.id}><CardContent className="p-5 space-y-3">
      <h2 className="font-bold text-lg">{row.name} {!row.active && <span className="text-muted-foreground text-sm">(غير نشط)</span>}</h2>
      <p dir="ltr" className="text-right">{row.phone || "—"}</p><p>سعر التوصيل: <strong>{row.delivery_fee}</strong></p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setForm({ id: row.id, name: row.name, phone: row.phone, fee: String(row.delivery_fee), active: row.active })}>تعديل / إعدادات الأسعار</Button>
        <Button asChild><Link to={`/dashboard/courier-settlements?courier=${row.id}`}>طلبات وتسوية المندوب</Link></Button></div>
    </CardContent></Card>)}</div>
    <Dialog open={!!form} onOpenChange={open => { if (!open && !busy) setForm(null); }}><DialogContent dir="rtl"><DialogTitle>{form?.id ? "إعدادات المندوب" : "إضافة مندوب"}</DialogTitle><DialogDescription>السعر بعملة المتجر وينطبق على جميع المناطق.</DialogDescription>
      {form && <form onSubmit={save} className="space-y-4">
        <div><Label htmlFor="courier-name">اسم المندوب</Label><Input id="courier-name" required maxLength={120} value={form.name} disabled={busy} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label htmlFor="courier-phone">رقم الهاتف</Label><Input id="courier-phone" type="tel" maxLength={50} value={form.phone} disabled={busy} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label htmlFor="courier-fee">سعر التوصيل الثابت لكل طلب</Label><Input id="courier-fee" type="number" required min="0" max="9999999999.99" step="0.01" value={form.fee} disabled={busy} onChange={e => setForm({ ...form, fee: e.target.value })} /></div>
        <label className="flex gap-2"><input type="checkbox" checked={form.active} disabled={busy} onChange={e => setForm({ ...form, active: e.target.checked })} />نشط لاستلام طلبات جديدة</label>
        <Button disabled={busy} type="submit">{busy ? "جاري الحفظ..." : "حفظ"}</Button>
      </form>}
    </DialogContent></Dialog>
  </div>;
}
