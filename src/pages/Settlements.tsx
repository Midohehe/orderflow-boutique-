import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, ChevronLeft, CheckCircle2, Wallet, Loader2, Building2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  const [tab, setTab] = useState<"carrier" | "internal">("carrier");

  // Internal settlement state
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [safes, setSafes] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [selectedSafeId, setSelectedSafeId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!activeStoreId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("settlements")
      .select("*")
      .eq("store_id", activeStoreId)
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

  const loadInternal = async () => {
    if (!activeStoreId) { setPendingOrders([]); return; }
    setPendingLoading(true);
    const [ordersRes, safesRes] = await Promise.all([
      supabase.from("orders").select("id, order_code, customer_name, phone, city, product_name, price, quantity, created_at")
        .eq("store_id", activeStoreId)
        .eq("status", "pending")
        .eq("is_deleted", false)
        .eq("settlement_received", false)
        .order("created_at", { ascending: false }),
      supabase.from("safes").select("id, name, balance").order("created_at"),
    ]);
    if (ordersRes.error) toast({ title: "خطأ", description: ordersRes.error.message, variant: "destructive" });
    setPendingOrders(ordersRes.data || []);
    setSafes((safesRes.data as any[]) || []);
    setSelectedIds(new Set());
    setPendingLoading(false);
  };

  useEffect(() => {
    if (tab === "internal") loadInternal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeStoreId]);

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === pendingOrders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingOrders.map(o => o.id)));
  };

  const selectedTotal = pendingOrders
    .filter(o => selectedIds.has(o.id))
    .reduce((s, o) => s + Number(o.price || 0) * Number(o.quantity || 1), 0);

  const submitInternal = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "لم يتم اختيار طلبات", variant: "destructive" }); return;
    }
    if (!selectedSafeId) {
      toast({ title: "اختر الخزينة", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const { data: ordersData, error: oErr } = await supabase
        .from("orders").select("id, owner_id, store_id, price, quantity, order_code")
        .in("id", ids);
      if (oErr) throw oErr;
      const ownerId = ordersData?.[0]?.owner_id;
      const storeId = ordersData?.[0]?.store_id;
      const total = (ordersData || []).reduce(
        (s, o: any) => s + Number(o.price || 0) * Number(o.quantity || 1), 0,
      );
      const nowIso = new Date().toISOString();

      const { error: updErr } = await supabase.from("orders").update({
        status: "settled",
        settlement_received: true,
        settlement_received_at: nowIso,
      }).in("id", ids);
      if (updErr) throw updErr;

      const { error: movErr } = await supabase.from("safe_movements").insert({
        safe_id: selectedSafeId,
        amount: total,
        movement_type: "deposit",
        reference_id: crypto.randomUUID(),
        notes: `تسوية داخلية - ${ids.length} طلب`,
        owner_id: ownerId,
        store_id: storeId,
      });
      if (movErr) throw movErr;

      toast({ title: "تمت التسوية", description: `${ids.length} طلب بقيمة ${total.toFixed(2)}` });
      setSelectedSafeId("");
      await loadInternal();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

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
        action={tab === "carrier" ? (
          <Button onClick={refreshFromCarrier} disabled={syncing} className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700">
            {syncing ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 ml-2" />
            )}
            تحديث من شركة الشحن
          </Button>
        ) : null}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="carrier"><Building2 className="w-4 h-4 ml-2" />من شركة التوصيل</TabsTrigger>
          <TabsTrigger value="internal"><Home className="w-4 h-4 ml-2" />تسوية داخلية</TabsTrigger>
        </TabsList>

        <TabsContent value="carrier" className="space-y-6 mt-4">
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
        </TabsContent>

        <TabsContent value="internal" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>تسوية داخلية للطلبات قيد الانتظار</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>الخزينة</Label>
                  <Select value={selectedSafeId} onValueChange={setSelectedSafeId}>
                    <SelectTrigger><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
                    <SelectContent>
                      {safes.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({Number(s.balance).toFixed(2)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المختار</Label>
                  <div className="text-sm font-semibold">{selectedIds.size} طلب — {selectedTotal.toFixed(2)}</div>
                </div>
                <Button onClick={submitInternal} disabled={submitting || selectedIds.size === 0 || !selectedSafeId}>
                  {submitting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
                  تسجيل التسوية
                </Button>
              </div>

              {pendingLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : pendingOrders.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">لا توجد طلبات قيد الانتظار.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedIds.size > 0 && selectedIds.size === pendingOrders.length}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead className="text-right">الكود</TableHead>
                        <TableHead className="text-right">العميل</TableHead>
                        <TableHead className="text-right">الهاتف</TableHead>
                        <TableHead className="text-right">المدينة</TableHead>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right">السعر</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOrders.map((o) => (
                        <TableRow key={o.id} className={selectedIds.has(o.id) ? "bg-muted/30" : ""}>
                          <TableCell>
                            <Checkbox checked={selectedIds.has(o.id)} onCheckedChange={() => toggleOne(o.id)} />
                          </TableCell>
                          <TableCell className="font-medium">{o.order_code || "—"}</TableCell>
                          <TableCell>{o.customer_name}</TableCell>
                          <TableCell className="text-muted-foreground">{o.phone}</TableCell>
                          <TableCell className="text-muted-foreground">{o.city}</TableCell>
                          <TableCell>{o.product_name}</TableCell>
                          <TableCell>{o.quantity}</TableCell>
                          <TableCell className="font-bold">{Number(o.price).toFixed(2)}</TableCell>
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

export default Settlements;