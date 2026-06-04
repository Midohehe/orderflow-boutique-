import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Crosshair, Facebook, BarChart3, Save, Loader2, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useUserContext } from "@/hooks/useUserContext";

interface PixelSettings {
  id?: string;
  facebook_pixel_id: string;
  facebook_enabled: boolean;
  tiktok_pixel_id: string;
  tiktok_enabled: boolean;
  google_analytics_id: string;
  google_enabled: boolean;
  snapchat_pixel_id: string;
  snapchat_enabled: boolean;
}

const PixelSettingsPage = () => {
  const { activeStoreId } = useStoreContext();
  const { effectiveOwnerId } = useUserContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [pixels, setPixels] = useState<PixelSettings>({
    facebook_pixel_id: "",
    facebook_enabled: false,
    tiktok_pixel_id: "",
    tiktok_enabled: false,
    google_analytics_id: "",
    google_enabled: false,
    snapchat_pixel_id: "",
    snapchat_enabled: false,
  });

  useEffect(() => {
    loadSettings();
  }, [activeStoreId, effectiveOwnerId]);

  const emptyPixels = (): PixelSettings => ({
    facebook_pixel_id: "",
    facebook_enabled: false,
    tiktok_pixel_id: "",
    tiktok_enabled: false,
    google_analytics_id: "",
    google_enabled: false,
    snapchat_pixel_id: "",
    snapchat_enabled: false,
  });

  const loadSettings = async () => {
    try {
      if (!activeStoreId || !effectiveOwnerId) {
        setLoading(false);
        setSettingsId(null);
        setPixels(emptyPixels());
        return;
      }
      const { data, error } = await supabase
        .from("pixel_settings")
        .select("*")
        .eq("store_id", activeStoreId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const row = data?.[0];
      if (row) {
        setSettingsId(row.id);
        setPixels({
          facebook_pixel_id: row.facebook_pixel_id || "",
          facebook_enabled: row.facebook_enabled || false,
          tiktok_pixel_id: row.tiktok_pixel_id || "",
          tiktok_enabled: row.tiktok_enabled || false,
          google_analytics_id: row.google_analytics_id || "",
          google_enabled: row.google_enabled || false,
          snapchat_pixel_id: row.snapchat_pixel_id || "",
          snapchat_enabled: row.snapchat_enabled || false,
        });
      } else {
        setSettingsId(null);
        setPixels(emptyPixels());
      }
    } catch (error) {
      console.error("Error loading pixel settings:", error);
      toast({
        title: "خطأ",
        description: "تعذر تحميل إعدادات البيكسل",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validatePixels = (): string | null => {
    const trim = (s: string) => s.trim();
    if (pixels.facebook_enabled && !trim(pixels.facebook_pixel_id)) {
      return "أدخل معرف Facebook Pixel أو عطّل المنصة";
    }
    if (pixels.tiktok_enabled && !trim(pixels.tiktok_pixel_id)) {
      return "أدخل معرف TikTok Pixel أو عطّل المنصة";
    }
    if (pixels.google_enabled && !trim(pixels.google_analytics_id)) {
      return "أدخل معرف Google Analytics أو عطّل المنصة";
    }
    if (pixels.snapchat_enabled && !trim(pixels.snapchat_pixel_id)) {
      return "أدخل معرف Snapchat Pixel أو عطّل المنصة";
    }
    if (pixels.facebook_enabled && !/^\d{5,20}$/.test(trim(pixels.facebook_pixel_id))) {
      return "معرف Facebook Pixel يجب أن يكون أرقاماً فقط (15 رقم تقريباً)";
    }
    if (pixels.google_enabled && !/^G-[A-Z0-9]+$/i.test(trim(pixels.google_analytics_id))) {
      return "معرف Google Analytics يجب أن يبدأ بـ G-";
    }
    return null;
  };

  const handleSave = async () => {
    if (!activeStoreId || !effectiveOwnerId) {
      toast({ title: "خطأ", description: "اختر متجراً أولاً", variant: "destructive" });
      return;
    }
    const validationError = validatePixels();
    if (validationError) {
      toast({ title: "خطأ", description: validationError, variant: "destructive" });
      return;
    }

    const payload = {
      owner_id: effectiveOwnerId,
      store_id: activeStoreId,
      facebook_pixel_id: pixels.facebook_pixel_id.trim() || null,
      facebook_enabled: pixels.facebook_enabled,
      tiktok_pixel_id: pixels.tiktok_pixel_id.trim() || null,
      tiktok_enabled: pixels.tiktok_enabled,
      google_analytics_id: pixels.google_analytics_id.trim() || null,
      google_enabled: pixels.google_enabled,
      snapchat_pixel_id: pixels.snapchat_pixel_id.trim() || null,
      snapchat_enabled: pixels.snapchat_enabled,
    };

    setSaving(true);
    try {
      if (settingsId) {
        const { error } = await supabase
          .from("pixel_settings")
          .update(payload)
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("pixel_settings")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      toast({
        title: "تم الحفظ",
        description: "تم حفظ إعدادات البيكسل — ستُطبَّق على صفحات الهبوط فوراً",
      });
    } catch (error) {
      console.error("Error saving pixel settings:", error);
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء حفظ الإعدادات",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeStoreId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        اختر متجراً من القائمة أعلاه لإعداد البيكسل.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-md">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">إعدادات البيكسل</h1>
          <p className="text-sm text-muted-foreground">إعداد أكواد التتبع والبيكسل</p>
        </div>
      </div>

      <div className="grid gap-5">
        <SectionCard
          icon={Facebook}
          title="Facebook Pixel"
          description="تتبع تحويلات فيسبوك"
          iconColor="bg-[#1877F2]"
          action={
            <Switch
              checked={pixels.facebook_enabled}
              onCheckedChange={(checked) => setPixels({ ...pixels, facebook_enabled: checked })}
            />
          }
        >
          <div className="space-y-2">
            <Label className="font-semibold">معرف البيكسل</Label>
            <Input
              value={pixels.facebook_pixel_id}
              onChange={(e) => setPixels({ ...pixels, facebook_pixel_id: e.target.value })}
              placeholder="123456789012345"
              dir="ltr"
              disabled={!pixels.facebook_enabled}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">من Facebook Events Manager</p>
          </div>
        </SectionCard>

        <SectionCard
          icon={Activity}
          title="TikTok Pixel"
          description="تتبع تحويلات تيك توك"
          iconColor="bg-foreground"
          action={
            <Switch
              checked={pixels.tiktok_enabled}
              onCheckedChange={(checked) => setPixels({ ...pixels, tiktok_enabled: checked })}
            />
          }
        >
          <div className="space-y-2">
            <Label className="font-semibold">معرف البيكسل</Label>
            <Input
              value={pixels.tiktok_pixel_id}
              onChange={(e) => setPixels({ ...pixels, tiktok_pixel_id: e.target.value })}
              placeholder="XXXXXXXXXXXXX"
              dir="ltr"
              disabled={!pixels.tiktok_enabled}
              className="font-mono"
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={BarChart3}
          title="Google Analytics"
          description="تحليلات جوجل"
          iconColor="bg-[#E37400]"
          action={
            <Switch
              checked={pixels.google_enabled}
              onCheckedChange={(checked) => setPixels({ ...pixels, google_enabled: checked })}
            />
          }
        >
          <div className="space-y-2">
            <Label className="font-semibold">معرف التتبع</Label>
            <Input
              value={pixels.google_analytics_id}
              onChange={(e) => setPixels({ ...pixels, google_analytics_id: e.target.value })}
              placeholder="G-XXXXXXXXXX"
              dir="ltr"
              disabled={!pixels.google_enabled}
              className="font-mono"
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={Crosshair}
          title="Snapchat Pixel"
          description="تتبع تحويلات سناب شات"
          iconColor="bg-yellow-400"
          action={
            <Switch
              checked={pixels.snapchat_enabled}
              onCheckedChange={(checked) => setPixels({ ...pixels, snapchat_enabled: checked })}
            />
          }
        >
          <div className="space-y-2">
            <Label className="font-semibold">معرف البيكسل</Label>
            <Input
              value={pixels.snapchat_pixel_id}
              onChange={(e) => setPixels({ ...pixels, snapchat_pixel_id: e.target.value })}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              dir="ltr"
              disabled={!pixels.snapchat_enabled}
              className="font-mono"
            />
          </div>
        </SectionCard>

        <Button
          onClick={handleSave}
          className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold gap-2"
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
};

export default PixelSettingsPage;