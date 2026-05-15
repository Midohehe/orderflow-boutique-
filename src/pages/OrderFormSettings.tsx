import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, Loader2, MousePointerClick, MessageSquare, FormInput, ArrowUp, ArrowDown, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { useUserContext } from "@/hooks/useUserContext";

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

const OrderFormSettings = () => {
  const { isAdmin, effectiveOwnerId } = useUserContext();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    buttonText: "اطلب الآن",
    successMessage: "شكراً لك! تم استلام طلبك بنجاح",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !effectiveOwnerId) return;

        const [{ data: cat }, { data: existing }] = await Promise.all([
          supabase.from("form_field_catalog").select("*").order("sort_order"),
          supabase.from("order_form_fields").select("*").eq("owner_id", effectiveOwnerId).order("sort_order"),
        ]);

        const catalogRows = (cat || []) as CatalogItem[];
        setCatalog(catalogRows);

        let rows = existing || [];
        // Auto-seed any missing catalog fields for this owner
        const existingKeys = new Set(rows.map((r: any) => r.field_key));
        const missing = catalogRows.filter(c => !existingKeys.has(c.field_key));
        if (missing.length > 0) {
          const { data: inserted } = await supabase.from("order_form_fields")
            .insert(missing.map(c => ({
              owner_id: effectiveOwnerId,
              field_key: c.field_key,
              label: c.label,
              placeholder: c.default_placeholder,
              field_type: c.field_type,
              required: c.default_required,
              enabled: c.default_required,
              sort_order: c.sort_order,
            }))).select();
          if (inserted) rows = [...rows, ...inserted];
        }

        setFormFields(rows.map((f: any) => ({
          id: f.id, field_key: f.field_key, label: f.label, placeholder: f.placeholder,
          field_type: f.field_type, required: f.required, enabled: f.enabled, sort_order: f.sort_order,
        })));
      } catch (e) {
        console.error(e);
      } finally { setLoading(false); }
    };
    if (effectiveOwnerId) load();
  }, [effectiveOwnerId]);

  // Visible to store owner = catalog admin_enabled fields only (admin sees all)
  const allowedKeys = new Set(catalog.filter(c => isAdmin || c.admin_enabled).map(c => c.field_key));
  const visibleFields = formFields.filter(f => allowedKeys.has(f.field_key));

  const handleFieldToggle = (id: string) => {
    setFormFields(formFields.map((f) => f.id === id ? { ...f, enabled: !f.enabled } : f));
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

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const f of formFields) {
        await supabase.from("order_form_fields")
          .update({ enabled: f.enabled, sort_order: f.sort_order, label: f.label, placeholder: f.placeholder })
          .eq("id", f.id);
      }
      toast({ title: "تم الحفظ", description: "تم حفظ إعدادات نموذج الطلب" });
    } catch (e) {
      toast({ title: "خطأ", description: "تعذر الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggleCatalogAdmin = async (key: string, value: boolean) => {
    const { error } = await supabase.from("form_field_catalog").update({ admin_enabled: value }).eq("field_key", key);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setCatalog(catalog.map(c => c.field_key === key ? { ...c, admin_enabled: value } : c));
  };

  const updateCatalogField = (key: string, patch: Partial<CatalogField>) => {
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
      <PageHeader icon={FormInput} title="تعديل نموذج الطلب" description="تخصيص حقول ورسائل النموذج" iconGradient="from-cyan-500 to-blue-500" />

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

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard icon={FileText} title="حقول النموذج" description="إظهار/إخفاء الحقول وترتيبها" iconColor="bg-blue-500">
          {[...visibleFields].sort((a, b) => a.sort_order - b.sort_order).map((field, i, arr) => (
            <div key={field.id} className="p-4 bg-muted/50 rounded-lg border space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => handleMove(field.id, -1)}>
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={i === arr.length - 1} onClick={() => handleMove(field.id, 1)}>
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 text-xs text-muted-foreground font-mono">
                  {field.field_key}{field.required ? " · مطلوب" : ""}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={field.enabled} onCheckedChange={() => handleFieldToggle(field.id)} />
                  <span className="font-medium">{field.enabled ? "ظاهر" : "مخفي"}</span>
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">اسم الحقل</Label>
                  <Input value={field.label} onChange={(e) => handleFieldEdit(field.id, { label: e.target.value })} />
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
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold gap-2">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        حفظ الإعدادات
      </Button>
    </div>
  );
};

export default OrderFormSettings;
