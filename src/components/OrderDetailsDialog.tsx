import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (updated: any) => void;
}

interface ProductLite {
  id: string;
  name: string;
  price: number;
  colors?: string[] | null;
  sizes?: string[] | null;
  product_codes?: string[] | null;
  variant_warehouse_codes?: Record<string, string> | null;
  variant_easyorders_ids?: Record<string, string> | null;
}

const TEXT_FIELDS: { key: string; label: string; type?: string; textarea?: boolean }[] = [
  { key: "customer_name", label: "اسم العميل" },
  { key: "phone", label: "رقم الهاتف" },
  { key: "city", label: "المدينة" },
  { key: "address", label: "العنوان", textarea: true },
  { key: "matched_zone_name", label: "المدينة المصححة" },
  { key: "matched_area_name", label: "المنطقة المصححة" },
  { key: "quantity", label: "الكمية", type: "number" },
  { key: "price", label: "السعر", type: "number" },
  { key: "shipping_reference", label: "كود الشحن" },
];

const NONE = "__none__";

interface ItemRow {
  id?: string;
  product_id: string | null;
  product_name: string;
  selected_color: string | null;
  selected_size: string | null;
  selected_product_code: string | null;
  quantity: number;
  price: number;
  warehouse_code?: string | null;
  easyorders_product_id?: string | null;
  easyorders_variant_id?: string | null;
}

