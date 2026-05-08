import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Truck, RefreshCw, Copy, Plus, Trash2 } from "lucide-react";

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
  const [mappings, setMappings] = useState<Array<{ id?: string; status_code: string; custom_label: string; color: string }>>([]);
  const [savingMappings, setSavingMappings] = useState(false);

  const COLOR_OPTIONS: Array<{ value: string; label: string; cls: string }> = [
    { value: "default", label: "افتراضي", cls: "bg-accent" },
    { value: "blue", label: "أزرق", cls: "bg-blue-500" },
    { value: "green", label: "أخضر", cls: "bg-green-600" },
    { value: "yellow", label: "أصفر", cls: "bg-yellow-400" },
    { value: "red", label: "أحمر", cls: "bg-red-600" },
    { value: "purple", label: "بنفسجي", cls: "bg-purple-600" },
    { value: "orange", label: "برتقالي", cls: "bg-orange-500" },
    { value: "pink", label: "وردي", cls: "bg-pink-500" },
    { value: "gray", label: "رمادي", cls: "bg-gray-500" },
  ];

  const DEFAULT_CODES: Array<{ code: string; label: string }> = [
    { code: "PRP", label: "جارى التجهيز" },
    { code: "PRPD", label: "تم التجهيز" },
    { code: "STD", label: "قيد الارسال للمندوب" },
    { code: "DEX", label: "متابعة" },
    { code: "HTR", label: "انتظار لإعادة التوصيل" },
    { code: "PKH", label: "انتظار لإعادة الالتقاط" },
    { code: "DTR", label: "تم التسليم" },
    { code: "DTRC", label: "تم التسليم والتحصيل" },
    { code: "DTRCP", label: "تم التسليم والسداد للعميل" },
    { code: "DTRUC", label: "تم التسليم دون تحصيل" },
    { code: "RTS", label: "راجع" },
    { code: "RTSD", label: "راجع لدى المندوب" },
    { code: "RTSC", label: "راجع لدى الشركة" },
    { code: "OTR", label: "قيد الإرجاع" },
    { code: "RTRN", label: "تم الإرجاع للراسل" },
    { code: "RCV", label: "ارتجاع للمخزن" },
    { code: "UPKBL", label: "جاهز للتفريغ" },
    { code: "UPKBD", label: "تم التفريغ" },
    { code: "BMR", label: "مناولة بين الفروع - وارد" },
    { code: "BMT", label: "مناولة بين الفروع - صادر" },
  ];

  const loadMappings = async () => {
    const [{ data }, { data: hidden }] = await Promise.all([
      supabase
        .from("carrier_status_mappings")
        .select("id, status_code, custom_label, color")
        .order("status_code"),
      supabase.from("hidden_default_carrier_codes").select("status_code"),
    ]);
    const existing = (data || []) as any[];
    const hiddenSet = new Set(((hidden || []) as any[]).map((h) => h.status_code));
    const merged = DEFAULT_CODES.filter((d) => !hiddenSet.has(d.code)).map((d) => {
      const found = existing.find((e) => e.status_code === d.code);
      return found
        ? { id: found.id, status_code: found.status_code, custom_label: found.custom_label, color: found.color || "default" }
        : { status_code: d.code, custom_label: d.label, color: "default" };
    });
    // Add any custom (non-default) codes the user already has
    existing
      .filter((e) => !DEFAULT_CODES.some((d) => d.code === e.status_code))
      .forEach((e) => merged.push({ id: e.id, status_code: e.status_code, custom_label: e.custom_label, color: e.color || "default" }));
    setMappings(merged);
  };

  useEffect(() => { loadMappings(); }, []);

  const updateMapping = (idx: number, field: "status_code" | "custom_label" | "color", value: string) => {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const addMapping = () => {
    setMappings((prev) => [...prev, { status_code: "", custom_label: "", color: "default" }]);
  };

  const removeMapping = async (idx: number) => {
    const m = mappings[idx];
    if (m.id) {
      await supabase.from("carrier_status_mappings").delete().eq("id", m.id);
    }
    // If it's a default code, remember the deletion so it doesn't reappear.
    if (DEFAULT_CODES.some((d) => d.code === m.status_code)) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("hidden_default_carrier_codes")
          .upsert({ owner_id: user.id, status_code: m.status_code }, { onConflict: "owner_id,status_code" });
      }
    }
    setMappings((prev) => prev.filter((_, i) => i !== idx));
    toast({ title: "تم الحذف" });
  };

  const saveMappings = async () => {
    setSavingMappings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("يجب تسجيل الدخول");
      const valid = mappings.filter((m) => m.status_code.trim() && m.custom_label.trim());
      const rows = valid.map((m) => ({
        owner_id: user.id,
        status_code: m.status_code.trim(),
        custom_label: m.custom_label.trim(),
        color: m.color || "default",
      }));
      const { error } = await supabase
        .from("carrier_status_mappings")
        .upsert(rows, { onConflict: "owner_id,status_code" });
      if (error) throw error;
      toast({ title: "تم الحفظ", description: "تم حفظ تخصيص أسماء الحالات" });
      await loadMappings();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingMappings(false);
    }
  };

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

          <div className="border-t pt-4 space-y-3">
            <div>
              <Label className="text-base font-bold">تخصيص أسماء حالات الشحن</Label>
              <p className="text-xs text-muted-foreground mt-1">
                حوّل أكواد الحالات القادمة من شركة الشحن إلى أسماء تفهمها (مثلاً: الكود <span className="font-mono">5</span> ← "تم التوصيل للزبون").
              </p>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[80px_1fr_120px_40px] gap-2 text-xs font-bold text-muted-foreground px-1">
                <span>الكود</span>
                <span>الاسم المعروض</span>
                <span>اللون</span>
                <span></span>
              </div>
              {mappings.map((m, idx) => (
                <div key={idx} className="grid grid-cols-[80px_1fr_120px_40px] gap-2 items-center">
                  <Input
                    dir="ltr"
                    value={m.status_code}
                    onChange={(e) => updateMapping(idx, "status_code", e.target.value)}
                    placeholder="5"
                    className="font-mono text-center"
                  />
                  <Input
                    value={m.custom_label}
                    onChange={(e) => updateMapping(idx, "custom_label", e.target.value)}
                    placeholder="مثال: تم التوصيل"
                  />
                  <select
                    value={m.color || "default"}
                    onChange={(e) => updateMapping(idx, "color", e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMapping(idx)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={addMapping} className="flex-1">
                <Plus className="w-4 h-4 ml-2" />
                إضافة حالة جديدة
              </Button>
              <Button type="button" onClick={saveMappings} disabled={savingMappings} className="flex-1">
                {savingMappings && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                حفظ التخصيصات
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShippingSettingsPage;
