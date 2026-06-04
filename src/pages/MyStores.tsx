import { useState } from "react";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Loader2, Store as StoreIcon, Check, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import StorePushToggle from "@/components/StorePushToggle";
import { parsePlanLimitError, planLimitMessage } from "@/lib/planLimits";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { Link } from "react-router-dom";

const sanitizeSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");

const MyStores = () => {
  const { user } = useAuth();
  const { stores, activeStoreId, setActiveStoreId, refresh } = useStoreContext();
  const { plan, usage } = usePlanUsage();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const ownStores = stores.filter((s) => s.owner_id === user?.id);

  const resetForm = () => { setName(""); setSlug(""); };

  const handleAdd = async () => {
    if (!user) return;
    const cleanSlug = sanitizeSlug(slug || name);
    if (!name.trim() || !cleanSlug) {
      toast({ title: "خطأ", description: "أدخل اسم ورابط المتجر", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("stores").insert({
        owner_id: user.id,
        name: name.trim(),
        slug: cleanSlug,
        is_default: false,
      });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "خطأ", description: "الرابط مستخدم مسبقاً", variant: "destructive" });
          return;
        }
        const limit = parsePlanLimitError(error.message);
        if (limit) {
          toast({
            title: "حد الخطة",
            description: planLimitMessage(limit.metric, limit.limit),
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      toast({ title: "تم", description: "تم إنشاء المتجر" });
      setAddOpen(false);
      resetForm();
      await refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const cleanSlug = sanitizeSlug(slug || name);
    if (!name.trim() || !cleanSlug) {
      toast({ title: "خطأ", description: "أدخل اسم ورابط المتجر", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ name: name.trim(), slug: cleanSlug })
        .eq("id", editTarget.id);
      if (error) {
        if (error.code === "23505") {
          toast({ title: "خطأ", description: "الرابط مستخدم مسبقاً", variant: "destructive" });
          return;
        }
        throw error;
      }
      toast({ title: "تم", description: "تم التحديث" });
      setEditTarget(null);
      resetForm();
      await refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("stores").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "تم", description: "تم حذف المتجر" });
      setDeleteTarget(null);
      await refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: "تعذر الحذف. تأكد من عدم وجود بيانات مرتبطة.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">متاجري</h1>
          <p className="text-sm text-muted-foreground">كل متجر مستقل ببياناته من منتجات وطلبات ومالية وشحن.</p>
          {plan && usage && (
            <p className="text-xs text-muted-foreground mt-1">
              المتاجر: {usage.stores} —{" "}
              <Link to="/dashboard/my-plan" className="text-primary hover:underline">
                خطتي ({plan.name})
              </Link>
            </p>
          )}
        </div>
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" />إضافة متجر</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>متجر جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>اسم المتجر</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="متجر الإكسسوارات" />
              </div>
              <div className="space-y-2">
                <Label>الرابط (slug)</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="accessories" dir="ltr" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                إنشاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ownStores.map((s) => (
          <Card key={s.id} className={s.id === activeStoreId ? "border-primary" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2 truncate">
                  <StoreIcon className="w-4 h-4 text-primary" />
                  {s.name}
                </span>
                {s.is_default && <Badge variant="secondary">افتراضي</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground truncate" dir="ltr">/store/{s.slug}</div>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => {
                  const url = `${window.location.origin}/store/${s.slug}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: "تم النسخ", description: url });
                }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <StorePushToggle storeId={s.id} initialEnabled={!!(s as any).push_enabled} onChange={() => refresh()} />
              <div className="flex flex-wrap gap-2">
                {s.id === activeStoreId ? (
                  <Badge className="gap-1"><Check className="w-3 h-3" /> نشط</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setActiveStoreId(s.id)}>تبديل إليه</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => {
                  setEditTarget({ id: s.id, name: s.name, slug: s.slug });
                  setName(s.name); setSlug(s.slug);
                }}>
                  <Edit className="w-4 h-4 ml-1" />تعديل
                </Button>
                {!s.is_default && (
                  <Button size="sm" variant="ghost" className="text-destructive"
                    onClick={() => setDeleteTarget({ id: s.id, name: s.name })}>
                    <Trash2 className="w-4 h-4 ml-1" />حذف
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) { setEditTarget(null); resetForm(); } }}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل المتجر</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>اسم المتجر</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الرابط (slug)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>إلغاء</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المتجر؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المتجر "{deleteTarget?.name}". لن يمكن الحذف إذا كانت توجد بيانات مرتبطة (منتجات، طلبات...).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyStores;
