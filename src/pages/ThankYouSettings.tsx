import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, CheckCircle, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
    // Save to localStorage for now
    localStorage.setItem("thankYouSettings", JSON.stringify(settings));
    toast({
      title: "تم الحفظ",
      description: "تم حفظ إعدادات صفحة الشكر بنجاح",
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem("thankYouSettings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">صفحة الشكر</h1>
          <p className="text-muted-foreground">تخصيص صفحة الشكر التي تظهر بعد إتمام الطلب</p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          حفظ التغييرات
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              إعدادات المحتوى
            </CardTitle>
            <CardDescription>تخصيص النصوص والرسائل في صفحة الشكر</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>العنوان الرئيسي</Label>
              <Input
                value={settings.title}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                placeholder="تم استلام طلبك بنجاح!"
              />
            </div>

            <div className="space-y-2">
              <Label>العنوان الفرعي</Label>
              <Input
                value={settings.subtitle}
                onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                placeholder="شكراً لك على ثقتك بنا"
              />
            </div>

            <div className="space-y-2">
              <Label>رسالة التواصل</Label>
              <Input
                value={settings.contactMessage}
                onChange={(e) => setSettings({ ...settings, contactMessage: e.target.value })}
                placeholder="سنتواصل معك قريباً لتأكيد الطلب"
              />
            </div>

            <div className="space-y-2">
              <Label>رسالة الشحن</Label>
              <Input
                value={settings.shippingMessage}
                onChange={(e) => setSettings({ ...settings, shippingMessage: e.target.value })}
                placeholder="🚚 شحن سريع خلال 2-5 أيام عمل"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <Label>إظهار تفاصيل الطلب</Label>
              <Switch
                checked={settings.showOrderDetails}
                onCheckedChange={(checked) => setSettings({ ...settings, showOrderDetails: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>إظهار معلومات التواصل</Label>
              <Switch
                checked={settings.showContactInfo}
                onCheckedChange={(checked) => setSettings({ ...settings, showContactInfo: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              معاينة
            </CardTitle>
            <CardDescription>كيف ستظهر صفحة الشكر للعميل</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-background rounded-lg p-6 text-center border">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">{settings.title}</h2>
              <p className="text-muted-foreground mb-4">{settings.subtitle}</p>

              {settings.showOrderDetails && (
                <div className="bg-muted/50 rounded-lg p-4 mb-4 text-right text-sm">
                  <div className="flex justify-between py-1">
                    <span>منتج تجريبي</span>
                    <span className="text-muted-foreground">المنتج</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>299 د.إ</span>
                    <span className="text-muted-foreground">السعر</span>
                  </div>
                </div>
              )}

              {settings.showContactInfo && (
                <div className="bg-primary/10 rounded-lg p-3 mb-4 text-sm">
                  {settings.contactMessage}
                </div>
              )}

              <p className="text-muted-foreground text-sm">{settings.shippingMessage}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ThankYouSettings;