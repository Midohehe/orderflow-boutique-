import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, LayoutTemplate, Store, Phone, Share2 } from "lucide-react";
import AccountInfoCard from "@/components/AccountInfoCard";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";

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
      const { data, error } = await supabase.from("header_settings").select("*").eq("owner_id", user.id).limit(1).maybeSingle();
      if (error) { console.error(error); toast({ title: "خطأ", description: "تعذر تحميل إعدادات الهيدر", variant: "destructive" }); }
      if (data) setRow(data as HeaderSettingsRow);
      else {
        const { data: created } = await supabase.from("header_settings").insert({ owner_id: user.id, logo_text: "متجري" }).select("*").single();
        if (created) setRow(created as HeaderSettingsRow);
      }
      setLoading(false);
    })();
  }, []);

  const update = (k: keyof HeaderSettingsRow, v: string) => { if (row) setRow({ ...row, [k]: v }); };

  const save = async () => {
    if (!row) return;
    if (!row.logo_text.trim()) { toast({ title: "خطأ", description: "اسم المتجر مطلوب", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("header_settings").update({
      logo_text: row.logo_text,
      logo_image: row.logo_image || null,
      tagline: row.tagline || "",
      phone: row.phone || "",
      email: row.email || "",
      instagram_url: row.instagram_url || "",
      facebook_url: row.facebook_url || "",
      whatsapp_url: row.whatsapp_url || "",
      tiktok_url: row.tiktok_url || "",
    }).eq("id", row.id);
    setSaving(false);
    if (error) { console.error(error); toast({ title: "خطأ", description: "تعذر حفظ الإعدادات", variant: "destructive" }); return; }
    toast({ title: "تم الحفظ", description: "تم تحديث إعدادات الهيدر بنجاح" });
  };

  if (loading || !row) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader icon={LayoutTemplate} title="إعدادات هيدر المتجر" description="الشعار، التواصل، وروابط السوشيال ميديا" iconGradient="from-sky-500 to-blue-500" />

      <AccountInfoCard />

      <SectionCard icon={Store} title="هوية المتجر" description="الاسم والشعار" iconColor="bg-indigo-500">
        <div className="space-y-2">
          <Label className="font-semibold">اسم المتجر <span className="text-red-500">*</span></Label>
          <Input value={row.logo_text} onChange={(e) => update("logo_text", e.target.value)} placeholder="عدسات ميار" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">الشعار التسويقي</Label>
          <Textarea value={row.tagline || ""} onChange={(e) => update("tagline", e.target.value)} placeholder="عدسات لاصقة ملونة بأعلى جودة" rows={2} />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">رابط صورة الشعار (URL)</Label>
          <Input value={row.logo_image || ""} onChange={(e) => update("logo_image", e.target.value)} placeholder="https://..." dir="ltr" className="font-mono" />
          {row.logo_image && (
            <div className="mt-3 flex items-center gap-3">
              <img src={row.logo_image} alt="Logo preview" className="w-16 h-16 rounded-full object-cover border-2 border-primary/30" />
              <span className="text-xs text-muted-foreground">معاينة الشعار</span>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard icon={Phone} title="معلومات التواصل" description="الهاتف والإيميل" iconColor="bg-emerald-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">رقم الهاتف</Label>
            <Input value={row.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="+218..." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">البريد الإلكتروني</Label>
            <Input type="email" value={row.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="info@example.com" dir="ltr" />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Share2} title="السوشيال ميديا" description="روابط الحسابات الاجتماعية" iconColor="bg-pink-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">انستجرام</Label>
            <Input value={row.instagram_url || ""} onChange={(e) => update("instagram_url", e.target.value)} placeholder="https://instagram.com/..." dir="ltr" className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">فيسبوك</Label>
            <Input value={row.facebook_url || ""} onChange={(e) => update("facebook_url", e.target.value)} placeholder="https://facebook.com/..." dir="ltr" className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">تيك توك</Label>
            <Input value={row.tiktok_url || ""} onChange={(e) => update("tiktok_url", e.target.value)} placeholder="https://tiktok.com/@..." dir="ltr" className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">واتساب</Label>
            <Input value={row.whatsapp_url || ""} onChange={(e) => update("whatsapp_url", e.target.value)} placeholder="https://wa.me/218..." dir="ltr" className="font-mono text-xs" />
          </div>
        </div>
      </SectionCard>

      <Button onClick={save} disabled={saving} className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold gap-2">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        حفظ التغييرات
      </Button>
    </div>
  );
};

export default HeaderSettings;
