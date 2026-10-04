import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Settings as SettingsIcon, Users, SlidersHorizontal, Store, ShieldCheck, CreditCard, Globe } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import OpeningBalanceSettings from "@/components/OpeningBalanceSettings";
import PlatformPixelSettings from "@/components/PlatformPixelSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const AdminCards = lazy(() => import("./AdminCards"));
const AdminStores = lazy(() => import("./AdminStores"));
const PermissionGroups = lazy(() => import("./PermissionGroups"));
const AdminUserDirectory = lazy(() => import("@/components/AdminUserDirectory"));
const PlatformSignupEditor = lazy(() => import("@/components/PlatformSignupEditor"));
const pending = <div role="status" className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /><span className="sr-only">جاري التحميل</span></div>;

export default function Settings() {
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const [systemName, setSystemName] = useState("");
  const [systemNameId, setSystemNameId] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [orderFee, setOrderFee] = useState("0");
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  useEffect(() => {
    if (ctxLoading || !isAdmin) return;
    let active = true;
    void supabase.from("app_settings").select("id,system_name,order_fee,wallet_enabled").limit(1).maybeSingle().then(({data,error}) => {
      if (!active) return;
      if (error) setSettingsError(error.message);
      else if (data) { setSystemName(data.system_name || ""); setSystemNameId(data.id); setOrderFee(String(data.order_fee ?? 0)); setWalletEnabled(Boolean(data.wallet_enabled)); }
      setSettingsLoading(false);
    });
    return () => { active = false; };
  }, [ctxLoading,isAdmin]);
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
    } catch (e: unknown) {
      toast({ title: "خطأ", description: e instanceof Error ? e.message : "تعذّر الحفظ", variant: "destructive" });
    } finally { setSavingName(false); }
  };


  if (ctxLoading) return pending;
  if (!isAdmin) return <div className="p-6 text-center text-muted-foreground">هذا القسم مخصص للسوبر أدمن فقط.</div>;
  return <div className="space-y-6" dir="rtl">
    <PageHeader icon={SettingsIcon} title="إدارة المنصة" description="إدارة حسابات المستخدمين والمتاجر وإعدادات وصلة." />
    <Tabs defaultValue="users" dir="rtl">
      <TabsList className="h-auto flex flex-wrap justify-start gap-1 bg-muted/50 p-1.5 rounded-xl">
        {[{value:"users",label:"المستخدمون",icon:Users},{value:"stores",label:"المتاجر",icon:Store},{value:"permissions",label:"الصلاحيات",icon:ShieldCheck},{value:"cards",label:"كروت الشحن",icon:CreditCard},{value:"signup-page",label:"صفحة تسجيل المتجر",icon:Globe},{value:"general",label:"الإعدادات العامة",icon:SlidersHorizontal}].map(tab => <TabsTrigger key={tab.value} value={tab.value} className="gap-2 py-2.5 rounded-lg"><tab.icon className="h-4 w-4" />{tab.label}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="users" className="mt-6"><Suspense fallback={pending}><AdminUserDirectory /></Suspense></TabsContent>
      <TabsContent value="signup-page" className="mt-6"><Suspense fallback={pending}><PlatformSignupEditor /></Suspense></TabsContent>
      <TabsContent value="general" className="mt-6 space-y-6">{settingsLoading ? pending : settingsError ? <p role="alert" className="text-destructive">تعذّر تحميل الإعدادات: {settingsError}</p> : <>
          <OpeningBalanceSettings settingsId={systemNameId} />
          <PlatformPixelSettings settingsId={systemNameId} />
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
              const payload = { order_fee: Number(orderFee) || 0, wallet_enabled: walletEnabled, updated_at: new Date().toISOString() };
              if (systemNameId) {
                const { error } = await supabase.from("app_settings").update(payload).eq("id", systemNameId);
                if (error) throw error;
              } else {
                const { data, error } = await supabase.from("app_settings").insert({ system_name: systemName || "النظام", ...payload }).select("id").single();
                if (error) throw error;
                setSystemNameId(data.id);
              }
              toast({ title: "تم", description: "تم حفظ إعدادات المحفظة" });
            } catch (e: unknown) {
              toast({ title: "خطأ", description: e instanceof Error ? e.message : "تعذّر الحفظ", variant: "destructive" });
            } finally { setSavingWallet(false); }
          }} disabled={savingWallet}>
            {savingWallet ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ
          </Button>
        </CardContent>
      </Card>

      </>}</TabsContent>
      <TabsContent value="stores" className="mt-6"><Suspense fallback={pending}><AdminStores /></Suspense></TabsContent>
      <TabsContent value="permissions" className="mt-6"><Suspense fallback={pending}><PermissionGroups /></Suspense></TabsContent>
      <TabsContent value="cards" className="mt-6"><Suspense fallback={pending}><AdminCards /></Suspense></TabsContent>
    </Tabs>
  </div>;
}
