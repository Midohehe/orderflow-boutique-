import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Package, Search, Upload, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface EoVariant {
  id?: string;
  name?: string | null;
  sku?: string | null;
  price?: number | null;
  stock?: number | null;
  variation_props?: Array<{ variation?: string; variation_name?: string; variation_prop?: string }> | null;
  props?: Array<{ variation?: string; variation_name?: string; variation_prop?: string }> | null;
  [k: string]: any;
}

interface EoProduct {
  id: string;
  external_id: string;
  name: string | null;
  sku: string | null;
  variants: EoVariant[];
  raw: any;
  synced_at: string;
}

const EasyOrdersProducts = () => {
  const [products, setProducts] = useState<EoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushingSkus, setPushingSkus] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareRows, setCompareRows] = useState<Array<{
    productName: string;
    eoProductId: string;
    eoSku: string | null;
    variants: Array<{ key: string; eoVarId: string; eoSku: string | null; eoQty: number | null; localQty: number; }>;
    isSingle: boolean;
    eoQty?: number | null;
    localQty?: number;
  }>>([]);

  const loadComparison = async () => {
    setCompareLoading(true);
    try {
      const [{ data: eo }, { data: local }] = await Promise.all([
        supabase.from("easyorders_products").select("external_id, sku, variants"),
        supabase
          .from("products")
          .select("name, stock, variant_stock, easyorders_product_id, variant_easyorders_ids")
          .not("easyorders_product_id", "is", null),
      ]);
      const eoMap = new Map<string, any>();
      for (const r of (eo || []) as any[]) eoMap.set(String(r.external_id), r);
      const rows: typeof compareRows = [];
      for (const lp of (local || []) as any[]) {
        const eop = eoMap.get(String(lp.easyorders_product_id));
        if (!eop) continue;
        const varIdsMap = (lp.variant_easyorders_ids || {}) as Record<string, string>;
        const varStock = (lp.variant_stock || {}) as Record<string, number>;
        const eoVarById = new Map((eop.variants || []).map((v: any) => [String(v.id), v]));
        const linkedKeys = Object.keys(varIdsMap);
        if (linkedKeys.length > 0) {
          rows.push({
            productName: lp.name,
            eoProductId: eop.external_id,
            eoSku: eop.sku ?? null,
            isSingle: false,
            variants: linkedKeys.map((k) => {
              const v: any = eoVarById.get(String(varIdsMap[k]));
              return {
                key: k,
                eoVarId: varIdsMap[k],
                eoSku: v?.sku ?? null,
                eoQty: v?.stock ?? null,
                localQty: Number(varStock[k] ?? 0),
              };
            }),
          });
        } else {
          rows.push({
            productName: lp.name,
            eoProductId: eop.external_id,
            eoSku: eop.sku ?? null,
            isSingle: true,
            variants: [],
            eoQty: null,
            localQty: Number(lp.stock ?? 0),
          });
        }
      }
      setCompareRows(rows);
      setShowCompare(true);
    } finally {
      setCompareLoading(false);
    }
  };

  const handlePush = async () => {
    if (!confirm("سيتم تحديث كميات المنتجات في EasyOrders لتطابق الكميات الحالية عندك. متأكد؟")) return;
    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-easyorders-quantities");
      if (error) throw error;
      const d: any = data || {};
      if (d.failed > 0) {
        toast.warning(`تم: ${d.updatedVariants} متغير، ${d.updatedProducts} منتج. فشل: ${d.failed}`);
        console.warn("Push errors:", d.errors);
      } else {
        toast.success(`تمت المطابقة: ${d.updatedVariants} متغير، ${d.updatedProducts} منتج`);
      }
      // Refresh sync to pull latest quantities back from EO
      await supabase.functions.invoke("sync-easyorders-products");
      const { data: fresh } = await supabase
        .from("easyorders_products")
        .select("id, external_id, name, sku, variants, raw, synced_at")
        .order("name", { ascending: true });
      if (fresh) setProducts(fresh as any);
      if (showCompare) await loadComparison();
    } catch (e: any) {
      toast.error(`فشل: ${e?.message || e}`);
    } finally {
      setPushing(false);
    }
  };

  const handlePushSkus = async () => {
    if (selectedIds.size === 0) {
      toast.error("اختر منتج واحد على الأقل.");
      return;
    }
    if (!confirm(
      `سيتم تعيين أكواد SKU لـ ${selectedIds.size} منتج/متغير في EasyOrders لتطابق أكواد شركة الشحن المحلية.\n\n` +
      "ملاحظة: هذه العملية تحدّث المنتج بالكامل في EasyOrders (قد تُعاد إنشاء معرفات المتغيرات داخلياً) وستتم مزامنة فورية بعد ذلك. متابعة؟"
    )) return;
    setPushingSkus(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-easyorders-skus", {
        body: { product_ids: Array.from(selectedIds) },
      });
      if (error) throw error;
      const d: any = data || {};
      if (d.failed > 0) {
        toast.warning(`تم: ${d.updatedProducts} منتج (${d.updatedVariants} متغير). تخطّي: ${d.skipped}. فشل: ${d.failed}`);
        console.warn("Push SKUs errors:", d.errors);
      } else {
        toast.success(`تم تعيين الأكواد: ${d.updatedProducts} منتج (${d.updatedVariants} متغير). تخطّي: ${d.skipped}`);
      }
      // Resync to refresh variant IDs and SKUs locally
      await supabase.functions.invoke("sync-easyorders-products");
      const { data: fresh } = await supabase
        .from("easyorders_products")
        .select("id, external_id, name, sku, variants, raw, synced_at")
        .order("name", { ascending: true });
      if (fresh) setProducts(fresh as any);
      if (showCompare) await loadComparison();
    } catch (e: any) {
      toast.error(`فشل: ${e?.message || e}`);
    } finally {
      setPushingSkus(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("easyorders_products")
        .select("id, external_id, name, sku, variants, raw, synced_at")
        .order("name", { ascending: true });
      if (!error && data) setProducts(data as any);
      setLoading(false);
    })();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? products.filter((p) => {
        const hay = [
          p.name || "",
          p.sku || "",
          p.external_id,
          ...(Array.isArray(p.variants)
            ? p.variants.flatMap((v) => [v.name || "", v.sku || ""])
            : []),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      })
    : products;

  // اسم المتغير المعروض: إن كان name = sku فابنِه من خصائص الفروقات (لون - مقاس...)
  const variantDisplayName = (v: EoVariant): string => {
    const props = v.variation_props || v.props || [];
    const fromProps = Array.isArray(props)
      ? props.map((p) => p?.variation_prop).filter(Boolean).join(" - ")
      : "";
    const name = (v.name || "").trim();
    const sku = (v.sku || "").trim();
    if (name && name !== sku) return name;
    if (fromProps) return fromProps;
    return name || "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">منتجات ايزي اوردرز</h1>
          <p className="text-sm text-muted-foreground">
            عرض المنتجات والمتغيرات المجلوبة من EasyOrders
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">مطابقة الكميات مع EasyOrders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            ادفع كميات منتجاتك المحلية إلى EasyOrders ليتطابق المخزون.
            يستخدم endpoint رسمي لتحديث الكميات (لن يتلف بيانات المنتجات).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadComparison} disabled={compareLoading} variant="outline">
              {compareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {showCompare ? "تحديث المقارنة" : "عرض مقارنة الكميات"}
            </Button>
            <Button onClick={handlePush} disabled={pushing}>
              {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              مطابقة الكميات (دفع كمياتنا إلى EasyOrders)
            </Button>
            <Button onClick={handlePushSkus} disabled={pushingSkus} variant="secondary">
              {pushingSkus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              تعيين أكواد SKU من شركة الشحن
            </Button>
          </div>

          {showCompare && (
            <div className="overflow-x-auto border rounded-md mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المنتج المحلي</TableHead>
                    <TableHead className="text-right">المتغير</TableHead>
                    <TableHead className="text-right">SKU في EO</TableHead>
                    <TableHead className="text-right">كمية EO</TableHead>
                    <TableHead className="text-right">كميتنا</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compareRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">لا توجد منتجات مرتبطة بـ EasyOrders</TableCell></TableRow>
                  ) : compareRows.flatMap((r) => {
                    if (r.isSingle) {
                      const match = r.eoQty != null && r.eoQty === r.localQty;
                      return [(
                        <TableRow key={r.eoProductId}>
                          <TableCell className="font-medium">{r.productName}</TableCell>
                          <TableCell className="text-muted-foreground">—</TableCell>
                          <TableCell className="font-mono text-xs">{r.eoSku || "—"}</TableCell>
                          <TableCell>{r.eoQty ?? "—"}</TableCell>
                          <TableCell className="font-semibold">{r.localQty}</TableCell>
                          <TableCell>{match ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}</TableCell>
                        </TableRow>
                      )];
                    }
                    return r.variants.map((v, i) => {
                      const match = v.eoQty != null && v.eoQty === v.localQty;
                      return (
                        <TableRow key={`${r.eoProductId}-${v.key}`}>
                          {i === 0 ? (
                            <TableCell rowSpan={r.variants.length} className="font-medium align-top">{r.productName}</TableCell>
                          ) : null}
                          <TableCell>{v.key}</TableCell>
                          <TableCell className="font-mono text-xs">{v.eoSku || "—"}</TableCell>
                          <TableCell>{v.eoQty ?? "—"}</TableCell>
                          <TableCell className="font-semibold">{v.localQty}</TableCell>
                          <TableCell>{match ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}</TableCell>
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {products.length === 0
                ? 'لا توجد منتجات. اذهب إلى "حسابي" واضغط "مزامنة منتجات EasyOrders".'
                : "لا توجد نتائج مطابقة."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              عدد المنتجات: {filtered.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {filtered.map((p) => {
                const variants = Array.isArray(p.variants) ? p.variants : [];
                return (
                  <AccordionItem key={p.id} value={p.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center gap-2 text-right">
                        <span className="font-semibold">{p.name || `#${p.external_id}`}</span>
                        {p.sku && (
                          <Badge variant="outline" className="font-mono text-xs">
                            SKU: {p.sku}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {variants.length} متغير
                        </Badge>
                        <span className="text-xs text-muted-foreground ms-auto">
                          ID: {p.external_id}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {variants.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">الاسم</TableHead>
                                <TableHead className="text-right">SKU</TableHead>
                                <TableHead className="text-right">الخصائص</TableHead>
                                <TableHead className="text-right">السعر</TableHead>
                                <TableHead className="text-right">المخزون</TableHead>
                                <TableHead className="text-right">المعرّف</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {variants.map((v, i) => (
                                <TableRow key={v.id || i}>
                                  <TableCell>{variantDisplayName(v)}</TableCell>
                                  <TableCell className="font-mono text-xs">{v.sku || "—"}</TableCell>
                                  <TableCell>
                                    {(() => {
                                      const props = v.variation_props || v.props || [];
                                      return Array.isArray(props) && props.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {props.map((pr: any, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {(pr.variation || pr.variation_name) ?? ""}: {pr.variation_prop}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      "—"
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell>{v.price ?? "—"}</TableCell>
                                  <TableCell>{v.stock ?? "—"}</TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">
                                    {v.id || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">لا توجد متغيرات.</p>
                      )}

                      <div className="mt-4 text-xs text-muted-foreground">
                        آخر مزامنة: {new Date(p.synced_at).toLocaleString("ar-EG")}
                      </div>

                      {p.raw && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            عرض البيانات الخام (JSON)
                          </summary>
                          <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-[11px] leading-relaxed">
                            {JSON.stringify(p.raw, null, 2)}
                          </pre>
                        </details>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EasyOrdersProducts;