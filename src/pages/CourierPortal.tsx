import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { courierLoginEmail, courierSubStatuses, batchLabel } from "@/lib/courierStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function CourierPortal() {
  const { user, loading, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setErrorText("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: courierLoginEmail(username), password });
      if (error) throw error;
      setPassword("");
    } catch { setErrorText("تعذّر الدخول. تحقق من اسم المستخدم وكلمة المرور وحاول مرة أخرى."); }
    finally { setBusy(false); }
  }
  return <main dir="rtl" className="min-h-screen bg-background p-4 sm:p-8"><div className="max-w-6xl mx-auto space-y-6">
    <div className="flex justify-between gap-4 items-center"><h1 className="text-2xl font-bold">وصلة — بوابة المندوب</h1>{user && <Button variant="outline" onClick={() => void signOut()}>تسجيل الخروج</Button>}</div>
    {loading ? <p>جاري التحميل...</p> : !user ? <Card className="max-w-md mx-auto"><CardContent className="p-6"><form onSubmit={login} className="space-y-4">
      <h2 className="font-bold text-xl">دخول المندوب</h2>
      <div><Label htmlFor="courier-username">اسم المستخدم</Label><Input id="courier-username" dir="ltr" autoComplete="username" required pattern="[a-zA-Z0-9_]{3,30}" value={username} disabled={busy} onChange={e => setUsername(e.target.value)} /></div>
      <div><Label htmlFor="courier-password">كلمة المرور</Label><Input id="courier-password" type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></div>
      {errorText && <p role="alert" className="text-destructive">{errorText}</p>}<Button type="submit" disabled={busy}>{busy ? "جاري الدخول..." : "دخول"}</Button>
      <p className="text-sm text-muted-foreground">للحصول على حساب أو تغيير كلمة المرور، تواصل مع مسؤول المتجر.</p>
    </form></CardContent></Card> : user.app_metadata?.account_type === "courier" ? <PortalOrders key={user.id} userId={user.id} /> : <p>هذه الصفحة مخصّصة لحسابات المناديب. <Link className="underline" to="/dashboard">العودة للنظام</Link></p>}
  </div></main>;
}
function PortalOrders({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const orders = useQuery({ queryKey: ["courier-portal", userId, page, filter], refetchInterval: 30000, queryFn: async () => {
    const { data, error } = await supabase.rpc("get_courier_portal_orders", { _offset: page * 50, _limit: 51, ...filter ? { _sub_status: filter } : {} });
    if (error) throw error;
    return data;
  } });
  async function update(orderId: string, value: string) {
    if (busy) return; setBusy(true);
    try {
      const { error } = await supabase.rpc("update_courier_sub_status", { _order_ids: [orderId], _sub_status: value });
      if (error) throw error;
      await cache.invalidateQueries({ queryKey: ["courier-portal", userId] });
      toast({ title: "تم تحديث الحالة الفرعية" });
    } catch (error) { toast({ title: "تعذّر تحديث الحالة", description: (error as { message?: string }).message, variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <p>طلباتك المسندة إليك. تحديث الحالة هنا لا يؤكد استلام المتجر للتسوية أو المرتجع.</p>
    <select aria-label="فلتر الحالة الفرعية" value={filter} className="border rounded-md p-2 bg-background" onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="">كل الحالات الفرعية</option>{Object.entries(courierSubStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    <Button variant="outline" disabled={orders.isFetching} onClick={() => void orders.refetch()}>تحديث</Button>
    {orders.isLoading && <p>جاري تحميل الطلبات...</p>}{orders.isError && <p role="alert" className="text-destructive">تعذّر تحميل الطلبات. أعد المحاولة.</p>}
    {!orders.isLoading && !orders.isError && !orders.data?.length && <p>لا توجد طلبات متاحة بهذه الحالة، أو الحساب غير نشط.</p>}
    <div className="grid md:grid-cols-2 gap-4">{orders.data?.slice(0, 50).map(row => <Card key={row.order_id}><CardContent className="p-5 space-y-3">
      <h2 className="font-bold">{row.order_code || row.order_id.slice(0, 8)} — {row.customer_name}</h2><p dir="ltr" className="text-right">{row.phone}</p><p>{row.city} — {row.address}</p><p>{row.product_name} × {row.quantity}</p><p>المبلغ المطلوب تحصيله: <strong>{row.cod_amount}</strong></p>
      <div className="text-sm text-muted-foreground"><p>تاريخ الإسناد: {new Date(row.assigned_at).toLocaleString("ar-LY")}</p><p>الباتش: <span dir="ltr">{batchLabel(row.batch_code)}</span></p></div>
      <Label htmlFor={`status-${row.order_id}`}>الحالة الفرعية</Label><select id={`status-${row.order_id}`} className="border rounded-md p-2 w-full bg-background" value={row.sub_status} disabled={busy || row.state !== "assigned"} onChange={e => void update(row.order_id, e.target.value)}>{Object.entries(courierSubStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      {row.state !== "assigned" && <p className="text-sm">{row.state === "returned" ? "استلم المتجر المرتجع" : row.state === "settled" ? "استلم المتجر التسوية" : "اعتمد المتجر التسليم"}</p>}
    </CardContent></Card>)}</div>
    <div className="flex gap-3"><Button variant="outline" disabled={!page || orders.isFetching} onClick={() => setPage(value => value - 1)}>السابق</Button><span>صفحة {page + 1}</span><Button variant="outline" disabled={(orders.data?.length || 0) <= 50 || orders.isFetching} onClick={() => setPage(value => value + 1)}>التالي</Button></div>
  </div>;
}
