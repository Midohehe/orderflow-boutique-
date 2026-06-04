import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ExternalLink, Package, ShoppingCart, Wallet, Crown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { isolateLatin } from "@/lib/bidi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Profile {
  user_id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  subscription_ends_at: string | null;
  plan_id: string | null;
}
interface PlanOption {
  id: string;
  slug: string;
  name: string;
}
interface Product {
  id: string; name: string; slug: string; price: number; is_visible: boolean; images: string[];
}
interface Order {
  id: string; customer_name: string; phone: string; city: string; status: string; price: number; created_at: string;
}

const AdminStoreDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [assigningPlan, setAssigningPlan] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctxLoading) return;
    if (!isAdmin || !userId) { setLoading(false); return; }
    (async () => {
      try {
        const [profRes, prodRes, ordRes, walletRes, plansRes] = await Promise.all([
          supabase.from("profiles").select("user_id, username, full_name, is_active, subscription_ends_at, plan_id").eq("user_id", userId).maybeSingle(),
          supabase.from("products").select("id, name, slug, price, is_visible, images").eq("owner_id", userId).is("deleted_at", null).order("created_at", { ascending: false }),
          supabase.from("orders").select("id, customer_name, phone, city, status, price, created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(50),
          supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
          supabase.from("subscription_plans" as never).select("id, slug, name").order("sort_order"),
        ]);
        if (profRes.error) throw profRes.error;
        setProfile(profRes.data as Profile);
        setProducts((prodRes.data || []) as Product[]);
        setOrders((ordRes.data || []) as Order[]);
        setWalletBalance(walletRes.data?.balance ?? 0);
        setPlans((plansRes.data || []) as PlanOption[]);
      } catch (e) {
        console.error(e);
        toast({ title: "خطأ", description: "تعذر تحميل بيانات المتجر", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, isAdmin, ctxLoading]);

  if (ctxLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return <div className="p-6 text-center text-muted-foreground">هذا القسم مخصص للأدمن فقط.</div>;
  }
  if (!profile) {
    return <div className="p-6 text-center text-muted-foreground">المتجر غير موجود.</div>;
  }

  const currentPlanSlug = plans.find((p) => p.id === profile.plan_id)?.slug || "free";

  const handleAssignPlan = async (slug: string) => {
    if (!userId) return;
    setAssigningPlan(true);
    try {
      const { error } = await supabase.rpc("admin_assign_plan", {
        _user_id: userId,
        _plan_slug: slug,
      });
      if (error) throw error;
      const plan = plans.find((p) => p.slug === slug);
      setProfile((p) => (p ? { ...p, plan_id: plan?.id ?? null } : p));
      toast({ title: "تم", description: `تم تعيين خطة ${plan?.name || slug}` });
    } catch (e: unknown) {
      toast({
        title: "خطأ",
        description: e instanceof Error ? e.message : "تعذر تعيين الخطة",
        variant: "destructive",
      });
    } finally {
      setAssigningPlan(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{profile.full_name || profile.username}</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">@{profile.username}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/dashboard/stores")}>
            <ArrowRight className="w-4 h-4" /> العودة
          </Button>
          <Button className="gap-2" onClick={() => window.open(`/store/${profile.username}`, "_blank")}>
            <ExternalLink className="w-4 h-4" /> فتح المتجر
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Package className="w-8 h-8 text-primary" /><div><p className="text-xs text-muted-foreground">المنتجات</p><p className="text-xl font-bold">{products.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><ShoppingCart className="w-8 h-8 text-primary" /><div><p className="text-xs text-muted-foreground">الطلبيات</p><p className="text-xl font-bold">{orders.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Wallet className="w-8 h-8 text-primary" /><div><p className="text-xs text-muted-foreground">رصيد المحفظة</p><p className="text-xl font-bold">{(walletBalance ?? 0).toFixed(2)}</p></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">الحالة</p><p className={`text-sm font-semibold ${profile.is_active ? "text-green-600" : "text-muted-foreground"}`}>{profile.is_active ? "نشط" : "موقوف"}</p>{profile.subscription_ends_at && (<p className="text-xs text-muted-foreground mt-1">ينتهي: {new Date(profile.subscription_ends_at).toLocaleDateString("ar")}</p>)}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-primary">
            <Crown className="w-5 h-5" />
            <span className="font-semibold">خطة الاشتراك</span>
          </div>
          <div className="space-y-1 min-w-[200px]">
            <Label>الخطة</Label>
            <Select
              value={currentPlanSlug}
              onValueChange={handleAssignPlan}
              disabled={assigningPlan}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.slug}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-bold text-foreground">المنتجات</h2>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد منتجات</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((p) => (
                <div key={p.id} className="border rounded-lg overflow-hidden">
                  <div className="aspect-video bg-muted">
                    {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-muted-foreground/50" /></div>}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm text-foreground line-clamp-1">{isolateLatin(p.name)}</h3>
                      <span className="text-primary font-bold text-sm">{p.price}</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => window.open(`/p/${profile.username}/${p.slug}`, "_blank")}>
                      <ExternalLink className="w-3 h-3" /> معاينة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-bold text-foreground">آخر 50 طلبية</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد طلبيات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b"><th className="text-right p-2">العميل</th><th className="text-right p-2">الهاتف</th><th className="text-right p-2">المدينة</th><th className="text-right p-2">الحالة</th><th className="text-right p-2">السعر</th><th className="text-right p-2">التاريخ</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b">
                      <td className="p-2">{o.customer_name}</td>
                      <td className="p-2" dir="ltr">{o.phone}</td>
                      <td className="p-2">{o.city}</td>
                      <td className="p-2">{o.status}</td>
                      <td className="p-2">{o.price}</td>
                      <td className="p-2 text-xs">{new Date(o.created_at).toLocaleDateString("ar")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStoreDetail;
