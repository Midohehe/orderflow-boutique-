import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

export default function OpeningBalanceSettings({ settingsId }: { settingsId: string | null }) {
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("د.ل");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!settingsId) { setLoading(false); return; }
    setLoading(true);
    setLoadError("");
    void (async () => {
      try {
        const { data, error } = await supabase.from("app_settings")
          .select("opening_balance_enabled, opening_balance_amount, subscription_currency")
          .eq("id", settingsId).single();
        if (error) throw error;
        if (!cancelled) {
          setEnabled(data.opening_balance_enabled);
          setAmount(String(data.opening_balance_amount));
          setCurrency(data.subscription_currency || "د.ل");
        }
      } catch {
        if (!cancelled) setLoadError("تعذّر تحميل إعداد الرصيد الافتتاحي. أعد تحميل الصفحة وحاول مرة أخرى.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [settingsId]);

  const save = async () => {
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value < 0 || value > 9999999999.99 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 0.001 || (enabled && value === 0)) {
      toast({ title: "قيمة غير صحيحة", description: "أدخل رصيدًا موجبًا بمنزلتين عشريتين كحد أقصى عند التفعيل.", variant: "destructive" });
      return;
    }
    if (!settingsId || loading || saving || loadError) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings")
        .update({ opening_balance_enabled: enabled, opening_balance_amount: value, updated_at: new Date().toISOString() })
        .eq("id", settingsId).select("id").single();
      if (error) throw error;
      toast({ title: "تم الحفظ", description: enabled ? "سيُضاف الرصيد مرة واحدة للحسابات الجديدة فقط." : "تم إيقاف الرصيد الافتتاحي للحسابات الجديدة." });
    } catch {
      toast({ title: "تعذّر الحفظ", description: "لم يتم تأكيد تحديث الإعداد. أعد تحميل الصفحة وحاول مرة أخرى.", variant: "destructive" });
    } finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle>الرصيد الافتتاحي للحسابات الجديدة</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">رصيد يُضاف تلقائيًا إلى محفظة الحساب الجديد مرة واحدة. لا يغيّر أرصدة الحسابات الموجودة، ولا يُمنح للمستخدمين الفرعيين.</p>
        {!settingsId && <p className="text-sm text-muted-foreground">احفظ اسم النظام أولًا لإنشاء الإعدادات.</p>}
        {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
        <div className="flex items-center gap-3">
          <Switch id="opening-balance-enabled" checked={enabled} onCheckedChange={setEnabled}
            disabled={loading || saving || !settingsId || !!loadError} />
          <Label htmlFor="opening-balance-enabled">تفعيل الرصيد الافتتاحي</Label>
        </div>
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="opening-balance-amount">قيمة الرصيد ({currency})</Label>
          <Input id="opening-balance-amount" type="number" min="0" max="9999999999.99" step="0.01" dir="ltr"
            value={amount} onChange={event => setAmount(event.target.value)}
            disabled={loading || saving || !settingsId || !!loadError} />
        </div>
        <Button type="button" onClick={save} disabled={loading || saving || !settingsId || !!loadError}>
          {loading || saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
          حفظ الرصيد الافتتاحي
        </Button>
      </CardContent>
    </Card>
  );
}
