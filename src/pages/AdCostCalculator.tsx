import { useState } from "react";
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
  const [values, setValues] = useState({ spendUsd: "", orders: "", deliveryPercent: "", messages: "", exchangeRate: "" });
  const [result, setResult] = useState<ReturnType<typeof calculateAdCosts> | null>(null);
  const [error, setError] = useState("");
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
              setResult(calculateAdCosts(input));
              setError("");
            } catch (cause) {
              setResult(null);
              setError(cause instanceof Error ? cause.message : "تعذّر الحساب");
            }
          }}>
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
        </section>
      )}
    </div>
  );
}
