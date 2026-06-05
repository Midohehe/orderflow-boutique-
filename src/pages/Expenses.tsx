import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Receipt, Plus, Loader2, Trash2, Tag, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useStoreContext } from "@/hooks/useStoreContext";

interface Safe { id: string; name: string; balance: number; allow_negative_balance?: boolean; }
interface ExpenseType { id: string; name: string; }
interface Expense {
  id: string; amount: number; notes: string | null; created_at: string;
  safe_id: string; expense_type_id: string | null;
}

const Expenses = () => {
  const { activeStoreId } = useStoreContext();
  const [safes, setSafes] = useState<Safe[]>([]);
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [typeId, setTypeId] = useState("");
  const [safeId, setSafeId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [typeName, setTypeName] = useState("");

  const load = async () => {
    if (!activeStoreId) { setSafes([]); setTypes([]); setExpenses([]); setLoading(false); return; }
    setLoading(true);
    const [sa, ty, ex] = await Promise.all([
      supabase.from("safes").select("id, name, balance, allow_negative_balance").eq("store_id", activeStoreId).order("created_at"),
      supabase.from("expense_types").select("id, name").eq("store_id", activeStoreId).order("created_at"),
      supabase.from("expenses").select("id, amount, notes, created_at, safe_id, expense_type_id").eq("store_id", activeStoreId).order("created_at", { ascending: false }),
    ]);
    if (sa.error) toast({ title: "خطأ", description: sa.error.message, variant: "destructive" });
    if (ty.error) toast({ title: "خطأ", description: ty.error.message, variant: "destructive" });
    if (ex.error) toast({ title: "خطأ", description: ex.error.message, variant: "destructive" });
    setSafes((sa.data as Safe[]) || []);
    setTypes((ty.data as ExpenseType[]) || []);
    setExpenses((ex.data as Expense[]) || []);
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
    const { data: inserted, error } = await supabase.from("expenses").insert({
      amount: amt, safe_id: safeId, expense_type_id: typeId || null,
      notes: notes || null, owner_id: user!.id, store_id: activeStoreId,
    }).select("id").single();
    if (error || !inserted) { toast({ title: "خطأ", description: error?.message, variant: "destructive" }); setSaving(false); return; }
    const { error: movErr } = await supabase.from("safe_movements").insert({
      safe_id: safeId, amount: -amt, movement_type: "expense",
      reference_id: inserted.id,
      notes: notes || (typeId ? types.find(t => t.id === typeId)?.name : null), owner_id: user!.id, store_id: activeStoreId,
    });
    if (movErr) {
      await supabase.from("expenses").delete().eq("id", inserted.id);
      toast({ title: "خطأ", description: movErr.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    toast({ title: "تمت إضافة المصروف" });
    setAmount(""); setTypeId(""); setSafeId(""); setNotes(""); setAddOpen(false); setSaving(false);
    load();
  };

  const removeExpense = async (id: string) => {
    await supabase.from("safe_movements").delete().eq("reference_id", id).eq("movement_type", "expense");
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم حذف المصروف" });
    load();
  };

  const addType = async () => {
    if (!typeName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("expense_types").insert({ name: typeName.trim(), owner_id: user!.id, store_id: activeStoreId });
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setTypeName(""); load();
  };

  const removeType = async (id: string) => {
    await supabase.from("expense_types").delete().eq("id", id);
    load();
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const safeName = (id: string) => safes.find(s => s.id === id)?.name || "-";
  const typeName2 = (id: string | null) => id ? (types.find(t => t.id === id)?.name || "-") : "-";

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={Receipt}
        title="المصروفات"
        description="إدارة المصروفات وأنواعها"
        iconGradient="from-rose-500 to-red-600"
      />

      {safes.length === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">لا توجد خزينة لهذا المتجر</p>
                <p className="text-sm text-muted-foreground">المصروفات تُخصم من الخزينة — أنشئ خزينة أولاً ثم أضف المصروفات.</p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/dashboard/safes">إنشاء خزينة</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">المصروفات</TabsTrigger>
          <TabsTrigger value="types">أنواع المصروفات</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddOpen(true)} disabled={safes.length === 0} className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700">
              <Plus className="w-4 h-4" />إضافة مصروف
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {expenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">لا توجد مصروفات</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">الخزينة</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                      <TableHead className="text-right">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("ar-SA")}</TableCell>
                        <TableCell>{typeName2(e.expense_type_id)}</TableCell>
                        <TableCell>{safeName(e.safe_id)}</TableCell>
                        <TableCell className="text-red-500 font-bold">{Number(e.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-sm">{e.notes || "-"}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف المصروف؟</AlertDialogTitle>
                                <AlertDialogDescription>سيتم استرجاع المبلغ إلى الخزينة وإزالة الحركة.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeExpense(e.id)}>حذف</AlertDialogAction>
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
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Tag className="w-5 h-5" />تعريف نوع جديد</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="اسم النوع" />
              <Button onClick={addType} disabled={!typeName.trim()}><Plus className="w-4 h-4" />إضافة</Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {types.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">لا توجد أنواع</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">إجراء</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {types.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => removeType(t.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة مصروف</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div>
              <Label>نوع المصروف</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={saving || !amount || !safeId}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
