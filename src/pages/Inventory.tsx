import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Boxes, Plus, Loader2, DollarSign, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProductRow {
  id: string;
  name: string;
  price: number;
  purchase_price: number;
  stock: number;
  variant_stock: Record<string, number> | null;
  colors: string[] | null;
  sizes: string[] | null;
  product_codes: string[] | null;
}

const buildVariantKeys = (p: ProductRow): string[] => {
  const colors = (p.colors || []).filter(Boolean);
  const sizes = (p.sizes || []).filter(Boolean);
  const codes = (p.product_codes || []).filter(Boolean);
  const keys: string[] = [];
  if (colors.length && sizes.length) {
    colors.forEach((c) => sizes.forEach((s) => keys.push(`${c} - ${s}`)));
  } else if (colors.length) keys.push(...colors);
  else if (sizes.length) keys.push(...sizes);
  codes.forEach((c) => { if (!keys.includes(c)) keys.push(c); });
  return keys;
};

const Inventory = () => {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [variantQty, setVariantQty] = useState<Record<string, string>>({});
  const [singleQty, setSingleQty] = useState<string>("");
  const [bulkQty, setBulkQty] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const q = supabase
      .from("products")
      .select("id, name, price, purchase_price, stock, variant_stock, colors, sizes, product_codes")
      .order("name", { ascending: true });
    const { data, error } = user ? await q.eq("owner_id", user.id) : await q;
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else setProducts((data as ProductRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalValue = useMemo(
    () => products.reduce((s, p) => s + Number(p.purchase_price || 0) * Number(p.stock || 0), 0),
    [products],
  );
  const totalUnits = useMemo(
    () => products.reduce((s, p) => s + Number(p.stock || 0), 0),
    [products],
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const variantKeys = selectedProduct ? buildVariantKeys(selectedProduct) : [];

  const resetDialog = () => {
    setSelectedProductId("");
    setVariantQty({});
    setSingleQty("");
    setBulkQty("");
  };

  const applyBulkToAll = () => {
    const v = bulkQty.trim();
    if (!v) return;
    const next: Record<string, string> = {};
    variantKeys.forEach((k) => { next[k] = v; });
    setVariantQty(next);
  };

  const submitAdd = async () => {
    if (!selectedProductId) {
      toast({ title: "اختر منتجاً", variant: "destructive" });
      return;
    }
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    type Entry = { variantKey: string | null; qty: number };
    const entries: Entry[] = [];
    if (variantKeys.length > 0) {
      for (const k of variantKeys) {
        const raw = (variantQty[k] || "").trim();
        if (!raw) continue;
        const q = parseInt(raw);
        if (isNaN(q) || q <= 0) continue;
        entries.push({ variantKey: k, qty: q });
      }
    } else {
      const q = parseInt(singleQty);
      if (!isNaN(q) && q > 0) entries.push({ variantKey: null, qty: q });
    }

    if (entries.length === 0) {
      toast({ title: "أدخل كمية واحدة على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const movementsPayload = entries.map((e) => ({
        owner_id: user.id,
        product_id: prod.id,
        product_name: prod.name,
        variant_key: e.variantKey,
        warehouse_code: null,
        qty: e.qty,
        reason: "manual_add",
        notes: "إضافة كميات يدوياً",
      }));
      const { error: mErr } = await (supabase as any).from("stock_movements").insert(movementsPayload);
      if (mErr) throw mErr;

      const newVariantStock = { ...(prod.variant_stock || {}) } as Record<string, number>;
      let added = 0;
      for (const e of entries) {
        if (e.variantKey) {
          newVariantStock[e.variantKey] = Number(newVariantStock[e.variantKey] || 0) + e.qty;
        }
        added += e.qty;
      }
      const newStock = Number(prod.stock || 0) + added;
      const { error: uErr } = await (supabase as any).from("products")
        .update({ stock: newStock, variant_stock: newVariantStock })
        .eq("id", prod.id);
      if (uErr) throw uErr;

      toast({ title: "تمت الإضافة", description: `+${added} إلى ${prod.name}` });
      setDialogOpen(false);
      resetDialog();
      await load();
    } catch (e: any) {
      toast({ title: "تعذر الحفظ", description: e?.message || "خطأ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المخزون</h1>
          <p className="text-muted-foreground">عرض كميات المنتجات وقيمة المخزون</p>
        </div>
        <Button onClick={() => { resetDialog(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" />
          إضافة كميات
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg"><DollarSign className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي قيمة المخزون</p>
              <p className="text-xl font-bold">{totalValue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg"><Boxes className="w-5 h-5 text-blue-500" /></div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي القطع</p>
              <p className="text-xl font-bold">{totalUnits}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg"><Package className="w-5 h-5 text-orange-500" /></div>
            <div>
              <p className="text-sm text-muted-foreground">عدد المنتجات</p>
              <p className="text-xl font-bold">{products.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="w-5 h-5" /> قائمة المنتجات</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد منتجات.</div>
          ) : (
            <div className="space-y-4">
              {products.map((p) => {
                const keys = buildVariantKeys(p);
                const value = Number(p.purchase_price || 0) * Number(p.stock || 0);
                return (
                  <div key={p.id} className="border rounded-lg overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 border-b">
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-bold text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">سعر الشراء: {Number(p.purchase_price).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">القيمة:</span>
                        <span className="px-2 py-1 rounded text-sm font-semibold bg-primary/10 text-primary">{value.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">الإجمالي:</span>
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${
                          p.stock <= 0 ? "bg-red-500/10 text-red-500"
                          : p.stock < 5 ? "bg-orange-500/10 text-orange-500"
                          : "bg-green-500/10 text-green-500"
                        }`}>{p.stock}</span>
                      </div>
                    </div>
                    {keys.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">المتغير</TableHead>
                            <TableHead className="text-right">الكمية</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {keys.map((k) => {
                            const cur = Number(p.variant_stock?.[k] ?? 0);
                            return (
                              <TableRow key={k}>
                                <TableCell className="text-muted-foreground">{k}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded ${
                                    cur <= 0 ? "bg-red-500/10 text-red-500"
                                    : cur < 5 ? "bg-orange-500/10 text-orange-500"
                                    : "bg-green-500/10 text-green-500"
                                  }`}>{cur}</span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إضافة كميات للمخزون</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>المنتج</Label>
              <Select value={selectedProductId} onValueChange={(v) => { setSelectedProductId(v); setVariantQty({}); setSingleQty(""); setBulkQty(""); }}>
                <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProduct && variantKeys.length > 0 && (
              <>
                <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                  <Label className="text-xs text-muted-foreground">قيمة موحدة (اختياري) — تطبّق على جميع المتغيرات</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={bulkQty}
                      onChange={(e) => setBulkQty(e.target.value)}
                      placeholder="مثال: 5"
                    />
                    <Button type="button" variant="secondary" onClick={applyBulkToAll} disabled={!bulkQty.trim()}>
                      تطبيق على الكل
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المتغير</TableHead>
                        <TableHead className="text-right">الكمية الحالية</TableHead>
                        <TableHead className="text-right">إضافة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variantKeys.map((k) => {
                        const cur = Number(selectedProduct.variant_stock?.[k] ?? 0);
                        return (
                          <TableRow key={k}>
                            <TableCell className="text-muted-foreground">{k}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${
                                cur <= 0 ? "bg-red-500/10 text-red-500"
                                : cur < 5 ? "bg-orange-500/10 text-orange-500"
                                : "bg-green-500/10 text-green-500"
                              }`}>{cur}</span>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                className="w-24"
                                value={variantQty[k] ?? ""}
                                placeholder="0"
                                onChange={(e) => setVariantQty((prev) => ({ ...prev, [k]: e.target.value }))}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {selectedProduct && variantKeys.length === 0 && (
              <div>
                <Label>الكمية المراد إضافتها</Label>
                <Input type="number" min="1" value={singleQty} onChange={(e) => setSingleQty(e.target.value)} placeholder="مثال: 10" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={submitAdd} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;