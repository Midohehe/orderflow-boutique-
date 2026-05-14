import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Trash2, KeyRound, CalendarPlus, Power, Save, Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface ManagedUser {
  user_id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  subscription_ends_at: string | null;
  roles: string[];
}

const Settings = () => {
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", username: "", full_name: "", duration_months: "1",
  });
  const [resetPwd, setResetPwd] = useState<{ user_id: string; password: string } | null>(null);
  const [extendUser, setExtendUser] = useState<{ user_id: string; months: string } | null>(null);
  const [systemName, setSystemName] = useState("");
  const [systemNameId, setSystemNameId] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [subPrice, setSubPrice] = useState("0");
  const [subCurrency, setSubCurrency] = useState("د.ل");
  const [savingPrice, setSavingPrice] = useState(false);

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
        const { data } = await supabase.from("app_settings").select("id, system_name, subscription_price, subscription_currency").limit(1).maybeSingle();
        if (data) {
          setSystemName(data.system_name || "");
          setSystemNameId(data.id);
          setSubPrice(String(data.subscription_price ?? 0));
          setSubCurrency(data.subscription_currency || "د.ل");
        }
      })();
    } else if (!ctxLoading) setLoading(false);
  }, [ctxLoading, isAdmin]);

  const saveSubPrice = async () => {
    setSavingPrice(true);
    try {
      const payload = { subscription_price: Number(subPrice) || 0, subscription_currency: subCurrency, updated_at: new Date().toISOString() };
      if (systemNameId) {
        const { error } = await supabase.from("app_settings").update(payload).eq("id", systemNameId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("app_settings").insert({ system_name: systemName || "النظام", ...payload }).select("id").single();
        if (error) throw error;
        setSystemNameId(data.id);
      }
      toast({ title: "تم", description: "تم حفظ سعر الاشتراك" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSavingPrice(false); }
  };

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
      setForm({ email: "", password: "", username: "", full_name: "", duration_months: "1" });
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleExtend = async () => {
    if (!extendUser) return;
    try {
      await callApi("extend", { user_id: extendUser.user_id, duration_months: extendUser.months });
      toast({ title: "تم", description: "تم تمديد الاشتراك" });
      setExtendUser(null);
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
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
        title="الإعدادات - إدارة المستخدمين"
        description="إنشاء حسابات جديدة، تمديد الاشتراكات وتغيير كلمات المرور"
        iconGradient="from-slate-600 to-slate-800"
      />

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
        <CardHeader><CardTitle>سعر الاشتراك</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">يظهر هذا السعر في لوحة تحكم المستخدمين</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>السعر الشهري</Label>
              <Input type="number" min="0" step="0.01" value={subPrice} onChange={(e) => setSubPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>العملة</Label>
              <Input value={subCurrency} onChange={(e) => setSubCurrency(e.target.value)} placeholder="د.ل" />
            </div>
          </div>
          <Button onClick={saveSubPrice} disabled={savingPrice}>
            {savingPrice ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> إضافة مستخدم جديد</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>كلمة المرور</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="space-y-2"><Label>اسم المستخدم (للمتجر)</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} placeholder="ahmed" /></div>
          <div className="space-y-2"><Label>الاسم الكامل (اختياري)</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-2 md:col-span-2">
            <Label>مدة الاشتراك</Label>
            <Select value={form.duration_months} onValueChange={(v) => setForm({ ...form, duration_months: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">شهر</SelectItem>
                <SelectItem value="3">3 أشهر</SelectItem>
                <SelectItem value="6">6 أشهر</SelectItem>
                <SelectItem value="12">سنة</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            const expired = u.subscription_ends_at && new Date(u.subscription_ends_at) < new Date();
            const isAdminUser = u.roles.includes("admin");
            return (
              <div key={u.user_id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{u.username}</span>
                    {isAdminUser && <Badge variant="default">أدمن</Badge>}
                    {!u.is_active && <Badge variant="destructive">معطّل</Badge>}
                    {expired && !isAdminUser && <Badge variant="destructive">منتهي</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  {u.subscription_ends_at && !isAdminUser && (
                    <p className="text-xs text-muted-foreground">ينتهي: {new Date(u.subscription_ends_at).toLocaleDateString("ar")}</p>
                  )}
                </div>
                {!isAdminUser && (
                  <div className="flex flex-wrap gap-2">
                    <Dialog open={extendUser?.user_id === u.user_id} onOpenChange={(o) => !o && setExtendUser(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setExtendUser({ user_id: u.user_id, months: "1" })}>
                          <CalendarPlus className="w-4 h-4 ml-1" /> تمديد
                        </Button>
                      </DialogTrigger>
                      <DialogContent dir="rtl">
                        <DialogHeader><DialogTitle>تمديد الاشتراك</DialogTitle></DialogHeader>
                        <Select value={extendUser?.months || "1"} onValueChange={(v) => setExtendUser((p) => p ? { ...p, months: v } : null)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">شهر</SelectItem>
                            <SelectItem value="3">3 أشهر</SelectItem>
                            <SelectItem value="6">6 أشهر</SelectItem>
                            <SelectItem value="12">سنة</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={handleExtend}>تأكيد</Button>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={resetPwd?.user_id === u.user_id} onOpenChange={(o) => !o && setResetPwd(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setResetPwd({ user_id: u.user_id, password: "" })}>
                          <KeyRound className="w-4 h-4 ml-1" /> كلمة المرور
                        </Button>
                      </DialogTrigger>
                      <DialogContent dir="rtl">
                        <DialogHeader><DialogTitle>تغيير كلمة المرور</DialogTitle></DialogHeader>
                        <Input value={resetPwd?.password || ""} onChange={(e) => setResetPwd((p) => p ? { ...p, password: e.target.value } : null)} placeholder="كلمة مرور جديدة" />
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
    </div>
  );
};

export default Settings;
