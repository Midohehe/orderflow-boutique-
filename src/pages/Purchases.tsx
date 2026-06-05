import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ShoppingBag, Plus, Loader2, Trash2, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useStoreContext } from "@/hooks/useStoreContext";

interface Safe { id: string; name: string; balance: number; allow_negative_balance?: boolean; }
interface Purchase { id: string; amount: number; notes: string | null; created_at: string; safe_id: string; }

const Purchases = () => {
  const { activeStoreId } = useStoreContext();
  const [safes, setSafes] = useState<Safe[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [safeId, setSafeId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeStoreId) { setSafes([]); setPurchases([]); setLoading(false); return; }
    setLoading(true);
    const [sa, pu] = await Promise.all([
      supabase.from("safes").select("id, name, balance, allow_negative_balance").eq("store_id", activeStoreId).order("created_at"),
      supabase.from("purchases").select("id, amount, notes, created_at, safe_id").eq("store_id", activeStoreId).order("created_at", { ascending: false }),
    ]);
    if (sa.error) toast({ title: "خطأ", description: sa.error.message, variant: "destructive" });
    if (pu.error) toast({ title: "خطأ", description: pu.error.message, variant: "destructive" });
    setSafes((sa.data as Safe[]) || []);
    setPurchases((pu.data as Purchase[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeStoreId]);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !safeId) return;
    const safe = safes.find((s) => s.id === safeId);
    if (safe && !safe.allow_negative_balance && Number(safe.balance) < amt) {
      toast({
        title: "رصيد غير كافٍ",
        description: `الرصيد الحالي ${Number(safe.balance).toFixed(2)} — المطلوب ${amt.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase.from("purchases").insert({
      amount: amt, safe_id: safeId, notes: notes || null, owner_id: user!.id, store_id: activeStoreId,
    }).select("id").single();
    if (error || !inserted) { toast({ title: "خطأ", description: error?.message, variant: "destructive" }); setSaving(false); return; }
    const { error: movErr } = await supabase.from("safe_movements").insert({
      safe_id: safeId, amount: -amt, movement_type: "purchase",
      reference_id: inserted.id,
      notes: notes || "مشتريات", owner_id: user!.id, store_id: activeStoreId,
    });
    if (movErr) {
      await supabase.from("purchases").delete().eq("id", inserted.id);
      toast({ title: "خطأ", description: movErr.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    toast({ title: "تمت إضافة عملية الشراء" });
    setAmount(""); setSafeId(""); setNotes(""); setOpen(false); setSaving(false);
    load();
  };

  const removePurchase = async (id: string) => {
    // Trigger sync_safe_balance auto-restores balance on movement DELETE
    await supabase.from("safe_movements").delete().eq("reference_id", id).eq("movement_type", "purchase");
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم حذف عملية الشراء" });
    load();
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  const safeName = (id: string) => safes.find(s => s.id === id)?.name || "-";

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={ShoppingBag}
        title="المشتريات"
        description="المشتريات تخصم من الخزينة فقط ولا تؤثر على الأرباح"
        iconGradient="from-amber-500 to-orange-600"
        action={
          <Button onClick={() => setOpen(true)} disabled={safes.length === 0} className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
            <Plus className="w-4 h-4" />إضافة عملية شراء
          </Button>
        }
      />

      {safes.length === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">لا توجد خزينة لهذا المتجر</p>
                <p className="text-sm text-muted-foreground">المشتريات تُخصم من الخزينة — أنشئ خزينة أولاً ثم أضف عمليات الشراء.</p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/dashboard/safes">إنشاء خزينة</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {purchases.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">لا توجد مشتريات</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الخزينة</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleString("ar-SA")}</TableCell>
                    <TableCell>{safeName(p.safe_id)}</TableCell>
                    <TableCell className="text-orange-500 font-bold">{Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{p.notes || "-"}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف عملية الشراء؟</AlertDialogTitle>
                            <AlertDialogDescription>سيتم استرجاع المبلغ إلى الخزينة وإزالة الحركة المالية.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removePurchase(p.id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة عملية شراء</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div>
              <Label>الخزينة</Label>
              <Select value={safeId} onValueChange={setSafeId}>
                <SelectTrigger><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
                <SelectContent>{safes.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({Number(s.balance).toFixed(2)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={saving || !amount || !safeId}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchases;
