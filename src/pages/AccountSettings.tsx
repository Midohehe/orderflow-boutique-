import { UserCircle, Palette } from "lucide-react";
import CityCorrections from "@/components/CityCorrections";
import { useUserContext } from "@/hooks/useUserContext";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { usePanelTheme, type PanelTheme } from "@/hooks/usePanelTheme";

const PANEL_THEMES: { id: PanelTheme; title: string; desc: string; swatch: string }[] = [
  { id: "default",  title: "افتراضي", desc: "ألوان النظام الأصلية",        swatch: "hsl(262 83% 58%)" },
  { id: "sport",    title: "Sport",   desc: "برتقالي ناري — طاقة وحماس",  swatch: "hsl(20 95% 55%)" },
  { id: "gaming",   title: "Gaming",  desc: "سيان نيون — مستقبلي",         swatch: "hsl(190 90% 50%)" },
  { id: "boutique", title: "Boutique",desc: "وردي راقي — هادئ",            swatch: "hsl(340 60% 50%)" },
  { id: "luxury",   title: "Luxury",  desc: "ذهبي فاخر",                   swatch: "hsl(42 60% 52%)" },
];

const AccountSettings = () => {
  const { isAdmin } = useUserContext();
  const { panelTheme, setPanelTheme } = usePanelTheme();

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      <PageHeader
        icon={UserCircle}
        title="حسابي"
        description='يمكنك تعديل بيانات الحساب من تبويب "هيدر المتجر".'
        iconGradient="from-sky-500 to-blue-600"
      />

      <SectionCard icon={Palette} title="ثيم لوحة الإدارة" description="يغيّر ألوان لوحة التحكم لديك فقط (لا يؤثر على المتجر)" iconColor="bg-fuchsia-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PANEL_THEMES.map((t) => {
            const selected = panelTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPanelTheme(t.id)}
                className={`text-right p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <span className="w-10 h-10 rounded-full border-2 border-white shadow" style={{ background: t.swatch }} />
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-2">{t.title}{selected && <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {isAdmin && <CityCorrections />}
    </div>
  );
};

export default AccountSettings;