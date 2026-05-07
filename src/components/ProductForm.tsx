import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "@/components/ImageUpload";
import RichTextEditor from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductFormData {
  name: string;
  slug: string;
  price: string;
  originalPrice: string;
  purchasePrice: string;
  stock: string;
  variantStock: Record<string, string>;
  variantWarehouseCodes: Record<string, string>;
  variantEasyOrdersIds: Record<string, string>;
  easyOrdersProductId: string;
  description: string;
  images: string[];
  features: string;
  productCodes: string;
  colors: string;
  sizes: string;
}

interface ProductFormProps {
  product: ProductFormData;
  onProductChange: (product: ProductFormData) => void;
  onSubmit: () => void;
  submitText: string;
  isLoading?: boolean;
}

// Build variant keys from colors/sizes/codes (same logic used in inventory page)
export const buildVariantKeys = (
  colorsCsv: string,
  sizesCsv: string,
  codesCsv: string
): string[] => {
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const colors = split(colorsCsv);
  const sizes = split(sizesCsv);
  const codes = split(codesCsv);

  const keys: string[] = [];
  if (colors.length && sizes.length) {
    colors.forEach((c) => sizes.forEach((s) => keys.push(`${c} - ${s}`)));
  } else if (colors.length) {
    keys.push(...colors);
  } else if (sizes.length) {
    keys.push(...sizes);
  }
  if (codes.length) {
    codes.forEach((c) => {
      if (!keys.includes(c)) keys.push(c);
    });
  }
  return keys;
};

