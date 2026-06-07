import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Trash2, KeyRound, Power, Save, Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assignMerchantPlan, planAssignErrorMessage, type PlanOption } from "@/lib/assignMerchantPlan";

const AdminCards = lazy(() => import("./AdminCards"));
const AdminStores = lazy(() => import("./AdminStores"));
const AdminPlans = lazy(() => import("./AdminPlans"));
const PermissionGroups = lazy(() => import("./PermissionGroups"));

interface ManagedUser {
  user_id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  roles: string[];
  plan_id: string | null;
}

const Settings = () => {
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", username: "", full_name: "",
  });
  const [resetPwd, setResetPwd] = useState<{ user_id: string; password: string } | null>(null);
  const [systemName, setSystemName] = useState("");
  const [systemNameId, setSystemNameId] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [orderFee, setOrderFee] = useState("0");
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [assigningPlanFor, setAssigningPlanFor] = useState<string | null>(null);

  const callApi = async (action: string, payload: any = {}) => {
    const { data, error } = await supabase.functions.invoke("admin-manage-users", {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await callApi("list");
      setUsers(data.users || []);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ctxLoading && isAdmin) {
      refresh();
      (async () => {
        const [{ data: appData }, { data: planData, error: planErr }] = await Promise.all([
          supabase.from("app_settings").select("id, system_name, order_fee, wallet_enabled").limit(1).maybeSingle(),
          supabase.from("subscription_plans" as never).select("id, slug, name").order("sort_order"),
        ]);
        if (appData) {
          setSystemName(appData.system_name || "");
          setSystemNameId(appData.id);
          setOrderFee(String((appData as { order_fee?: number }).order_fee ?? 0));
          setWalletEnabled(Boolean((appData as { wallet_enabled?: boolean }).wallet_enabled));
        }
        if (!planErr && planData) {
          setPlans(planData as PlanOption[]);
        }
      })();
    } else if (!ctxLoading) setLoading(false);
  }, [ctxLoading, isAdmin]);

  const saveSystemName = async () => {
    setSavingName(true);
    try {
      if (systemNameId) {
        const { error } = await supabase.from("app_settings").update({ system_name: systemName, updated_at: new Date().toISOString() }).eq("id", systemNameId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("app_settings").insert({ system_name: systemName }).select("id").single();
        if (error) throw error;
        setSystemNameId(data.id);
      }
      toast({ title: "تم", description: "تم حفظ اسم النظام" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSavingName(false); }
  };

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.username) {
      toast({ title: "خطأ", description: "البريد، كلمة المرور، واسم المستخدم مطلوبة", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await callApi("create", form);
      toast({ title: "تم", description: "تم إنشاء المستخدم بنجاح" });
      setForm({ email: "", password: "", username: "", full_name: "" });
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleReset = async () => {
    if (!resetPwd) return;
    try {
      await callApi("reset_password", { user_id: resetPwd.user_id, new_password: resetPwd.password });
      toast({ title: "تم", description: "تم تغيير كلمة المرور" });
      setResetPwd(null);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = async (u: ManagedUser) => {
    try {
      await callApi("toggle_active", { user_id: u.user_id, is_active: !u.is_active });
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (user_id: string) => {
    try {
      await callApi("delete", { user_id });
      toast({ title: "تم", description: "تم حذف المستخدم" });
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleAssignPlan = async (userId: string, slug: string) => {
    const currentSlug = plans.find((p) => p.id === users.find((u) => u.user_id === userId)?.plan_id)?.slug || "free";
    if (slug === currentSlug) return;
    setAssigningPlanFor(userId);
    try {
      await assignMerchantPlan(userId, slug);
      const plan = plans.find((p) => p.slug === slug);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, plan_id: plan?.id ?? u.plan_id } : u))
      );
      toast({ title: "تم", description: `تم تعيين خطة ${plan?.name || slug}` });
    } catch (e: unknown) {
      toast({ title: "خطأ", description: planAssignErrorMessage(e), variant: "destructive" });
    } finally {
      setAssigningPlanFor(null);
    }
  };

  if (ctxLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return <div className="p-6 text-center text-muted-foreground">هذا القسم مخصص للأدمن فقط.</div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={SettingsIcon}
        title="الإعدادات"
        description="إدارة المستخدمين، كروت الشحن، المتاجر والصلاحيات"
        iconGradient="from-slate-600 to-slate-800"
      />

      <Tabs defaultValue="users" dir="rtl" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
          <TabsTrigger value="cards">كروت الشحن</TabsTrigger>
          <TabsTrigger value="stores">المتاجر</TabsTrigger>
          <TabsTrigger value="plans">خطط الاشتراك</TabsTrigger>
          <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6 mt-4">
          <Card>
        <CardHeader><CardTitle>اسم النظام</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label>اسم النظام (يظهر في صفحة تسجيل الدخول)</Label>
          <Input value={systemName} onChange={(e) => setSystemName(e.target.value)} placeholder="عدسات ميار" />
          <Button onClick={saveSystemName} disabled={savingName || !systemName.trim()}>
            {savingName ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>المحفظة ورسوم الطلبات</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">عند التفعيل، يُخصم مبلغ ثابت من محفظة المستخدم عن كل طلب جديد. إن لم يكفِ الرصيد، يتم قبول الطلب وقفل بياناته (لا يمكن إرساله للشحن) حتى يشحن المستخدم محفظته.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>رسوم كل طلب</Label>
              <Input type="number" min="0" step="0.01" value={orderFee} onChange={(e) => setOrderFee(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>تفعيل النظام</Label>
              <Select value={walletEnabled ? "1" : "0"} onValueChange={(v) => setWalletEnabled(v === "1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">مفعّل</SelectItem>
                  <SelectItem value="0">معطّل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={async () => {
            setSavingWallet(true);
            try {
              const payload: any = { order_fee: Number(orderFee) || 0, wallet_enabled: walletEnabled, updated_at: new Date().toISOString() };
              if (systemNameId) {
                const { error } = await supabase.from("app_settings").update(payload).eq("id", systemNameId);
                if (error) throw error;
              } else {
                const { data, error } = await supabase.from("app_settings").insert({ system_name: systemName || "النظام", ...payload }).select("id").single();
                if (error) throw error;
                setSystemNameId(data.id);
              }
              toast({ title: "تم", description: "تم حفظ إعدادات المحفظة" });
            } catch (e: any) {
              toast({ title: "خطأ", description: e.message, variant: "destructive" });
            } finally { setSavingWallet(false); }
          }} disabled={savingWallet}>
            {savingWallet ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> إضافة مستخدم جديد</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>كلمة المرور</Label><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="space-y-2"><Label>اسم المستخدم (للمتجر)</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} placeholder="ahmed" /></div>
          <div className="space-y-2"><Label>الاسم الكامل (اختياري)</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="md:col-span-2">
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء المستخدم"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>المستخدمون ({users.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {users.map((u) => {
            const isAdminUser = u.roles.includes("admin");
            const currentPlanSlug = plans.find((p) => p.id === u.plan_id)?.slug || "free";
            return (
              <div key={u.user_id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{u.username}</span>
                    {isAdminUser && <Badge variant="default">أدمن</Badge>}
                    {!u.is_active && <Badge variant="destructive">معطّل</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  {!isAdminUser && plans.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <Label className="text-xs text-muted-foreground shrink-0">الخطة:</Label>
                      <Select
                        value={currentPlanSlug}
                        onValueChange={(slug) => handleAssignPlan(u.user_id, slug)}
                        disabled={assigningPlanFor === u.user_id}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent searchable={false}>
                          {plans.map((p) => (
                            <SelectItem key={p.id} value={p.slug}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {!isAdminUser && (
                  <div className="flex flex-wrap gap-2">
                    <Dialog open={resetPwd?.user_id === u.user_id} onOpenChange={(o) => !o && setResetPwd(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setResetPwd({ user_id: u.user_id, password: "" })}>
                          <KeyRound className="w-4 h-4 ml-1" /> كلمة المرور
                        </Button>
                      </DialogTrigger>
                      <DialogContent dir="rtl">
                        <DialogHeader><DialogTitle>تغيير كلمة المرور</DialogTitle></DialogHeader>
                        <PasswordInput value={resetPwd?.password || ""} onChange={(e) => setResetPwd((p) => p ? { ...p, password: e.target.value } : null)} placeholder="كلمة مرور جديدة" />
                        <Button onClick={handleReset}>حفظ</Button>
                      </DialogContent>
                    </Dialog>

                    <Button size="sm" variant="outline" onClick={() => handleToggle(u)}>
                      <Power className="w-4 h-4 ml-1" /> {u.is_active ? "تعطيل" : "تفعيل"}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف المستخدم؟</AlertDialogTitle>
                          <AlertDialogDescription>سيتم حذف الحساب وجميع بياناته نهائياً.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(u.user_id)}>حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="cards" className="mt-4">
          <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
            <AdminCards />
          </Suspense>
        </TabsContent>
        <TabsContent value="stores" className="mt-4">
          <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
            <AdminStores />
          </Suspense>
        </TabsContent>
        <TabsContent value="plans" className="mt-4">
          <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
            <AdminPlans />
          </Suspense>
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
            <PermissionGroups />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
