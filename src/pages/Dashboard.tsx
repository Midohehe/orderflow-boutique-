import { useEffect, useState } from "react";
import DashboardStats from "@/components/DashboardStats";
import { useUserContext } from "@/hooks/useUserContext";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, CalendarClock, Infinity as InfinityIcon, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("ar-LY", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
};

const daysRemaining = (iso?: string | null) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const Dashboard = () => {
  const { profile, isAdmin } = useUserContext();
  const [subPrice, setSubPrice] = useState<number | null>(null);
  const [subCurrency, setSubCurrency] = useState<string>("د.ل");
  const start = formatDate(profile?.subscription_starts_at);
  const end = formatDate(profile?.subscription_ends_at);
  const remaining = daysRemaining(profile?.subscription_ends_at);

  useEffect(() => {
    supabase.from("app_settings").select("subscription_price, subscription_currency").limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setSubPrice(Number(data.subscription_price ?? 0));
        setSubCurrency(data.subscription_currency || "د.ل");
      }
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground">نظرة عامة على أداء متجرك</p>
      </div>

      {!isAdmin && profile && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">بداية الاشتراك</p>
                <p className="font-semibold text-foreground">{start || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${remaining !== null && remaining <= 7 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                {profile.subscription_ends_at ? <CalendarClock className="w-5 h-5" /> : <InfinityIcon className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نهاية الاشتراك</p>
                <p className="font-semibold text-foreground">
                  {end || "اشتراك مفتوح"}
                  {remaining !== null && (
                    <span className={`mr-2 text-xs ${remaining <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                      ({remaining > 0 ? `متبقي ${remaining} يوم` : "منتهي"})
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
          {subPrice !== null && subPrice > 0 && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">سعر الاشتراك الشهري</p>
                  <p className="font-semibold text-foreground">{subPrice} {subCurrency}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <DashboardStats />
    </div>
  );
};

export default Dashboard;
