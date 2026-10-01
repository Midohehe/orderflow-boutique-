import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateAdCosts, type AdCostInput } from "@/lib/adCostCalculator";

const fields = [
  { key: "spendUsd", label: "الإنفاق اليومي بالدولار", step: "0.01", min: 0 },
  { key: "orders", label: "عدد الطلبات اليومي", step: "1", min: 0 },
  { key: "deliveryPercent", label: "نسبة التسليم المتوقعة (%)", step: "0.01", min: 0, max: 100 },
  { key: "messages", label: "عدد الرسائل اليومي", step: "1", min: 0 },
  { key: "exchangeRate", label: "سعر الدولار بالعملة المحلية", step: "any", min: 0 },
] as const;
const format = (value: number) => value.toLocaleString("ar-LY", { maximumFractionDigits: 4 });

export default function AdCostCalculator() {
  const { activeStoreId } = useStoreContext();
  const [productId, setProductId] = useState("");
  const [averageItems, setAverageItems] = useState("1");
  const { data: products = [], isLoading: productsLoading, isError: productsError, refetch } = useQuery({
    queryKey: ["ad-calculator-products", activeStoreId],
    enabled: !!activeStoreId,
    queryFn: async () => {
      const list: { id: string; name: string; price: number }[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("products").select("id, name, price")
          .eq("store_id", activeStoreId!).is("deleted_at", null).order("id").range(offset, offset + 499);
        if (error) throw error;
        list.push(...data);
        if (data.length < 500) break;
      }
      return list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    },
  });
  const product = products.find(item => item.id === productId);
  const { data: purchasePrice, isFetching: costLoading, isError: costError } = useQuery({
    queryKey: ["ad-calculator-cost", activeStoreId, product?.id],
    enabled: !!product,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_owner_product_costs", { _product_ids: [product!.id] });
      if (error) throw error;
      const cost = data?.find(item => item.id === product!.id)?.purchase_price;
      if (cost == null) throw new Error("سعر الشراء غير متاح");
      return Number(cost);
    },
  });
  const [values, setValues] = useState({ spendUsd: "", orders: "", deliveryPercent: "", messages: "", exchangeRate: "" });
  const [result, setResult] = useState<ReturnType<typeof calculateAdCosts> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { setProductId(""); setResult(null); setError(""); }, [activeStoreId]);
  useEffect(() => { setResult(null); }, [product?.price, purchasePrice]);
  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <PageHeader icon={Calculator} title="حاسبة تكلفة الإعلان"
        description="احسب تكلفة الطلب والبيع المتوقع والرسالة من إنفاق يوم واحد." />
      <Card>
        <CardHeader><CardTitle>بيانات الإعلان</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={event => {
            event.preventDefault();
            try {
              if (Object.values(values).some(value => !value.trim())) throw new Error("يرجى تعبئة جميع الحقول، ويمكن إدخال صفر عند عدم وجود طلبات أو رسائل.");
              const input = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])) as unknown as AdCostInput;
              if (productId && (!product || costLoading || costError || purchasePrice == null)) throw new Error("تعذّر قراءة أسعار المنتج. انتظر التحميل أو أعد اختيار المنتج.");
              if (product && !averageItems.trim()) throw new Error("أدخل متوسط عدد القطع لكل طلب.");
              setResult(calculateAdCosts(input, product ? { purchasePrice: purchasePrice!, salePrice: Number(product.price), averageItems: Number(averageItems) } : undefined));
              setError("");
            } catch (cause) {
              setResult(null);
              setError(cause instanceof Error ? cause.message : "تعذّر الحساب");
            }
          }}>
            <div className="rounded-xl border p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ad-product">المنتج (اختياري لحساب الأرباح)</Label>
                <select id="ad-product" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={productId} disabled={!activeStoreId || productsLoading || productsError}
                  onChange={event => { setProductId(event.target.value); setResult(null); setError(""); }}>
                  <option value="">{productsLoading ? "جاري تحميل المنتجات..." : "بدون منتج — حساب تكلفة الإعلان فقط"}</option>
                  {products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {productsError && <p role="alert" className="text-sm text-destructive">تعذّر تحميل المنتجات. <button type="button" className="underline" onClick={() => void refetch()}>إعادة المحاولة</button></p>}
                {!productsLoading && !productsError && activeStoreId && products.length === 0 && <p className="text-sm text-muted-foreground">لا توجد منتجات في المتجر الحالي.</p>}
              </div>
              {product && <>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <p>سعر شراء القطعة: <strong>{costLoading ? "جاري التحميل..." : costError || purchasePrice == null ? "غير متاح" : format(purchasePrice)}</strong></p>
                  <p>سعر بيع القطعة: <strong>{format(Number(product.price))}</strong></p>
                </div>
                {costError && <p role="alert" className="text-sm text-destructive">تعذّر قراءة سعر الشراء أو ليست لديك صلاحية الوصول إليه. لن تُحسب الأرباح بسعر شراء افتراضي.</p>}
                <div className="space-y-2">
                  <Label htmlFor="average-items">متوسط عدد القطع لكل طلب</Label>
                  <Input id="average-items" type="number" min="1" step="any" required dir="ltr" value={averageItems}
                    onChange={event => { setAverageItems(event.target.value); setResult(null); setError(""); }} />
                  <p className="text-xs text-muted-foreground">الافتراضي قطعة واحدة؛ يمكن إدخال متوسط مثل 1.5. أسعار المنتج بالعملة المحلية، وأرقام الإعلان تخص المنتج المختار.</p>
                </div>
              </>}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map(field => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input id={field.key} type="number" required min={field.min}
                    max={"max" in field ? field.max : undefined} step={field.step} dir="ltr"
                    value={values[field.key]} onChange={event => {
                      setValues(current => ({ ...current, [field.key]: event.target.value }));
                      setResult(null);
                      setError("");
                    }} />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">مثال: إذا كان الدولار يساوي 7 د.ل، أدخل 7 في سعر الدولار. استخدم الطلبات والرسائل لنفس يوم الإنفاق.</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit"><Calculator className="w-4 h-4 ml-2" />حساب</Button>
          </form>
        </CardContent>
      </Card>
      {result && (
        <section aria-live="polite" aria-label="نتائج حساب تكلفة الإعلان" className="space-y-4">
          <div className="rounded-xl bg-muted p-4 space-y-1">
            <p>الإنفاق بالعملة المحلية: <strong>{format(result.localSpend)}</strong></p>
            <p>عدد عمليات البيع المتوقعة بعد التسليم: <strong>{format(result.expectedSales)}</strong></p>
            <p className="text-xs text-muted-foreground">المبيعات المتوقعة = عدد الطلبات × نسبة التسليم ÷ 100. النتائج تقديرية حسب النسبة المدخلة.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: "تكلفة الإعلان لكل طلب", value: result.perOrder, empty: "أدخل عدد طلبات أكبر من صفر" },
              { title: "تكلفة الإعلان لكل عملية بيع متوقعة", value: result.perSale, empty: "لا توجد مبيعات متوقعة حسب المدخلات" },
              { title: "تكلفة الإعلان لكل رسالة", value: result.perMessage, empty: "أدخل عدد رسائل أكبر من صفر" },
            ].map(item => (
              <Card key={item.title}>
                <CardHeader><CardTitle className="text-base">{item.title}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {item.value ? <><p className="text-2xl font-bold">{format(item.value.usd)} $</p>
                    <p className="text-sm">{format(item.value.local)} بالعملة المحلية</p></>
                    : <p className="text-sm text-muted-foreground">{item.empty}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          {result.profit && <Card>
            <CardHeader><CardTitle>الأرباح المتوقعة — {product?.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ["عدد القطع المتوقع تسليمها", result.profit.expectedItems],
                  ["إيرادات البيع المتوقعة", result.profit.revenue],
                  ["تكلفة شراء القطع المتوقع بيعها", result.profit.purchaseCost],
                  ["الربح قبل الإعلان", result.profit.grossProfit],
                  ["تكلفة الإعلان", result.localSpend],
                ].map(([label, value]) => <p key={label}>{label}: <strong>{format(Number(value))}</strong></p>)}
              </div>
              <p className={`text-xl font-bold ${result.profit.netProfit < 0 ? "text-destructive" : "text-foreground"}`}>
                {result.profit.netProfit < 0 ? "الخسارة المتوقعة بعد الإعلان" : "الربح المتوقع بعد الإعلان"}: {format(Math.abs(result.profit.netProfit))} بالعملة المحلية
              </p>
              <p className="text-xs text-muted-foreground">الربح المتوقع = الطلبات × نسبة التسليم ÷ 100 × متوسط القطع × (سعر البيع − سعر الشراء) − الإنفاق الإعلاني بالعملة المحلية. المبالغ بالعملة المحلية ولا تشمل الشحن أو المرتجعات أو الرسوم والمصاريف الأخرى.</p>
            </CardContent>
          </Card>}
        </section>
      )}
    </div>
  );
}
