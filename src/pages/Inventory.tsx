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
import { Boxes, Plus, Minus, Loader2, DollarSign, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";

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
  // Only use product_codes as variant keys when there are no colors/sizes (legacy code-only variants).
  if (keys.length === 0) {
    codes.forEach((c) => { if (!keys.includes(c)) keys.push(c); });
  }
  return keys;
};

const Inventory = () => {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "remove">("add");
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

  const openDialog = (mode: "add" | "remove") => {
    setDialogMode(mode);
    resetDialog();
    setDialogOpen(true);
  };

  const applyBulkToAll = () => {
    const v = bulkQty.trim();
    if (!v) return;
    const next: Record<string, string> = {};
    variantKeys.forEach((k) => { next[k] = v; });
    setVariantQty(next);
  };

  const submit = async () => {
    if (!selectedProductId) {
      toast({ title: "اختر منتجاً", variant: "destructive" });
      return;
    }
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const isRemove = dialogMode === "remove";

    type Entry = { variantKey: string | null; qty: number };
    const entries: Entry[] = [];
    if (variantKeys.length > 0) {
      for (const k of variantKeys) {
        const raw = (variantQty[k] || "").trim();
        if (!raw) continue;
        const q = parseInt(raw);
        if (isNaN(q) || q <= 0) continue;
        if (isRemove) {
          const cur = Number(prod.variant_stock?.[k] ?? 0);
          if (q > cur) {
            toast({ title: "كمية غير كافية", description: `المتغير "${k}" متوفر فقط ${cur}`, variant: "destructive" });
            return;
          }
        }
        entries.push({ variantKey: k, qty: q });
      }
    } else {
      const q = parseInt(singleQty);
      if (!isNaN(q) && q > 0) {
        if (isRemove && q > prod.stock) {
          toast({ title: "الكمية في المخزن غير كافية", variant: "destructive" });
          return;
        }
        entries.push({ variantKey: null, qty: q });
      }
    }

    if (entries.length === 0) {
      toast({ title: isRemove ? "أدخل كمية سحب واحدة على الأقل" : "أدخل كمية واحدة على الأقل", variant: "destructive" });
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
        qty: isRemove ? -e.qty : e.qty,
        reason: isRemove ? "manual_remove" : "manual_add",
        notes: isRemove ? "سحب كميات يدوياً" : "إضافة كميات يدوياً",
      }));
      const { error: mErr } = await (supabase as any).from("stock_movements").insert(movementsPayload);
      if (mErr) throw mErr;

      const newVariantStock = { ...(prod.variant_stock || {}) } as Record<string, number>;
      let totalDelta = 0;
      for (const e of entries) {
        if (e.variantKey) {
          const newVal = Math.max(0, Number(newVariantStock[e.variantKey] || 0) + (isRemove ? -e.qty : e.qty));
          newVariantStock[e.variantKey] = newVal;
        }
        totalDelta += e.qty;
      }
      const newStock = Math.max(0, Number(prod.stock || 0) + (isRemove ? -totalDelta : totalDelta));
      const { error: uErr } = await (supabase as any).from("products")
        .update({ stock: newStock, variant_stock: newVariantStock })
        .eq("id", prod.id);
      if (uErr) throw uErr;

      const verb = isRemove ? "تم السحب" : "تمت الإضافة";
      toast({ title: verb, description: `${isRemove ? "-" : "+"}${totalDelta} إلى ${prod.name}` });
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
      <PageHeader
        icon={Boxes}
        title="المخزون"
        description="عرض كميات المنتجات وقيمة المخزون"
        iconGradient="from-blue-500 to-cyan-600"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openDialog("remove")} className="shadow-sm hover:shadow-md transition-shadow border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
              <Minus className="w-4 h-4 ml-1" />
              سحب الكميات
            </Button>
            <Button onClick={() => openDialog("add")} className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700">
              <Plus className="w-4 h-4 ml-1" />
              إضافة كميات
            </Button>
          </div>
        }
      />

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
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "إضافة كميات للمخزون" : "سحب كميات من المخزون"}
            </DialogTitle>
          </DialogHeader>
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
                        <TableHead className="text-right">{dialogMode === "add" ? "إضافة" : "سحب"}</TableHead>
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
                <Label>{dialogMode === "add" ? "الكمية المراد إضافتها" : "الكمية المراد سحبها"}</Label>
                <Input type="number" min="1" value={singleQty} onChange={(e) => setSingleQty(e.target.value)} placeholder="مثال: 10" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={submit} disabled={saving} variant={dialogMode === "remove" ? "destructive" : "default"}>
              {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : dialogMode === "remove" ? <Minus className="w-4 h-4 ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
