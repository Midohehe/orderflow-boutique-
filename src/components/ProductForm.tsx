import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "@/components/ImageUpload";
import RichTextEditor from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
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

  // Auto-link on first EO product selection (only fills empty mappings)
  useEffect(() => {
    if (!product.easyOrdersProductId || !eoVariants.length || !variantKeys.length) return;
    const empty = variantKeys.every((k) => !product.variantEasyOrdersIds?.[k]);
    if (empty) autoLinkEoVariants(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.easyOrdersProductId, eoProducts.length]);

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

      {/* EasyOrders linking — يظهر قبل قسم المخزون لاختيار المنتج الرئيسي أولاً */}
      <div className="border-t pt-6 mt-6 space-y-3">
        <h3 className="text-lg font-semibold">المنتج الرئيسي في EasyOrders</h3>
        <p className="text-sm text-muted-foreground">
          اختر المنتج الرئيسي من EasyOrders. سيتم عرض متغيراته فقط في خيارات الربط أدناه.
        </p>
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
          <p className="text-xs text-muted-foreground">
            لا توجد منتجات. اذهب إلى "حسابي" واضغط "مزامنة منتجات EasyOrders".
          </p>
        )}
        {product.easyOrdersProductId && eoVariants.length > 0 && hasVariants && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => autoLinkEoVariants(true)}
          >
            ربط المتغيرات تلقائياً (استبدال)
          </Button>
        )}
      </div>

      {/* Stock Management */}
      <div className="border-t pt-6 mt-6">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="text-lg font-semibold">المخزون *</h3>
          {hasVariants && whProducts.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const n = autoLinkWarehouseVariants(true);
                // no toast import here; visible by updated Selects
              }}
            >
              ربط منتجات المخزن تلقائياً (استبدال)
            </Button>
          )}
        </div>

        {hasVariants ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              أدخل عدد القطع المتوفرة لكل متغير. سيظهر هذا في صفحة المخزون.
            </p>
            {/* Column headers (visible on md+) */}
            <div className="hidden md:grid md:grid-cols-[1fr_6rem_16rem_18rem] gap-2 px-3 text-xs font-semibold text-muted-foreground">
              <div>المتغير المحلي</div>
              <div>الكمية</div>
              <div>منتج المخزن (شركة الشحن)</div>
              <div>متغير EasyOrders</div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {variantKeys.map((key) => (
                <div key={key} className="flex flex-col md:grid md:grid-cols-[1fr_6rem_16rem_18rem] md:items-start gap-2 p-3 border rounded-lg bg-muted/30">
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground md:hidden">المتغير المحلي</div>
                    <Label className="block truncate">{key}</Label>
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
                    />
                  </div>
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

      {/* قائمة متغيرات EasyOrders للمنتج المختار */}
      {product.easyOrdersProductId && eoVariants.length > 0 && (
        <div className="border-t pt-6 mt-6 space-y-3">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-sm font-semibold">
              متغيرات EasyOrders ({eoVariants.length})
            </div>
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
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[11px] whitespace-nowrap">
                        ↔ {linkedKey}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-destructive/10 text-destructive text-[11px] whitespace-nowrap">
                        غير مرتبط
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Button onClick={onSubmit} className="w-full gradient-primary text-primary-foreground" disabled={isLoading}>
        {isLoading ? "جاري الحفظ..." : submitText}
      </Button>
    </div>
  );
};

export default ProductForm;
