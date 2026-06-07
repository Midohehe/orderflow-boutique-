import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { useUserContext } from "@/hooks/useUserContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Store, Package, Users, ShoppingCart, Check } from "lucide-react";
import { formatLimit, isUnlimited, usagePercent } from "@/lib/planLimits";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface PublicPlan {
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
  features: string[];
}

function UsageRow({
  icon: Icon,
  label,
  used,
  max,
}: {
  icon: typeof Store;
  label: string;
  used: number;
  max: number;
}) {
  const pct = usagePercent(used, max);
  const atLimit = !isUnlimited(max) && used >= max;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Icon className="w-4 h-4 text-primary shrink-0" />
          <span>{label}</span>
        </div>
        <span className={cn("font-medium tabular-nums", atLimit && "text-destructive")}>
          {used} / {formatLimit(max)}
        </span>
      </div>
      {!isUnlimited(max) && <Progress value={pct} className={cn("h-2", atLimit && "[&>div]:bg-destructive")} />}
    </div>
  );
}

const MyPlan = () => {
  const { isSubUser, isAdmin, loading: ctxLoading } = useUserContext();
  const { plan, usage, isLoading, error } = usePlanUsage();

  const { data: publicPlans = [] } = useQuery({
    queryKey: ["public-plans"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from("subscription_plans" as never)
        .select("*")
        .eq("is_public", true)
        .order("sort_order");
      if (qErr) throw qErr;
      return (data || []).map((p: Record<string, unknown>) => ({
        ...p,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
      })) as PublicPlan[];
    },
  });

  if (ctxLoading || isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSubUser) {
    return (
      <div className="p-6 text-center text-muted-foreground" dir="rtl">
        خطتك مرتبطة بحساب صاحب المتجر. تواصل معه لترقية الخطة.
      </div>
    );
  }

  if (error || !plan || !usage) {
    return (
      <div className="p-6 text-center text-destructive" dir="rtl">
        تعذر تحميل بيانات الخطة.
      </div>
    );
  }

  const ordersAtLimit =
    !isUnlimited(plan.max_orders_month) && usage.orders_month >= plan.max_orders_month;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={Crown}
        title="خطتي"
        description="استخدامك الحالي وحدود اشتراكك"
        iconGradient="from-amber-500 to-orange-600"
      />

      {ordersAtLimit && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">وصلت إلى حد طلبات الشهر</p>
                <p className="text-sm text-muted-foreground mt-1">
                  لا يمكن استقبال طلبات جديدة من صفحات الهبوط حتى ترقية الخطة. تواصل مع الإدارة
                  أو اطلب ترقية حسابك إلى Starter أو Pro.
                </p>
              </div>
            </div>
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to="/dashboard/settings">تعيين الخطة من الإعدادات</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <Badge variant="secondary">{plan.slug}</Badge>
          </div>
          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <UsageRow icon={Store} label="المتاجر" used={usage.stores} max={plan.max_stores} />
          <UsageRow icon={ShoppingCart} label="طلبات هذا الشهر" used={usage.orders_month} max={plan.max_orders_month} />
          <UsageRow icon={Package} label="المنتجات" used={usage.products} max={plan.max_products} />
          <UsageRow icon={Users} label="الموظفون" used={usage.staff} max={plan.max_staff} />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-bold mb-4 text-foreground">خطط متاحة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {publicPlans.map((p) => {
            const current = p.slug === plan.slug;
            return (
              <Card
                key={p.id}
                className={cn(current && "ring-2 ring-primary border-primary/40")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    {p.name}
                    {current && <Badge>خطتك</Badge>}
                  </CardTitle>
                  <p className="text-2xl font-bold text-primary">
                    {Number(p.price_monthly) === 0 ? "مجاني" : `${p.price_monthly} ${p.currency}`}
                    {Number(p.price_monthly) > 0 && (
                      <span className="text-xs font-normal text-muted-foreground"> / شهر</span>
                    )}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <ul className="space-y-1.5">
                    {(p.features.length ? p.features : [
                      `${formatLimit(p.max_stores)} متجر`,
                      `${formatLimit(p.max_orders_month)} طلب/شهر`,
                      `${formatLimit(p.max_products)} منتج`,
                      `${formatLimit(p.max_staff)} موظف`,
                    ]).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {!current && (
                    <p className="text-xs text-muted-foreground pt-2 border-t">
                      {isAdmin
                        ? "لتغيير خطة أي تاجر: الإعدادات → المستخدمون أو المتاجر → عرض البيانات."
                        : "لترقية خطتك تواصل مع الإدارة — التفعيل يتم من لوحة الأدمن."}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MyPlan;
