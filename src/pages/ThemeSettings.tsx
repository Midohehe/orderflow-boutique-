import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Save,
  Loader2,
  Palette,
  Eye,
  Download,
  Upload,
  LayoutTemplate,
  Sparkles,
  ExternalLink,
  Check,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { useUserContext } from "@/hooks/useUserContext";
import { useStoreContext } from "@/hooks/useStoreContext";
import { StoreThemeScope } from "@/components/StoreThemeScope";
import {
  DEFAULT_STORE_THEME,
  FONT_OPTIONS,
  primaryButtonClass,
  parseThemeTokens,
  type StoreThemeTokens,
} from "@/lib/themeTokens";
import { hslToHex, hexToHsl } from "@/lib/themeColors";
import { THEME_CATALOG, getThemeById, parseExportedThemeJson, parseThemePackageJson } from "@/lib/themes/catalog";
import { applyThemePackage, exportCurrentStoreTheme } from "@/lib/themes/applyThemePackage";
import {
  DEFAULT_APPLY_OPTIONS,
  THEME_CATEGORY_LABELS,
  type ThemeApplyOptions,
  type ThemePackage,
} from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { purgeLandingCache } from "@/lib/purgeLandingCache";

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hsl: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={hslToHex(value)}
          onChange={(e) => onChange(hexToHsl(e.target.value))}
          className="w-10 h-10 rounded-md border cursor-pointer shrink-0"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" className="font-mono text-xs" />
      </div>
    </div>
  );
}

