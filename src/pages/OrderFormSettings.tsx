import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Save, Loader2, MousePointerClick, MessageSquare, FormInput,
  ArrowUp, ArrowDown, Shield, Eye, EyeOff, Asterisk, Truck, Plus, Trash2,
  BookmarkPlus, LayoutTemplate, ShieldCheck,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { useUserContext } from "@/hooks/useUserContext";
import { useStoreContext } from "@/hooks/useStoreContext";
import { isDeliverySelectField, clearLandingFormFieldsCache } from "@/lib/landingOrderForm";
import { purgeLandingCache } from "@/lib/purgeLandingCache";
import { mapPresetRow, type OrderFormPreset, type OrderFormPresetField } from "@/lib/orderFormPresets";
import { SearchableSelect } from "@/components/SearchableSelect";

interface CatalogItem {
  field_key: string;
  label: string;
  field_type: string;
  default_required: boolean;
  default_placeholder: string;
  admin_enabled: boolean;
  sort_order: number;
}
interface FormField {
  id: string;
  field_key: string;
  label: string;
  placeholder: string;
  field_type: string;
  required: boolean;
  enabled: boolean;
  sort_order: number;
}
interface DeliveryPriceRow {
  id?: string;
  city_name: string;
  price: string;
  sort_order: number;
}

/** Arabic text that was saved with wrong encoding shows as question marks only. */
function isCorruptedArabicText(value: string | null | undefined): boolean {
  const s = (value || "").trim();
  if (!s) return false;
  return s.includes("?") && !/[\u0600-\u06FF]/.test(s);
}

function resolveFieldText(
  value: string | null | undefined,
  fallback: string | null | undefined,
): string {
  if (isCorruptedArabicText(value)) return (fallback || "").trim();
  return (value || fallback || "").trim();
}

