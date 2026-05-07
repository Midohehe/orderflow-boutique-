import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, Plus, Trash2, GripVertical, Loader2, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">تعديل نموذج الطلب</h1>
        <p className="text-muted-foreground">تخصيص حقول ورسائل نموذج الطلب</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form Fields */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              حقول النموذج
            </CardTitle>
            <CardDescription>إدارة حقول نموذج الطلب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center gap-3 p-4 bg-muted rounded-lg"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                <div className="flex-1 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">اسم الحقل</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => handleLabelChange(field.id, e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">النص المساعد (Placeholder)</Label>
                    <Input
                      value={field.placeholder}
                      onChange={(e) => handlePlaceholderChange(field.id, e.target.value)}
                      placeholder="أدخل النص المساعد..."
                      className="text-muted-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={() => handleFieldToggle(field.id)}
                      />
                      <span className="text-muted-foreground">مفعل</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={field.required}
                        onCheckedChange={() => handleRequiredToggle(field.id)}
                        disabled={!field.enabled}
                      />
                      <span className="text-muted-foreground">مطلوب</span>
                    </label>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDeleteField(field.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            <Button
              variant="outline"
              onClick={handleAddField}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة حقل جديد
            </Button>
          </CardContent>
        </Card>

        {/* General Settings */}
        <div className="space-y-6">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>إعدادات الزر</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>نص الزر</Label>
                <Input
                  value={settings.buttonText}
                  onChange={(e) => setSettings({ ...settings, buttonText: e.target.value })}
                  placeholder="اطلب الآن"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>رسالة النجاح</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>رسالة بعد إرسال الطلب</Label>
                <Textarea
                  value={settings.successMessage}
                  onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })}
                  placeholder="شكراً لك! تم استلام طلبك بنجاح"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>الدفع عند الاستلام</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار شارة الدفع عند الاستلام</Label>
                <Switch
                  checked={settings.showCodBadge}
                  onCheckedChange={(checked) => setSettings({ ...settings, showCodBadge: checked })}
                />
              </div>
              <div className="space-y-2">
                <Label>نص الدفع عند الاستلام</Label>
                <Input
                  value={settings.codText}
                  onChange={(e) => setSettings({ ...settings, codText: e.target.value })}
                  placeholder="الدفع عند الاستلام"
                  disabled={!settings.showCodBadge}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
};

export default OrderFormSettings;