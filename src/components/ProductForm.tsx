import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "@/components/ImageUpload";
import RichTextEditor from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ImageIcon,
  Tag,
  DollarSign,
  FileText,
  Sparkles,
  Layers,
  TrendingUp,
  Link2,
  Boxes,
} from "lucide-react";

const SectionCard = ({
  icon: Icon,
  title,
  description,
  iconColor = "bg-blue-500",
  children,
}: {
  icon: any;
  title: string;
  description?: string;
  iconColor?: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
    <div className="flex items-start gap-3 px-4 py-3 border-b bg-muted/40">
      <div className={`w-9 h-9 rounded-lg ${iconColor} text-white flex items-center justify-center shadow-sm shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-foreground leading-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

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
  variantSkus: Record<string, string>;
  easyOrdersProductId: string;
  description: string;
  images: string[];
  features: string;
  productCodes: string;
  colors: string;
  sizes: string;
  warehouseLinked: boolean;
  upsellEnabled: boolean;
  upsellTitle?: string;
  upsellOffers: Array<{ quantity: string; price: string; label: string }>;
  categoryId?: string | null;
}

interface ProductFormProps {
  product: ProductFormData;
  onProductChange: (product: ProductFormData) => void;
  onSubmit: () => void;
  submitText: string;
  isLoading?: boolean;
  /**
   * "product" = بيانات المنتج فقط (بدون slug، وصف ثري، upsell، مميزات)
   * "landing" = نموذج كامل (للاستخدام القديم/صفحة الهبوط)
   */
  mode?: "product" | "landing";
  categories?: Array<{ id: string; name: string }>;
  /** عند true يتم تعطيل تعديل كميات المخزون (تعديل من صفحة المخزون فقط) */
  readOnlyStock?: boolean;
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
  // Only treat product_codes as variant keys when the product has NO colors and NO sizes.
  // When colors/sizes exist, codes are per-variant SKUs (stored in variant_skus) — not separate variants.
  if (keys.length === 0 && codes.length) {
    codes.forEach((c) => {
      if (!keys.includes(c)) keys.push(c);
    });
  }
  return keys;
};

const parseTags = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const joinTags = (arr: string[]) => arr.join(", ");

const TagsField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => {
  const [input, setInput] = useState("");
  const tags = parseTags(value);
  const addTag = (text: string) => {
    const t = text.trim();
    if (!t) return;
    if (tags.includes(t)) return;
    onChange(joinTags([...tags, t]));
    setInput("");
  };
  const removeTag = (idx: number) => {
    const next = tags.filter((_, i) => i !== idx);
    onChange(joinTags(next));
  };
  return (
    <div className="space-y-2">
      <Label className="font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-2 p-2 rounded-md border border-input bg-background min-h-[2.5rem] items-center">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="ml-1 leading-none text-primary/70 hover:text-primary"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(input);
            } else if (e.key === "Backspace" && !input && tags.length) {
              removeTag(tags.length - 1);
            }
          }}
          onBlur={() => {
            if (input.trim()) addTag(input);
          }}
          placeholder={tags.length ? "" : placeholder}
          className="flex-1 min-w-[6rem] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
};

const ProductForm = ({ product, onProductChange, onSubmit, submitText, isLoading, mode = "landing", categories = [], readOnlyStock = false }: ProductFormProps) => {
  const isLandingMode = mode === "landing";
  const updateField = <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => {
    onProductChange({ ...product, [field]: value });
  };

  // توليد SKU تلقائي لجميع المتغيرات
  const autoGenerateSkus = (overwrite: boolean) => {
    const keys = buildVariantKeys(product.colors, product.sizes, product.productCodes);
    if (keys.length === 0) return;
    const base = (product.name || "SKU")
      .replace(/[\u064B-\u0652\u0670]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 4) || "SKU";
    const next: Record<string, string> = { ...(product.variantSkus || {}) };
    keys.forEach((k, idx) => {
      if (!overwrite && next[k]) return;
      const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      next[k] = `${base}-${String(idx + 1).padStart(2, "0")}-${rand}`;
    });
    onProductChange({ ...product, variantSkus: next });
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
    ? (selectedEoProduct!.variants as any[]).map((v) => {
        const props = Array.isArray(v.variation_props)
          ? v.variation_props
          : (Array.isArray(v.props) ? v.props : []);
        const fromProps = props.map((p: any) => p?.variation_prop).filter(Boolean).join(" - ");
        const rawName = (v.name ?? "").toString().trim();
        const sku = (v.sku ?? "").toString().trim() || null;
        // إذا كان الاسم فارغاً أو مطابقاً للـ SKU، نبنيه من خصائص الفروقات (لون - مقاس)
        const displayName = rawName && rawName !== (sku || "") ? rawName : (fromProps || rawName || null);
        return {
          id: String(v.id ?? ""),
          name: displayName,
          sku,
          props,
        };
      }).filter((v) => v.id)
    : [];

  const variantKeys = buildVariantKeys(product.colors, product.sizes, product.productCodes);
  const hasVariants = variantKeys.length > 0;
  const hasColorOrSize = !!(product.colors?.trim() || product.sizes?.trim());

  // Toggle: does this product have variants (colors/sizes) or is it a single-SKU product?
  const [variantsEnabled, setVariantsEnabled] = useState<boolean>(
    !!(product.colors?.trim() || product.sizes?.trim())
  );
  useEffect(() => {
    if (product.colors?.trim() || product.sizes?.trim()) setVariantsEnabled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.colors, product.sizes]);

  const toggleVariants = (enabled: boolean) => {
    setVariantsEnabled(enabled);
    if (enabled) {
      // switching to variants → clear single product code
      if (product.productCodes?.trim()) {
        onProductChange({ ...product, productCodes: "" });
      }
    } else {
      // switching to single SKU → clear colors/sizes
      if (product.colors?.trim() || product.sizes?.trim()) {
        onProductChange({ ...product, colors: "", sizes: "" });
      }
    }
  };

  // Normalize Arabic for matching
  const norm = (s: string) => (s || "").toString().trim()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه")
    .replace(/\s+/g, " ").toLowerCase();

  // Token-aware match: local part appears as a standalone token within EO variation_prop
  const valueMatches = (localPart: string, eoVal: string) => {
    const lp = norm(localPart);
    const ev = norm(eoVal);
    if (!lp || !ev) return false;
    if (lp === ev) return true;
    const tokens = ev.split(/[\s\-_/،,]+/).filter(Boolean);
    if (tokens.includes(lp)) return true;
    if (ev.startsWith(lp + " ")) return true;
    return false;
  };

  // Tokenize a normalized string into search tokens
  const tokenize = (s: string) => norm(s).split(/[\s\-_/،,()]+/).filter((t) => t && t.length > 0);

  // Score how well a candidate text matches the target tokens (higher = better)
  // - exact full match: huge bonus
  // - each target token found as a token in candidate: +3
  // - each target token found as substring: +1
  const scoreMatch = (targetText: string, candidateText: string): number => {
    const t = norm(targetText);
    const c = norm(candidateText);
    if (!t || !c) return 0;
    if (t === c) return 100;
    const tTokens = tokenize(targetText);
    const cTokens = new Set(tokenize(candidateText));
    let score = 0;
    for (const tk of tTokens) {
      if (cTokens.has(tk)) score += 3;
      else if (c.includes(tk)) score += 1;
    }
    // small bonus if candidate contains the full target as substring
    if (c.includes(t)) score += 2;
    return score;
  };

  const autoLinkEoVariants = (overwrite: boolean) => {
    if (!eoVariants.length || !variantKeys.length) return;
    const next: Record<string, string> = { ...(product.variantEasyOrdersIds || {}) };
    let linked = 0;
    const used = new Set<string>(Object.values(next));
    for (const key of variantKeys) {
      if (!overwrite && next[key]) continue;
      const parts = key.split(" - ").map((x) => x.trim()).filter(Boolean);
      // المرحلة 1: المطابقة بين المتغيرات في ايزي اوردر والمحلي بالاسم فقط
      // 1) Strict: all parts match EO props with same arity (exact value match)
      let match = eoVariants.find((v) => {
        if (!overwrite && used.has(v.id)) return false;
        const vals: string[] = (v.props || []).map((p: any) => p?.variation_prop || "");
        if (vals.length !== parts.length) return false;
        return parts.every((p) => vals.some((vv) => valueMatches(p, vv)));
      });
      // 2) Loose by name/props: pick best-scoring EO variant whose name/props contain all parts (SKU excluded)
      if (!match) {
        let bestScore = 0;
        let best: typeof eoVariants[number] | undefined;
        for (const v of eoVariants) {
          if (!overwrite && used.has(v.id)) continue;
          const haystack = [
            v.name || "",
            ...(v.props || []).map((p: any) => p?.variation_prop || ""),
          ].join(" ");
          // require all key parts to appear (token or substring) before scoring
          const allFound = parts.every((p) => scoreMatch(p, haystack) > 0);
          if (!allFound) continue;
          const sc = scoreMatch(key, haystack);
          if (sc > bestScore) { bestScore = sc; best = v; }
        }
        if (best && bestScore >= 3) match = best;
      }
      // 3) Fallback: SKU exact equality (only if no name match found)
      if (!match) match = eoVariants.find((v) => {
        if (!v.sku) return false;
        if (!overwrite && used.has(v.id)) return false;
        const sk = norm(v.sku);
        if (norm(key) === sk) return true;
        return parts.some((p) => norm(p) === sk);
      });
      if (match) { next[key] = match.id; used.add(match.id); linked++; }
    }
    onProductChange({ ...product, variantEasyOrdersIds: next });
    return linked;
  };

  // المرحلة 2: المطابقة بين المحلي وشركة الشحن.
  // ناخذ ال SKU من متغير EasyOrders المربوط بالمتغير المحلي ونطابقه مع code لدى شركة الشحن.
  const autoLinkWarehouseVariants = (overwrite: boolean) => {
    if (!whProducts.length || !variantKeys.length) return 0;
    const next: Record<string, string> = { ...(product.variantWarehouseCodes || {}) };
    const eoMap = product.variantEasyOrdersIds || {};
    let linked = 0;
    for (const key of variantKeys) {
      if (!overwrite && next[key]) continue;
      const eoId = eoMap[key];
      if (!eoId) continue; // يتطلب أولاً ربط متغير EasyOrders
      const eoVar = eoVariants.find((v) => v.id === eoId);
      const sku = eoVar?.sku ? norm(eoVar.sku) : "";
      if (!sku) continue;
      const match = whProducts.find((w) => w.code && norm(w.code) === sku);
      if (match) { next[key] = String(match.external_id); linked++; }
    }
    onProductChange({ ...product, variantWarehouseCodes: next });
    return linked;
  };

  // Auto-link EO variants whenever there are any unlinked local variants
  // (works in both create and edit modes, even when some variants already linked).
  useEffect(() => {
    if (!product.easyOrdersProductId || !eoVariants.length || !variantKeys.length) return;
    const hasEmpty = variantKeys.some((k) => !product.variantEasyOrdersIds?.[k]);
    if (hasEmpty) autoLinkEoVariants(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.easyOrdersProductId, eoProducts.length, variantKeys.join("|")]);

  // Auto-link warehouse products بعد توفر ربط EasyOrders + قائمة المخزن (المرحلة 2)
  useEffect(() => {
    if (!whProducts.length || !variantKeys.length) return;
    // ربط أي متغير فيه EO link لكنه بدون كود مخزن — لا نشترط أن تكون كل الخانات فارغة
    const needsLink = variantKeys.some(
      (k) => product.variantEasyOrdersIds?.[k] && !product.variantWarehouseCodes?.[k]
    );
    if (needsLink) autoLinkWarehouseVariants(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whProducts.length, variantKeys.join("|"), JSON.stringify(product.variantEasyOrdersIds || {})]);

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

  const updateVariantSku = (key: string, value: string) => {
    onProductChange({
      ...product,
      variantSkus: { ...(product.variantSkus || {}), [key]: value },
    });
  };

  return (
    <div className="space-y-5 mt-4">
      {/* Images */}
      <SectionCard icon={ImageIcon} title="صور المنتج" description="ارفع حتى 5 صور — الصورة الأولى هي الرئيسية" iconColor="bg-purple-500">
        <ImageUpload
          images={product.images}
          onImagesChange={(images) => updateField("images", images)}
          maxImages={5}
        />
      </SectionCard>

      {/* Basic Info */}
      <SectionCard icon={Tag} title="المعلومات الأساسية" description={isLandingMode ? "اسم المنتج والرابط الفريد" : "اسم المنتج"} iconColor="bg-blue-500">
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4`}>
          <div className="space-y-2">
            <Label className="font-semibold">اسم المنتج <span className="text-red-500">*</span></Label>
            <Input
              value={product.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="أدخل اسم المنتج"
            />
          </div>
          {isLandingMode && (
          <div className="space-y-2">
            <Label className="font-semibold">رابط المنتج <span className="text-red-500">*</span></Label>
            <Input
              value={product.slug}
              onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
              placeholder="hair-oil"
              dir="ltr"
              className="text-left font-mono"
            />
            <p className="text-xs text-muted-foreground">أحرف إنجليزية فقط — مثال: /p/hair-oil</p>
          </div>
          )}
          <div className="space-y-2">
            <Label className="font-semibold">القسم</Label>
            <Select
              value={product.categoryId || "__none__"}
              onValueChange={(v) => updateField("categoryId", v === "__none__" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="بدون قسم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون قسم</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">يمكنك إنشاء الأقسام من تبويب «الأقسام»</p>
          </div>
        </div>
      </SectionCard>

      {/* Pricing */}
      <SectionCard icon={DollarSign} title="التسعير" description="حدد سعر البيع وسعر التكلفة لحساب الأرباح" iconColor="bg-emerald-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">السعر <span className="text-red-500">*</span></Label>
            <Input
              value={product.price}
              onChange={(e) => updateField("price", e.target.value)}
              placeholder="99"
              type="number"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">السعر قبل الخصم</Label>
            <Input
              value={product.originalPrice}
              onChange={(e) => updateField("originalPrice", e.target.value)}
              placeholder="149"
              type="number"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">سعر الشراء</Label>
            <Input
              value={product.purchasePrice}
              onChange={(e) => updateField("purchasePrice", e.target.value)}
              placeholder="0"
              type="number"
            />
            <p className="text-xs text-muted-foreground">يُستخدم لحساب الربح</p>
          </div>
        </div>
      </SectionCard>

      {/* Description */}
      {isLandingMode && (
      <SectionCard icon={FileText} title="الوصف التفصيلي" description="أضف وصفاً غنياً مع صور وفيديوهات" iconColor="bg-indigo-500">
        <RichTextEditor
          value={product.description}
          onChange={(value) => updateField("description", value)}
          placeholder="أضف وصف تفصيلي للمنتج مع صور وفيديوهات..."
        />
      </SectionCard>
      )}

      {/* Features */}
      {isLandingMode && (
      <SectionCard icon={Sparkles} title="مميزات المنتج" description="سطر واحد لكل ميزة" iconColor="bg-amber-500">
        <Textarea
          value={product.features}
          onChange={(e) => updateField("features", e.target.value)}
          placeholder="جودة عالية&#10;شحن مجاني&#10;ضمان سنة"
          rows={4}
        />
      </SectionCard>
      )}

      {/* Variants */}
      <SectionCard icon={Layers} title="خيارات المنتج" description="ألوان، مقاسات، أو أكواد متعددة (اختياري)" iconColor="bg-pink-500">
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border-2 border-dashed bg-muted/40">
          <div className="flex-1 min-w-0">
            <Label className="block font-semibold">مرتبط بالتخزين بشركة التوصيل</Label>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              عند التفعيل: تُرسل الطلبية لشركة الشحن مع خصم المنتج من مخزنها.
              عند الإيقاف: تُرسل كطلبية عادية دون ربط بمخزن الشركة.
            </p>
          </div>
          <Switch
            checked={product.warehouseLinked !== false}
            onCheckedChange={(v) => updateField("warehouseLinked", v)}
          />
        </div>

        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border-2 border-dashed bg-muted/40">
          <div className="flex-1 min-w-0">
            <Label className="block font-semibold">المنتج يحتوي على متغيرات</Label>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              فعّل هذا الخيار إذا كان المنتج يأتي بألوان أو مقاسات متعددة. عند الإيقاف يُستخدم كود (SKU) واحد للمنتج كاملاً.
            </p>
          </div>
          <Switch checked={variantsEnabled} onCheckedChange={toggleVariants} />
        </div>

        {variantsEnabled ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <TagsField
                  label="الألوان المتاحة"
                  value={product.colors}
                  onChange={(v) => updateField("colors", v)}
                  placeholder="أحمر"
                />
              </div>
              <div className="space-y-2">
                <TagsField
                  label="المقاسات المتاحة"
                  value={product.sizes}
                  onChange={(v) => updateField("sizes", v)}
                  placeholder="XL"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              اكتب المتغير واضغط Enter لإضافته. يمكنك تعيين كود (SKU) لكل توليفة من جدول المخزون أدناه.
            </p>
            {hasVariants && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t mt-1">
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                  onClick={() => autoGenerateSkus(false)}
                >
                  إنشاء الأكواد تلقائياً
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => autoGenerateSkus(true)}
                >
                  إعادة إنشاء (استبدال الكل)
                </Button>
                <p className="text-[11px] text-muted-foreground">يقوم النظام بتوليد SKU فريد لكل متغير تلقائياً.</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <Label className="font-semibold">كود المنتج (SKU)</Label>
            <Input
              value={product.productCodes}
              onChange={(e) => updateField("productCodes", e.target.value.replace(/,.*$/, ""))}
              placeholder="SKU-001"
              dir="ltr"
              className="text-left font-mono"
            />
            <p className="text-[11px] text-muted-foreground">كود واحد للمنتج كاملاً (بدون متغيرات).</p>
          </div>
        )}
      </SectionCard>

      {/* Upsell Offers */}
      {isLandingMode && (
      <SectionCard icon={TrendingUp} title="عروض Upsell" description="اعرض حزم بكميات أكبر بأسعار مميزة" iconColor="bg-orange-500">
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border-2 border-dashed bg-muted/40">
          <div className="flex-1 min-w-0">
            <Label className="block font-semibold">تفعيل عروض Upsell</Label>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              اعرض على المشتري عروض كمية بأسعار خاصة (مثال: اشترِ 4 قطع بسعر 320). عند اختيار العرض في صفحة الهبوط يتم تحديث الكمية والسعر تلقائياً.
            </p>
          </div>
          <Switch
            checked={!!product.upsellEnabled}
            onCheckedChange={(v) => updateField("upsellEnabled", v)}
          />
        </div>

        {product.upsellEnabled && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">عنوان قسم العروض (يظهر للمشتري)</Label>
              <Input
                value={product.upsellTitle ?? ""}
                onChange={(e) => updateField("upsellTitle" as any, e.target.value as any)}
                placeholder="🎁 عروض خاصة"
              />
            </div>
            {(product.upsellOffers || []).map((offer, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-[6rem_8rem_1fr_auto] gap-2 p-3 border rounded-lg bg-muted/20 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">عدد القطع</Label>
                  <Input
                    type="number"
                    min="1"
                    value={offer.quantity}
                    onChange={(e) => {
                      const next = [...product.upsellOffers];
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      updateField("upsellOffers", next);
                    }}
                    placeholder="4"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">السعر الإجمالي</Label>
                  <Input
                    type="number"
                    min="0"
                    value={offer.price}
                    onChange={(e) => {
                      const next = [...product.upsellOffers];
                      next[idx] = { ...next[idx], price: e.target.value };
                      updateField("upsellOffers", next);
                    }}
                    placeholder="320"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">وصف العرض (يظهر للمشتري)</Label>
                  <Input
                    value={offer.label}
                    onChange={(e) => {
                      const next = [...product.upsellOffers];
                      next[idx] = { ...next[idx], label: e.target.value };
                      updateField("upsellOffers", next);
                    }}
                    placeholder="اشترِ 4 قطع بسعر 320 + شحن مجاني"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="bg-red-500 hover:bg-red-600 text-white border-none shadow-md hover:shadow-lg transition-all"
                  onClick={() => {
                    const next = product.upsellOffers.filter((_, i) => i !== idx);
                    updateField("upsellOffers", next);
                  }}
                >
                  حذف
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg transition-all"
              onClick={() =>
                updateField("upsellOffers", [
                  ...(product.upsellOffers || []),
                  { quantity: "", price: "", label: "" },
                ])
              }
            >
              + إضافة عرض
            </Button>
          </div>
        )}
      </SectionCard>
      )}

      {/* EasyOrders linking — يظهر قبل قسم المخزون لاختيار المنتج الرئيسي أولاً */}
      <SectionCard icon={Link2} title="المنتج الرئيسي في EasyOrders" description="اختر منتج EasyOrders لربط متغيراته" iconColor="bg-cyan-500">
        <SearchableSelect
          value={product.easyOrdersProductId || "__none__"}
          onChange={(v) => updateField("easyOrdersProductId", v === "__none__" ? "" : v)}
          placeholder="اختر منتج EasyOrders"
          searchPlaceholder="ابحث بالاسم أو SKU..."
          options={[
            { value: "__none__", label: "— غير مرتبط —" },
            ...eoProducts.map((p) => ({
              value: p.external_id,
              label: `${p.name || `#${p.external_id}`}${p.sku ? ` (${p.sku})` : ""}`,
              keywords: `${p.name || ""} ${p.sku || ""}`,
            })),
          ]}
        />
        {eoProducts.length === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900">
            لا توجد منتجات. اذهب إلى "حسابي" واضغط "مزامنة منتجات EasyOrders".
          </p>
        )}
        {product.easyOrdersProductId && eoVariants.length > 0 && hasVariants && (
          <Button
            type="button"
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg transition-all"
            onClick={() => autoLinkEoVariants(true)}
          >
            ربط المتغيرات تلقائياً (استبدال)
          </Button>
        )}
      </SectionCard>

      {/* Stock Management */}
      <SectionCard icon={Boxes} title="المخزون" description="حدد عدد القطع المتوفرة" iconColor="bg-teal-500">
        <div className="flex items-center justify-end gap-2 flex-wrap">
        {hasVariants && whProducts.length > 0 && product.warehouseLinked !== false && (
          <Button
            type="button"
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg transition-all"
            onClick={() => {
              autoLinkWarehouseVariants(true);
            }}
          >
            ربط منتجات المخزن تلقائياً (استبدال)
          </Button>
        )}
        </div>

        {hasVariants ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              أدخل الكود (SKU) وعدد القطع لكل توليفة. كل توليفة تعتبر وحدة مستقلة في المخزون.
            </p>
            {/* Column headers (visible on md+) */}
            <div className={`hidden md:grid ${product.warehouseLinked !== false ? "md:grid-cols-[1fr_8rem_6rem_16rem_18rem]" : "md:grid-cols-[1fr_8rem_6rem_18rem]"} gap-2 px-3 text-xs font-semibold text-muted-foreground`}>
              <div>المتغير المحلي</div>
              <div>كود (SKU)</div>
              <div>الكمية</div>
              {product.warehouseLinked !== false && <div>منتج المخزن (شركة الشحن)</div>}
              <div>متغير EasyOrders</div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {variantKeys.map((key) => (
                <div key={key} className={`flex flex-col md:grid ${product.warehouseLinked !== false ? "md:grid-cols-[1fr_8rem_6rem_16rem_18rem]" : "md:grid-cols-[1fr_8rem_6rem_18rem]"} md:items-start gap-2 p-3 border rounded-lg bg-muted/30`}>
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground md:hidden">المتغير المحلي</div>
                    <Label className="block truncate">{key}</Label>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground md:hidden">كود (SKU)</div>
                    <Input
                      value={product.variantSkus?.[key] ?? ""}
                      onChange={(e) => updateVariantSku(key, e.target.value)}
                      placeholder="SKU"
                      dir="ltr"
                      className="w-full text-left font-mono text-xs"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground md:hidden">الكمية</div>
                    <Input
                      type="number"
                      min="0"
                      value={product.variantStock[key] ?? ""}
                      onChange={(e) => updateVariantQty(key, e.target.value)}
                      placeholder="الكمية"
                      className="w-full"
                      disabled={readOnlyStock}
                      title={readOnlyStock ? "تعديل الكميات من صفحة المخزون فقط" : undefined}
                    />
                  </div>
                  {product.warehouseLinked !== false && (
                  <div>
                    <div className="text-[10px] text-muted-foreground md:hidden">منتج المخزن (شركة الشحن)</div>
                    <SearchableSelect
                      value={product.variantWarehouseCodes?.[key] || "__none__"}
                      onChange={(v) => updateVariantWhCode(key, v === "__none__" ? "" : v)}
                      placeholder="منتج المخزن (شركة الشحن)"
                      searchPlaceholder="ابحث بالاسم أو SKU..."
                      options={[
                        { value: "__none__", label: "— بدون ربط (طلبية عادية) —" },
                        ...whProducts.map((p) => ({
                          value: String(p.external_id),
                          label: `${p.name || `#${p.external_id}`}${p.code ? ` (${p.code})` : ""}`,
                          keywords: `${p.name || ""} ${p.code || ""}`,
                        })),
                      ]}
                    />
                    {(() => {
                      const id = product.variantWarehouseCodes?.[key];
                      const w = id ? whProducts.find((x) => String(x.external_id) === String(id)) : null;
                      return w ? (
                        <div className="text-[10px] text-muted-foreground mt-1 truncate">
                          {w.name || "—"}{w.code ? ` • SKU: ${w.code}` : ""}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  )}
                  <div>
                    <div className="text-[10px] text-muted-foreground md:hidden">متغير EasyOrders</div>
                    {eoVariants.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <SearchableSelect
                          value={product.variantEasyOrdersIds?.[key] || "__none__"}
                          onChange={(v) => updateVariantEoId(key, v === "__none__" ? "" : v)}
                          placeholder="متغير EasyOrders"
                          searchPlaceholder="ابحث بالاسم أو SKU..."
                          options={[
                            { value: "__none__", label: "— غير مرتبط —" },
                            ...eoVariants.map((v) => ({
                              value: v.id,
                              label: `${v.name || `#${v.id}`}${v.sku ? ` (${v.sku})` : ""}`,
                              keywords: `${v.name || ""} ${v.sku || ""}`,
                            })),
                          ]}
                        />
                        {product.variantEasyOrdersIds?.[key] ? (() => {
                          const id = product.variantEasyOrdersIds[key];
                          const v = eoVariants.find((x) => x.id === id);
                          return (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {v?.name || "—"}{v?.sku ? ` • SKU: ${v.sku}` : ""}
                            </span>
                          );
                        })() : (
                          <span className="text-[10px] text-destructive">غير مرتبط بمتغير EasyOrders</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">لا توجد متغيرات EasyOrders</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="font-semibold">الكمية المتوفرة</Label>
            <Input
              type="number"
              min="0"
              value={product.stock}
              onChange={(e) => updateField("stock", e.target.value)}
              placeholder="0"
              disabled={readOnlyStock}
              title={readOnlyStock ? "تعديل الكميات من صفحة المخزون فقط" : undefined}
            />
            <p className="text-xs text-muted-foreground">
              {readOnlyStock ? "تعديل الكميات يتم من صفحة المخزون فقط." : "عدد القطع المتوفرة من هذا المنتج (عند عدم وجود متغيرات)"}
            </p>
          </div>
        )}
      </SectionCard>

      {/* قائمة متغيرات EasyOrders للمنتج المختار */}
      {product.easyOrdersProductId && eoVariants.length > 0 && (
        <SectionCard icon={Link2} title={`متغيرات EasyOrders (${eoVariants.length})`} description="حالة الربط لكل متغير" iconColor="bg-violet-500">
          <div className="border rounded-lg overflow-hidden">
            <div className="divide-y">
              {eoVariants.map((v) => {
                const linkedKey = Object.entries(product.variantEasyOrdersIds || {})
                  .find(([, id]) => id === v.id)?.[0];
                return (
                  <div key={v.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{v.name || "—"}{v.sku ? ` (${v.sku})` : ""}</div>
                      <div className="text-muted-foreground font-mono truncate" dir="ltr">ID: {v.id}</div>
                    </div>
                    {linkedKey ? (
                      <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[11px] whitespace-nowrap font-semibold">
                        ↔ {linkedKey}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-[11px] whitespace-nowrap font-semibold">
                        غير مرتبط
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>
      )}

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-t shadow-lg">
        <Button onClick={onSubmit} className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold" disabled={isLoading}>
          {isLoading ? "جاري الحفظ..." : submitText}
        </Button>
      </div>
    </div>
  );
};

export default ProductForm;
