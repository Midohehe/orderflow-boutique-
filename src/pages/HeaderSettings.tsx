import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, LayoutTemplate } from "lucide-react";
import AccountInfoCard from "@/components/AccountInfoCard";

interface HeaderSettingsRow {
  id: string;
  logo_text: string;
  logo_image: string | null;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  tiktok_url: string | null;
}

const HeaderSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<HeaderSettingsRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("header_settings")
        .select("*")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error(error);
        toast({ title: "خطأ", description: "تعذر تحميل إعدادات الهيدر", variant: "destructive" });
      }
      if (data) setRow(data as HeaderSettingsRow);
      else {
        const { data: created } = await supabase
          .from("header_settings")
          .insert({ owner_id: user.id, logo_text: "متجري" })
          .select("*")
          .single();
        if (created) setRow(created as HeaderSettingsRow);
      }
      setLoading(false);
    })();
  }, []);

  const update = (k: keyof HeaderSettingsRow, v: string) => {
    if (!row) return;
    setRow({ ...row, [k]: v });
  };

  const save = async () => {
    if (!row) return;
    if (!row.logo_text.trim()) {
      toast({ title: "خطأ", description: "اسم المتجر مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("header_settings")
      .update({
        logo_text: row.logo_text,
        logo_image: row.logo_image || null,
        tagline: row.tagline || "",
        phone: row.phone || "",
        email: row.email || "",
        instagram_url: row.instagram_url || "",
        facebook_url: row.facebook_url || "",
        whatsapp_url: row.whatsapp_url || "",
        tiktok_url: row.tiktok_url || "",
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      console.error(error);
      toast({ title: "خطأ", description: "تعذر حفظ الإعدادات", variant: "destructive" });
      return;
    }
    toast({ title: "تم الحفظ", description: "تم تحديث إعدادات الهيدر بنجاح" });
  };

  if (loading || !row) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-3">
        <LayoutTemplate className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">إعدادات هيدر المتجر</h1>
          <p className="text-sm text-muted-foreground">عدّل شعار المتجر، التواصل، وروابط السوشيال ميديا</p>
        </div>
      </div>

      <AccountInfoCard />

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>الهوية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="logo_text">اسم المتجر *</Label>
            <Input id="logo_text" value={row.logo_text} onChange={(e) => update("logo_text", e.target.value)} placeholder="عدسات ميار" />
          </div>
          <div>
            <Label htmlFor="tagline">الشعار التسويقي</Label>
            <Textarea
              id="tagline"
              value={row.tagline || ""}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="عدسات لاصقة ملونة بأعلى جودة"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="logo_image">رابط صورة الشعار (URL)</Label>
            <Input
              id="logo_image"
              value={row.logo_image || ""}
              onChange={(e) => update("logo_image", e.target.value)}
              placeholder="https://..."
              dir="ltr"
            />
            {row.logo_image && (
              <div className="mt-3 flex items-center gap-3">
                <img src={row.logo_image} alt="Logo preview" className="w-16 h-16 rounded-full object-cover border-2 border-primary/30" />
                <span className="text-xs text-muted-foreground">معاينة الشعار</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>معلومات التواصل</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input id="phone" value={row.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="+218..." dir="ltr" />
          </div>
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" value={row.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="info@example.com" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>روابط التواصل الاجتماعي</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="instagram_url">انستجرام</Label>
            <Input id="instagram_url" value={row.instagram_url || ""} onChange={(e) => update("instagram_url", e.target.value)} placeholder="https://instagram.com/..." dir="ltr" />
          </div>
          <div>
            <Label htmlFor="facebook_url">فيسبوك</Label>
            <Input id="facebook_url" value={row.facebook_url || ""} onChange={(e) => update("facebook_url", e.target.value)} placeholder="https://facebook.com/..." dir="ltr" />
          </div>
          <div>
            <Label htmlFor="tiktok_url">تيك توك</Label>
            <Input id="tiktok_url" value={row.tiktok_url || ""} onChange={(e) => update("tiktok_url", e.target.value)} placeholder="https://tiktok.com/@..." dir="ltr" />
          </div>
          <div>
            <Label htmlFor="whatsapp_url">واتساب</Label>
            <Input id="whatsapp_url" value={row.whatsapp_url || ""} onChange={(e) => update("whatsapp_url", e.target.value)} placeholder="https://wa.me/218..." dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ التغييرات
        </Button>
      </div>
    </div>
  );
};

export default HeaderSettings;
