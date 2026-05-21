import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Palette, Image as ImageIcon, Sparkles } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { useStoreContext } from "@/hooks/useStoreContext";
import ImageUpload from "@/components/ImageUpload";

interface Row {
  id: string;
  template: string;
  hero_image: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  gallery_images: string[];
}

const TEMPLATES = [
  { id: "classic", title: "كلاسيكي", desc: "تصميم بسيط ملوّن — مناسب للجميع", emoji: "🎨" },
  { id: "fashion", title: "Fashion", desc: "هيرو محرّر بإطار أنيق", emoji: "👗" },
  { id: "stylish", title: "Stylish", desc: "صورة عريضة + خط Playfair", emoji: "✨" },
  { id: "luxury", title: "Luxury", desc: "داكن مع ذهبي وزجاج — للعطور والمجوهرات", emoji: "💎" },
  { id: "editorial", title: "Editorial", desc: "مجلة مينيمال أبيض راقي", emoji: "📰" },
  { id: "vibrant", title: "Vibrant Pop", desc: "ألوان جريئة ومرحة — للشباب", emoji: "🌈" },
  { id: "tech", title: "Tech Grid", desc: "Bento داكن مع لمسة Neon — للإلكترونيات", emoji: "⚡" },
  { id: "sport", title: "Sport", desc: "أسود/برتقالي وخطوط حادة — للملابس الرياضية", emoji: "🏆" },
  { id: "gaming", title: "Gaming", desc: "نيون بنفسجي/سيان وشبكة Glow — للجيمنق", emoji: "🎮" },
  { id: "boutique", title: "Boutique", desc: "وردي ناعم وخط Serif أنيق — للنساء", emoji: "🌸" },
];

export default function ThemesSettings() {
  const { activeStoreId } = useStoreContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !activeStoreId) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase.from("header_settings").select("id, template, hero_image, hero_title, hero_subtitle, gallery_images").eq("store_id", activeStoreId).limit(1).maybeSingle();
      if (data) setRow({ ...(data as any), gallery_images: (data as any).gallery_images || [] });
      else {
        const { data: created } = await supabase.from("header_settings").insert({ owner_id: user.id, store_id: activeStoreId, logo_text: "متجري" }).select("id, template, hero_image, hero_title, hero_subtitle, gallery_images").single();
        if (created) setRow({ ...(created as any), gallery_images: (created as any).gallery_images || [] });
      }
      setLoading(false);
    })();
  }, [activeStoreId]);

  const update = (k: keyof Row, v: any) => row && setRow({ ...row, [k]: v });

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase.from("header_settings").update({
      template: row.template,
      hero_image: row.hero_image || null,
      hero_title: row.hero_title || null,
      hero_subtitle: row.hero_subtitle || null,
      gallery_images: row.gallery_images,
    }).eq("id", row.id);
    setSaving(false);
    if (error) { toast({ title: "خطأ", description: "تعذر الحفظ", variant: "destructive" }); return; }
    toast({ title: "تم الحفظ", description: "تم تحديث التيم" });
  };

  if (loading || !row) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader icon={Palette} title="التيمات" description="اختر شكل المتجر وتحكم بالصور المعروضة" iconGradient="from-fuchsia-500 to-pink-500" />

      <SectionCard icon={Sparkles} title="اختر التيم" description="القالب يحدد شكل صفحات المتجر العامة" iconColor="bg-fuchsia-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map(t => {
            const selected = (row.template || "classic") === t.id;
            return (
              <button key={t.id} type="button" onClick={() => update("template", t.id)}
                className={`text-right p-4 rounded-lg border-2 transition-all ${selected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/40"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{t.emoji}</span>
                  <div className="font-bold">{t.title}</div>
                  {selected && <span className="text-[10px] mr-auto bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>}
                </div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard icon={ImageIcon} title="صورة الهيرو الرئيسية" description="الصورة الكبيرة في أعلى المتجر" iconColor="bg-indigo-500">
        <div className="space-y-2">
          <Label className="font-semibold">صورة الهيرو</Label>
          <ImageUpload
            images={row.hero_image ? [row.hero_image] : []}
            onImagesChange={(imgs) => update("hero_image", imgs[0] || null)}
            maxImages={1}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="font-semibold">عنوان الهيرو</Label>
            <Input value={row.hero_title || ""} onChange={(e) => update("hero_title", e.target.value)} placeholder="مجموعة الموسم" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">وصف الهيرو</Label>
            <Textarea rows={2} value={row.hero_subtitle || ""} onChange={(e) => update("hero_subtitle", e.target.value)} placeholder="اكتشف أحدث منتجاتنا..." />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={ImageIcon} title="معرض الصور / البانرات" description="صور إضافية تظهر بين الأقسام" iconColor="bg-emerald-500">
        <ImageUpload
          images={row.gallery_images}
          onImagesChange={(imgs) => update("gallery_images", imgs)}
          maxImages={10}
        />
      </SectionCard>

      <Button onClick={save} disabled={saving} className="w-full bg-gradient-to-l from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold gap-2">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        حفظ التغييرات
      </Button>
    </div>
  );
}