import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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
      supabase.from("products").select("id, name, price, colors, sizes, product_codes").order("name"),
      supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
    ]).then(([o, p, it]) => {
      if (o.error) toast({ title: "خطأ", description: o.error.message, variant: "destructive" });
      setData(o.data || null);
      setProducts((p.data || []) as ProductLite[]);
      setItems((it.data || []) as any[]);
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

  const save = async () => {
    if (!data || !orderId) return;
    setSaving(true);
    const payload: any = {
      product_id: data.product_id ?? null,
      product_name: data.product_name,
      selected_color: data.selected_color || null,
      selected_size: data.selected_size || null,
      selected_product_code: data.selected_product_code || null,
      status: data.status,
    };
    for (const f of TEXT_FIELDS) {
      let v = data[f.key];
      if (f.type === "number") v = v === "" || v === null || v === undefined ? null : Number(v);
      payload[f.key] = v;
    }
    const { error } = await supabase.from("orders").update(payload).eq("id", orderId);
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
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

            {items.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <h4 className="font-semibold text-foreground">منتجات الطلب ({items.length})</h4>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={it.id} className="text-sm border rounded p-2 bg-background">
                      <div className="font-medium">{idx + 1}. {it.product_name}</div>
                      <div className="text-muted-foreground text-xs flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        {it.selected_color && <span>اللون: {it.selected_color}</span>}
                        {it.selected_size && <span>المقاس: {it.selected_size}</span>}
                        {it.selected_product_code && <span>الكود: {it.selected_product_code}</span>}
                        <span>الكمية: {it.quantity}</span>
                        <span>السعر: {Number(it.price).toLocaleString()}</span>
                        {it.warehouse_code && <span>كود المخزن: {it.warehouse_code}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <h4 className="font-semibold text-foreground">المنتج الرئيسي (للعرض في الجدول)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label>اختر المنتج</Label>
                  <Select value={data.product_id || ""} onValueChange={onProductChange}>
                    <SelectTrigger><SelectValue placeholder="اختر منتجاً" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>اسم المنتج (في الطلب)</Label>
                  <Input value={data.product_name ?? ""} onChange={(e) => update("product_name", e.target.value)} />
                </div>

                {colors.length > 0 ? (
                  <div className="space-y-1">
                    <Label>اللون</Label>
                    <Select
                      value={data.selected_color || NONE}
                      onValueChange={(v) => update("selected_color", v === NONE ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="اختر اللون" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {colors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>اللون</Label>
                    <Input value={data.selected_color ?? ""} onChange={(e) => update("selected_color", e.target.value)} />
                  </div>
                )}

                {sizes.length > 0 ? (
                  <div className="space-y-1">
                    <Label>المقاس</Label>
                    <Select
                      value={data.selected_size || NONE}
                      onValueChange={(v) => update("selected_size", v === NONE ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="اختر المقاس" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {sizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>المقاس</Label>
                    <Input value={data.selected_size ?? ""} onChange={(e) => update("selected_size", e.target.value)} />
                  </div>
                )}

                {codes.length > 0 ? (
                  <div className="space-y-1 sm:col-span-2">
                    <Label>كود المنتج</Label>
                    <Select
                      value={data.selected_product_code || NONE}
                      onValueChange={(v) => update("selected_product_code", v === NONE ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="اختر الكود" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {codes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1 sm:col-span-2">
                    <Label>كود المنتج</Label>
                    <Input value={data.selected_product_code ?? ""} onChange={(e) => update("selected_product_code", e.target.value)} />
                  </div>
                )}
              </div>
            </div>
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
