import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { useUserContext } from "@/hooks/useUserContext";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Crown, Store, Package, Users, ShoppingCart, Check, AlertTriangle, Wallet } from "lucide-react";
import { formatLimit, isUnlimited, usagePercent } from "@/lib/planLimits";
import { subscribePlanErrorMessage, subscribeToPlan } from "@/lib/subscribePlan";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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
  sort_order: number;
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isSubUser, loading: ctxLoading } = useUserContext();
  const { plan, usage, isLoading, error } = usePlanUsage();
  const [pendingPlan, setPendingPlan] = useState<PublicPlan | null>(null);
  const [subscribing, setSubscribing] = useState(false);

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

  const { data: walletBalance = 0 } = useQuery({
    queryKey: ["wallet-balance", user?.id],
    enabled: !!user?.id && !isSubUser,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  const currentMeta = publicPlans.find((p) => p.slug === plan?.slug);
  const currentSortOrder = currentMeta?.sort_order ?? 0;
  const displayCurrency = currentMeta?.currency || plan?.currency || "LYD";

  const canSubscribeTo = (p: PublicPlan) => {
    if (p.slug === plan?.slug) return Number(p.price_monthly) > 0;
    return p.sort_order > currentSortOrder;
  };

  const subscribeLabel = (p: PublicPlan) => {
    if (p.slug === plan?.slug) return "تجديد الاشتراك";
    return "اشتراك";
  };

  const handleConfirmSubscribe = async () => {
    if (!pendingPlan) return;
    setSubscribing(true);
    try {
      const res = await subscribeToPlan(pendingPlan.slug);
      if (!res.success) {
        toast({
          title: "تعذر الاشتراك",
          description: subscribePlanErrorMessage(res),
          variant: "destructive",
        });
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["merchant-usage"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["public-plans"] }),
      ]);
      toast({
        title: res.renewal ? "تم التجديد" : "تم الاشتراك",
        description: res.renewal
          ? `تم تجديد «${res.plan_name}» — الرصيد المتبقي ${res.balance} ${displayCurrency}`
          : `تم تفعيل «${res.plan_name}» — خُصم ${res.amount} ${displayCurrency}`,
      });
      setPendingPlan(null);
    } catch (e: unknown) {
      toast({
        title: "خطأ",
        description: e instanceof Error ? e.message : "تعذر إتمام الاشتراك",
        variant: "destructive",
      });
    } finally {
      setSubscribing(false);
    }
  };

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
        description="استخدامك الحالي — ترقِ خطتك من رصيد المحفظة"
        iconGradient="from-amber-500 to-orange-600"
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">رصيد المحفظة</p>
              <p className="text-2xl font-bold text-primary tabular-nums">
                {walletBalance.toLocaleString()} <span className="text-sm font-normal">{displayCurrency}</span>
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/wallet">شحن المحفظة</Link>
          </Button>
        </CardContent>
      </Card>

      {ordersAtLimit && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">وصلت إلى حد طلبات الشهر</p>
                <p className="text-sm text-muted-foreground mt-1">
                  اختر خطة أعلى أدناه واضغط «اشتراك» — يُخصم المبلغ من محفظتك فوراً.
                </p>
              </div>
            </div>
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
            const showSubscribe = canSubscribeTo(p);
            const price = Number(p.price_monthly);
            const canAfford = price <= 0 || walletBalance >= price;
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
                    {price === 0 ? "مجاني" : `${price} ${p.currency}`}
                    {price > 0 && (
                      <span className="text-xs font-normal text-muted-foreground"> / شهر</span>
                    )}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
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
                  {showSubscribe ? (
                    <Button
                      className="w-full"
                      disabled={!canAfford && price > 0}
                      onClick={() => setPendingPlan(p)}
                    >
                      {subscribeLabel(p)}
                    </Button>
                  ) : current ? null : (
                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      للتخفيض تواصل مع الإدارة
                    </p>
                  )}
                  {showSubscribe && price > 0 && !canAfford && (
                    <p className="text-xs text-destructive text-center">
                      الرصيد غير كافٍ —{" "}
                      <Link to="/dashboard/wallet" className="underline">
                        شحن المحفظة
                      </Link>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!pendingPlan} onOpenChange={(open) => !open && !subscribing && setPendingPlan(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingPlan?.slug === plan.slug ? "تجديد الاشتراك" : "تأكيد الاشتراك"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {pendingPlan && (
                  <>
                    <p>
                      {pendingPlan.slug === plan.slug
                        ? `سيتم تجديد خطة «${pendingPlan.name}» لمدة شهر إضافي.`
                        : `سيتم تفعيل خطة «${pendingPlan.name}» فوراً.`}
                    </p>
                    <p className="font-semibold text-foreground">
                      المبلغ: {Number(pendingPlan.price_monthly)} {pendingPlan.currency}
                    </p>
                    <p>
                      رصيدك بعد الخصم:{" "}
                      {(walletBalance - Number(pendingPlan.price_monthly)).toLocaleString()}{" "}
                      {pendingPlan.currency}
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={subscribing}>إلغاء</AlertDialogCancel>
            <AlertDialogAction disabled={subscribing} onClick={(e) => { e.preventDefault(); handleConfirmSubscribe(); }}>
              {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد الاشتراك"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyPlan;
