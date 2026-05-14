import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Crosshair, Facebook, BarChart3, Save, Loader2, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";

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
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("pixel_settings")
        .select("*")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        setPixels({
          facebook_pixel_id: data.facebook_pixel_id || "",
          facebook_enabled: data.facebook_enabled || false,
          tiktok_pixel_id: data.tiktok_pixel_id || "",
          tiktok_enabled: data.tiktok_enabled || false,
          google_analytics_id: data.google_analytics_id || "",
          google_enabled: data.google_enabled || false,
          snapchat_pixel_id: data.snapchat_pixel_id || "",
          snapchat_enabled: data.snapchat_enabled || false,
        });
      }
    } catch (error) {
      console.error("Error loading pixel settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settingsId) {
        // Update existing settings
        const { error } = await supabase
          .from("pixel_settings")
          .update({
            facebook_pixel_id: pixels.facebook_pixel_id,
            facebook_enabled: pixels.facebook_enabled,
            tiktok_pixel_id: pixels.tiktok_pixel_id,
            tiktok_enabled: pixels.tiktok_enabled,
            google_analytics_id: pixels.google_analytics_id,
            google_enabled: pixels.google_enabled,
            snapchat_pixel_id: pixels.snapchat_pixel_id,
            snapchat_enabled: pixels.snapchat_enabled,
          })
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        // Insert new settings
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("pixel_settings")
          .insert({
            owner_id: user!.id,
            facebook_pixel_id: pixels.facebook_pixel_id,
            facebook_enabled: pixels.facebook_enabled,
            tiktok_pixel_id: pixels.tiktok_pixel_id,
            tiktok_enabled: pixels.tiktok_enabled,
            google_analytics_id: pixels.google_analytics_id,
            google_enabled: pixels.google_enabled,
            snapchat_pixel_id: pixels.snapchat_pixel_id,
            snapchat_enabled: pixels.snapchat_enabled,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      toast({
        title: "تم الحفظ",
        description: "تم حفظ إعدادات البيكسل بنجاح",
      });
    } catch (error) {
      console.error("Error saving pixel settings:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ الإعدادات",
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