import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, Loader2, MousePointerClick, MessageSquare, Wallet, FormInput, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";

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
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    buttonText: "اطلب الآن",
    successMessage: "شكراً لك! تم استلام طلبك بنجاح",
    codText: "الدفع عند الاستلام",
    showCodBadge: true,
  });

  useEffect(() => {
    const loadFormFields = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("order_form_fields")
          .select("*")
          .order("sort_order", { ascending: true });

        if (error) throw error;

        let rows = data || [];

        // Seed default fields the first time a user opens this page so
        // landing pages always collect the essential customer info.
        if (user && rows.length === 0) {
          const defaults = [
            { field_key: "phone", label: "رقم الهاتف", placeholder: "أدخل رقم هاتفك", field_type: "phone", required: true, enabled: true, sort_order: 1 },
            { field_key: "full_name", label: "الاسم الكامل", placeholder: "أدخل اسمك الكامل", field_type: "text", required: true, enabled: true, sort_order: 2 },
            { field_key: "government", label: "المدينة", placeholder: "أدخل اسم مدينتك", field_type: "text", required: true, enabled: true, sort_order: 3 },
            { field_key: "address", label: "العنوان التفصيلي", placeholder: "الشارع، رقم المبنى…", field_type: "textarea", required: true, enabled: true, sort_order: 4 },
            { field_key: "note", label: "المنطقة", placeholder: "الرجاء ادخال المنطقة", field_type: "text", required: false, enabled: false, sort_order: 5 },
            { field_key: "country", label: "الدولة", placeholder: "أدخل اسم الدولة", field_type: "text", required: false, enabled: false, sort_order: 6 },
            { field_key: "email", label: "البريد الإلكتروني", placeholder: "example@mail.com", field_type: "email", required: false, enabled: false, sort_order: 7 },
            { field_key: "phone_alt", label: "رقم هاتف بديل", placeholder: "رقم هاتف إضافي", field_type: "phone", required: false, enabled: false, sort_order: 8 },
            { field_key: "sa_national_address", label: "العنوان الوطني", placeholder: "رمز العنوان الوطني", field_type: "text", required: false, enabled: false, sort_order: 9 },
          ];
          const { data: inserted, error: insErr } = await supabase
            .from("order_form_fields")
            .insert(defaults.map((d) => ({ ...d, owner_id: user.id })))
            .select();
          if (!insErr && inserted) rows = inserted;
        }

        if (rows.length) {
          setFormFields(rows.map(f => ({
            id: f.id,
            field_key: f.field_key,
            label: f.label,
            placeholder: f.placeholder,
            field_type: f.field_type,
            required: f.required,
            enabled: f.enabled,
            sort_order: f.sort_order,
          })));
        }
      } catch (error) {
        console.error("Error loading form fields:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFormFields();
  }, []);

  const handleFieldToggle = (id: string) => {
    setFormFields(formFields.map((field) =>
      field.id === id ? { ...field, enabled: !field.enabled } : field
    ));
  };

  const handleMove = (id: string, direction: -1 | 1) => {
    const sorted = [...formFields].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(f => f.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aOrder = a.sort_order;
    a.sort_order = b.sort_order;
    b.sort_order = aOrder;
    setFormFields(sorted);
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Update visibility + sort order only
      for (const field of formFields) {
        const { error } = await supabase
          .from("order_form_fields")
          .update({
            enabled: field.enabled,
            sort_order: field.sort_order,
          })
          .eq("id", field.id);

        if (error) throw error;
      }

      toast({
        title: "تم الحفظ",
        description: "تم حفظ إعدادات نموذج الطلب بنجاح",
      });
    } catch (error) {
      console.error("Error saving form fields:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ الإعدادات",
        variant: "destructive",
      });
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader icon={FormInput} title="تعديل نموذج الطلب" description="تخصيص حقول ورسائل النموذج" iconGradient="from-cyan-500 to-blue-500" />

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard icon={FileText} title="حقول النموذج" description="إظهار/إخفاء الحقول وترتيبها" iconColor="bg-blue-500">
            {[...formFields].sort((a, b) => a.sort_order - b.sort_order).map((field, i, arr) => (
              <div
                key={field.id}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border"
              >
                <div className="flex flex-col gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => handleMove(field.id, -1)}>
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={i === arr.length - 1} onClick={() => handleMove(field.id, 1)}>
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{field.label}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">{field.field_key}{field.required ? " · مطلوب" : ""}</div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={field.enabled}
                    onCheckedChange={() => handleFieldToggle(field.id)}
                  />
                  <span className="font-medium">{field.enabled ? "ظاهر" : "مخفي"}</span>
                </label>
              </div>
            ))}
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

          <SectionCard
            icon={Wallet}
            title="الدفع عند الاستلام"
            description="شارة COD"
            iconColor="bg-amber-500"
            action={
              <Switch checked={settings.showCodBadge} onCheckedChange={(c) => setSettings({ ...settings, showCodBadge: c })} />
            }
          >
            <div className="space-y-2">
              <Label className="font-semibold">نص الدفع عند الاستلام</Label>
              <Input value={settings.codText} onChange={(e) => setSettings({ ...settings, codText: e.target.value })} disabled={!settings.showCodBadge} />
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