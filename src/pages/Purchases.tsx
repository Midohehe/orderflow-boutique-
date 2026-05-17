import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingBag, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useStoreContext } from "@/hooks/useStoreContext";

interface Safe { id: string; name: string; balance: number; }
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
      supabase.from("safes").select("id, name, balance").eq("store_id", activeStoreId).order("created_at"),
      supabase.from("purchases").select("id, amount, notes, created_at, safe_id").eq("store_id", activeStoreId).order("created_at", { ascending: false }),
    ]);
    setSafes((sa.data as Safe[]) || []);
    setPurchases((pu.data as Purchase[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeStoreId]);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !safeId) return;
    setSaving(true);
    const safe = safes.find(s => s.id === safeId);
    if (!safe) { setSaving(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("purchases").insert({
      amount: amt, safe_id: safeId, notes: notes || null, owner_id: user!.id, store_id: activeStoreId,
    });
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); setSaving(false); return; }
    await supabase.from("safes").update({ balance: Number(safe.balance) - amt }).eq("id", safeId);
    await supabase.from("safe_movements").insert({
      safe_id: safeId, amount: -amt, movement_type: "purchase",
      notes: notes || "مشتريات", owner_id: user!.id, store_id: activeStoreId,
    });
    toast({ title: "تمت إضافة عملية الشراء" });
    setAmount(""); setSafeId(""); setNotes(""); setOpen(false); setSaving(false);
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleString("ar-SA")}</TableCell>
                    <TableCell>{safeName(p.safe_id)}</TableCell>
                    <TableCell className="text-orange-500 font-bold">{Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{p.notes || "-"}</TableCell>
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
