import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, HelpCircle, Loader2, Save, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/PageHeader";
import { OfferPreview } from "@/components/offers/OfferPreview";
import { toast } from "@/hooks/use-toast";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useUserContext } from "@/hooks/useUserContext";
import { supabase } from "@/integrations/supabase/client";
import { getOffer, saveOffer } from "@/lib/offers/api";
import { OFFER_TEMPLATES } from "@/lib/offers/templates";
import {
  ACCEPT_ACTIONS,
  DECLINE_ACTIONS,
  DEFAULT_DESIGN,
  DEFAULT_FREQUENCY,
  DEFAULT_PRICING,
  DEFAULT_SCHEDULE,
  DEFAULT_TRIGGER,
  OFFER_TYPE_META,
  RULE_FIELDS,
  emptyOfferDraft,
  type OfferAction,
  type OfferRecord,
  type OfferRule,
  type OfferType,
} from "@/lib/offers/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STEPS = [
  "أساسي",
  "منتجات",
  "تصميم",
  "تسعير",
  "تشغيل",
  "قواعد",
  "إجراء",
  "تكرار",
  "جدولة",
  "مراجعة",
];

function Tip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

type ProductOpt = { id: string; name: string; images: string[]; stock?: number };
type IdName = { id: string; name: string };
type LandingOpt = { id: string; title: string; slug: string };

const NUMERIC_RULE_FIELDS = new Set([
  "order_value",
  "order_quantity",
  "inventory",
]);

const BOOLEAN_RULE_FIELDS = new Set(["returning_customer", "new_customer"]);

function defaultRuleValue(field: string): OfferRule["value"] {
  if (NUMERIC_RULE_FIELDS.has(field)) return 0;
  if (BOOLEAN_RULE_FIELDS.has(field)) return true;
  if (field === "day_of_week") return "0";
  if (field === "device") return "mobile";
  return "";
}

