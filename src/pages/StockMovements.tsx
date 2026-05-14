import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Boxes, Loader2, ArrowDown, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { isolateLatin } from "@/lib/bidi";
import { PageHeader } from "@/components/PageHeader";

interface MovementRow {
  id: string;
  product_id: string | null;
  product_name: string | null;
  variant_key: string | null;
  warehouse_code: string | null;
  qty: number;
  reason: string;
  order_id: string | null;
  return_id: string | null;
  notes: string | null;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  order_created: "إنشاء طلب",
  order_unpacked: "تفريغ من شركة الشحن",
  return_received: "استلام مرتجع",
  manual: "حركة يدوية",
  manual_add: "إضافة كميات",
  manual_remove: "سحب كميات",
};

const StockMovements = () => {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else setRows((data as MovementRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (reasonFilter !== "all" && r.reason !== reasonFilter) return false;
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const hay = `${r.product_name || ""} ${r.variant_key || ""} ${r.warehouse_code || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, reasonFilter, search]);

  const totals = useMemo(() => {
    let inQty = 0, outQty = 0;
    for (const r of filtered) {
      if (r.qty > 0) inQty += r.qty; else outQty += -r.qty;
    }
    return { inQty, outQty, net: inQty - outQty };
  }, [filtered]);

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={Boxes}
        title="حركة المنتجات"
        description="سجل كل تأثير على المخزون من الطلبات والمرتجعات"
        iconGradient="from-indigo-500 to-blue-600"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg"><ArrowDown className="w-5 h-5 text-red-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الخارج</p>
              <p className="text-lg font-bold">{totals.outQty}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg"><ArrowUp className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الداخل</p>
              <p className="text-lg font-bold">{totals.inQty}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Boxes className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">الصافي</p>
              <p className="text-lg font-bold">{totals.net}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <CardTitle>السجل</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="بحث بالمنتج/المتغير/الكود"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحركات</SelectItem>
                <SelectItem value="order_created">إنشاء طلب</SelectItem>
                <SelectItem value="order_unpacked">تفريغ من شركة الشحن</SelectItem>
                <SelectItem value="return_received">استلام مرتجع</SelectItem>
                <SelectItem value="manual_add">إضافة كميات</SelectItem>
                <SelectItem value="manual_remove">سحب كميات</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load} disabled={loading}>تحديث</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">لا توجد حركات بعد.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">المتغير</TableHead>
                    <TableHead className="text-right">كود التخزين</TableHead>
                    <TableHead className="text-right">الكمية</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                    <TableHead className="text-right">الطلب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("ar-LY")}
                      </TableCell>
                      <TableCell className="font-medium">{r.product_name || "—"}</TableCell>
                      <TableCell>{r.variant_key || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.warehouse_code || "—"}</TableCell>
                      <TableCell className="font-bold">
                        <Badge className={r.qty < 0
                          ? "bg-red-500/10 text-red-600 hover:bg-red-500/10"
                          : "bg-green-500/10 text-green-600 hover:bg-green-500/10"}>
                          {r.qty > 0 ? `+${r.qty}` : r.qty}
                        </Badge>
                      </TableCell>
                      <TableCell>{REASON_LABEL[r.reason] || r.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {r.order_id ? r.order_id.slice(0, 8) : "—"}
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

export default StockMovements;
