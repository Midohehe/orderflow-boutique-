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
import { useStoreContext } from "@/hooks/useStoreContext";
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
  unit_price: number | null;
  reason: string;
  order_id: string | null;
  return_id: string | null;
  notes: string | null;
  created_at: string;
}

interface ProductPrice {
  id: string;
  price: number;
}

const REASON_LABEL: Record<string, string> = {
  order_created: "إنشاء طلب",
  order_unpacked: "تفريغ من شركة الشحن",
  return_received: "استلام مرتجع",
  manual: "حركة يدوية",
  manual_add: "إضافة كميات",
  manual_remove: "سحب كميات",
  opening_stock: "كمية افتتاحية",
};

const StockMovements = () => {
  const { activeStoreId } = useStoreContext();
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [products, setProducts] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [groupByProduct, setGroupByProduct] = useState(false);
  const [productFilter, setProductFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setRows([]);
      setProducts([]);
      setLoading(false);
      return;
    }
    const { data: ownerRow } = await (supabase as any)
      .rpc("get_effective_owner_id", { _uid: userData.user.id });
    const effectiveOwnerId = (ownerRow as string) || userData.user.id;
    let smQ = (supabase as any)
      .from("stock_movements")
      .select("*")
      .eq("owner_id", effectiveOwnerId)
      .order("created_at", { ascending: false })
      .limit(1000);
    let prQ = (supabase as any)
      .from("products")
      .select("id, price")
      .eq("owner_id", effectiveOwnerId)
      .limit(1000);
    if (activeStoreId) {
      smQ = smQ.or(`store_id.eq.${activeStoreId},store_id.is.null`);
      prQ = prQ.eq("store_id", activeStoreId);
    }
    const [smRes, prRes] = await Promise.all([
      smQ,
      prQ,
    ]);
    if (smRes.error) toast({ title: "خطأ", description: smRes.error.message, variant: "destructive" });
    else setRows((smRes.data as MovementRow[]) || []);
    if (prRes.error) toast({ title: "خطأ", description: prRes.error.message, variant: "destructive" });
    else setProducts((prRes.data as ProductPrice[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeStoreId]);

  const productPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.price != null) map.set(p.id, Number(p.price));
    }
    return map;
  }, [products]);

  const getRowTotal = (row: MovementRow): number | null => {
    const price = row.unit_price ?? (row.product_id ? productPriceMap.get(row.product_id) ?? null : null);
    if (price == null || row.qty == null) return null;
    return Number((price * row.qty).toFixed(2));
  };

  const getRowUnitPrice = (row: MovementRow): number | null => {
    return row.unit_price ?? (row.product_id ? productPriceMap.get(row.product_id) ?? null : null);
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (reasonFilter !== "all" && r.reason !== reasonFilter) return false;
      if (productFilter !== "all") {
        const key = r.product_id || r.product_name || "—";
        if (key !== productFilter) return false;
      }
      if (fromDate) {
        const f = new Date(fromDate); f.setHours(0, 0, 0, 0);
        if (new Date(r.created_at) < f) return false;
      }
      if (toDate) {
        const t = new Date(toDate); t.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > t) return false;
      }
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const hay = `${r.product_name || ""} ${r.variant_key || ""} ${r.warehouse_code || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, reasonFilter, search, fromDate, toDate, productFilter]);

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const key = r.product_id || r.product_name || "—";
      if (!map.has(key)) map.set(key, r.product_name || "—");
    }
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, { product_name: string; inQty: number; outQty: number; net: number; count: number }>();
    for (const r of filtered) {
      const key = r.product_id || r.product_name || "—";
      const cur = map.get(key) || { product_name: r.product_name || "—", inQty: 0, outQty: 0, net: 0, count: 0 };
      if (r.qty > 0) cur.inQty += r.qty; else cur.outQty += -r.qty;
      cur.net = cur.inQty - cur.outQty;
      cur.count++;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [filtered]);

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
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
              title="من تاريخ"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
              title="إلى تاريخ"
            />
            {(fromDate || toDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>
                مسح التاريخ
              </Button>
            )}
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
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="كل المنتجات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنتجات</SelectItem>
                {productOptions.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={groupByProduct ? "default" : "outline"}
              onClick={() => setGroupByProduct((v) => !v)}
            >
              {groupByProduct ? "عرض السجل التفصيلي" : "تجميع حسب المنتج"}
            </Button>
            <Button variant="outline" onClick={load} disabled={loading}>تحديث</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">لا توجد حركات بعد.</div>
          ) : groupByProduct ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">عدد الحركات</TableHead>
                    <TableHead className="text-right">إجمالي الداخل</TableHead>
                    <TableHead className="text-right">إجمالي الخارج</TableHead>
                    <TableHead className="text-right">الصافي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.map((g, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{isolateLatin(g.product_name)}</TableCell>
                      <TableCell className="text-muted-foreground">{g.count}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10">+{g.inQty}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/10">-{g.outQty}</Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        <Badge className={g.net < 0
                          ? "bg-red-500/10 text-red-600 hover:bg-red-500/10"
                          : "bg-green-500/10 text-green-600 hover:bg-green-500/10"}>
                          {g.net > 0 ? `+${g.net}` : g.net}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                    <TableHead className="text-right">سعر الوحدة</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
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
                      <TableCell className="text-muted-foreground">
                        {getRowUnitPrice(r) != null ? Number(getRowUnitPrice(r)).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="font-bold">
                        {getRowTotal(r) != null ? Number(getRowTotal(r)).toFixed(2) : "—"}
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