export const OrderDetailsDialog = ({ orderId, open, onOpenChange, onSaved }: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase.from("products").select("id, name, price, colors, sizes, product_codes, variant_warehouse_codes, variant_easyorders_ids").order("name"),
      supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
    ]).then(([o, p, it]) => {
      if (o.error) toast({ title: "خطأ", description: o.error.message, variant: "destructive" });
      setData(o.data || null);
      setProducts((p.data || []) as ProductLite[]);
      const list = (it.data || []) as any[];
      // If no order_items yet, seed with the order's main product so the user can edit it
      if (list.length === 0 && o.data) {
        setItems([
          {
            product_id: o.data.product_id || null,
            product_name: o.data.product_name || "",
            selected_color: o.data.selected_color || null,
            selected_size: o.data.selected_size || null,
            selected_product_code: o.data.selected_product_code || null,
            quantity: o.data.quantity || 1,
            price: Number(o.data.price) || 0,
          },
        ]);
      } else {
        setItems(list as ItemRow[]);
      }
      setLoading(false);
    });
  }, [open, orderId]);

  const update = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  const selectedProduct = products.find((p) => p.id === data?.product_id);

  const onProductChange = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setData((d: any) => ({
      ...d,
      product_id: p.id,
      product_name: p.name,
      price: p.price,
      selected_color: null,
      selected_size: null,
      selected_product_code: null,
    }));
  };

  const updateItem = (idx: number, patch: Partial<ItemRow>) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const onItemProductChange = (idx: number, id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    updateItem(idx, {
      product_id: p.id,
      product_name: p.name,
      price: Number(p.price) || 0,
      selected_color: null,
      selected_size: null,
      selected_product_code: null,
      warehouse_code: null,
      easyorders_product_id: null,
      easyorders_variant_id: null,
    });
  };

  const addItem = () => {
    setItems((arr) => [
      ...arr,
      {
        product_id: null,
        product_name: "",
        selected_color: null,
        selected_size: null,
        selected_product_code: null,
        quantity: 1,
        price: 0,
      },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!data || !orderId) return;
    setSaving(true);
    // Compute aggregate price from items if any
    const aggPrice = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
    const aggQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
    const main = items[0];
    const payload: any = {
      product_id: data.product_id ?? null,
      product_name: data.product_name,
      selected_color: data.selected_color || null,
      selected_size: data.selected_size || null,
      selected_product_code: data.selected_product_code || null,
      status: data.status,
    };
    if (main) {
      payload.product_id = main.product_id;
      payload.product_name = main.product_name;
      payload.selected_color = main.selected_color;
      payload.selected_size = main.selected_size;
      payload.selected_product_code = main.selected_product_code;
    }
    for (const f of TEXT_FIELDS) {
      let v = data[f.key];
      if (f.type === "number") v = v === "" || v === null || v === undefined ? null : Number(v);
      payload[f.key] = v;
    }
    if (items.length > 0) {
      payload.price = aggPrice;
      payload.quantity = aggQty;
    }
    const { error } = await supabase.from("orders").update(payload).eq("id", orderId);
    if (error) {
      setSaving(false);
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    // Replace order_items
    const { error: dErr } = await supabase.from("order_items").delete().eq("order_id", orderId);
    if (dErr) {
      setSaving(false);
      toast({ title: "خطأ", description: dErr.message, variant: "destructive" });
      return;
    }
    if (items.length > 0) {
      const rows = items.map((it) => {
        const prod = products.find((p) => p.id === it.product_id);
        const key = `${it.selected_color || ""}-${it.selected_size || ""}`;
        const wh = prod?.variant_warehouse_codes?.[key] || it.warehouse_code || null;
        const eoVar = prod?.variant_easyorders_ids?.[key] || it.easyorders_variant_id || null;
        return {
          order_id: orderId,
          owner_id: data.owner_id,
          product_id: it.product_id,
          product_name: it.product_name,
          selected_color: it.selected_color,
          selected_size: it.selected_size,
          selected_product_code: it.selected_product_code,
          quantity: Number(it.quantity) || 1,
          price: Number(it.price) || 0,
          warehouse_code: wh,
          easyorders_product_id: it.easyorders_product_id || null,
          easyorders_variant_id: eoVar,
        };
      });
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) {
        setSaving(false);
        toast({ title: "خطأ", description: iErr.message, variant: "destructive" });
        return;
      }
    }
    setSaving(false);
    toast({ title: "تم الحفظ", description: "تم تحديث بيانات الطلب" });
    onSaved({ id: orderId, ...payload });
    onOpenChange(false);
  };

  const colors = selectedProduct?.colors || [];
  const sizes = selectedProduct?.sizes || [];
  const codes = selectedProduct?.product_codes || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تفاصيل الطلب وتعديل البيانات</DialogTitle>
        </DialogHeader>
        {loading || !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEXT_FIELDS.map((f) => (
                <div key={f.key} className={f.textarea ? "sm:col-span-2 space-y-1" : "space-y-1"}>
                  <Label>{f.label}</Label>
                  {f.textarea ? (
                    <Textarea value={data[f.key] ?? ""} onChange={(e) => update(f.key, e.target.value)} />
                  ) : (
                    <Input type={f.type || "text"} value={data[f.key] ?? ""} onChange={(e) => update(f.key, e.target.value)} />
                  )}
                </div>
              ))}
              <div className="space-y-1">
                <Label>الحالة</Label>
                <Select value={data.status} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="shipped">جاري التوصيل</SelectItem>
                    <SelectItem value="delivered">تم الاستلام</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground">منتجات الطلب ({items.length})</h4>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-4 h-4 ml-1" /> إضافة منتج
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((it, idx) => {
                  const prod = products.find((p) => p.id === it.product_id);
                  const cs = prod?.colors || [];
                  const ss = prod?.sizes || [];
                  const cds = prod?.product_codes || [];
                  const variantKey = `${it.selected_color || ""} - ${it.selected_size || ""}`;
                  const resolvedWh = prod?.variant_warehouse_codes?.[variantKey] || it.warehouse_code || null;
                  const resolvedEoVar = prod?.variant_easyorders_ids?.[variantKey] || it.easyorders_variant_id || null;
                  return (
                    <div key={idx} className="border rounded p-3 bg-background space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">منتج #{idx + 1}</span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)} title="حذف">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">الاسم المجلوب من ايزي اوردرز:</span>
                          <span className="font-medium text-foreground truncate">{it.product_name || "—"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">معرف منتج ايزي اوردرز:</span>
                          <span className="font-mono text-foreground truncate" title={it.easyorders_product_id || ""}>{it.easyorders_product_id || "—"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">معرف متغير ايزي اوردرز:</span>
                          <span className="font-mono text-foreground truncate" title={resolvedEoVar || ""}>{resolvedEoVar || "—"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">المنتج المختار محلياً:</span>
                          <span className="font-medium text-foreground truncate">{prod?.name || "غير مختار"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">كود مخزن شركة الشحن:</span>
                          <span className={`font-mono ${resolvedWh ? "text-foreground" : "text-destructive"}`}>{resolvedWh || "غير مرتبط"}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">المنتج</Label>
                          <Select value={it.product_id || ""} onValueChange={(v) => onItemProductChange(idx, v)}>
                            <SelectTrigger><SelectValue placeholder="اختر منتجاً" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">اللون</Label>
                          {cs.length > 0 ? (
                            <Select
                              value={it.selected_color || NONE}
                              onValueChange={(v) => updateItem(idx, { selected_color: v === NONE ? null : v })}
                            >
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>—</SelectItem>
                                {cs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={it.selected_color || ""} onChange={(e) => updateItem(idx, { selected_color: e.target.value })} />
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">المقاس</Label>
                          {ss.length > 0 ? (
                            <Select
                              value={it.selected_size || NONE}
                              onValueChange={(v) => updateItem(idx, { selected_size: v === NONE ? null : v })}
                            >
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>—</SelectItem>
                                {ss.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={it.selected_size || ""} onChange={(e) => updateItem(idx, { selected_size: e.target.value })} />
                          )}
                        </div>
                        {cds.length > 0 && (
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">كود المنتج</Label>
                            <Select
                              value={it.selected_product_code || NONE}
                              onValueChange={(v) => updateItem(idx, { selected_product_code: v === NONE ? null : v })}
                            >
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>—</SelectItem>
                                {cds.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">الكمية</Label>
                          <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">سعر الوحدة</Label>
                          <Input type="number" value={it.price} onChange={(e) => updateItem(idx, { price: Number(e.target.value) || 0 })} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد منتجات. اضغط "إضافة منتج"</p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">السعر الإجمالي والمنتج الرئيسي للطلب يُحسبان تلقائياً من المنتجات أعلاه.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
