import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Loader2, Plus, Trash2, Link2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEasyOrdersEnabled } from "@/hooks/useEasyOrdersEnabled";
import { isolateLatin } from "@/lib/bidi";

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
  easyorders_product_id?: string | null;
}

const TEXT_FIELDS: { key: string; label: string; type?: string; textarea?: boolean }[] = [
  { key: "customer_name", label: "اسم العميل" },
  { key: "phone", label: "رقم الهاتف" },
  { key: "address", label: "العنوان", textarea: true },
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
  const { enabled: eoEnabled } = useEasyOrdersEnabled();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [originalInput, setOriginalInput] = useState<{ city: string; address: string; variant: string; quantity: number | null } | null>(null);
  const [zones, setZones] = useState<Array<{ id: number; name: string; canonical?: string }>>([]);
  const [areasMap, setAreasMap] = useState<Record<number, Array<{ id: number; name: string; canonical?: string }>>>({});
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  useEffect(() => {
    if (!open || zones.length > 0) return;
    setLoadingZones(true);
    supabase.functions.invoke("list-shipping-dropdown", { body: {} })
      .then(({ data, error }) => {
        if (!error) {
          const list = ((data as any)?.zones || []) as Array<{ id: number; name: string; canonical?: string }>;
          list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
          setZones(list);
          // Remap stored matched_zone_name (may be the old canonical) to current display name
          setData((d: any) => {
            if (!d) return d;
            const current = d.matched_zone_name || d.city;
            if (!current) return d;
            if (list.some((z) => z.name === current)) return d;
            const byCanon = list.find((z) => z.canonical === current);
            if (!byCanon) return d;
            return { ...d, matched_zone_name: byCanon.name, city: byCanon.name, matched_zone_id: byCanon.id };
          });
        }
      })
      .finally(() => setLoadingZones(false));
  }, [open]);

  const selectedZone = zones.find((z) => z.name === (data?.matched_zone_name || data?.city));
  const currentAreas = selectedZone ? (areasMap[selectedZone.id] || []) : [];

  useEffect(() => {
    if (!selectedZone || areasMap[selectedZone.id]) return;
    setLoadingAreas(true);
    supabase.functions.invoke("list-shipping-dropdown", { body: { zoneId: selectedZone.id, zoneName: selectedZone.name } })
      .then(({ data, error }) => {
        if (!error) {
          const list = ((data as any)?.areas || []) as Array<{ id: number; name: string; canonical?: string }>;
          setAreasMap((prev) => ({ ...prev, [selectedZone.id]: list }));
          setData((d: any) => {
            if (!d) return d;
            const current = d.matched_area_name;
            if (!current) return d;
            if (list.some((x) => x.name === current)) return d;
            const byCanon = list.find((x) => x.canonical === current);
            if (!byCanon) return d;
            return { ...d, matched_area_name: byCanon.name, matched_area_id: byCanon.id };
          });
        }
      })
      .finally(() => setLoadingAreas(false));
  }, [selectedZone?.id]);

  const onZoneChange = (name: string) => {
    const z = zones.find((x) => x.name === name);
    setData((d: any) => ({
      ...d,
      city: name,
      matched_zone_name: name,
      matched_zone_id: z?.id ?? null,
      matched_area_name: null,
      matched_area_id: null,
    }));
  };

  const onAreaChange = (name: string) => {
    const a = currentAreas.find((x) => x.name === name);
    setData((d: any) => ({ ...d, matched_area_name: name, matched_area_id: a?.id ?? null }));
  };

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      const [o, p, it] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        (uid
          ? supabase.from("products").select("id, name, price, colors, sizes, product_codes, variant_warehouse_codes, variant_easyorders_ids, easyorders_product_id").eq("owner_id", uid).order("name")
          : supabase.from("products").select("id, name, price, colors, sizes, product_codes, variant_warehouse_codes, variant_easyorders_ids, easyorders_product_id").order("name")),
        supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
      ]);
      if (o.error) toast({ title: "خطأ", description: o.error.message, variant: "destructive" });
      setData(o.data || null);
      if (o.data) {
        const variantStr = [o.data.selected_color, o.data.selected_size, o.data.selected_product_code]
          .filter((v: any) => v != null && String(v).trim() !== "")
          .join(" - ");
        setOriginalInput({
          city: o.data.city || "",
          address: o.data.address || "",
          variant: variantStr,
          quantity: o.data.quantity ?? null,
        });
      }
      setProducts((p.data || []) as ProductLite[]);
      const list = (it.data || []) as any[];
      // If no order_items yet, seed with the order's main product so the user can edit it
      if (list.length === 0 && o.data) {
        const splitVals = (v: any): string[] => {
          if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
          if (typeof v === "string") return v.split(/[,،;\/]+/).map((s) => s.trim()).filter(Boolean);
          return [];
        };
        const colors = splitVals(o.data.selected_color);
        const sizes = splitVals(o.data.selected_size);
        const codes = splitVals(o.data.selected_product_code);
        const qty = Number(o.data.quantity) || 1;
        const unitPrice = qty > 0 ? (Number(o.data.price) || 0) / qty : Number(o.data.price) || 0;
        const count = Math.max(qty, colors.length, sizes.length, codes.length, 1);
        const seeded: ItemRow[] = Array.from({ length: count }).map((_, i) => ({
          product_id: o.data.product_id || null,
          product_name: o.data.product_name || "",
          selected_color: colors[i] ?? colors[0] ?? null,
          selected_size: sizes[i] ?? sizes[0] ?? null,
          selected_product_code: codes[i] ?? codes[0] ?? null,
          quantity: 1,
          price: unitPrice,
        }));
        setItems(seeded);
      } else {
        setItems(list as ItemRow[]);
      }
      setLoading(false);
    })();
  }, [open, orderId]);

  const update = (k: string, v: any) => {
    setData((d: any) => ({ ...d, [k]: v }));
    // Keep the top-level "السعر" / "الكمية" inputs in sync with the items
    // array, because on save the aggregate is recomputed from items. Without
    // this, edits to those top fields silently get overwritten.
    if ((k === "price" || k === "quantity") && items.length === 1) {
      const num = Number(v) || 0;
      setItems((prev) => {
        if (prev.length !== 1) return prev;
        const next = [...prev];
        if (k === "price") {
          const qty = Number(next[0].quantity) || 1;
          next[0] = { ...next[0], price: qty > 0 ? num / qty : num };
        } else {
          next[0] = { ...next[0], quantity: Math.max(1, Math.floor(num) || 1) };
        }
        return next;
      });
    }
  };

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
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const next: any = { ...it, ...patch };
      // If variant selection changed, invalidate cached warehouse_code & EO variant id
      // so they get re-resolved from the product's mappings on save.
      const variantChanged =
        "selected_color" in patch ||
        "selected_size" in patch ||
        "selected_product_code" in patch ||
        "product_id" in patch;
      if (variantChanged) {
        next.warehouse_code = null;
        next.easyorders_variant_id = null;
      }
      return next;
    }));
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

  const retryLinking = () => {
    let linkedProducts = 0;
    let linkedWarehouse = 0;
    let stillMissing = 0;
    const next = items.map((it) => {
      const updated: any = { ...it };
      // 1) Link product by easyorders_product_id if not linked
      if (!updated.product_id && updated.easyorders_product_id) {
        const p = products.find((x) => x.easyorders_product_id === updated.easyorders_product_id);
        if (p) {
          updated.product_id = p.id;
          if (!updated.product_name) updated.product_name = p.name;
          if (!updated.price) updated.price = Number(p.price) || 0;
          linkedProducts++;
        }
      }
      // 2) Resolve variant + warehouse code
      const prod = products.find((x) => x.id === updated.product_id);
      if (prod) {
        const eoMap = (prod.variant_easyorders_ids || {}) as Record<string, string>;
        const whMap = (prod.variant_warehouse_codes || {}) as Record<string, string>;
        let variantKey: string | null = null;
        // Match by EO variant id
        if (updated.easyorders_variant_id) {
          for (const [k, v] of Object.entries(eoMap)) {
            if (String(v) === String(updated.easyorders_variant_id)) { variantKey = k; break; }
          }
        }
        // Match by color/size
        if (!variantKey) {
          const candidates = [
            [updated.selected_color, updated.selected_size].filter(Boolean).join(" - "),
            updated.selected_color || "",
            updated.selected_size || "",
            updated.selected_product_code || "",
          ].filter(Boolean) as string[];
          for (const k of candidates) if (whMap[k] || eoMap[k]) { variantKey = k; break; }
        }
        if (variantKey) {
          const parts = variantKey.split(" - ").map((x) => x.trim());
          const colors = prod.colors || [];
          const sizes = prod.sizes || [];
          const codes = prod.product_codes || [];
          for (const part of parts) {
            if (colors.includes(part)) updated.selected_color = part;
            else if (sizes.includes(part)) updated.selected_size = part;
            else if (codes.includes(part)) updated.selected_product_code = part;
          }
          if (whMap[variantKey] && !updated.warehouse_code) {
            updated.warehouse_code = whMap[variantKey];
            linkedWarehouse++;
          }
          if (eoMap[variantKey] && !updated.easyorders_variant_id) {
            updated.easyorders_variant_id = eoMap[variantKey];
          }
        }
      }
      if (!updated.product_id || !updated.warehouse_code) stillMissing++;
      return updated;
    });
    setItems(next);
    if (linkedProducts === 0 && linkedWarehouse === 0) {
      toast({
        title: "لم يتم العثور على روابط جديدة",
        description: stillMissing > 0
          ? "تأكد من ربط المنتج المحلي مع منتج EasyOrders ومتغيراته أولاً، ثم أعد المحاولة."
          : "كل المنتجات مربوطة بالفعل.",
        variant: stillMissing > 0 ? "destructive" : "default",
      });
    } else {
      toast({
        title: "تم تحديث الربط",
        description: `تم ربط ${linkedProducts} منتج و ${linkedWarehouse} كود مخزن. اضغط "حفظ التعديلات" للحفظ.`,
      });
    }
  };

  const save = async () => {
    if (!data || !orderId) return;
    // التحقق من الحقول الإلزامية: رقم الهاتف، المدينة، المنطقة، ومنتج واحد على الأقل
    const phoneVal = String(data.phone ?? "").trim();
    const cityVal = String((data.matched_zone_name ?? data.city) ?? "").trim();
    const areaVal = String((data.matched_area_name ?? data.address) ?? "").trim();
    const hasProduct = items.length > 0
      ? items.every((it) => it.product_id || (it.product_name && it.product_name.trim()))
      : !!(data.product_id || (data.product_name && String(data.product_name).trim()));
    const missing: string[] = [];
    if (!phoneVal) missing.push("رقم الهاتف");
    if (!cityVal) missing.push("المدينة");
    if (!areaVal) missing.push("المنطقة");
    if (!hasProduct) missing.push("المنتج");
    if (missing.length > 0) {
      toast({
        title: "حقول إلزامية ناقصة",
        description: `يرجى تعبئة: ${missing.join("، ")}`,
        variant: "destructive",
      });
      return;
    }
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
    // Recompute link_error based on current items so the warning clears after a successful retry-link
    const newLinkErrors: string[] = [];
    for (const it of items) {
      const prod = products.find((p) => p.id === it.product_id);
      const key = `${it.selected_color || ""} - ${it.selected_size || ""}`;
      const wh = prod?.variant_warehouse_codes?.[key] || it.warehouse_code || null;
      const eoVar = prod?.variant_easyorders_ids?.[key] || it.easyorders_variant_id || null;
      const name = it.product_name || "منتج";
      if (!it.product_id) {
        newLinkErrors.push(`المنتج "${name}" (EO: ${it.easyorders_product_id || "—"}) غير مرتبط بأي منتج محلي`);
      } else if (eoVar && !wh) {
        newLinkErrors.push(`متغير المنتج "${name}" (متغير EO: ${eoVar}) غير مرتبط بكود مخزن شركة الشحن`);
      }
    }
    payload.link_error = newLinkErrors.length > 0 ? newLinkErrors.join(" | ") : null;
    payload.matched_zone_name = data.matched_zone_name ?? null;
    payload.matched_area_name = data.matched_area_name ?? null;
    payload.matched_zone_id = data.matched_zone_id ?? null;
    payload.matched_area_id = data.matched_area_id ?? null;
    payload.city = data.city ?? null;
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
        const key = [it.selected_color, it.selected_size].filter(Boolean).join(" - ")
          || it.selected_color || it.selected_size || it.selected_product_code || "";
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
          <>
          {data.locked_insufficient_balance && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm mb-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>الطلب مقفل بسبب نفاد الرصيد — لا يمكن إرساله لشركة التوصيل حتى شحن المحفظة.</span>
            </div>
          )}
          {originalInput && (originalInput.city || originalInput.address || originalInput.variant) && (
            <div className="p-3 rounded-md bg-muted/50 border border-border text-sm mb-2 space-y-1">
              <div className="font-medium text-foreground">ما كتبه الزبون في النموذج:</div>
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">المدينة/المنطقة: </span>
                {originalInput.city || "—"}
              </div>
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">العنوان: </span>
                {originalInput.address || "—"}
              </div>
              {originalInput.variant && (
                <div className="text-muted-foreground" dir="rtl">
                  <span className="font-medium text-foreground">المتغير المختار: </span>
                  <span dir="ltr" className="inline-block">{isolateLatin(originalInput.variant)}</span>
                </div>
              )}
              {originalInput.quantity != null && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">الكمية: </span>
                  {originalInput.quantity}
                </div>
              )}
            </div>
          )}
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
                <Label>المدينة (شركة الشحن)</Label>
                <SearchableSelect
                  options={zones.map((z) => ({ value: z.name, label: z.name }))}
                  value={(data?.matched_zone_name || data?.city) ?? ""}
                  onChange={onZoneChange}
                  placeholder={loadingZones ? "جاري التحميل..." : "اختر المدينة"}
                  searchPlaceholder="ابحث عن مدينة..."
                />
              </div>
              <div className="space-y-1">
                <Label>المنطقة (شركة الشحن)</Label>
                <SearchableSelect
                  options={currentAreas.map((a) => ({ value: a.name, label: a.name }))}
                  value={data?.matched_area_name ?? ""}
                  onChange={onAreaChange}
                  disabled={!selectedZone}
                  placeholder={!selectedZone ? "اختر المدينة أولاً" : (loadingAreas ? "جاري التحميل..." : (currentAreas.length === 0 ? "لا مناطق" : "اختر المنطقة"))}
                  searchPlaceholder="ابحث عن منطقة..."
                />
              </div>
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
                <div className="flex gap-2">
                  {eoEnabled && <Button type="button" size="sm" variant="outline" onClick={retryLinking} title="يحاول ربط المنتجات والمتغيرات بناءً على معرفات EasyOrders">
                    <Link2 className="w-4 h-4 ml-1" /> إعادة محاولة الربط
                  </Button>}
                  <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="w-4 h-4 ml-1" /> إضافة منتج
                  </Button>
                </div>
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
                        {eoEnabled && <>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">الاسم المجلوب من ايزي اوردرز:</span>
                          <span className="font-medium text-foreground truncate">{isolateLatin(it.product_name) || "—"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">معرف منتج ايزي اوردرز:</span>
                          <span className="font-mono text-foreground truncate" title={it.easyorders_product_id || ""}>{it.easyorders_product_id || "—"}</span>
                        </div>
                        </>}
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">اسم المتغير:</span>
                          <span className="font-medium text-foreground truncate">
                            {isolateLatin([it.selected_color, it.selected_size, it.selected_product_code].filter(Boolean).join(" - ")) || "—"}
                          </span>
                        </div>
                        {eoEnabled && <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">معرف متغير ايزي اوردرز:</span>
                          <span className="font-mono text-foreground truncate" title={resolvedEoVar || ""}>{resolvedEoVar || "—"}</span>
                        </div>}
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
          </>
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
