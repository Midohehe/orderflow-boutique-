import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface QA {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  enabled: boolean;
  sort_order: number;
}

export default function AITrainingSettings() {
  const { toast } = useToast();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [instructions, setInstructions] = useState("");
  const [instructionsEnabled, setInstructionsEnabled] = useState(true);

  const [qaList, setQaList] = useState<QA[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QA | null>(null);
  const [form, setForm] = useState({ question: "", answer: "", keywords: "" });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: oid } = await (supabase as any).rpc("get_effective_owner_id", { _uid: u.user.id });
      const owner = oid || u.user.id;
      setOwnerId(owner);
      await Promise.all([loadSettings(owner), loadQa(owner)]);
      setLoading(false);
    })();
  }, []);

  const loadSettings = async (owner: string) => {
    const { data } = await (supabase as any)
      .from("ai_training_settings").select("*").eq("owner_id", owner).maybeSingle();
    if (data) {
      setInstructions(data.custom_instructions || "");
      setInstructionsEnabled(data.enabled !== false);
    }
  };

  const loadQa = async (owner: string) => {
    const { data } = await (supabase as any)
      .from("ai_training_qa").select("*").eq("owner_id", owner)
      .order("sort_order", { ascending: true });
    setQaList((data || []) as QA[]);
  };

  const saveSettings = async () => {
    if (!ownerId) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("ai_training_settings")
      .upsert({
        owner_id: ownerId,
        custom_instructions: instructions,
        enabled: instructionsEnabled,
      }, { onConflict: "owner_id" });
    setSaving(false);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else toast({ title: "تم الحفظ", description: "تم حفظ التعليمات بنجاح" });
  };

  const openNew = () => {
    setEditing(null);
    setForm({ question: "", answer: "", keywords: "" });
    setDialogOpen(true);
  };

  const openEdit = (q: QA) => {
    setEditing(q);
    setForm({ question: q.question, answer: q.answer, keywords: (q.keywords || []).join("، ") });
    setDialogOpen(true);
  };

  const saveQa = async () => {
    if (!ownerId) return;
    if (!form.question.trim() || !form.answer.trim()) {
      toast({ title: "حقول ناقصة", description: "أدخل السؤال والجواب", variant: "destructive" });
      return;
    }
    const keywords = form.keywords.split(/[،,\n]/).map((s) => s.trim()).filter(Boolean);
    if (editing) {
      const { error } = await (supabase as any).from("ai_training_qa")
        .update({ question: form.question, answer: form.answer, keywords }).eq("id", editing.id);
      if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      const { error } = await (supabase as any).from("ai_training_qa").insert({
        owner_id: ownerId,
        question: form.question, answer: form.answer, keywords,
        sort_order: qaList.length,
      });
      if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
    setDialogOpen(false);
    await loadQa(ownerId);
    toast({ title: "تم الحفظ" });
  };

  const toggleEnabled = async (q: QA) => {
    await (supabase as any).from("ai_training_qa").update({ enabled: !q.enabled }).eq("id", q.id);
    if (ownerId) await loadQa(ownerId);
  };

  const deleteQa = async (q: QA) => {
    if (!confirm("حذف هذا السؤال؟")) return;
    await (supabase as any).from("ai_training_qa").delete().eq("id", q.id);
    if (ownerId) await loadQa(ownerId);
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تدريب مساعد WhatsApp"
        description="خصّص تعليمات المساعد الذكي وأضف أسئلة وأجوبة جاهزة يستخدمها مع زبائنك."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>تعليمات عامة</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-enabled" className="text-sm">مفعّلة</Label>
              <Switch id="ai-enabled" checked={instructionsEnabled} onCheckedChange={setInstructionsEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            اكتب أي تعليمات إضافية يجب على المساعد التزامها (نبرة الكلام، عروض حالية، سياسات إرجاع، عبارات ممنوعة...).
          </p>
          <Textarea
            rows={8}
            placeholder="مثال: استعمل دائماً نبرة ودودة. لا تَعِد بتخفيض إلا إذا ذكر الزبون كود خصم. ساعات العمل من 9ص إلى 9م."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              حفظ التعليمات
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>أسئلة وأجوبة جاهزة</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} size="sm">
                  <Plus className="w-4 h-4 me-1" /> إضافة سؤال
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "تعديل سؤال" : "سؤال جديد"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>السؤال</Label>
                    <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
                      placeholder="مثال: متى يوصل الطلب؟" />
                  </div>
                  <div>
                    <Label>الجواب</Label>
                    <Textarea rows={4} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}
                      placeholder="الطلب يوصل خلال 2-4 أيام عمل حسب المدينة." />
                  </div>
                  <div>
                    <Label>كلمات مفتاحية (اختياري، افصل بفواصل)</Label>
                    <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                      placeholder="توصيل، وقت، مدة" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                  <Button onClick={saveQa}>حفظ</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {qaList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              لا توجد أسئلة بعد. أضف أسئلة شائعة من زبائنك ليجيب عليها المساعد بدقة.
            </p>
          ) : (
            <div className="space-y-3">
              {qaList.map((q) => (
                <div key={q.id} className="border rounded-lg p-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">س: {q.question}</div>
                      <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">ج: {q.answer}</div>
                      {q.keywords?.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">🏷️ {q.keywords.join("، ")}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch checked={q.enabled} onCheckedChange={() => toggleEnabled(q)} />
                      <Button size="icon" variant="ghost" onClick={() => openEdit(q)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteQa(q)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}