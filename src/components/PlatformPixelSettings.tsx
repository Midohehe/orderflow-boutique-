import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { invalidateAppSettingsCache } from "@/lib/appSettings";

export default function PlatformPixelSettings({ settingsId }: { settingsId: string | null }) {
  const [pixelId, setPixelId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setLoadError(false);
    if (!settingsId) return;
    supabase.from("app_settings").select("platform_facebook_pixel_id").eq("id", settingsId).single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadError(true);
        else {
          setPixelId(data.platform_facebook_pixel_id || "");
          setLoaded(true);
        }
      });
    return () => { active = false; };
  }, [settingsId]);

  const save = async () => {
    const value = pixelId.trim();
    if (value && !/^\d{5,20}$/.test(value)) {
      toast({ title: "رقم غير صالح", description: "أدخل رقم Pixel ID من 5 إلى 20 رقمًا فقط.", variant: "destructive" });
      return;
    }
    if (!settingsId || !loaded) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings")
        .update({ platform_facebook_pixel_id: value || null, updated_at: new Date().toISOString() })
        .eq("id", settingsId).select("id").single();
      if (error) throw error;
      setPixelId(value);
      invalidateAppSettingsCache();
      toast({ title: "تم حفظ رقم بكسل المنصة" });
    } catch {
      toast({ title: "تعذّر حفظ رقم البكسل", description: "حاول مرة أخرى.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return <Card>
    <CardHeader><CardTitle>بكسل فيسبوك للمنصة</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">رقم بكسل إعلانات منصة وصلة. إعدادات بكسل كل متجر مستقلة عن هذا الرقم.</p>
      <Label htmlFor="platform-facebook-pixel">رقم Pixel ID</Label>
      <Input id="platform-facebook-pixel" dir="ltr" inputMode="numeric" maxLength={20}
        placeholder="123456789012345" value={pixelId} disabled={!loaded || saving}
        onChange={(event) => setPixelId(event.target.value)} />
      <p className="text-sm text-muted-foreground">يُرسل البكسل زيارات الصفحة الرئيسية وصفحة التسجيل واكتمال تسجيل الحسابات الجديدة بعد تأكيد البريد. يمكنك مسح الرقم لإيقاف التتبّع للزيارات الجديدة.</p>
      {loadError && <p role="alert" className="text-sm text-destructive">تعذّر تحميل إعدادات البكسل. أعد تحميل الصفحة للمحاولة مجددًا.</p>}
      <Button onClick={save} disabled={!loaded || saving}>{saving ? "جارٍ الحفظ..." : "حفظ رقم البكسل"}</Button>
    </CardContent>
  </Card>;
}