const ProductForm = ({ product, onProductChange, onSubmit, submitText, isLoading }: ProductFormProps) => {
  const updateField = <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => {
    onProductChange({ ...product, [field]: value });
  };

  const [whProducts, setWhProducts] = useState<Array<{ external_id: number; code: string | null; name: string | null }>>([]);
  const [eoProducts, setEoProducts] = useState<Array<{ external_id: string; name: string | null; sku: string | null; variants: any }>>([]);
  useEffect(() => {
    supabase.from("shipping_warehouse_products").select("external_id, code, name").order("name").then(({ data }) => {
      setWhProducts(data || []);
    });
    supabase.from("easyorders_products").select("external_id, name, sku, variants").order("name").then(({ data }) => {
      setEoProducts((data || []) as any);
    });
  }, []);

  const selectedEoProduct = eoProducts.find((p) => p.external_id === product.easyOrdersProductId);
  const eoVariants: Array<{ id: string; name: string | null; sku: string | null; props: any[] }> = Array.isArray(selectedEoProduct?.variants)
    ? (selectedEoProduct!.variants as any[]).map((v) => ({
        id: String(v.id ?? ""),
        name: v.name ?? (Array.isArray(v.variation_props) ? v.variation_props.map((p: any) => p.variation_prop).join(" / ") : null),
        sku: v.sku ?? null,
        props: Array.isArray(v.variation_props) ? v.variation_props : [],
      })).filter((v) => v.id)
    : [];

  const variantKeys = buildVariantKeys(product.colors, product.sizes, product.productCodes);
  const hasVariants = variantKeys.length > 0;

  // Normalize Arabic for matching
  const norm = (s: string) => (s || "").toString().trim()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه")
    .replace(/\s+/g, " ").toLowerCase();

  const autoLinkEoVariants = (overwrite: boolean) => {
    if (!eoVariants.length || !variantKeys.length) return;
    const next: Record<string, string> = { ...(product.variantEasyOrdersIds || {}) };
    let linked = 0;
    for (const key of variantKeys) {
      if (!overwrite && next[key]) continue;
      const parts = key.split(" - ").map((x) => norm(x));
      const match = eoVariants.find((v) => {
        const vals = (v.props || []).map((p: any) => norm(p?.variation_prop || ""));
        if (!vals.length) return false;
        return parts.every((p) => vals.includes(p)) && vals.length === parts.length;
      });
      if (match) { next[key] = match.id; linked++; }
    }
    onProductChange({ ...product, variantEasyOrdersIds: next });
    return linked;
  };

  // Auto-link on first EO product selection (only fills empty mappings)
  useEffect(() => {
    if (!product.easyOrdersProductId || !eoVariants.length || !variantKeys.length) return;
    const empty = variantKeys.every((k) => !product.variantEasyOrdersIds?.[k]);
    if (empty) autoLinkEoVariants(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.easyOrdersProductId, eoProducts.length]);

  const updateVariantQty = (key: string, value: string) => {
    onProductChange({
      ...product,
      variantStock: { ...product.variantStock, [key]: value },
    });
  };

  const updateVariantWhCode = (key: string, value: string) => {
    onProductChange({
      ...product,
      variantWarehouseCodes: { ...product.variantWarehouseCodes, [key]: value },
    });
  };

  const updateVariantEoId = (key: string, value: string) => {
    onProductChange({
      ...product,
      variantEasyOrdersIds: { ...product.variantEasyOrdersIds, [key]: value },
    });
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Images Upload */}
      <div className="space-y-2">
        <Label>صور المنتج *</Label>
        <ImageUpload
          images={product.images}
          onImagesChange={(images) => updateField("images", images)}
          maxImages={5}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>اسم المنتج *</Label>
          <Input
            value={product.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="أدخل اسم المنتج"
          />
        </div>
        <div className="space-y-2">
          <Label>رابط المنتج *</Label>
          <Input
            value={product.slug}
            onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
            placeholder="hair-oil"
            dir="ltr"
            className="text-left"
          />
          <p className="text-xs text-muted-foreground">استخدم أحرف إنجليزية فقط، مثال: /p/hair-oil</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>السعر *</Label>
          <Input
            value={product.price}
            onChange={(e) => updateField("price", e.target.value)}
            placeholder="99"
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label>السعر قبل الخصم</Label>
          <Input
            value={product.originalPrice}
            onChange={(e) => updateField("originalPrice", e.target.value)}
            placeholder="149"
            type="number"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>سعر الشراء (التكلفة)</Label>
        <Input
          value={product.purchasePrice}
          onChange={(e) => updateField("purchasePrice", e.target.value)}
          placeholder="0"
          type="number"
        />
        <p className="text-xs text-muted-foreground">يُستخدم لحساب الربح في الحسابات المالية</p>
      </div>

      <div className="space-y-2">
        <Label>الوصف التفصيلي</Label>
        <RichTextEditor
          value={product.description}
          onChange={(value) => updateField("description", value)}
          placeholder="أضف وصف تفصيلي للمنتج مع صور وفيديوهات..."
        />
      </div>

      <div className="space-y-2">
        <Label>المميزات (سطر لكل ميزة)</Label>
        <Textarea
          value={product.features}
          onChange={(e) => updateField("features", e.target.value)}
          placeholder="جودة عالية&#10;شحن مجاني&#10;ضمان سنة"
          rows={4}
        />
      </div>

      {/* Optional Variant Fields */}
      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">خيارات المنتج (اختياري)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          أضف هذه الخيارات إذا كان للمنتج أكواد أو ألوان أو مقاسات متعددة
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>أكواد المنتج (افصل بين كل كود بفاصلة)</Label>
            <Input
              value={product.productCodes}
              onChange={(e) => updateField("productCodes", e.target.value)}
              placeholder="مثال: SKU-001, SKU-002, SKU-003"
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <Label>الألوان المتاحة (افصل بين كل لون بفاصلة)</Label>
            <Input
              value={product.colors}
              onChange={(e) => updateField("colors", e.target.value)}
              placeholder="مثال: أحمر, أزرق, أسود"
            />
          </div>

          <div className="space-y-2">
            <Label>المقاسات المتاحة (افصل بين كل مقاس بفاصلة)</Label>
            <Input
              value={product.sizes}
              onChange={(e) => updateField("sizes", e.target.value)}
              placeholder="مثال: S, M, L, XL"
            />
          </div>
        </div>
      </div>

      {/* Stock Management */}
      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">المخزون *</h3>

        {hasVariants ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              أدخل عدد القطع المتوفرة لكل متغير. سيظهر هذا في صفحة المخزون.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {variantKeys.map((key) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg bg-muted/30">
                  <Label className="flex-1 truncate">{key}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={product.variantStock[key] ?? ""}
                      onChange={(e) => updateVariantQty(key, e.target.value)}
                      placeholder="الكمية"
                      className="w-24"
                    />
                    <Select
                      value={product.variantWarehouseCodes?.[key] || "__none__"}
                      onValueChange={(v) => updateVariantWhCode(key, v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="منتج المخزن (شركة الشحن)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— بدون ربط (طلبية عادية) —</SelectItem>
                        {whProducts.map((p) => (
                          <SelectItem key={p.external_id} value={String(p.external_id)}>
                            {p.name || `#${p.external_id}`}{p.code ? ` (${p.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {eoVariants.length > 0 && (
                      <Select
                        value={product.variantEasyOrdersIds?.[key] || "__none__"}
                        onValueChange={(v) => updateVariantEoId(key, v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="متغير EasyOrders" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— غير مرتبط —</SelectItem>
                          {eoVariants.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name || `#${v.id}`}{v.sku ? ` (${v.sku})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>الكمية المتوفرة</Label>
            <Input
              type="number"
              min="0"
              value={product.stock}
              onChange={(e) => updateField("stock", e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              عدد القطع المتوفرة من هذا المنتج (عند عدم وجود متغيرات)
            </p>
          </div>
        )}
      </div>

      {/* EasyOrders linking */}
      <div className="border-t pt-6 mt-6 space-y-3">
        <h3 className="text-lg font-semibold">ربط بمنتج EasyOrders (اختياري)</h3>
        <p className="text-sm text-muted-foreground">
          عند استلام طلب من EasyOrders، يستخدم هذا الربط لتحديد المنتج المحلي ومتغيره تلقائياً.
        </p>
        <Select
          value={product.easyOrdersProductId || "__none__"}
          onValueChange={(v) => updateField("easyOrdersProductId", v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="اختر منتج EasyOrders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— غير مرتبط —</SelectItem>
            {eoProducts.map((p) => (
              <SelectItem key={p.external_id} value={p.external_id}>
                {p.name || `#${p.external_id}`}{p.sku ? ` (${p.sku})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {eoProducts.length === 0 && (
          <p className="text-xs text-muted-foreground">
            لا توجد منتجات. اذهب إلى "حسابي" واضغط "مزامنة منتجات EasyOrders".
          </p>
        )}
      </div>

      <Button onClick={onSubmit} className="w-full gradient-primary text-primary-foreground" disabled={isLoading}>
        {isLoading ? "جاري الحفظ..." : submitText}
      </Button>
    </div>
  );
};

export default ProductForm;
