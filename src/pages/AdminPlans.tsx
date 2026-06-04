import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Crown } from "lucide-react";
import { formatLimit } from "@/lib/planLimits";

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  max_stores: number;
  max_orders_month: number;
  max_products: number;
  max_staff: number;
  price_monthly: number;
  currency: string;
  is_public: boolean;
  sort_order: number;
}

const AdminPlans = () => {
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_plans" as never)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      setPlans((data || []) as PlanRow[]);
    } catch (e: unknown) {
      toast({
        title: "خطأ",
        description: e instanceof Error ? e.message : "تعذر التحميل",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ctxLoading && isAdmin) load();
    else if (!ctxLoading) setLoading(false);
  }, [ctxLoading, isAdmin]);

  const updateLocal = (id: string, patch: Partial<PlanRow>) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const savePlan = async (plan: PlanRow) => {
    setSavingId(plan.id);
    try {
      const { error } = await supabase
        .from("subscription_plans" as never)
        .update({
          name: plan.name,
          description: plan.description,
          max_stores: plan.max_stores,
          max_orders_month: plan.max_orders_month,
          max_products: plan.max_products,
          max_staff: plan.max_staff,
          price_monthly: plan.price_monthly,
          currency: plan.currency,
          is_public: plan.is_public,
          sort_order: plan.sort_order,
        } as never)
        .eq("id", plan.id);
      if (error) throw error;
      toast({ title: "تم", description: `تم حفظ خطة ${plan.name}` });
    } catch (e: unknown) {
      toast({
        title: "خطأ",
        description: e instanceof Error ? e.message : "تعذر الحفظ",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  if (ctxLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <p className="text-muted-foreground text-center py-8">أدمن فقط</p>;
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">خطط الاشتراك</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        استخدم -1 للحدود غير المحدودة. تعيين الخطة للتاجر من صفحة تفاصيل المتجر.
      </p>

      {plans.map((plan) => (
        <Card key={plan.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span>{plan.slug}</span>
              <div className="flex items-center gap-2 text-sm font-normal">
                <Label htmlFor={`pub-${plan.id}`}>عامة</Label>
                <Switch
                  id={`pub-${plan.id}`}
                  checked={plan.is_public}
                  onCheckedChange={(v) => updateLocal(plan.id, { is_public: v })}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>الاسم</Label>
              <Input value={plan.name} onChange={(e) => updateLocal(plan.id, { name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>السعر الشهري</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={plan.price_monthly}
                onChange={(e) => updateLocal(plan.id, { price_monthly: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>العملة</Label>
              <Input value={plan.currency} onChange={(e) => updateLocal(plan.id, { currency: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={plan.sort_order}
                onChange={(e) => updateLocal(plan.id, { sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>الوصف</Label>
              <Input
                value={plan.description || ""}
                onChange={(e) => updateLocal(plan.id, { description: e.target.value || null })}
              />
            </div>
            <div className="space-y-1">
              <Label>متاجر ({formatLimit(plan.max_stores)})</Label>
              <Input
                type="number"
                value={plan.max_stores}
                onChange={(e) => updateLocal(plan.id, { max_stores: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>طلبات/شهر</Label>
              <Input
                type="number"
                value={plan.max_orders_month}
                onChange={(e) => updateLocal(plan.id, { max_orders_month: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>منتجات</Label>
              <Input
                type="number"
                value={plan.max_products}
                onChange={(e) => updateLocal(plan.id, { max_products: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>موظفون</Label>
              <Input
                type="number"
                value={plan.max_staff}
                onChange={(e) => updateLocal(plan.id, { max_staff: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button onClick={() => savePlan(plan)} disabled={savingId === plan.id}>
                {savingId === plan.id ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 ml-2" />
                )}
                حفظ {plan.name}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminPlans;
