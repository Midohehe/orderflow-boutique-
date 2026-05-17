import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Plus, Trash2, Star, Loader2, MessageSquare, ListChecks, Sliders } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_TEMPLATE_BODY, TEMPLATE_VARIABLES } from "@/lib/confirmationTemplates";
import { useStoreContext } from "@/hooks/useStoreContext";

interface Template { id: string; name: string; body: string; is_default: boolean; channel: string; owner_id: string }
interface Reason { id: string; label: string; sort_order: number; owner_id: string }
interface Settings {
  owner_id: string;
  max_no_answer_attempts: number;
  auto_cancel_after_hours: number;
  work_hours_start: string;
  work_hours_end: string;
  auto_assign_enabled: boolean;
}

export default function ConfirmationSettings() {
  const { activeStoreId } = useStoreContext();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newTplName, setNewTplName] = useState("قالب جديد");
  const [newTplBody, setNewTplBody] = useState(DEFAULT_TEMPLATE_BODY);
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const { data: ownerRow } = await (supabase as any).rpc("get_effective_owner_id", { _uid: u.user.id });
      const oid = (ownerRow as string) || u.user.id;
      setOwnerId(oid);
      if (!activeStoreId) { setLoading(false); return; }
      setLoading(true);
      const [t, r, s] = await Promise.all([
        (supabase as any).from("confirmation_templates").select("*").eq("store_id", activeStoreId).order("is_default", { ascending: false }),
        (supabase as any).from("cancellation_reasons").select("*").eq("store_id", activeStoreId).order("sort_order"),
        (supabase as any).from("confirmation_settings").select("*").eq("store_id", activeStoreId).maybeSingle(),
      ]);
      setTemplates((t.data as Template[]) || []);
      setReasons((r.data as Reason[]) || []);
      setSettings((s.data as Settings) || {
        owner_id: oid, max_no_answer_attempts: 3, auto_cancel_after_hours: 0,
        work_hours_start: "09:00", work_hours_end: "21:00", auto_assign_enabled: false,
      });
      setLoading(false);
    })();
  }, [activeStoreId]);

  const addTemplate = async () => {
    if (!ownerId || !newTplName.trim() || !newTplBody.trim()) return;
    const { data, error } = await (supabase as any).from("confirmation_templates").insert({
      owner_id: ownerId, store_id: activeStoreId, name: newTplName, body: newTplBody, channel: "whatsapp",
      is_default: templates.length === 0,
    }).select().single();
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setTemplates(prev => [data, ...prev]);
    setNewTplName("قالب جديد"); setNewTplBody(DEFAULT_TEMPLATE_BODY);
    toast({ title: "تمت الإضافة" });
  };

  const updateTemplate = async (id: string, patch: Partial<Template>) => {
    const { error } = await (supabase as any).from("confirmation_templates").update(patch).eq("id", id);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("حذف هذا القالب؟")) return;
    const { error } = await (supabase as any).from("confirmation_templates").delete().eq("id", id);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const setDefault = async (id: string) => {
    if (!ownerId) return;
    await (supabase as any).from("confirmation_templates").update({ is_default: false }).eq("owner_id", ownerId);
    await updateTemplate(id, { is_default: true });
    setTemplates(prev => prev.map(t => ({ ...t, is_default: t.id === id })));
  };

  const addReason = async () => {
    if (!ownerId || !newReason.trim()) return;
    const { data, error } = await (supabase as any).from("cancellation_reasons").insert({
      owner_id: ownerId, store_id: activeStoreId, label: newReason.trim(), sort_order: reasons.length,
    }).select().single();
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setReasons(prev => [...prev, data]);
    setNewReason("");
  };

  const deleteReason = async (id: string) => {
    await (supabase as any).from("cancellation_reasons").delete().eq("id", id);
    setReasons(prev => prev.filter(r => r.id !== id));
  };

  const saveSettings = async () => {
    if (!settings || !ownerId) return;
    setSaving(true);
    // confirmation_settings PK is owner_id (one row per owner); keep store_id for future
    const { error } = await (supabase as any).from("confirmation_settings").upsert({
      ...settings, owner_id: ownerId, store_id: activeStoreId,
    }, { onConflict: "owner_id" });
    setSaving(false);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    toast({ title: "تم الحفظ" });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={SettingsIcon}
        title="إعدادات مركز التأكيد"
        description="قوالب الواتساب، أسباب الإلغاء، وسياسة المحاولات"
        iconGradient="from-emerald-500 to-teal-600"
      />

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates"><MessageSquare className="w-4 h-4 ml-1" /> قوالب الرسائل</TabsTrigger>
          <TabsTrigger value="reasons"><ListChecks className="w-4 h-4 ml-1" /> أسباب الإلغاء</TabsTrigger>
          <TabsTrigger value="policy"><Sliders className="w-4 h-4 ml-1" /> السياسة</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">إضافة قالب جديد</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>اسم القالب</Label>
                <Input value={newTplName} onChange={(e) => setNewTplName(e.target.value)} />
              </div>
              <div>
                <Label>نص الرسالة</Label>
                <Textarea rows={4} value={newTplBody} onChange={(e) => setNewTplBody(e.target.value)} />
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                  المتغيرات المتاحة:
                  {TEMPLATE_VARIABLES.map(v => (
                    <Badge key={v.token} variant="outline" className="cursor-pointer"
                      onClick={() => setNewTplBody(b => b + " " + v.token)}>
                      {v.token} = {v.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={addTemplate}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {templates.map(t => (
              <Card key={t.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input className="font-bold max-w-xs" value={t.name}
                      onChange={(e) => updateTemplate(t.id, { name: e.target.value })} />
                    <div className="flex gap-1">
                      <Button size="sm" variant={t.is_default ? "default" : "outline"}
                        onClick={() => setDefault(t.id)}>
                        <Star className="w-3.5 h-3.5 ml-1" /> {t.is_default ? "افتراضي" : "اجعله افتراضياً"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteTemplate(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Textarea rows={3} value={t.body} onChange={(e) => updateTemplate(t.id, { body: e.target.value })} />
                </CardContent>
              </Card>
            ))}
            {templates.length === 0 && (
              <Card><CardContent className="p-6 text-center text-muted-foreground">لا توجد قوالب بعد. أضف قالباً أعلاه.</CardContent></Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reasons" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input placeholder="سبب جديد للإلغاء (مثل: العميل تراجع)" value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addReason()} />
                <Button onClick={addReason}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
              </div>
              <div className="space-y-2">
                {reasons.map(r => (
                  <div key={r.id} className="flex items-center justify-between border-b pb-2">
                    <span>{r.label}</span>
                    <Button size="sm" variant="ghost" onClick={() => deleteReason(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {reasons.length === 0 && <div className="text-center text-muted-foreground py-4">لا توجد أسباب بعد.</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="mt-4">
          {settings && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>أقصى عدد محاولات "لم يرد" قبل التنبيه</Label>
                    <Input type="number" min={1} value={settings.max_no_answer_attempts}
                      onChange={(e) => setSettings({ ...settings, max_no_answer_attempts: +e.target.value || 1 })} />
                  </div>
                  <div>
                    <Label>الإلغاء التلقائي بعد كم ساعة (0 = تعطيل)</Label>
                    <Input type="number" min={0} value={settings.auto_cancel_after_hours}
                      onChange={(e) => setSettings({ ...settings, auto_cancel_after_hours: +e.target.value || 0 })} />
                  </div>
                  <div>
                    <Label>بداية ساعات العمل</Label>
                    <Input type="time" value={settings.work_hours_start}
                      onChange={(e) => setSettings({ ...settings, work_hours_start: e.target.value })} />
                  </div>
                  <div>
                    <Label>نهاية ساعات العمل</Label>
                    <Input type="time" value={settings.work_hours_end}
                      onChange={(e) => setSettings({ ...settings, work_hours_end: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <Label>توزيع تلقائي على الموظفين</Label>
                    <p className="text-xs text-muted-foreground">إسناد الطلبات الجديدة بالتدوير</p>
                  </div>
                  <Switch checked={settings.auto_assign_enabled}
                    onCheckedChange={(v) => setSettings({ ...settings, auto_assign_enabled: v })} />
                </div>
                <Button onClick={saveSettings} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />} حفظ السياسة
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}