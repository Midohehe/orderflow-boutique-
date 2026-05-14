import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, CheckCircle, Eye, PartyPopper } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";

const ThankYouSettings = () => {
  const [settings, setSettings] = useState({
    title: "تم استلام طلبك بنجاح!",
    subtitle: "شكراً لك على ثقتك بنا",
    contactMessage: "سنتواصل معك قريباً لتأكيد الطلب",
    shippingMessage: "🚚 شحن سريع خلال 2-5 أيام عمل",
    showOrderDetails: true,
    showContactInfo: true,
  });

  const handleSave = () => {
    localStorage.setItem("thankYouSettings", JSON.stringify(settings));
    toast({ title: "تم الحفظ", description: "تم حفظ إعدادات صفحة الشكر بنجاح" });
  };

  useEffect(() => {
    const saved = localStorage.getItem("thankYouSettings");
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={PartyPopper}
        title="صفحة الشكر"
        description="تخصيص صفحة الشكر بعد إتمام الطلب"
        iconGradient="from-pink-500 to-rose-500"
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard icon={CheckCircle} title="إعدادات المحتوى" description="النصوص والرسائل" iconColor="bg-emerald-500">
          <div className="space-y-2">
            <Label className="font-semibold">العنوان الرئيسي</Label>
            <Input value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">العنوان الفرعي</Label>
            <Input value={settings.subtitle} onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">رسالة التواصل</Label>
            <Input value={settings.contactMessage} onChange={(e) => setSettings({ ...settings, contactMessage: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">رسالة الشحن</Label>
            <Input value={settings.shippingMessage} onChange={(e) => setSettings({ ...settings, shippingMessage: e.target.value })} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border-2 border-dashed bg-muted/40">
            <Label className="font-semibold">إظهار تفاصيل الطلب</Label>
            <Switch checked={settings.showOrderDetails} onCheckedChange={(c) => setSettings({ ...settings, showOrderDetails: c })} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border-2 border-dashed bg-muted/40">
            <Label className="font-semibold">إظهار معلومات التواصل</Label>
            <Switch checked={settings.showContactInfo} onCheckedChange={(c) => setSettings({ ...settings, showContactInfo: c })} />
          </div>
        </SectionCard>

        <SectionCard icon={Eye} title="معاينة" description="كيف ستظهر للعميل" iconColor="bg-violet-500">
          <div className="bg-background rounded-lg p-6 text-center border">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{settings.title}</h2>
            <p className="text-muted-foreground mb-4">{settings.subtitle}</p>

            {settings.showOrderDetails && (
              <div className="bg-muted/50 rounded-lg p-4 mb-4 text-right text-sm">
                <div className="flex justify-between py-1"><span>منتج تجريبي</span><span className="text-muted-foreground">المنتج</span></div>
                <div className="flex justify-between py-1"><span>299 د.إ</span><span className="text-muted-foreground">السعر</span></div>
              </div>
            )}

            {settings.showContactInfo && (
              <div className="bg-primary/10 rounded-lg p-3 mb-4 text-sm">{settings.contactMessage}</div>
            )}

            <p className="text-muted-foreground text-sm">{settings.shippingMessage}</p>
          </div>
        </SectionCard>
      </div>

      <Button onClick={handleSave} className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold gap-2">
        <Save className="w-5 h-5" />
        حفظ التغييرات
      </Button>
    </div>
  );
};

export default ThankYouSettings;
