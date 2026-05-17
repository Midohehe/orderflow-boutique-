import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, Save, AlertOctagon } from "lucide-react";
import { useUserContext } from "@/hooks/useUserContext";
import { Navigate } from "react-router-dom";

interface Alias {
  id: string;
  pattern: string;
  match_type: string;
  short_label: string;
  sort_order: number;
}

const ShippingErrorAliases = () => {
  const { isAdmin, loading: userLoading } = useUserContext();
  const { toast } = useToast();
  const [items, setItems] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("contains");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shipping_error_aliases")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setItems((data as Alias[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (userLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const handleAdd = async () => {
    if (!newPattern.trim() || !newLabel.trim()) {
      toast({ title: "أدخل النص المطابق والاسم المختصر", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("shipping_error_aliases").insert({
      pattern: newPattern.trim(),
      short_label: newLabel.trim(),
      match_type: newType,
      sort_order: items.length,
    });
    setSaving(false);
    if (error) {
      toast({ title: "فشل الإضافة", description: error.message, variant: "destructive" });
      return;
    }
    setNewPattern(""); setNewLabel(""); setNewType("contains");
    toast({ title: "تمت الإضافة" });
    load();
  };

  const handleUpdate = async (id: string, patch: Partial<Alias>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  };

  const handleSave = async (item: Alias) => {
    const { error } = await supabase.from("shipping_error_aliases").update({
      pattern: item.pattern,
      short_label: item.short_label,
      match_type: item.match_type,
    }).eq("id", item.id);
    if (error) toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" });
    else toast({ title: "تم الحفظ" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا التعريف؟")) return;
    const { error } = await supabase.from("shipping_error_aliases").delete().eq("id", id);
    if (error) toast({ title: "فشل الحذف", description: error.message, variant: "destructive" });
    else { toast({ title: "تم الحذف" }); load(); }
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <AlertOctagon className="w-6 h-6 text-destructive" />
        <h1 className="text-2xl font-bold">تعريفات فشل الإرسال</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        أضف اسماً مختصراً واضحاً يعبّر عن كل رسالة فشل إرسال تأتي من شركة الشحن. سيظهر الاسم المختصر بجانب الخطأ في الطلبيات بدلاً من النص الطويل.
      </p>

      <Card className="p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة تعريف جديد</h2>
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-5 space-y-1">
            <Label>النص المطابق (من رسالة الخطأ)</Label>
            <Input value={newPattern} onChange={(e) => setNewPattern(e.target.value)} placeholder="مثال: There is no available quantity" />
          </div>
          <div className="md:col-span-4 space-y-1">
            <Label>الاسم المختصر</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="مثال: لا يوجد مخزون متاح" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label>نوع المطابقة</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">يحتوي</SelectItem>
                <SelectItem value="exact">مطابقة تامة</SelectItem>
                <SelectItem value="regex">Regex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 flex items-end">
            <Button onClick={handleAdd} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-3">التعريفات المضافة ({items.length})</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا يوجد تعريفات بعد</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="grid md:grid-cols-12 gap-2 items-end border-b pb-3">
                <div className="md:col-span-5">
                  <Label className="text-xs">النص المطابق</Label>
                  <Input value={item.pattern} onChange={(e) => handleUpdate(item.id, { pattern: e.target.value })} />
                </div>
                <div className="md:col-span-4">
                  <Label className="text-xs">الاسم المختصر</Label>
                  <Input value={item.short_label} onChange={(e) => handleUpdate(item.id, { short_label: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">المطابقة</Label>
                  <Select value={item.match_type} onValueChange={(v) => handleUpdate(item.id, { match_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">يحتوي</SelectItem>
                      <SelectItem value="exact">مطابقة تامة</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1 flex gap-1">
                  <Button size="icon" variant="outline" onClick={() => handleSave(item)} title="حفظ">
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => handleDelete(item.id)} title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ShippingErrorAliases;