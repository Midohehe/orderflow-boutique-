import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Star, Loader2, LayoutTemplate } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Template {
  id: string;
  name: string;
  is_default: boolean;
  updated_at: string;
}

const LandingTemplates = () => {
  const { activeStore } = useStoreContext();
  const { profile } = useUserContext();
  const navigate = useNavigate();
  const storeId = activeStore?.id;
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!storeId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("landing_page_templates")
      .select("id, name, is_default, updated_at")
      .eq("store_id", storeId)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (!error) setItems((data || []) as Template[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [storeId]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !storeId) return;
    setSaving(true);
    const ownerId = activeStore?.owner_id || profile?.user_id;
    const { data, error } = await (supabase as any)
      .from("landing_page_templates")
      .insert({ name, store_id: storeId, owner_id: ownerId, puck_data: null, is_default: items.length === 0 })
      .select("id")
      .single();
    setSaving(false);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setAddOpen(false);
    setNewName("");
    toast({ title: "تم إنشاء القالب" });
    navigate(`/dashboard/page-builder?template=${data.id}`);
  };

  const handleSetDefault = async (t: Template) => {
    if (!storeId) return;
    // unset others
    await (supabase as any).from("landing_page_templates").update({ is_default: false }).eq("store_id", storeId);
    const { error } = await (supabase as any).from("landing_page_templates").update({ is_default: true }).eq("id", t.id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم تعيين القالب الافتراضي" });
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from("landing_page_templates").delete().eq("id", deleteTarget.id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setDeleteTarget(null);
    toast({ title: "تم حذف القالب" });
    load();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-violet-500" />
            قوالب صفحات الهبوط
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            أنشئ قوالب تصميم بمحرر Puck، ثم اختر القالب عند إنشاء أي صفحة هبوط.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> قالب جديد
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          لا توجد قوالب بعد. أنشئ قالبك الأول لبدء التصميم.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t) => (
            <Card key={t.id} className="card-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base truncate">{t.name}</h3>
                  {t.is_default && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1 shrink-0">
                      <Star className="w-3 h-3 fill-current" /> افتراضي
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1 bg-violet-500 hover:bg-violet-600 text-white"
                    onClick={() => navigate(`/dashboard/page-builder?template=${t.id}`)}
                  >
                    <Edit className="w-3 h-3" /> تعديل التصميم
                  </Button>
                  {!t.is_default && (
                    <Button size="sm" variant="outline" onClick={() => handleSetDefault(t)} title="تعيين كافتراضي">
                      <Star className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(t)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>قالب جديد</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-semibold">اسم القالب</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثلاً: قالب أنيق" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              إنشاء وفتح المحرر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>حذف القالب</DialogTitle></DialogHeader>
          <p>هل أنت متأكد من حذف القالب "{deleteTarget?.name}"؟ الصفحات المنشأة منه ستبقى كما هي.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete}>حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingTemplates;