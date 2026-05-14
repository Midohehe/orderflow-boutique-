import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, CheckCircle2, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rtrnRows, setRtrnRows] = useState<RtrnOrderRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [codeQuery, setCodeQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: ord, error: oErr } = await (supabase as any).from("orders")
      .select("id, customer_name, phone, product_name, quantity, price, shipping_reference, carrier_status, carrier_status_updated_at, status")
      .or('carrier_status.eq.تم الارجاع للراسل,carrier_status.ilike.%RTRN%')
      .neq("status", "returned_received")
      .order("carrier_status_updated_at", { ascending: false });
    if (oErr) console.error(oErr);
    else setRtrnRows((ord as RtrnOrderRow[]) || []);
    setLoading(false);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    load();
  }, []);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === rtrnRows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rtrnRows.map((r) => r.id)));
  };

  const applyCodeSelection = () => {
    const tokens = codeQuery
      .split(/[\s,،\n]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) {
      toast({ title: "أدخل كود أو أكواد", variant: "destructive" });
      return;
    }
    const matched = rtrnRows.filter((r) =>
      tokens.some((t) => (r.shipping_reference || "").toLowerCase().includes(t)),
    );
    if (matched.length === 0) {
      toast({ title: "لا توجد طلبات مطابقة", variant: "destructive" });
      return;
    }
    setSelectedIds((prev) => {
      const n = new Set(prev);
      matched.forEach((m) => n.add(m.id));
      return n;
    });
    toast({ title: `تم تحديد ${matched.length} طلب` });
  };

  const handleBarcodeScan = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t) return;
    const match = rtrnRows.find((r) => (r.shipping_reference || "").toLowerCase() === t)
      || rtrnRows.find((r) => (r.shipping_reference || "").toLowerCase().includes(t));
    if (!match) {
      toast({ title: "لم يتم العثور على طلب", description: raw, variant: "destructive" });
      setBarcode("");
      return;
    }
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.add(match.id);
      return n;
    });
    toast({ title: "تمت إضافة الطلب", description: match.shipping_reference || "" });
    setBarcode("");
  };

  const confirmBulkReceive = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast({ title: "لم يتم اختيار أي طلب", variant: "destructive" });
      return;
    }
    setBulkProcessing(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        const { error: fErr } = await supabase.functions.invoke("apply-order-stock", {
          body: { order_id: id, reason: "return_received" },
        });
        if (fErr) throw fErr;
        const { error: uErr } = await (supabase as any).from("orders")
          .update({ status: "returned_received" }).eq("id", id);
        if (uErr) throw uErr;
        ok++;
      } catch (e) { console.error(e); fail++; }
    }
    setBulkProcessing(false);
    toast({
      title: "اكتمل الاستلام",
      description: `تم استلام ${ok} طلب${fail ? ` — فشل ${fail}` : ""}`,
      variant: fail ? "destructive" : "default",
    });
    await load();
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

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">استلام المرتجعات</h1>
          <p className="text-muted-foreground">استلام البضاعة المرتجعة من شركة الشحن وإعادتها للمخزون</p>
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

      <Card>
        <CardHeader>
          <CardTitle>طلبات بحالة "تم الإرجاع للراسل" (RTRN)</CardTitle>
          <p className="text-sm text-muted-foreground">حدد الطلبات يدوياً أو الصق أكواد المراجع، ثم اضغط "تأكيد الاستلام" لإرجاع الكميات للمخزون.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative w-full sm:w-[280px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
              <Input
                autoFocus
                placeholder="باركود — امسح الكود واضغط Enter"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleBarcodeScan(barcode); }}
                className="pr-9 border-primary/40 focus-visible:ring-primary"
              />
            </div>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ألصق كود أو عدة أكواد مفصولة بمسافة/فاصلة"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyCodeSelection(); }}
                className="pr-9"
              />
            </div>
            <Button variant="outline" onClick={applyCodeSelection}>تحديد بالأكواد</Button>
            <div className="flex-1" />
            <Badge variant="secondary">المختار: {selectedIds.size}</Badge>
            <Button onClick={confirmBulkReceive} disabled={bulkProcessing || selectedIds.size === 0}>
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 ml-1" />
              )}
              تأكيد الاستلام
            </Button>
          </div>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : rtrnRows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">لا توجد طلبات بهذه الحالة حالياً.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === rtrnRows.length && rtrnRows.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-right">المرجع</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">الكمية</TableHead>
                    <TableHead className="text-right">آخر تحديث</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rtrnRows.map((o) => (
                    <TableRow key={o.id} data-state={selectedIds.has(o.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(o.id)}
                          onCheckedChange={() => toggleOne(o.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{o.shipping_reference || "—"}</TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell>{o.product_name}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.carrier_status_updated_at ? new Date(o.carrier_status_updated_at).toLocaleString("ar-LY") : "—"}
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

export default Returns;
