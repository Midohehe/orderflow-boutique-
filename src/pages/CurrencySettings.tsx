import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Save, Loader2, Eye, Coins } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { useUserContext } from "@/hooks/useUserContext";

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
];

const CurrencySettings = () => {
  const [selectedCurrency, setSelectedCurrency] = useState("AED");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const { effectiveOwnerId, loading: ctxLoading } = useUserContext();

  useEffect(() => {
    if (ctxLoading) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const ownerId = effectiveOwnerId || user?.id;
        if (!ownerId) { setLoading(false); return; }
        const { data, error } = await supabase
          .from("store_settings").select("*")
          .eq("owner_id", ownerId)
          .limit(1).maybeSingle();
        if (error) throw error;
        if (data) { setSelectedCurrency(data.currency_code); setSettingsId(data.id); }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [ctxLoading, effectiveOwnerId]);

  const handleSave = async () => {
    setSaving(true);
    const c = currencies.find((x) => x.code === selectedCurrency);
    try {
      if (settingsId) {
        const { error } = await supabase.from("store_settings").update({
          currency_code: selectedCurrency,
          currency_symbol: c?.symbol || selectedCurrency,
          currency_name: c?.name || selectedCurrency,
        }).eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const ownerId = effectiveOwnerId || user!.id;
        const { error } = await supabase.from("store_settings").insert({
          owner_id: ownerId,
          currency_code: selectedCurrency,
          currency_symbol: c?.symbol || selectedCurrency,
          currency_name: c?.name || selectedCurrency,
        });
        if (error) throw error;
      }
      toast({ title: "تم الحفظ", description: "تم حفظ إعدادات العملة بنجاح" });
    } catch (e) {
      console.error(e);
      toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ الإعدادات", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const sel = currencies.find((c) => c.code === selectedCurrency);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader icon={Coins} title="إعدادات العملة" description="اختر العملة المستخدمة في متجرك" iconGradient="from-amber-500 to-orange-500" />

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard icon={DollarSign} title="عملة المتجر" description="ستظهر بها كل الأسعار" iconColor="bg-emerald-500">
          <div className="space-y-2">
            <Label className="font-semibold">العملة</Label>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="flex items-center gap-2">
                      <span className="font-bold w-8">{c.symbol}</span>
                      <span>{c.name}</span>
                      <span className="text-muted-foreground text-xs">({c.code})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SectionCard>

        <SectionCard icon={Eye} title="معاينة" description="كيف ستظهر الأسعار" iconColor="bg-violet-500">
          <div className="bg-muted/50 rounded-lg p-6 text-center space-y-4">
            <div>
              <p className="text-muted-foreground text-sm mb-1">مثال على السعر</p>
              <p className="text-3xl font-bold text-primary">299 {sel?.symbol}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm mb-1">السعر مع الخصم</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-bold text-primary">199 {sel?.symbol}</span>
                <span className="text-lg text-muted-foreground line-through">299 {sel?.symbol}</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold gap-2">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        حفظ التغييرات
      </Button>
    </div>
  );
};

export default CurrencySettings;
