import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const currencies = [
  { code: "AED", name: "درهم إماراتي", symbol: "د.إ" },
  { code: "SAR", name: "ريال سعودي", symbol: "ر.س" },
  { code: "EGP", name: "جنيه مصري", symbol: "ج.م" },
  { code: "KWD", name: "دينار كويتي", symbol: "د.ك" },
  { code: "BHD", name: "دينار بحريني", symbol: "د.ب" },
  { code: "QAR", name: "ريال قطري", symbol: "ر.ق" },
  { code: "OMR", name: "ريال عماني", symbol: "ر.ع" },
  { code: "JOD", name: "دينار أردني", symbol: "د.أ" },
  { code: "LBP", name: "ليرة لبنانية", symbol: "ل.ل" },
  { code: "IQD", name: "دينار عراقي", symbol: "د.ع" },
  { code: "SYP", name: "ليرة سورية", symbol: "ل.س" },
  { code: "YER", name: "ريال يمني", symbol: "ر.ي" },
  { code: "LYD", name: "دينار ليبي", symbol: "د.ل" },
  { code: "TND", name: "دينار تونسي", symbol: "د.ت" },
  { code: "DZD", name: "دينار جزائري", symbol: "د.ج" },
  { code: "MAD", name: "درهم مغربي", symbol: "د.م" },
  { code: "SDG", name: "جنيه سوداني", symbol: "ج.س" },
  { code: "USD", name: "دولار أمريكي", symbol: "$" },
  { code: "EUR", name: "يورو", symbol: "€" },
  { code: "GBP", name: "جنيه إسترليني", symbol: "£" },
  { code: "TRY", name: "ليرة تركية", symbol: "₺" },
  { code: "INR", name: "روبية هندية", symbol: "₹" },
  { code: "PKR", name: "روبية باكستانية", symbol: "Rs" },
  { code: "BDT", name: "تاكا بنغلاديشية", symbol: "৳" },
  { code: "MYR", name: "رينغيت ماليزي", symbol: "RM" },
  { code: "IDR", name: "روبية إندونيسية", symbol: "Rp" },
  { code: "PHP", name: "بيزو فلبيني", symbol: "₱" },
  { code: "CNY", name: "يوان صيني", symbol: "¥" },
  { code: "JPY", name: "ين ياباني", symbol: "¥" },
  { code: "KRW", name: "وون كوري", symbol: "₩" },
  { code: "THB", name: "بات تايلندي", symbol: "฿" },
  { code: "VND", name: "دونغ فيتنامي", symbol: "₫" },
  { code: "NGN", name: "نايرا نيجيرية", symbol: "₦" },
  { code: "ZAR", name: "راند جنوب أفريقي", symbol: "R" },
  { code: "BRL", name: "ريال برازيلي", symbol: "R$" },
  { code: "MXN", name: "بيزو مكسيكي", symbol: "$" },
  { code: "ARS", name: "بيزو أرجنتيني", symbol: "$" },
  { code: "COP", name: "بيزو كولومبي", symbol: "$" },
  { code: "CLP", name: "بيزو تشيلي", symbol: "$" },
  { code: "PEN", name: "سول بيروفي", symbol: "S/" },
  { code: "CAD", name: "دولار كندي", symbol: "C$" },
  { code: "AUD", name: "دولار أسترالي", symbol: "A$" },
  { code: "NZD", name: "دولار نيوزيلندي", symbol: "NZ$" },
  { code: "CHF", name: "فرنك سويسري", symbol: "CHF" },
  { code: "SEK", name: "كرونة سويدية", symbol: "kr" },
  { code: "NOK", name: "كرونة نرويجية", symbol: "kr" },
  { code: "DKK", name: "كرونة دانماركية", symbol: "kr" },
  { code: "PLN", name: "زلوتي بولندي", symbol: "zł" },
  { code: "CZK", name: "كرونة تشيكية", symbol: "Kč" },
  { code: "HUF", name: "فورنت مجري", symbol: "Ft" },
  { code: "RON", name: "ليو روماني", symbol: "lei" },
  { code: "BGN", name: "ليف بلغاري", symbol: "лв" },
  { code: "HRK", name: "كونا كرواتية", symbol: "kn" },
  { code: "RUB", name: "روبل روسي", symbol: "₽" },
  { code: "UAH", name: "هريفنا أوكرانية", symbol: "₴" },
  { code: "ILS", name: "شيكل إسرائيلي", symbol: "₪" },
];

const CurrencySettings = () => {
  const [selectedCurrency, setSelectedCurrency] = useState("AED");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("store_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSelectedCurrency(data.currency_code);
          setSettingsId(data.id);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const currencyData = currencies.find(c => c.code === selectedCurrency);
    
    try {
      if (settingsId) {
        const { error } = await supabase
          .from("store_settings")
          .update({
            currency_code: selectedCurrency,
            currency_symbol: currencyData?.symbol || selectedCurrency,
            currency_name: currencyData?.name || selectedCurrency,
          })
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("store_settings")
          .insert({
            owner_id: user!.id,
            currency_code: selectedCurrency,
            currency_symbol: currencyData?.symbol || selectedCurrency,
            currency_name: currencyData?.name || selectedCurrency,
          });

        if (error) throw error;
      }

      toast({
        title: "تم الحفظ",
        description: "تم حفظ إعدادات العملة بنجاح",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ الإعدادات",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedCurrencyData = currencies.find(c => c.code === selectedCurrency);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إعدادات العملة</h1>
          <p className="text-muted-foreground">اختر العملة المستخدمة في متجرك</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ التغييرات
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              عملة المتجر
            </CardTitle>
            <CardDescription>اختر العملة التي سيتم عرض الأسعار بها</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>العملة</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العملة" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{currency.symbol}</span>
                        <span>{currency.name}</span>
                        <span className="text-muted-foreground">({currency.code})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>معاينة</CardTitle>
            <CardDescription>كيف ستظهر الأسعار في المتجر</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-6 text-center space-y-4">
              <div>
                <p className="text-muted-foreground text-sm mb-1">مثال على السعر</p>
                <p className="text-3xl font-bold text-primary">
                  299 {selectedCurrencyData?.symbol}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">السعر مع الخصم</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-bold text-primary">
                    199 {selectedCurrencyData?.symbol}
                  </span>
                  <span className="text-lg text-muted-foreground line-through">
                    299 {selectedCurrencyData?.symbol}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CurrencySettings;