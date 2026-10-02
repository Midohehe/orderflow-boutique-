import { courierSubStatuses, batchLabel, type CourierSubStatus } from "@/lib/courierStatus";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useCouriers } from "@/hooks/useCouriers";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const states: Record<string, string> = { assigned: "مع المندوب", delivered: "تم التسليم — بانتظار التسوية", settled: "تم استلام التسوية", returned: "تم استلام المرتجع" };
const money = (n: number) => n.toLocaleString("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function CourierSettlements() {
  const { activeStoreId } = useStoreContext();
  return <SettlementStore key={activeStoreId} storeId={activeStoreId} />;
}
function SettlementStore({ storeId }: { storeId: string | null }) {
  const [params, setParams] = useSearchParams();
  const couriers = useCouriers(storeId);
  const courierId = params.get("courier") || "";
  return <div dir="rtl" className="space-y-6">
    <PageHeader icon={Wallet} title="تسوية المناديب" description="تسجيل التسليم واستلام التحصيل في الخزينة أو استلام المرتجعات." />
    <select aria-label="المندوب" className="border rounded-md bg-background p-2 w-full max-w-md" value={courierId} disabled={couriers.isLoading} onChange={e => setParams({ courier: e.target.value })}>
      <option value="">اختر المندوب</option>{couriers.data?.map(row => <option key={row.id} value={row.id}>{row.name}{row.active ? "" : " (غير نشط)"}</option>)}
    </select>
    {couriers.isError && <Button onClick={() => void couriers.refetch()}>تعذّر تحميل المناديب — أعد المحاولة</Button>}
    {storeId && couriers.data?.some(row => row.id === courierId) && <CourierLedger key={courierId} storeId={storeId} courierId={courierId} />}
  </div>;
}
function CourierLedger({ storeId, courierId }: { storeId: string; courierId: string }) {
  const cache = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [safeId, setSafeId] = useState("");
  const [action, setAction] = useState<"deliver" | "settle" | "return" | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const [page, setPage] = useState(0);
  const [receiptPage, setReceiptPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [subFilter, setSubFilter] = useState("");
  const [newSub, setNewSub] = useState<CourierSubStatus>("follow_up");
  const orders = useQuery({ queryKey: ["courier-orders", storeId, courierId, history, subFilter, page, pageSize], queryFn: async () => {
    let query = supabase.from("courier_orders").select("*, courier_batches(code), orders(id, order_code, customer_name, phone, city, product_name, status)", { count: "exact" })
      .eq("store_id", storeId).eq("courier_id", courierId);
    if (!history) query = query.in("state", ["assigned", "delivered"]);
    if (subFilter) query = query.eq("sub_status", subFilter);
    const { data, error, count } = await query.order("assigned_at", { ascending: false }).order("order_id").range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return { rows: data, total: count ?? 0 };
  } });
  const openCount = useQuery({ queryKey: ["courier-orders", storeId, courierId, "open-count"], queryFn: async () => {
    const { count, error } = await supabase.from("courier_orders").select("order_id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("courier_id", courierId).in("state", ["assigned", "delivered"]);
    if (error) throw error;
    return count ?? 0;
  } });
  const safes = useQuery({ queryKey: ["courier-safes", storeId], queryFn: async () => {
    const { data, error } = await supabase.from("safes").select("id,name").eq("store_id", storeId).order("name");
    if (error) throw error;
    return data;
  } });
  const receipts = useQuery({ queryKey: ["courier-receipts", storeId, courierId, receiptPage, pageSize], queryFn: async () => {
    const { data, error, count } = await supabase.from("courier_receipts").select("*", { count: "exact" }).eq("store_id", storeId).eq("courier_id", courierId)
      .order("created_at", { ascending: false }).order("id").range(receiptPage * pageSize, (receiptPage + 1) * pageSize - 1);
    if (error) throw error;
    return { rows: data, total: count ?? 0 };
  } });
  const rows = orders.data?.rows || [];
  const open = rows.filter(row => ["assigned", "delivered"].includes(row.state));
  const visible = (history ? rows : open).filter(row => !subFilter || row.sub_status === subFilter);
  const visibleOpen = visible.filter(row => ["assigned", "delivered"].includes(row.state));
  const picked = visibleOpen.filter(row => selected.includes(row.order_id));
  const gross = picked.reduce((sum, row) => sum + Number(row.cod_amount), 0);
  const fees = picked.reduce((sum, row) => sum + Number(row.delivery_fee), 0);
  const net = gross - fees;
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 500 ? [...current, id] : current);
  async function updateSub() {
    if (!picked.length || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("update_courier_sub_status", { _order_ids: picked.map(row => row.order_id), _sub_status: newSub });
      if (error) throw error;
      setSelected([]);
      await cache.invalidateQueries({ queryKey: ["courier-orders", storeId, courierId] });
      await cache.invalidateQueries({ queryKey: ["orders-page", storeId] });
      toast({ title: "تم تحديث الحالة الفرعية" });
    } catch (error) { toast({ title: "تعذّر تغيير الحالة", description: (error as { message?: string }).message, variant: "destructive" }); }
    finally { setBusy(false); }
  }
  async function process() {
    if (!action || busy || !picked.length || (action === "settle" && !safeId)) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("process_courier_orders", { _courier_id: courierId, _order_ids: picked.map(row => row.order_id), _action: action, ...action === "settle" ? { _safe_id: safeId } : {} });
      if (error) throw error;
      toast({ title: action === "settle" ? "تم استلام التسوية في الخزينة" : action === "return" ? "تم استلام المرتجع" : "تم تسجيل التسليم" });
      setAction(null); setSelected([]);
      await Promise.all(["courier-orders", "courier-receipts", "orders-page", "orders-page-meta", "orders-delivery-stats", "courier-safes"].map(key => cache.invalidateQueries({ queryKey: [key, storeId] })));
    } catch (error) { toast({ title: "لم تتم العملية", description: (error as { message?: string }).message || "أعد تحميل الطلبات وحاول مرة أخرى", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    {orders.isLoading && <p>جاري تحميل الطلبات...</p>}
    {orders.isError && <Button onClick={() => void orders.refetch()}>تعذّر تحميل الطلبات — أعد المحاولة</Button>}
    <Card><CardContent className="p-5 space-y-4">
      <p>طلبات مفتوحة: <strong>{openCount.data ?? "…"}</strong> | المحدد في الصفحة: <strong>{picked.length}</strong></p>
      <div className="grid sm:grid-cols-3 gap-3"><p>التحصيل: <strong>{money(gross)}</strong></p><p>أجرة المندوب: <strong>{money(fees)}</strong></p><p>الصافي للخزينة: <strong>{money(net)}</strong></p></div>
      <p className="text-sm text-muted-foreground">المبالغ بعملة المتجر. التحصيل يشمل قيمة المنتجات وتوصيل العميل. الأجرة هي السعر المثبت عند إسناد الطلب. المرتجع بدون رسوم.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!picked.length || busy || picked.some(row => row.state === "delivered" || row.sub_status !== "delivered_by_courier")} onClick={() => setAction("deliver")}>تحويل إلى تم التسليم</Button>
        <Button disabled={!picked.length || busy || picked.some(row => row.sub_status !== "delivered_by_courier")} onClick={() => setAction("settle")}>تسليم واستلام تسوية</Button>
        <Button variant="outline" disabled={!picked.length || busy || picked.some(row => row.sub_status !== "returned_by_courier")} onClick={() => setAction("return")}>استلام مرتجع</Button>
      </div>
    </CardContent></Card>
    <p className="text-sm text-muted-foreground">التسليم والتسوية متاحان فقط لحالة «تم التسليم لدى المندوب»، واستلام المرتجع فقط لحالة «راجع لدى المندوب».</p>
    <div className="flex flex-wrap gap-2">
      <select aria-label="فلتر الحالة الفرعية" className="border rounded-md bg-background p-2" value={subFilter} onChange={e => { setSubFilter(e.target.value); setPage(0); setSelected([]); }}><option value="">كل الحالات الفرعية</option>{Object.entries(courierSubStatuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
      <select aria-label="الحالة الفرعية الجديدة" className="border rounded-md bg-background p-2" value={newSub} disabled={busy} onChange={e => setNewSub(e.target.value as CourierSubStatus)}>{Object.entries(courierSubStatuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
      <Button variant="outline" disabled={busy || !picked.length} onClick={() => void updateSub()}>تغيير الحالة الفرعية للمحدد</Button>
      <Button variant="outline" disabled={orders.isFetching} onClick={() => void orders.refetch()}>تحديث الطلبات</Button>
    </div>
    <label className="flex gap-2"><input type="checkbox" checked={history} onChange={e => { setHistory(e.target.checked); setPage(0); setSelected([]); }} />عرض كل الطلبات بما فيها المسددة والمرتجعات</label>
    <div className="flex items-center gap-3">
      <select aria-label="عدد الطلبات في الصفحة" className="border rounded-md bg-background p-2" disabled={busy} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0); setReceiptPage(0); setSelected([]); }}>
        {[50, 100, 500].map(size => <option key={size} value={size}>{size} لكل صفحة</option>)}
      </select>
      <Button variant="outline" disabled={busy || page === 0} onClick={() => { setPage(page - 1); setSelected([]); }}>السابق</Button>
      <span>صفحة {page + 1} — {orders.data?.total ?? 0} طلب مطابق</span>
      <Button variant="outline" disabled={busy || orders.isFetching || (page + 1) * pageSize >= (orders.data?.total ?? 0)} onClick={() => { setPage(page + 1); setSelected([]); }}>التالي</Button>
    </div>
    <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm text-right"><thead className="bg-muted"><tr>
      <th className="p-3"><input aria-label="تحديد الطلبات المفتوحة في هذه الصفحة" type="checkbox" disabled={busy || !visibleOpen.length} checked={visibleOpen.length > 0 && visibleOpen.slice(0, 500).every(row => selected.includes(row.order_id))} onChange={e => setSelected(e.target.checked ? visibleOpen.slice(0, 500).map(row => row.order_id) : [])} /></th>
      {["الطلب", "العميل", "المنطقة", "المنتج", "التحصيل", "أجرة التوصيل", "الحالة", "الحالة الفرعية", "تاريخ الإسناد", "كود الباتش"].map(label => <th className="p-3 whitespace-nowrap" key={label}>{label}</th>)}</tr></thead>
      <tbody>{visible.map(row => <tr key={row.order_id} className="border-t">
        <td className="p-3"><input aria-label={`تحديد الطلب ${row.orders?.order_code || row.order_id}`} type="checkbox" disabled={busy || !["assigned", "delivered"].includes(row.state)} checked={selected.includes(row.order_id)} onChange={() => toggle(row.order_id)} /></td>
        <td className="p-3">{row.orders?.order_code || row.order_id.slice(0, 8)}</td><td className="p-3">{row.orders?.customer_name}<div dir="ltr">{row.orders?.phone}</div></td><td className="p-3">{row.orders?.city}</td><td className="p-3">{row.orders?.product_name}</td>
        <td className="p-3">{money(Number(row.cod_amount))}</td><td className="p-3">{money(Number(row.delivery_fee))}</td><td className="p-3 whitespace-nowrap">{states[row.state]}</td><td className="p-3 whitespace-nowrap">{courierSubStatuses[row.sub_status as CourierSubStatus]}</td><td className="p-3 whitespace-nowrap">{new Date(row.assigned_at).toLocaleString("ar-LY")}</td><td className="p-3" dir="ltr">{batchLabel(row.courier_batches?.code)}</td>
      </tr>)}</tbody></table></div>
    {!orders.isLoading && !orders.isError && !visible.length && <p>لا توجد طلبات في هذه القائمة.</p>}
    <h2 className="font-bold text-lg">سجل التسويات والمرتجعات</h2>
    {receipts.isError && <Button onClick={() => void receipts.refetch()}>إعادة تحميل السجل</Button>}
    {receipts.data?.rows.map(row => <Card key={row.id}><CardContent className="p-4 flex flex-wrap gap-4 text-sm"><span>{row.action === "settle" ? "تسوية مالية" : "استلام مرتجع"}</span><span>{new Date(row.created_at).toLocaleString("ar-LY")}</span><span>{row.order_count} طلب</span><span>تحصيل: {money(Number(row.gross))}</span><span>أجرة: {money(Number(row.fees))}</span><strong>صافي: {money(Number(row.net))}</strong><span>{safes.data?.find(safe => safe.id === row.safe_id)?.name || "—"}</span></CardContent></Card>)}
    <div className="flex items-center gap-3">
      <Button variant="outline" disabled={receiptPage === 0} onClick={() => setReceiptPage(receiptPage - 1)}>السجل السابق</Button>
      <span>صفحة {receiptPage + 1} — {receipts.data?.total ?? 0} عملية</span>
      <Button variant="outline" disabled={receipts.isFetching || (receiptPage + 1) * pageSize >= (receipts.data?.total ?? 0)} onClick={() => setReceiptPage(receiptPage + 1)}>السجل التالي</Button>
    </div>
    <Dialog open={!!action} onOpenChange={value => { if (!value && !busy) setAction(null); }}><DialogContent dir="rtl"><DialogTitle>تأكيد {action === "settle" ? "استلام التسوية" : action === "return" ? "استلام المرتجع" : "التسليم"}</DialogTitle>
      <DialogDescription>عدد الطلبات: {picked.length}. {action === "return" ? "سيتم تسجيل استلام المرتجع وإعادة الكميات المخصومة للمخزون، بدون حركة مالية." : action === "deliver" ? "سيتم تسجيل التسليم فقط، ويبقى التحصيل لدى المندوب حتى استلام التسوية." : "سيتم تسجيل تسليم الطلبات وإيداع الصافي في الخزينة في عملية واحدة."}</DialogDescription>
      {action === "settle" && <><p>التحصيل {money(gross)} − أجرة المندوب {money(fees)} = <strong>{money(net)}</strong></p>{net < 0 && <p className="text-destructive">الأجرة أكبر من التحصيل؛ ستُخصم قيمة الفرق من الخزينة.</p>}
        <select aria-label="خزينة استلام التسوية" className="border rounded-md p-2 bg-background" disabled={busy || safes.isLoading} value={safeId} onChange={e => setSafeId(e.target.value)}><option value="">اختر الخزينة</option>{safes.data?.map(safe => <option value={safe.id} key={safe.id}>{safe.name}</option>)}</select>
        {safes.isError && <Button onClick={() => void safes.refetch()}>إعادة تحميل الخزائن</Button>}
        {!safes.isLoading && !safes.isError && !safes.data?.length && <p>أضف خزينة لهذا المتجر من تبويب المالية أولًا.</p>}
      </>}
      <Button disabled={busy || !picked.length || (action === "settle" && !safes.data?.some(safe => safe.id === safeId))} onClick={() => void process()}>{busy ? "جاري التنفيذ..." : "تأكيد"}</Button>
    </DialogContent></Dialog>
  </div>;
}
