import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, Plus, Trash2, GripVertical, Loader2, MousePointerClick, MessageSquare, Wallet, FormInput } from "lucide-react";
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
        const { data, error } = await supabase
          .from("order_form_fields")
          .select("*")
          .order("sort_order", { ascending: true });

        if (error) throw error;

        if (data) {
          setFormFields(data.map(f => ({
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

  const handleRequiredToggle = (id: string) => {
    setFormFields(formFields.map((field) =>
      field.id === id ? { ...field, required: !field.required } : field
    ));
  };

  const handleLabelChange = (id: string, label: string) => {
    setFormFields(formFields.map((field) =>
      field.id === id ? { ...field, label } : field
    ));
  };

  const handlePlaceholderChange = (id: string, placeholder: string) => {
    setFormFields(formFields.map((field) =>
      field.id === id ? { ...field, placeholder } : field
    ));
  };

  const handleAddField = async () => {
    const newFieldKey = `custom_${Date.now()}`;
    const newSortOrder = formFields.length > 0 ? Math.max(...formFields.map(f => f.sort_order)) + 1 : 1;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("order_form_fields")
        .insert({
          owner_id: user!.id,
          field_key: newFieldKey,
          label: "حقل جديد",
          placeholder: "أدخل النص هنا...",
          field_type: "text",
          required: false,
          enabled: true,
          sort_order: newSortOrder,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setFormFields([...formFields, {
          id: data.id,
          field_key: data.field_key,
          label: data.label,
          placeholder: data.placeholder,
          field_type: data.field_type,
          required: data.required,
          enabled: data.enabled,
          sort_order: data.sort_order,
        }]);
      }
    } catch (error) {
      console.error("Error adding field:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة الحقل",
        variant: "destructive",
      });
    }
  };

  const handleDeleteField = async (id: string) => {
    try {
      const { error } = await supabase
        .from("order_form_fields")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setFormFields(formFields.filter((field) => field.id !== id));
    } catch (error) {
      console.error("Error deleting field:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف الحقل",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Update all fields
      for (const field of formFields) {
        const { error } = await supabase
          .from("order_form_fields")
          .update({
            label: field.label,
            placeholder: field.placeholder,
            required: field.required,
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
        <SectionCard icon={FileText} title="حقول النموذج" description="إدارة الحقول الظاهرة للعميل" iconColor="bg-blue-500">
            {formFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                <div className="flex-1 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">اسم الحقل</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => handleLabelChange(field.id, e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">النص المساعد</Label>
                    <Input
                      value={field.placeholder}
                      onChange={(e) => handlePlaceholderChange(field.id, e.target.value)}
                      placeholder="أدخل النص المساعد..."
                    />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={() => handleFieldToggle(field.id)}
                      />
                      <span className="font-medium">مفعل</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={field.required}
                        onCheckedChange={() => handleRequiredToggle(field.id)}
                        disabled={!field.enabled}
                      />
                      <span className="font-medium">مطلوب</span>
                    </label>
                  </div>
                </div>
                <Button
                  size="icon"
                  className="bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg transition-all"
                  onClick={() => handleDeleteField(field.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button
              onClick={handleAddField}
              className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              إضافة حقل جديد
            </Button>
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