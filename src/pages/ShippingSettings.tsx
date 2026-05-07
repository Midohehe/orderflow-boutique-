import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Truck, RefreshCw, Copy } from "lucide-react";

interface ShippingSettings {
  id?: string;
  email: string;
  password: string;
  endpoint: string;
  enabled: boolean;
}

const DEFAULT: ShippingSettings = {
  email: "",
  password: "",
  endpoint: "https://turboex.ly:8001/graphql",
  enabled: false,
};

const ShippingSettingsPage = () => {
  const [settings, setSettings] = useState<ShippingSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [whCount, setWhCount] = useState<number>(0);
  const [webhookUrl, setWebhookUrl] = useState<string>("");

  const loadCount = async () => {
    const { count } = await supabase.from("shipping_warehouse_products").select("*", { count: "exact", head: true });
    setWhCount(count || 0);
  };
  useEffect(() => { loadCount(); }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("webhook_token")
        .eq("user_id", user.id)
        .maybeSingle();
      const token = (data as any)?.webhook_token;
      if (token) {
        const base = import.meta.env.VITE_SUPABASE_URL;
        setWebhookUrl(`${base}/functions/v1/carrier-webhook?token=${token}`);
      }
    })();
  }, []);

  const handleSyncProducts = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-warehouse-products");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "تمت المزامنة", description: `تم جلب ${(data as any)?.count ?? 0} منتج من مخزن الشركة` });
      await loadCount();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shipping_settings")
        .select("*")
        .maybeSingle();
      if (data) setSettings(data as ShippingSettings);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      email: settings.email.trim(),
      password: settings.password,
      endpoint: settings.endpoint.trim(),
      enabled: settings.enabled,
    };
    const { error } = settings.id
      ? await supabase.from("shipping_settings").update(payload).eq("id", settings.id)
      : await supabase.from("shipping_settings").insert({ ...payload, owner_id: user!.id }).select().single().then(r => {
          if (r.data) setSettings(r.data as ShippingSettings);
          return { error: r.error };
        });
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحفظ", description: "تم حفظ إعدادات شركة الشحن" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">إعدادات شركة الشحن</h1>
          <p className="text-sm text-muted-foreground">Accurate / Turbo Express</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>بيانات تسجيل الدخول</CardTitle>
          <CardDescription>
            أدخل البريد الإلكتروني وكلمة المرور الخاصين بحسابك في شركة الشحن.
            تُستخدم هذه البيانات لإرسال الطلبيات تلقائياً عبر API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">تفعيل التكامل</Label>
              <p className="text-xs text-muted-foreground">عند التفعيل يظهر زر الإرسال في صفحة الطلبيات</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="example@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              value={settings.password}
              onChange={(e) => setSettings({ ...settings, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint">رابط الـ API</Label>
            <Input
              id="endpoint"
              dir="ltr"
              value={settings.endpoint}
              onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            حفظ الإعدادات
          </Button>

          <div className="border-t pt-4 space-y-2">
            <Label>منتجات مخزن شركة الشحن</Label>
            <p className="text-sm text-muted-foreground">
              المنتجات المتزامنة حالياً: <span className="font-bold">{whCount}</span>
            </p>
            <Button onClick={handleSyncProducts} disabled={syncing || !settings.enabled} variant="secondary" className="w-full">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <RefreshCw className="w-4 h-4 ml-2" />}
              مزامنة منتجات المخزن من شركة الشحن
            </Button>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>رابط الويب هوك لتحديث حالات الشحنات</Label>
            <p className="text-xs text-muted-foreground">
              أرسل هذا الرابط لشركة الشحن (Turbo) ليُرسلوا تحديثات حالة الشحنة عليه. سيتم تحديث "حالة شركة التوصيل" تلقائياً في الطلبات بناءً على كود الشحن.
            </p>
            <div className="flex gap-2">
              <Input dir="ltr" readOnly value={webhookUrl} placeholder="جاري التحميل..." />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (!webhookUrl) return;
                  navigator.clipboard.writeText(webhookUrl);
                  toast({ title: "تم النسخ" });
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShippingSettingsPage;
