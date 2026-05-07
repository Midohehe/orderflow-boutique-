import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Crosshair, Facebook, BarChart3, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
      <div>
        <h1 className="text-2xl font-bold text-foreground">إعدادات البيكسل</h1>
        <p className="text-muted-foreground">إعداد أكواد التتبع والبيكسل</p>
      </div>

      <div className="grid gap-6">
        {/* Facebook Pixel */}
        <Card className="card-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                  <Facebook className="w-5 h-5 text-[#1877F2]" />
                </div>
                <div>
                  <CardTitle className="text-lg">Facebook Pixel</CardTitle>
                  <CardDescription>تتبع تحويلات فيسبوك</CardDescription>
                </div>
              </div>
              <Switch
                checked={pixels.facebook_enabled}
                onCheckedChange={(checked) => setPixels({ ...pixels, facebook_enabled: checked })}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>معرف البيكسل</Label>
              <Input
                value={pixels.facebook_pixel_id}
                onChange={(e) => setPixels({ ...pixels, facebook_pixel_id: e.target.value })}
                placeholder="123456789012345"
                dir="ltr"
                disabled={!pixels.facebook_enabled}
              />
              <p className="text-xs text-muted-foreground">
                يمكنك الحصول على معرف البيكسل من Facebook Events Manager
              </p>
            </div>
          </CardContent>
        </Card>

        {/* TikTok Pixel */}
        <Card className="card-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-lg">TikTok Pixel</CardTitle>
                  <CardDescription>تتبع تحويلات تيك توك</CardDescription>
                </div>
              </div>
              <Switch
                checked={pixels.tiktok_enabled}
                onCheckedChange={(checked) => setPixels({ ...pixels, tiktok_enabled: checked })}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>معرف البيكسل</Label>
              <Input
                value={pixels.tiktok_pixel_id}
                onChange={(e) => setPixels({ ...pixels, tiktok_pixel_id: e.target.value })}
                placeholder="XXXXXXXXXXXXX"
                dir="ltr"
                disabled={!pixels.tiktok_enabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Google Analytics */}
        <Card className="card-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#E37400]/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#E37400]" />
                </div>
                <div>
                  <CardTitle className="text-lg">Google Analytics</CardTitle>
                  <CardDescription>تحليلات جوجل</CardDescription>
                </div>
              </div>
              <Switch
                checked={pixels.google_enabled}
                onCheckedChange={(checked) => setPixels({ ...pixels, google_enabled: checked })}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>معرف التتبع</Label>
              <Input
                value={pixels.google_analytics_id}
                onChange={(e) => setPixels({ ...pixels, google_analytics_id: e.target.value })}
                placeholder="G-XXXXXXXXXX"
                dir="ltr"
                disabled={!pixels.google_enabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Snapchat Pixel */}
        <Card className="card-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#FFFC00]/10 flex items-center justify-center">
                  <Crosshair className="w-5 h-5 text-[#FFFC00]" />
                </div>
                <div>
                  <CardTitle className="text-lg">Snapchat Pixel</CardTitle>
                  <CardDescription>تتبع تحويلات سناب شات</CardDescription>
                </div>
              </div>
              <Switch
                checked={pixels.snapchat_enabled}
                onCheckedChange={(checked) => setPixels({ ...pixels, snapchat_enabled: checked })}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>معرف البيكسل</Label>
              <Input
                value={pixels.snapchat_pixel_id}
                onChange={(e) => setPixels({ ...pixels, snapchat_pixel_id: e.target.value })}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                dir="ltr"
                disabled={!pixels.snapchat_enabled}
              />
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={handleSave} 
          className="w-full md:w-auto gradient-primary text-primary-foreground gap-2"
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