export default function OfferWizard() {
  const { offerId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { activeStoreId } = useStoreContext();
  const { effectiveOwnerId } = useUserContext();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!offerId);
  const [productsCatalog, setProductsCatalog] = useState<ProductOpt[]>([]);
  const [categoriesCatalog, setCategoriesCatalog] = useState<IdName[]>([]);
  const [landingPagesCatalog, setLandingPagesCatalog] = useState<LandingOpt[]>([]);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState(() => emptyOfferDraft((search.get("type") as OfferType) || "upsell"));

  useEffect(() => {
    if (!activeStoreId) return;
    (async () => {
      const [productsRes, categoriesRes, landingsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, images, stock")
          .eq("store_id", activeStoreId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("product_categories")
          .select("id, name")
          .eq("store_id", activeStoreId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("landing_pages")
          .select("id, title, slug")
          .eq("store_id", activeStoreId)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);

      setProductsCatalog(
        (productsRes.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          images: Array.isArray(p.images) ? p.images : [],
          stock: typeof p.stock === "number" ? p.stock : undefined,
        })),
      );
      setCategoriesCatalog(
        (categoriesRes.data || []).map((c: any) => ({ id: c.id, name: c.name })),
      );
      setLandingPagesCatalog(
        (landingsRes.data || []).map((lp: any) => ({
          id: lp.id,
          title: lp.title || lp.slug || "بدون عنوان",
          slug: lp.slug || "",
        })),
      );
    })();
  }, [activeStoreId]);

  useEffect(() => {
    if (!offerId) return;
    (async () => {
      try {
        setLoading(true);
        const o = await getOffer(offerId);
        if (!o) {
          toast({ title: "غير موجود", description: "العرض غير موجود", variant: "destructive" });
          navigate("/dashboard/offers");
          return;
        }
        setDraft({
          name: o.name,
          status: o.status,
          priority: o.priority,
          offer_type: o.offer_type,
          design: o.design,
          pricing: o.pricing,
          trigger_config: o.trigger_config,
          frequency: o.frequency,
          schedule: o.schedule,
          template_key: o.template_key,
          products: o.products || [],
          rule_groups: o.rule_groups || [{ logic: "and", sort_order: 0, rules: [] }],
          actions: o.actions || [],
        });
      } catch (e: any) {
        toast({ title: "خطأ", description: e?.message || "تعذر التحميل", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [offerId, navigate]);

  const applyTemplate = (key: string) => {
    const t = OFFER_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setDraft((d) => ({
      ...d,
      name: d.name || t.name,
      offer_type: t.offer_type,
      template_key: t.key,
      design: { ...DEFAULT_DESIGN, ...t.design },
      pricing: { ...DEFAULT_PRICING, ...t.pricing },
      trigger_config: { ...DEFAULT_TRIGGER, ...t.trigger },
    }));
    toast({ title: "تم تطبيق القالب", description: t.name });
  };

  const patch = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const selectedProductIds = useMemo(
    () => new Set((draft.products || []).map((p) => p.product_id).filter(Boolean) as string[]),
    [draft.products],
  );

  const toggleProduct = (p: ProductOpt) => {
    const list = [...(draft.products || [])];
    const idx = list.findIndex((x) => x.product_id === p.id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push({
        product_id: p.id,
        sort_order: list.length,
        is_default: list.length === 0,
        allow_variants: true,
        allow_multi_select: false,
        product_name: p.name,
        product_image: p.images[0],
        stock: p.stock,
      });
    }
    patch("products", list);
  };

  const rules: OfferRule[] = draft.rule_groups?.[0]?.rules || [];
  const setRules = (next: OfferRule[]) => {
    patch("rule_groups", [{ logic: "and", sort_order: 0, rules: next }]);
  };

  const acceptAction =
    draft.actions?.find((a) => a.on_event === "accept") ||
    ({ on_event: "accept", action_type: "add_to_order", config: {}, sort_order: 0 } as OfferAction);
  const declineAction =
    draft.actions?.find((a) => a.on_event === "decline") ||
    ({ on_event: "decline", action_type: "close_popup", config: {}, sort_order: 0 } as OfferAction);

  const setActions = (accept: OfferAction, decline: OfferAction) => {
    patch("actions", [
      { ...accept, on_event: "accept", sort_order: 0 },
      { ...decline, on_event: "decline", sort_order: 1 },
    ]);
  };

  const canNext = () => {
    if (step === 0) return !!draft.offer_type && !!draft.name.trim();
    return true;
  };

  const handleSave = async (asStatus?: typeof draft.status) => {
    if (!effectiveOwnerId || !activeStoreId) return;
    if (!draft.name.trim()) {
      toast({ title: "مطلوب", description: "أدخل اسم العرض", variant: "destructive" });
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const id = await saveOffer({
        id: offerId,
        ownerId: effectiveOwnerId,
        storeId: activeStoreId,
        offer: {
          ...draft,
          id: offerId,
          status: asStatus || draft.status,
        } as OfferRecord,
      });
      toast({ title: "تم الحفظ", description: "تم حفظ العرض بنجاح" });
      navigate(`/dashboard/offers/${id}/edit`);
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-5 animate-fade-in pb-24">
        <PageHeader
          icon={Sparkles}
          title={offerId ? "تعديل العرض" : "إنشاء عرض جديد"}
          description="معالج موحّد لكل أنواع العروض — بدون تعقيد"
          iconGradient="from-emerald-500 to-teal-600"
        />

        {/* Stepper */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                i === step
                  ? "bg-primary text-primary-foreground border-primary"
                  : i < step
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                    : "bg-muted/40 text-muted-foreground border-border"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-5 min-h-[420px]">
            {/* STEP 0 — Basic */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>اسم العرض</Label>
                    <Tip text="اسم داخلي يظهر لك في لوحة التحكم فقط" />
                  </div>
                  <Input
                    value={draft.name}
                    onChange={(e) => patch("name", e.target.value)}
                    placeholder="مثال: Upsell قطعة ثانية"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحالة</Label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={draft.status}
                      onChange={(e) => patch("status", e.target.value as any)}
                    >
                      <option value="draft">مسودة</option>
                      <option value="active">نشط</option>
                      <option value="disabled">معطّل</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>الأولوية</Label>
                      <Tip text="الأعلى يظهر أولاً عند تعارض العروض" />
                    </div>
                    <Input
                      type="number"
                      value={draft.priority}
                      onChange={(e) => patch("priority", Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>نوع العرض</Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {(Object.keys(OFFER_TYPE_META) as OfferType[]).map((type) => {
                      const meta = OFFER_TYPE_META[type];
                      const active = draft.offer_type === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => patch("offer_type", type)}
                          className={`text-right rounded-xl border p-3 transition-all ${
                            active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:border-primary/40"
                          }`}
                        >
                          <div className={`inline-flex text-white text-xs font-bold px-2 py-0.5 rounded-md bg-gradient-to-l ${meta.color} mb-2`}>
                            {meta.label}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>قوالب جاهزة</Label>
                  <div className="flex flex-wrap gap-2">
                    {OFFER_TEMPLATES.map((t) => (
                      <Button key={t.key} type="button" size="sm" variant="outline" onClick={() => applyTemplate(t.key)}>
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1 — Products */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  اختر منتجات العرض، رتّبها، وحدّد الافتراضي والمتغيرات.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto">
                  {productsCatalog.map((p) => {
                    const checked = selectedProductIds.has(p.id);
                    const row = (draft.products || []).find((x) => x.product_id === p.id);
                    return (
                      <div key={p.id} className={`rounded-xl border p-3 space-y-2 ${checked ? "border-primary bg-primary/5" : ""}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <Checkbox checked={checked} onCheckedChange={() => toggleProduct(p)} />
                          {p.images[0] ? (
                            <img src={p.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground">
                              المخزون: {p.stock ?? "—"}
                            </div>
                          </div>
                        </label>
                        {checked && row && (
                          <div className="flex flex-wrap gap-3 text-xs pt-1 border-t">
                            <label className="flex items-center gap-1.5">
                              <Checkbox
                                checked={!!row.is_default}
                                onCheckedChange={(v) => {
                                  patch(
                                    "products",
                                    (draft.products || []).map((x) =>
                                      x.product_id === p.id
                                        ? { ...x, is_default: !!v }
                                        : { ...x, is_default: v ? false : x.is_default },
                                    ),
                                  );
                                }}
                              />
                              افتراضي
                            </label>
                            <label className="flex items-center gap-1.5">
                              <Checkbox
                                checked={row.allow_variants !== false}
                                onCheckedChange={(v) => {
                                  patch(
                                    "products",
                                    (draft.products || []).map((x) =>
                                      x.product_id === p.id ? { ...x, allow_variants: !!v } : x,
                                    ),
                                  );
                                }}
                              />
                              متغيرات
                            </label>
                            <label className="flex items-center gap-1.5">
                              <Checkbox
                                checked={!!row.allow_multi_select}
                                onCheckedChange={(v) => {
                                  patch(
                                    "products",
                                    (draft.products || []).map((x) =>
                                      x.product_id === p.id ? { ...x, allow_multi_select: !!v } : x,
                                    ),
                                  );
                                }}
                              />
                              اختيار متعدد
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {productsCatalog.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">لا توجد منتجات في هذا المتجر</p>
                )}
              </div>
            )}

            {/* STEP 2 — Design */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>العنوان</Label>
                    <Input value={draft.design.title} onChange={(e) => patch("design", { ...draft.design, title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>العنوان الفرعي</Label>
                    <Input value={draft.design.subtitle} onChange={(e) => patch("design", { ...draft.design, subtitle: e.target.value })} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>الوصف</Label>
                    <Textarea rows={3} value={draft.design.description} onChange={(e) => patch("design", { ...draft.design, description: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>الشارة</Label>
                    <Input value={draft.design.badge} onChange={(e) => patch("design", { ...draft.design, badge: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>رابط الصورة</Label>
                    <Input value={draft.design.image} onChange={(e) => patch("design", { ...draft.design, image: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="space-y-1">
                    <Label>نمط العرض</Label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={draft.design.displayStyle}
                      onChange={(e) => patch("design", { ...draft.design, displayStyle: e.target.value as any })}
                    >
                      <option value="popup">Popup</option>
                      <option value="slide_in">Slide In</option>
                      <option value="fullscreen">Fullscreen</option>
                      <option value="embedded">Embedded Block</option>
                      <option value="floating_bar">Floating Bar</option>
                      <option value="thank_you">Thank You Page</option>
                      <option value="side_panel">Side Panel</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>الحركة</Label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={draft.design.animation}
                      onChange={(e) => patch("design", { ...draft.design, animation: e.target.value as any })}
                    >
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="zoom">Zoom</option>
                      <option value="none">بدون</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>نص الزر الأساسي</Label>
                    <Input value={draft.design.primaryButtonText} onChange={(e) => patch("design", { ...draft.design, primaryButtonText: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>نص الزر الثانوي</Label>
                    <Input value={draft.design.secondaryButtonText} onChange={(e) => patch("design", { ...draft.design, secondaryButtonText: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>لون الزر</Label>
                    <Input type="color" value={draft.design.buttonColor} onChange={(e) => patch("design", { ...draft.design, buttonColor: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>الخلفية</Label>
                    <Input type="color" value={draft.design.background} onChange={(e) => patch("design", { ...draft.design, background: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>انحناء الحواف</Label>
                    <Input type="number" value={draft.design.borderRadius} onChange={(e) => patch("design", { ...draft.design, borderRadius: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label>عرض النافذة</Label>
                    <Input type="number" value={draft.design.popupWidth} onChange={(e) => patch("design", { ...draft.design, popupWidth: Number(e.target.value) || 480 })} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    ["shadow", "ظل"],
                    ["showCountdown", "عدّاد تنازلي"],
                    ["showProgressBar", "شريط تقدم"],
                    ["showTrustBadges", "شارات ثقة"],
                    ["showReviews", "تقييمات"],
                    ["showGuarantee", "صندوق ضمان"],
                    ["showFreeShippingLabel", "شحن مجاني"],
                    ["showDiscountBadge", "شارة الخصم"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <span className="text-sm">{label}</span>
                      <Switch
                        checked={!!(draft.design as any)[key]}
                        onCheckedChange={(v) => patch("design", { ...draft.design, [key]: v })}
                      />
                    </label>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>رسالة الإلحاح</Label>
                    <Input value={draft.design.urgencyMessage} onChange={(e) => patch("design", { ...draft.design, urgencyMessage: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>رسالة المخزون</Label>
                    <Input value={draft.design.inventoryMessage} onChange={(e) => patch("design", { ...draft.design, inventoryMessage: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Pricing */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>نوع التسعير</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={draft.pricing.mode}
                    onChange={(e) => patch("pricing", { ...draft.pricing, mode: e.target.value as any })}
                  >
                    <option value="fixed_discount">خصم ثابت</option>
                    <option value="percent_discount">خصم نسبة</option>
                    <option value="custom_price">سعر مخصص</option>
                    <option value="free_product">منتج مجاني</option>
                    <option value="free_shipping">شحن مجاني</option>
                    <option value="bundle_discount">خصم باقة</option>
                    <option value="auto_coupon">كوبون تلقائي</option>
                  </select>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>خصم ثابت</Label>
                    <Input type="number" value={draft.pricing.fixedDiscount} onChange={(e) => patch("pricing", { ...draft.pricing, fixedDiscount: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label>نسبة الخصم %</Label>
                    <Input type="number" value={draft.pricing.percentDiscount} onChange={(e) => patch("pricing", { ...draft.pricing, percentDiscount: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label>سعر مخصص</Label>
                    <Input type="number" value={draft.pricing.customPrice} onChange={(e) => patch("pricing", { ...draft.pricing, customPrice: Number(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>كود الكوبون</Label>
                  <Input value={draft.pricing.couponCode} onChange={(e) => patch("pricing", { ...draft.pricing, couponCode: e.target.value })} />
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    ["showOriginalPrice", "إظهار السعر الأصلي"],
                    ["showDiscountPercent", "إظهار نسبة الخصم"],
                    ["showSavings", "إظهار مبلغ التوفير"],
                  ].map(([k, label]) => (
                    <label key={k} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <span className="text-sm">{label}</span>
                      <Switch
                        checked={!!(draft.pricing as any)[k]}
                        onCheckedChange={(v) => patch("pricing", { ...draft.pricing, [k]: v })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4 — Trigger */}
            {step === 4 && (
              <div className="space-y-4">
                <Label>متى يظهر العرض؟</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    ["before_checkout", "قبل الدفع"],
                    ["inside_checkout", "داخل الدفع"],
                    ["before_confirmation", "قبل تأكيد الطلب"],
                    ["after_order", "فور إتمام الطلب"],
                    ["thank_you_page", "صفحة الشكر"],
                    ["after_seconds", "بعد ثوانٍ"],
                    ["exit_intent", "نية المغادرة"],
                    ["scroll_percent", "نسبة التمرير"],
                    ["button_click", "ضغط زر"],
                    ["manual", "تشغيل يدوي"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => patch("trigger_config", { ...draft.trigger_config, type: value as any })}
                      className={`rounded-lg border px-3 py-2 text-sm text-right ${
                        draft.trigger_config.type === value ? "border-primary bg-primary/5 font-semibold" : ""
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {draft.trigger_config.type === "after_seconds" && (
                  <div className="space-y-1">
                    <Label>التأخير (ثوانٍ)</Label>
                    <Input type="number" value={draft.trigger_config.delaySeconds} onChange={(e) => patch("trigger_config", { ...draft.trigger_config, delaySeconds: Number(e.target.value) || 0 })} />
                  </div>
                )}
                {draft.trigger_config.type === "scroll_percent" && (
                  <div className="space-y-1">
                    <Label>نسبة التمرير %</Label>
                    <Input type="number" value={draft.trigger_config.scrollPercent} onChange={(e) => patch("trigger_config", { ...draft.trigger_config, scrollPercent: Number(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
            )}

            {/* STEP 5 — Rules */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>محرك القواعد</Label>
                    <p className="text-xs text-muted-foreground">
                      شروط AND — مثال: المنتج = «سماعة» ← يتفعّل العرض عند طلب هذا المنتج
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRules([
                        ...rules,
                        {
                          field: "product",
                          operator: "eq",
                          value: productsCatalog[0]?.id || "",
                          sort_order: rules.length,
                        },
                      ])
                    }
                  >
                    + قاعدة
                  </Button>
                </div>
                {rules.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 border rounded-xl">
                    بدون قواعد = يظهر العرض للجميع حسب التشغيل
                  </p>
                )}
                <div className="space-y-3">
                  {rules.map((r, i) => {
                    const isProduct = r.field === "product";
                    const isCategory = r.field === "category";
                    const isLanding = r.field === "landing_page";
                    const isMulti = r.operator === "in" || r.operator === "contains";
                    const selectedIds: string[] = Array.isArray(r.value)
                      ? r.value.map(String)
                      : r.value
                        ? [String(r.value)]
                        : [];
                    const q = (productSearch[i] || "").trim().toLowerCase();
                    const filteredProducts = isProduct
                      ? productsCatalog.filter(
                          (p) => !q || p.name.toLowerCase().includes(q),
                        )
                      : [];

                    const updateRule = (patchRule: Partial<OfferRule>) => {
                      const next = [...rules];
                      next[i] = { ...r, ...patchRule };
                      setRules(next);
                    };

                    return (
                      <div key={i} className="rounded-xl border p-3 space-y-3 bg-muted/20">
                        <div className="grid sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
                          <div className="space-y-1">
                            <Label className="text-xs">الحقل</Label>
                            <select
                              className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                              value={r.field}
                              onChange={(e) => {
                                const field = e.target.value;
                                const operator =
                                  field === "product" || field === "category" || field === "landing_page"
                                    ? "eq"
                                    : NUMERIC_RULE_FIELDS.has(field)
                                      ? "gte"
                                      : "eq";
                                updateRule({
                                  field,
                                  operator,
                                  value: defaultRuleValue(field),
                                });
                                setProductSearch((prev) => ({ ...prev, [i]: "" }));
                              }}
                            >
                              {RULE_FIELDS.map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">المعامل</Label>
                            <select
                              className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                              value={r.operator}
                              onChange={(e) => {
                                const operator = e.target.value;
                                let value = r.value;
                                if ((operator === "in" || operator === "contains") && !Array.isArray(value)) {
                                  value = value ? [String(value)] : [];
                                } else if (operator !== "in" && operator !== "contains" && Array.isArray(value)) {
                                  value = value[0] || "";
                                }
                                updateRule({ operator, value });
                              }}
                            >
                              <option value="eq">يساوي</option>
                              <option value="neq">لا يساوي</option>
                              {(isProduct || isCategory || isLanding) && (
                                <option value="in">واحد من</option>
                              )}
                              {NUMERIC_RULE_FIELDS.has(r.field) && (
                                <>
                                  <option value="gt">&gt;</option>
                                  <option value="gte">≥</option>
                                  <option value="lt">&lt;</option>
                                  <option value="lte">≤</option>
                                </>
                              )}
                              {!isProduct && !isCategory && !isLanding && !NUMERIC_RULE_FIELDS.has(r.field) && (
                                <>
                                  <option value="contains">يحتوي</option>
                                  <option value="in">ضمن</option>
                                </>
                              )}
                            </select>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setRules(rules.filter((_, j) => j !== i))}
                          >
                            حذف
                          </Button>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            القيمة
                            {isProduct && (
                              <Tip text="اختر المنتج الذي عند وجوده في الطلب/الصفحة يتفعّل هذا العرض" />
                            )}
                          </Label>

                          {isProduct && (
                            <div className="space-y-2">
                              <Input
                                placeholder="ابحث عن منتج…"
                                value={productSearch[i] || ""}
                                onChange={(e) =>
                                  setProductSearch((prev) => ({ ...prev, [i]: e.target.value }))
                                }
                              />
                              <div className="max-h-56 overflow-y-auto rounded-lg border bg-background divide-y">
                                {filteredProducts.length === 0 ? (
                                  <p className="text-sm text-muted-foreground p-3 text-center">
                                    {productsCatalog.length === 0
                                      ? "لا توجد منتجات في هذا المتجر"
                                      : "لا نتائج للبحث"}
                                  </p>
                                ) : (
                                  filteredProducts.map((p) => {
                                    const checked = selectedIds.includes(p.id);
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                          if (isMulti) {
                                            const nextIds = checked
                                              ? selectedIds.filter((id) => id !== p.id)
                                              : [...selectedIds, p.id];
                                            updateRule({ value: nextIds });
                                          } else {
                                            updateRule({ value: p.id });
                                          }
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-muted/60 ${
                                          checked ? "bg-primary/10" : ""
                                        }`}
                                      >
                                        {p.images[0] ? (
                                          <img
                                            src={p.images[0]}
                                            alt=""
                                            className="w-9 h-9 rounded object-cover shrink-0"
                                          />
                                        ) : (
                                          <div className="w-9 h-9 rounded bg-muted shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-medium truncate">{p.name}</div>
                                          {typeof p.stock === "number" && (
                                            <div className="text-[11px] text-muted-foreground">
                                              المخزون: {p.stock}
                                            </div>
                                          )}
                                        </div>
                                        {checked && <Check className="w-4 h-4 text-primary shrink-0" />}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                              {selectedIds.length > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                  محدد:{" "}
                                  {selectedIds
                                    .map(
                                      (id) =>
                                        productsCatalog.find((p) => p.id === id)?.name || id.slice(0, 8),
                                    )
                                    .join(" · ")}
                                </p>
                              )}
                            </div>
                          )}

                          {isCategory && (
                            isMulti ? (
                              <div className="max-h-48 overflow-y-auto rounded-lg border bg-background divide-y">
                                {categoriesCatalog.length === 0 ? (
                                  <p className="text-sm text-muted-foreground p-3 text-center">
                                    لا توجد تصنيفات
                                  </p>
                                ) : (
                                  categoriesCatalog.map((c) => {
                                    const checked = selectedIds.includes(c.id);
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                          const nextIds = checked
                                            ? selectedIds.filter((id) => id !== c.id)
                                            : [...selectedIds, c.id];
                                          updateRule({ value: nextIds });
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-right hover:bg-muted/60 ${
                                          checked ? "bg-primary/10 font-medium" : ""
                                        }`}
                                      >
                                        {c.name}
                                        {checked && <Check className="w-4 h-4 text-primary" />}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            ) : (
                              <select
                                className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                                value={String(r.value || "")}
                                onChange={(e) => updateRule({ value: e.target.value })}
                              >
                                <option value="">— اختر تصنيفاً —</option>
                                {categoriesCatalog.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            )
                          )}

                          {isLanding && (
                            isMulti ? (
                              <div className="max-h-48 overflow-y-auto rounded-lg border bg-background divide-y">
                                {landingPagesCatalog.length === 0 ? (
                                  <p className="text-sm text-muted-foreground p-3 text-center">
                                    لا توجد صفحات هبوط
                                  </p>
                                ) : (
                                  landingPagesCatalog.map((lp) => {
                                    const checked = selectedIds.includes(lp.id);
                                    return (
                                      <button
                                        key={lp.id}
                                        type="button"
                                        onClick={() => {
                                          const nextIds = checked
                                            ? selectedIds.filter((id) => id !== lp.id)
                                            : [...selectedIds, lp.id];
                                          updateRule({ value: nextIds });
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-right hover:bg-muted/60 ${
                                          checked ? "bg-primary/10 font-medium" : ""
                                        }`}
                                      >
                                        <span className="truncate">
                                          {lp.title}
                                          {lp.slug ? (
                                            <span className="text-muted-foreground"> · {lp.slug}</span>
                                          ) : null}
                                        </span>
                                        {checked && <Check className="w-4 h-4 text-primary shrink-0" />}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            ) : (
                              <select
                                className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                                value={String(r.value || "")}
                                onChange={(e) => updateRule({ value: e.target.value })}
                              >
                                <option value="">— اختر صفحة هبوط —</option>
                                {landingPagesCatalog.map((lp) => (
                                  <option key={lp.id} value={lp.id}>
                                    {lp.title} {lp.slug ? `(${lp.slug})` : ""}
                                  </option>
                                ))}
                              </select>
                            )
                          )}

                          {BOOLEAN_RULE_FIELDS.has(r.field) && (
                            <select
                              className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                              value={r.value ? "true" : "false"}
                              onChange={(e) => updateRule({ value: e.target.value === "true" })}
                            >
                              <option value="true">نعم</option>
                              <option value="false">لا</option>
                            </select>
                          )}

                          {r.field === "device" && (
                            <select
                              className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                              value={String(r.value || "mobile")}
                              onChange={(e) => updateRule({ value: e.target.value })}
                            >
                              <option value="mobile">موبايل</option>
                              <option value="desktop">كمبيوتر</option>
                              <option value="tablet">تابلت</option>
                            </select>
                          )}

                          {r.field === "day_of_week" && (
                            <select
                              className="w-full h-10 rounded-md border bg-background px-2 text-sm"
                              value={String(r.value ?? "0")}
                              onChange={(e) => updateRule({ value: e.target.value })}
                            >
                              {["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map(
                                (d, di) => (
                                  <option key={d} value={String(di)}>{d}</option>
                                ),
                              )}
                            </select>
                          )}

                          {!isProduct &&
                            !isCategory &&
                            !isLanding &&
                            !BOOLEAN_RULE_FIELDS.has(r.field) &&
                            r.field !== "device" &&
                            r.field !== "day_of_week" && (
                              <Input
                                type={NUMERIC_RULE_FIELDS.has(r.field) ? "number" : "text"}
                                value={
                                  NUMERIC_RULE_FIELDS.has(r.field)
                                    ? String(r.value ?? 0)
                                    : String(r.value ?? "")
                                }
                                onChange={(e) =>
                                  updateRule({
                                    value: NUMERIC_RULE_FIELDS.has(r.field)
                                      ? Number(e.target.value) || 0
                                      : e.target.value,
                                  })
                                }
                                placeholder={
                                  r.field === "customer_city"
                                    ? "طرابلس"
                                    : r.field === "utm_source"
                                      ? "facebook"
                                      : "القيمة"
                                }
                              />
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 6 — Actions */}
            {step === 6 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>عند القبول</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={acceptAction.action_type}
                    onChange={(e) =>
                      setActions({ ...acceptAction, action_type: e.target.value }, declineAction)
                    }
                  >
                    {ACCEPT_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>عند الرفض</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={declineAction.action_type}
                    onChange={(e) =>
                      setActions(acceptAction, { ...declineAction, action_type: e.target.value })
                    }
                  >
                    {DECLINE_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 7 — Frequency */}
            {step === 7 && (
              <div className="space-y-4">
                <Label>تكرار الظهور</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={draft.frequency.mode}
                  onChange={(e) => patch("frequency", { ...draft.frequency, mode: e.target.value as any })}
                >
                  <option value="once">مرة واحدة فقط</option>
                  <option value="once_per_session">مرة لكل جلسة</option>
                  <option value="once_per_customer">مرة لكل زبون</option>
                  <option value="every_visit">كل زيارة</option>
                  <option value="every_x_days">كل X أيام</option>
                </select>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>كل كم يوم</Label>
                    <Input type="number" value={draft.frequency.everyDays} onChange={(e) => patch("frequency", { ...draft.frequency, everyDays: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label>حد المشاهدات يومياً</Label>
                    <Input type="number" value={draft.frequency.maxDailyViews} onChange={(e) => patch("frequency", { ...draft.frequency, maxDailyViews: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label>حد القبولات</Label>
                    <Input type="number" value={draft.frequency.maxAcceptances} onChange={(e) => patch("frequency", { ...draft.frequency, maxAcceptances: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8 — Schedule */}
            {step === 8 && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>تاريخ البداية</Label>
                    <Input type="datetime-local" value={draft.schedule.startDate} onChange={(e) => patch("schedule", { ...draft.schedule, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>تاريخ النهاية</Label>
                    <Input type="datetime-local" value={draft.schedule.endDate} onChange={(e) => patch("schedule", { ...draft.schedule, endDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>المنطقة الزمنية</Label>
                    <Input value={draft.schedule.timezone} onChange={(e) => patch("schedule", { ...draft.schedule, timezone: e.target.value })} />
                  </div>
                  <label className="flex items-center justify-between gap-2 rounded-lg border p-3 mt-6">
                    <span className="text-sm">ساعات العمل فقط</span>
                    <Switch
                      checked={draft.schedule.businessHoursOnly}
                      onCheckedChange={(v) => patch("schedule", { ...draft.schedule, businessHoursOnly: v })}
                    />
                  </label>
                  <div className="space-y-1">
                    <Label>من</Label>
                    <Input type="time" value={draft.schedule.businessHoursStart} onChange={(e) => patch("schedule", { ...draft.schedule, businessHoursStart: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>إلى</Label>
                    <Input type="time" value={draft.schedule.businessHoursEnd} onChange={(e) => patch("schedule", { ...draft.schedule, businessHoursEnd: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 9 — Review */}
            {step === 9 && (
              <div className="space-y-4">
                <div className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{OFFER_TYPE_META[draft.offer_type].label}</Badge>
                    <Badge variant="outline">{draft.status}</Badge>
                    <Badge variant="secondary">أولوية {draft.priority}</Badge>
                  </div>
                  <h3 className="text-xl font-bold">{draft.name || "بدون اسم"}</h3>
                  <p className="text-sm text-muted-foreground">
                    منتجات: {(draft.products || []).length} · قواعد: {rules.length} · تشغيل: {draft.trigger_config.type}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
                    حفظ كمسودة
                  </Button>
                  <Button type="button" onClick={() => handleSave("active")} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    تفعيل وحفظ
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-muted-foreground">معاينة مباشرة</div>
            <div className="sticky top-4 flex justify-center rounded-xl border bg-muted/20 p-4">
              <OfferPreview design={draft.design} pricing={draft.pricing} />
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => (step === 0 ? navigate("/dashboard/offers") : setStep((s) => s - 1))}>
              <ArrowRight className="w-4 h-4 ml-1" />
              {step === 0 ? "إلغاء" : "السابق"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => handleSave()} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
                  التالي
                  <ArrowLeft className="w-4 h-4 mr-1" />
                </Button>
              ) : (
                <Button type="button" onClick={() => handleSave("active")} disabled={saving}>
                  إنهاء
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