const ThemeSettings = () => {
  const navigate = useNavigate();
  const { effectiveOwnerId, loading: ctxLoading } = useUserContext();
  const { activeStoreId, activeStore, loading: storeLoading } = useStoreContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<StoreThemeTokens>(DEFAULT_STORE_THEME);
  const [customCss, setCustomCss] = useState("");
  const [packageId, setPackageId] = useState<string | null>(null);
  const [pendingPkg, setPendingPkg] = useState<ThemePackage | null>(null);
  const [applyOptions, setApplyOptions] = useState<ThemeApplyOptions>(DEFAULT_APPLY_OPTIONS);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    if (ctxLoading || storeLoading) return;
    (async () => {
      try {
        if (!effectiveOwnerId || !activeStoreId) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("store_settings")
          .select("id, theme_tokens, theme_custom_css, theme_package_id")
          .eq("owner_id", effectiveOwnerId)
          .eq("store_id", activeStoreId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const row = data as {
            id: string;
            theme_tokens?: unknown;
            theme_custom_css?: string | null;
            theme_package_id?: string | null;
          };
          setSettingsId(row.id);
          setTokens(parseThemeTokens(row.theme_tokens));
          setCustomCss(row.theme_custom_css || "");
          setPackageId(row.theme_package_id ?? null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [ctxLoading, storeLoading, effectiveOwnerId, activeStoreId]);

  const filteredCatalog =
    categoryFilter === "all"
      ? THEME_CATALOG
      : THEME_CATALOG.filter((t) => t.category === categoryFilter);

  const handleSave = async () => {
    if (!settingsId) {
      toast({ title: "خطأ", description: "لم يتم العثور على إعدادات المتجر", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("store_settings")
        .update({
          theme_tokens: tokens as unknown as Record<string, unknown>,
          theme_custom_css: customCss.trim() || null,
          theme_package_id: packageId,
        } as never)
        .eq("id", settingsId);
      if (error) throw error;
      if (activeStore?.slug) await purgeLandingCache(undefined, activeStore.slug);
      toast({ title: "تم الحفظ", description: "تم تحديث مظهر المتجر" });
    } catch (e: unknown) {
      toast({
        title: "خطأ",
        description: e instanceof Error ? e.message : "تعذر الحفظ",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmApplyTheme = async () => {
    if (!pendingPkg || !settingsId || !effectiveOwnerId || !activeStoreId) return;
    setApplying(true);
    try {
      const result = await applyThemePackage(supabase, {
        ownerId: effectiveOwnerId,
        storeId: activeStoreId,
        settingsId,
        pkg: pendingPkg,
        options: applyOptions,
      });
      if (!result.ok) throw new Error(result.error);
      setTokens(parseThemeTokens(pendingPkg.tokens));
      setCustomCss(pendingPkg.customCss || "");
      setPackageId(pendingPkg.id);
      if (activeStore?.slug) await purgeLandingCache(undefined, activeStore.slug);
      toast({
        title: "تم تطبيق الثيم",
        description: `تم تطبيق «${pendingPkg.nameAr}» — يمكنك التعديل من محرر الصفحات`,
      });
      setPendingPkg(null);
    } catch (e: unknown) {
      toast({
        title: "خطأ",
        description: e instanceof Error ? e.message : "تعذر تطبيق الثيم",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleExport = async () => {
    if (!effectiveOwnerId || !activeStoreId) return;
    try {
      const data = await exportCurrentStoreTheme(supabase, {
        ownerId: effectiveOwnerId,
        storeId: activeStoreId,
        storeName: activeStore?.name || "متجر",
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `theme-${activeStore?.slug || "store"}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "تم التصدير", description: "تم تنزيل ملف الثيم" });
    } catch (e: unknown) {
      toast({ title: "خطأ", description: e instanceof Error ? e.message : "تعذر التصدير", variant: "destructive" });
    }
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const asPackage = parseThemePackageJson(raw);
        const asExport = parseExportedThemeJson(raw);

        if (asPackage) {
          setPendingPkg(asPackage);
          return;
        }
        if (asExport) {
          setTokens(parseThemeTokens(asExport.tokens));
          setCustomCss(asExport.customCss || "");
          setPackageId(asExport.packageId ?? null);
          toast({ title: "تم الاستيراد", description: "اضغط «حفظ المظهر» لتطبيق الألوان، أو طبّق التخطيطات من الثيمات" });
          return;
        }
        throw new Error("ملف غير صالح — يجب أن يكون theme package v1");
      } catch (e: unknown) {
        toast({
          title: "خطأ في الاستيراد",
          description: e instanceof Error ? e.message : "ملف JSON غير صالح",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const btnClass = primaryButtonClass(tokens);

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        title="متجر الثيمات"
        description="ثيمات احترافية جاهزة — ألوان، صفحة المتجر، وقوالب هبوط — مثل Shopify"
        icon={Palette}
      />

      <Tabs defaultValue="library" dir="rtl">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="library" className="gap-1">
            <Sparkles className="w-4 h-4" /> مكتبة الثيمات
          </TabsTrigger>
          <TabsTrigger value="customize" className="gap-1">
            <Palette className="w-4 h-4" /> تخصيص
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1">
            <Upload className="w-4 h-4" /> استيراد / تصدير
          </TabsTrigger>
        </TabsList>

        {/* ── Library ── */}
        <TabsContent value="library" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="text-muted-foreground">التصنيف:</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {Object.entries(THEME_CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {packageId && (
              <Badge variant="secondary" className="mr-auto">
                الثيم الحالي: {getThemeById(packageId)?.nameAr || packageId}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCatalog.map((theme) => {
              const active = packageId === theme.id;
              return (
                <div
                  key={theme.id}
                  className={cn(
                    "rounded-xl border overflow-hidden transition-all hover:shadow-lg",
                    active && "ring-2 ring-primary border-primary"
                  )}
                >
                  <div
                    className="h-36 relative flex items-end p-4"
                    style={{ background: theme.previewGradient }}
                  >
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="relative text-white drop-shadow-md">
                      <p className="font-bold text-lg">{theme.nameAr}</p>
                      <p className="text-xs opacity-90">{theme.name}</p>
                    </div>
                    {active && (
                      <Badge className="absolute top-3 left-3 bg-white text-primary">
                        <Check className="w-3 h-3 ml-1" /> مفعّل
                      </Badge>
                    )}
                  </div>
                  <div className="p-4 space-y-3 bg-card">
                    <Badge variant="outline">{THEME_CATEGORY_LABELS[theme.category]}</Badge>
                    <p className="text-sm text-muted-foreground line-clamp-2">{theme.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {theme.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setPendingPkg(theme);
                          setApplyOptions(DEFAULT_APPLY_OPTIONS);
                        }}
                      >
                        تطبيق الثيم
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTokens(parseThemeTokens(theme.tokens));
                          setCustomCss(theme.customCss || "");
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <SectionCard icon={LayoutTemplate} title="بعد التطبيق" description="عدّل التخطيطات باحترافية">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate("/dashboard/page-builder")}>
                <LayoutTemplate className="w-4 h-4 ml-2" />
                محرر صفحة المتجر
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard/landing-templates")}>
                <LayoutTemplate className="w-4 h-4 ml-2" />
                قوالب صفحات الهبوط
              </Button>
              {activeStore?.slug && (
                <Button variant="outline" onClick={() => window.open(`/store/${activeStore.slug}`, "_blank")}>
                  <ExternalLink className="w-4 h-4 ml-2" />
                  معاينة المتجر
                </Button>
              )}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Customize ── */}
        <TabsContent value="customize" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard icon={Palette} title="الألوان والخطوط" description="تخصيص دقيق مثل Shopify Theme Editor">
              <div className="space-y-4">
                <ColorField label="اللون الرئيسي" value={tokens.primary || ""} onChange={(v) => setTokens((p) => ({ ...p, primary: v }))} />
                <ColorField label="لون التمييز" value={tokens.accent || ""} onChange={(v) => setTokens((p) => ({ ...p, accent: v }))} />
                <ColorField label="خلفية الصفحة" value={tokens.background || ""} onChange={(v) => setTokens((p) => ({ ...p, background: v }))} />
                <ColorField label="لون النص" value={tokens.foreground || ""} onChange={(v) => setTokens((p) => ({ ...p, foreground: v }))} />
                <ColorField label="خلفية البطاقات" value={tokens.card || ""} onChange={(v) => setTokens((p) => ({ ...p, card: v }))} />

                <div className="space-y-2">
                  <Label>خط النص</Label>
                  <Select
                    value={FONT_OPTIONS.find((f) => f.value === tokens.fontFamily)?.id || "cairo"}
                    onValueChange={(id) => {
                      const f = FONT_OPTIONS.find((x) => x.id === id);
                      if (f) {
                        setTokens((p) => ({
                          ...p,
                          fontFamily: f.value,
                          headingFont: ("heading" in f && f.heading) || f.value,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>شكل الأزرار</Label>
                    <Select
                      value={tokens.buttonStyle || "gradient"}
                      onValueChange={(v) => setTokens((p) => ({ ...p, buttonStyle: v as StoreThemeTokens["buttonStyle"] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gradient">تدرّج</SelectItem>
                        <SelectItem value="solid">صلب</SelectItem>
                        <SelectItem value="outline">حدود</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الهيدر</Label>
                    <Select
                      value={tokens.headerStyle || "solid"}
                      onValueChange={(v) => setTokens((p) => ({ ...p, headerStyle: v as StoreThemeTokens["headerStyle"] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">صلب</SelectItem>
                        <SelectItem value="blur">شفاف + blur</SelectItem>
                        <SelectItem value="transparent">شفاف</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={Eye} title="معاينة حية" description="شكل الأزرار والبطاقات">
              <StoreThemeScope tokens={tokens} customCss={customCss}>
                <div className="space-y-4 p-4 rounded-xl store-card">
                  <h2 className="text-xl font-bold store-heading">منتج تجريبي</h2>
                  <p className="text-2xl font-extrabold" style={{ color: "hsl(var(--store-primary))" }}>
                    149 د.ل
                  </p>
                  <button type="button" className={`w-full py-3 px-4 ${btnClass}`}>
                    اطلب الآن — COD
                  </button>
                  <div className="store-section-muted rounded-lg p-3 text-sm">قسم بخلفية muted</div>
                </div>
              </StoreThemeScope>
            </SectionCard>
          </div>

          <SectionCard icon={Palette} title="CSS مخصص (متقدم)" description="مثل Shopify custom.css — يُطبّق على المتجر وصفحات الهبوط">
            <Textarea
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              rows={6}
              dir="ltr"
              className="font-mono text-xs"
              placeholder=".store-theme-scope .my-class { ... }"
            />
          </SectionCard>

          <Button onClick={handleSave} disabled={saving} className="gap-2 gradient-primary text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ التخصيص
          </Button>
        </TabsContent>

        {/* ── Import / Export ── */}
        <TabsContent value="import" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard icon={Download} title="تصدير الثيم الحالي" description="احفظ JSON وشاركه أو استورده لمتجر آخر">
              <p className="text-sm text-muted-foreground mb-4">
                يتضمن: الألوان، CSS، تخطيط صفحة المتجر، وقوالب الهبوط.
              </p>
              <Button onClick={handleExport} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                تنزيل theme.json
              </Button>
            </SectionCard>

            <SectionCard icon={Upload} title="استيراد ثيم" description="الصق ملف JSON من مكتبة وصلة أو متجر آخر">
              <Input
                type="file"
                accept=".json,application/json"
                className="cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                يدعم: Theme Package v1 (ثيم كامل) أو Export (ألوان + تخطيطات)
              </p>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>

      {/* Apply theme dialog */}
      <AlertDialog open={!!pendingPkg} onOpenChange={(o) => !o && setPendingPkg(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تطبيق «{pendingPkg?.nameAr}»؟</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>اختر ما تريد تطبيقه من حزمة الثيم:</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={applyOptions.applyTokens}
                    onCheckedChange={(c) => setApplyOptions((p) => ({ ...p, applyTokens: !!c }))}
                  />
                  الألوان والخطوط و CSS
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={applyOptions.applyStoreHome}
                    onCheckedChange={(c) => setApplyOptions((p) => ({ ...p, applyStoreHome: !!c }))}
                  />
                  صفحة المتجر الرئيسية (Puck)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={applyOptions.applyLandingTemplates}
                    onCheckedChange={(c) => setApplyOptions((p) => ({ ...p, applyLandingTemplates: !!c }))}
                  />
                  قوالب صفحات الهبوط ({pendingPkg?.landingTemplates?.length || 0} قالب)
                </label>
                {applyOptions.applyLandingTemplates && (
                  <label className="flex items-center gap-2 cursor-pointer mr-6 text-destructive">
                    <Checkbox
                      checked={applyOptions.replaceExistingTemplates}
                      onCheckedChange={(c) => setApplyOptions((p) => ({ ...p, replaceExistingTemplates: !!c }))}
                    />
                    حذف القوالب الحالية قبل الاستيراد
                  </label>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmApplyTheme();
              }}
              disabled={applying}
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              تطبيق
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ThemeSettings;