const OrderFormSettings = () => {
  const { isAdmin, effectiveOwnerId } = useUserContext();
  const { activeStoreId } = useStoreContext();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [defaultFieldSnapshot, setDefaultFieldSnapshot] = useState<FormField[]>([]);
  const [deliveryPrices, setDeliveryPrices] = useState<DeliveryPriceRow[]>([]);
  const [presets, setPresets] = useState<OrderFormPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("__default__");
  const [newPresetName, setNewPresetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [settings, setSettings] = useState({
    buttonText: "اطلب الآن",
    successMessage: "شكراً لك! تم استلام طلبك بنجاح",
    confirmationEnabled: false,
    confirmationMessage: "",
  });

  const mergeFieldsFromRows = (existing: any[], cat: CatalogItem[]): FormField[] => {
    const catalogByKey = new Map(cat.map((c) => [c.field_key, c]));
    return (existing || []).map((f: any) => {
      const catItem = catalogByKey.get(f.field_key);
      const merged = {
        id: f.id || `${f.field_key}-${f.sort_order ?? 0}`,
        field_key: f.field_key,
        label: resolveFieldText(f.label, catItem?.label),
        placeholder: resolveFieldText(f.placeholder, catItem?.default_placeholder),
        field_type: f.field_type,
        required: !!f.required,
        enabled: f.enabled !== false,
        sort_order: f.sort_order ?? 0,
      };
      return isDeliverySelectField(merged)
        ? { ...merged, field_type: "delivery_select", field_key: "delivery_city" }
        : merged;
    });
  };

  const loadPresets = async () => {
    if (!activeStoreId) return;
    const { data, error } = await (supabase as any)
      .from("order_form_presets")
      .select("*")
      .eq("store_id", activeStoreId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setPresets((data || []).map(mapPresetRow));
  };

  const loadDefaultIntoEditor = async (cat: CatalogItem[]) => {
    if (!effectiveOwnerId || !activeStoreId) return;
    const [{ data: existing }, { data: storeRow }] = await Promise.all([
      supabase.from("order_form_fields").select("*").eq("store_id", activeStoreId).order("sort_order"),
      supabase
        .from("store_settings")
        .select("button_text, success_message, confirmation_enabled, confirmation_message")
        .eq("owner_id", effectiveOwnerId)
        .eq("store_id", activeStoreId)
        .maybeSingle(),
    ]);
    const merged = mergeFieldsFromRows(existing || [], cat);
    setFormFields(merged);
    setDefaultFieldSnapshot(merged);
    setSettings({
      buttonText: (storeRow as any)?.button_text || "اطلب الآن",
      successMessage: (storeRow as any)?.success_message || "شكراً لك! تم استلام طلبك بنجاح",
      confirmationEnabled: !!(storeRow as any)?.confirmation_enabled,
      confirmationMessage: (storeRow as any)?.confirmation_message || "",
    });
  };

  const loadPresetIntoEditor = (preset: OrderFormPreset, cat: CatalogItem[], baseFields: FormField[]) => {
    const byKey = new Map(preset.fields.map((f) => [f.field_key, f]));
    const bases = baseFields.length
      ? baseFields
      : cat.map((c, i) => ({
          id: c.field_key,
          field_key: c.field_key,
          label: c.label,
          placeholder: c.default_placeholder,
          field_type: c.field_type,
          required: c.default_required,
          enabled: false,
          sort_order: i,
        }));

    const merged: FormField[] = bases.map((base) => {
      const p = byKey.get(base.field_key);
      if (!p) return { ...base, enabled: false, required: false };
      return {
        ...base,
        label: resolveFieldText(p.label, base.label),
        placeholder: resolveFieldText(p.placeholder, base.placeholder),
        field_type: p.field_type || base.field_type,
        required: !!p.required,
        enabled: p.enabled !== false,
        sort_order: p.sort_order ?? base.sort_order,
      };
    });

    setFormFields(merged);
    setSettings({
      buttonText: preset.button_text || "اطلب الآن",
      successMessage: preset.success_message || "شكراً لك! تم استلام طلبك بنجاح",
      confirmationEnabled: !!preset.confirmation_enabled,
      confirmationMessage: preset.confirmation_message || "",
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !effectiveOwnerId || !activeStoreId) return;
        setLoading(true);

        await supabase.rpc("seed_store_defaults", {
          _owner_id: effectiveOwnerId,
          _store_id: activeStoreId,
        });

        const [{ data: cat }, { data: prices }] = await Promise.all([
          supabase.from("form_field_catalog").select("*").order("sort_order"),
          supabase.from("store_delivery_prices").select("id, city_name, price, sort_order").eq("store_id", activeStoreId).order("sort_order"),
        ]);

        const catalogItems = (cat || []) as CatalogItem[];
        setCatalog(catalogItems);
        await loadDefaultIntoEditor(catalogItems);
        await loadPresets();
        setActivePresetId("__default__");

        setDeliveryPrices((prices || []).map((p: any, i: number) => ({
          id: p.id,
          city_name: p.city_name,
          price: String(p.price ?? 0),
          sort_order: p.sort_order ?? i,
        })));
      } catch (e) {
        console.error(e);
      } finally { setLoading(false); }
    };
    load();
  }, [effectiveOwnerId, activeStoreId]);

  const allowedKeys = new Set(catalog.filter(c => isAdmin || c.admin_enabled).map(c => c.field_key));
  const visibleFields = formFields.filter(f => allowedKeys.has(f.field_key));
  const hasDeliveryField = visibleFields.some(isDeliverySelectField);
  const editingPreset = activePresetId !== "__default__"
    ? presets.find((p) => p.id === activePresetId) || null
    : null;

  const handleFieldToggle = (id: string) => {
    setFormFields(formFields.map((f) => {
      if (f.id !== id) return f;
      const enabled = !f.enabled;
      return { ...f, enabled, required: enabled ? f.required : false };
    }));
  };
  const handleRequiredToggle = (id: string) => {
    setFormFields(formFields.map((f) => f.id === id ? { ...f, required: !f.required } : f));
  };
  const handleFieldEdit = (id: string, patch: Partial<FormField>) => {
    setFormFields(formFields.map((f) => f.id === id ? { ...f, ...patch } : f));
  };
  const handleMove = (id: string, direction: -1 | 1) => {
    const sorted = [...visibleFields].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(f => f.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const aOrder = sorted[idx].sort_order;
    sorted[idx].sort_order = sorted[swapIdx].sort_order;
    sorted[swapIdx].sort_order = aOrder;
    setFormFields([...formFields]);
  };

  const purgeStoreLandingCache = async () => {
    if (!activeStoreId) return;
    const [{ data: pages }, { data: store }] = await Promise.all([
      supabase.from("landing_pages").select("slug").eq("store_id", activeStoreId),
      supabase.from("stores").select("slug").eq("id", activeStoreId).maybeSingle(),
    ]);
    const username = store?.slug || null;
    for (const row of pages || []) {
      if (row.slug) await purgeLandingCache(row.slug, username);
    }
    if (effectiveOwnerId) clearLandingFormFieldsCache(effectiveOwnerId, activeStoreId);
  };

  const snapshotFields = (): OrderFormPresetField[] =>
    [...formFields]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f, i) => {
        const isDelivery = isDeliverySelectField(f);
        return {
          id: f.id,
          field_key: isDelivery ? "delivery_city" : f.field_key,
          label: f.label,
          placeholder: f.placeholder,
          field_type: isDelivery ? "delivery_select" : f.field_type,
          required: f.enabled ? f.required : false,
          enabled: f.enabled,
          sort_order: i,
        };
      });

  const handleSelectPreset = async (value: string) => {
    setActivePresetId(value);
    if (value === "__default__") {
      await loadDefaultIntoEditor(catalog);
      return;
    }
    const preset = presets.find((p) => p.id === value);
    if (preset) loadPresetIntoEditor(preset, catalog, defaultFieldSnapshot);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activePresetId === "__default__") {
        for (const f of formFields) {
          const isDelivery = isDeliverySelectField(f);
          await supabase.from("order_form_fields")
            .update({
              enabled: f.enabled,
              required: f.enabled ? f.required : false,
              sort_order: f.sort_order,
              label: f.label,
              placeholder: f.placeholder,
              ...(isDelivery ? { field_type: "delivery_select", field_key: "delivery_city" } : {}),
            })
            .eq("id", f.id);
        }
        if (effectiveOwnerId && activeStoreId) {
          await supabase.from("store_settings")
            .update({
              button_text: settings.buttonText,
              success_message: settings.successMessage,
              confirmation_enabled: settings.confirmationEnabled,
              confirmation_message: settings.confirmationMessage,
            } as any)
            .eq("owner_id", effectiveOwnerId)
            .eq("store_id", activeStoreId);
        }
        toast({ title: "تم الحفظ", description: "تم حفظ الإعدادات الافتراضية لنموذج الطلب" });
      } else if (editingPreset) {
        const { error } = await (supabase as any)
          .from("order_form_presets")
          .update({
            button_text: settings.buttonText,
            success_message: settings.successMessage,
            confirmation_enabled: settings.confirmationEnabled,
            confirmation_message: settings.confirmationMessage,
            fields: snapshotFields(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPreset.id);
        if (error) throw error;
        await loadPresets();
        toast({ title: "تم الحفظ", description: `تم تحديث القالب «${editingPreset.name}»` });
      }
      await purgeStoreLandingCache();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleSaveAsPreset = async () => {
    const name = newPresetName.trim();
    if (!name) {
      toast({ title: "خطأ", description: "أدخل اسماً للقالب", variant: "destructive" });
      return;
    }
    if (!effectiveOwnerId || !activeStoreId) return;
    if (presets.some((p) => p.name === name)) {
      toast({ title: "خطأ", description: "يوجد قالب بنفس الاسم", variant: "destructive" });
      return;
    }
    setSavingPreset(true);
    try {
      const { data, error } = await (supabase as any)
        .from("order_form_presets")
        .insert({
          owner_id: effectiveOwnerId,
          store_id: activeStoreId,
          name,
          button_text: settings.buttonText,
          success_message: settings.successMessage,
          confirmation_enabled: settings.confirmationEnabled,
          confirmation_message: settings.confirmationMessage,
          fields: snapshotFields(),
        })
        .select("*")
        .single();
      if (error) throw error;
      const mapped = mapPresetRow(data);
      setPresets((prev) => [...prev, mapped]);
      setActivePresetId(mapped.id);
      setNewPresetName("");
      toast({ title: "تم", description: `تم حفظ القالب «${name}»` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر حفظ القالب", variant: "destructive" });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async () => {
    if (!editingPreset) return;
    if (!window.confirm(`حذف القالب «${editingPreset.name}»؟`)) return;
    const { error } = await (supabase as any).from("order_form_presets").delete().eq("id", editingPreset.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    setPresets((prev) => prev.filter((p) => p.id !== editingPreset.id));
    setActivePresetId("__default__");
    await loadDefaultIntoEditor(catalog);
    toast({ title: "تم الحذف", description: "تم حذف القالب" });
    await purgeStoreLandingCache();
  };

  const addDeliveryRow = () => {
    setDeliveryPrices((prev) => [
      ...prev,
      { city_name: "", price: "0", sort_order: prev.length },
    ]);
  };

  const updateDeliveryRow = (index: number, patch: Partial<DeliveryPriceRow>) => {
    setDeliveryPrices((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeDeliveryRow = (index: number) => {
    setDeliveryPrices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDeliveryPrices = async () => {
    if (!effectiveOwnerId || !activeStoreId) return;
    const cleaned = deliveryPrices
      .map((r, i) => ({
        city_name: r.city_name.trim(),
        price: Number(r.price) || 0,
        sort_order: i,
      }))
      .filter((r) => r.city_name.length > 0);

    const names = cleaned.map((r) => r.city_name);
    if (new Set(names).size !== names.length) {
      toast({ title: "خطأ", description: "لا يمكن تكرار اسم المدينة", variant: "destructive" });
      return;
    }

    setSavingPrices(true);
    try {
      await supabase.from("store_delivery_prices").delete().eq("store_id", activeStoreId);
      if (cleaned.length) {
        const { error } = await supabase.from("store_delivery_prices").insert(
          cleaned.map((r) => ({
            owner_id: effectiveOwnerId,
            store_id: activeStoreId,
            city_name: r.city_name,
            price: r.price,
            sort_order: r.sort_order,
          })),
        );
        if (error) throw error;
      }
      const { data: refreshed } = await supabase
        .from("store_delivery_prices")
        .select("id, city_name, price, sort_order")
        .eq("store_id", activeStoreId)
        .order("sort_order");
      setDeliveryPrices((refreshed || []).map((p: any, i: number) => ({
        id: p.id,
        city_name: p.city_name,
        price: String(p.price ?? 0),
        sort_order: p.sort_order ?? i,
      })));
      toast({ title: "تم الحفظ", description: `تم حفظ ${cleaned.length} سعر توصيل` });
      await purgeStoreLandingCache();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر حفظ أسعار التوصيل", variant: "destructive" });
    } finally {
      setSavingPrices(false);
    }
  };

  const toggleCatalogAdmin = async (key: string, value: boolean) => {
    const { error } = await supabase.from("form_field_catalog").update({ admin_enabled: value }).eq("field_key", key);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setCatalog(catalog.map(c => c.field_key === key ? { ...c, admin_enabled: value } : c));
  };

  const updateCatalogField = (key: string, patch: Partial<CatalogItem>) => {
    setCatalog(catalog.map(c => c.field_key === key ? { ...c, ...patch } : c));
  };
  const saveCatalogField = async (key: string) => {
    const c = catalog.find(x => x.field_key === key);
    if (!c) return;
    const { error } = await supabase.from("form_field_catalog")
      .update({ label: c.label, default_placeholder: c.default_placeholder })
      .eq("field_key", key);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم الحفظ", description: "تم تحديث الحقل" });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader icon={FormInput} title="تعديل نموذج الطلب" description="تخصيص حقول ورسائل النموذج وأسعار التوصيل وحفظ قوالب متعددة" iconGradient="from-cyan-500 to-blue-500" />

      {isAdmin && (
        <SectionCard icon={Shield} title="كتالوج الحقول (السوبر ادمن)" description="تحكّم في الحقول التي تظهر لأصحاب المتاجر" iconColor="bg-rose-500">
          {catalog.map((c) => (
            <div key={c.field_key} className="p-3 bg-muted/50 rounded-lg border space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 text-xs text-muted-foreground font-mono">{c.field_key}</div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={c.admin_enabled} onCheckedChange={(v) => toggleCatalogAdmin(c.field_key, v)} />
                  <span>{c.admin_enabled ? "متاح للمتاجر" : "مخفي عن المتاجر"}</span>
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">اسم الحقل</Label>
                  <Input value={c.label} onChange={(e) => updateCatalogField(c.field_key, { label: e.target.value })} onBlur={() => saveCatalogField(c.field_key)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">النص المساعد الافتراضي</Label>
                  <Input value={c.default_placeholder} onChange={(e) => updateCatalogField(c.field_key, { default_placeholder: e.target.value })} onBlur={() => saveCatalogField(c.field_key)} />
                </div>
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      <SectionCard
        icon={LayoutTemplate}
        title="قوالب نموذج الطلب"
        description="احفظ أكثر من إعداد باسم معيّن، ثم اختر القالب من صفحة الهبوط"
        iconColor="bg-indigo-500"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">القالب الحالي للتحرير</Label>
            <SearchableSelect
              value={activePresetId}
              onChange={handleSelectPreset}
              placeholder="اختر قالباً..."
              searchPlaceholder="ابحث..."
              options={[
                { value: "__default__", label: "الإعدادات الافتراضية للمتجر" },
                ...presets.map((p) => ({ value: p.id, label: p.name, keywords: p.name })),
              ]}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="اسم القالب الجديد..."
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={handleSaveAsPreset} disabled={savingPreset} className="gap-2 shrink-0">
              {savingPreset ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkPlus className="w-4 h-4" />}
              حفظ كقالب جديد
            </Button>
            {editingPreset && (
              <Button type="button" variant="destructive" onClick={handleDeletePreset} className="gap-2 shrink-0">
                <Trash2 className="w-4 h-4" />
                حذف القالب
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {editingPreset
              ? `تحرّر القالب «${editingPreset.name}» — زر الحفظ بالأسفل يحدّث هذا القالب فقط.`
              : "تحرّر الإعدادات الافتراضية — تُستخدم لصفحات الهبوط التي لم يُختر لها قالب."}
          </p>
        </div>
      </SectionCard>

      <Tabs defaultValue="fields" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="fields">حقول النموذج</TabsTrigger>
          <TabsTrigger value="delivery-prices">أسعار التوصيل</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <SectionCard icon={FileText} title="حقول النموذج" description="لكل حقل: إظهار/إخفاء + إلزامي/اختياري" iconColor="bg-blue-500">
              {[...visibleFields].sort((a, b) => a.sort_order - b.sort_order).map((field, i, arr) => (
                <div key={field.id} className="p-4 bg-muted/50 rounded-lg border space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => handleMove(field.id, -1)}>
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={i === arr.length - 1} onClick={() => handleMove(field.id, 1)}>
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="text-xs text-muted-foreground font-mono">{field.field_key}</div>
                      {isDeliverySelectField(field) && (
                        <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                          قائمة منسدلة بالمدن من تبويب «أسعار التوصيل» — يُضاف سعر التوصيل على إجمالي الطلب
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm min-w-[140px]">
                          <Switch checked={field.enabled} onCheckedChange={() => handleFieldToggle(field.id)} />
                          {field.enabled ? (
                            <span className="flex items-center gap-1 font-medium text-emerald-700">
                              <Eye className="w-4 h-4" /> ظاهر
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-medium text-muted-foreground">
                              <EyeOff className="w-4 h-4" /> مخفي
                            </span>
                          )}
                        </label>
                        <label className={`flex items-center gap-2 text-sm min-w-[160px] ${!field.enabled ? "opacity-50 pointer-events-none" : ""}`}>
                          <Switch
                            checked={field.required}
                            disabled={!field.enabled}
                            onCheckedChange={() => handleRequiredToggle(field.id)}
                          />
                          {field.required ? (
                            <span className="flex items-center gap-1 font-medium text-amber-700">
                              <Asterisk className="w-4 h-4" /> إلزامي
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-medium text-muted-foreground">
                              اختياري
                            </span>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">اسم الحقل</Label>
                      <Input value={field.label} onChange={(e) => handleFieldEdit(field.id, { label: e.target.value })} disabled={!isAdmin} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">النص المساعد</Label>
                      <Input value={field.placeholder} onChange={(e) => handleFieldEdit(field.id, { placeholder: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
              {visibleFields.length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center">لا توجد حقول متاحة. تواصل مع السوبر ادمن.</div>
              )}
            </SectionCard>

            <div className="space-y-5">
              <SectionCard icon={MousePointerClick} title="زر الطلب" description="نص زر الإرسال" iconColor="bg-emerald-500">
                <div className="space-y-2">
                  <Label className="font-semibold">نص الزر</Label>
                  <Input value={settings.buttonText} onChange={(e) => setSettings({ ...settings, buttonText: e.target.value })} placeholder="اطلب الآن" />
                </div>
              </SectionCard>
              <SectionCard icon={MessageSquare} title="رسالة النجاح" description="تظهر بعد إرسال الطلب" iconColor="bg-violet-500">
                <div className="space-y-2">
                  <Label className="font-semibold">رسالة بعد إرسال الطلب</Label>
                  <Textarea value={settings.successMessage} onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })} rows={3} />
                </div>
              </SectionCard>
              <SectionCard icon={ShieldCheck} title="تأكيد قبل الإرسال" description="نافذة منبثقة يقرأها الزبون قبل تأكيد الطلب" iconColor="bg-amber-500">
                <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <Label className="block font-semibold">تفعيل نافذة التأكيد</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      عند الضغط على «اطلب الآن» تظهر رسالة التأكيد، ولا يمكن التأكيد إلا بعد 3 ثوانٍ
                    </p>
                  </div>
                  <Switch
                    checked={settings.confirmationEnabled}
                    onCheckedChange={(v) => setSettings({ ...settings, confirmationEnabled: v })}
                  />
                </div>
                {settings.confirmationEnabled && (
                  <div className="space-y-2">
                    <Label className="font-semibold">نص رسالة التأكيد</Label>
                    <Textarea
                      value={settings.confirmationMessage}
                      onChange={(e) => setSettings({ ...settings, confirmationMessage: e.target.value })}
                      rows={4}
                      placeholder="مثال: تأكد من صحة رقم الهاتف والعنوان قبل إرسال الطلب..."
                    />
                  </div>
                )}
              </SectionCard>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {editingPreset ? `حفظ القالب «${editingPreset.name}»` : "حفظ الإعدادات الافتراضية"}
          </Button>
        </TabsContent>

        <TabsContent value="delivery-prices" className="space-y-4">
          <SectionCard
            icon={Truck}
            title="أسعار التوصيل حسب المدينة"
            description="تُستخدم في حقل «نوع التوصيل» في صفحة الطلب — يختار الزبون المدينة ويُضاف السعر على المنتج"
            iconColor="bg-orange-500"
          >
            {!hasDeliveryField && (
              <p className="text-sm text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                فعّل حقل «نوع التوصيل» (delivery_city) من تبويب حقول النموذج ليظهر للزبائن.
              </p>
            )}
            <div className="space-y-3">
              {deliveryPrices.map((row, index) => (
                <div key={row.id || `new-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">المدينة</Label>
                    <Input
                      value={row.city_name}
                      onChange={(e) => updateDeliveryRow(index, { city_name: e.target.value })}
                      placeholder="مثال: طرابلس"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">سعر التوصيل</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.price}
                      onChange={(e) => updateDeliveryRow(index, { price: e.target.value })}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeDeliveryRow(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addDeliveryRow} className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة مدينة
              </Button>
            </div>
          </SectionCard>

          <Button onClick={handleSaveDeliveryPrices} disabled={savingPrices} className="w-full py-6 text-lg font-bold gap-2">
            {savingPrices ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            حفظ أسعار التوصيل
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrderFormSettings;
