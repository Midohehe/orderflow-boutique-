import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Plus, Loader2, History, ArrowDownCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Safe {
  id: string;
  name: string;
  balance: number;
  notes: string | null;
}

interface Movement {
  id: string;
  amount: number;
  movement_type: string;
  notes: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  deposit: "إيداع",
  expense: "مصروف",
  purchase: "شراء",
  adjustment: "تعديل",
};

const Safes = () => {
  const [safes, setSafes] = useState<Safe[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [initBalance, setInitBalance] = useState("");
  const [saving, setSaving] = useState(false);

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositSafe, setDepositSafe] = useState<Safe | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNotes, setDepositNotes] = useState("");

  const [movementsOpen, setMovementsOpen] = useState(false);
  const [movementsSafe, setMovementsSafe] = useState<Safe | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movLoading, setMovLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("safes").select("id, name, balance, notes").order("created_at");
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setSafes((data as Safe[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createSafe = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const balance = Number(initBalance) || 0;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("safes")
      .insert({ name: name.trim(), balance, owner_id: user!.id })
      .select().single();
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); setSaving(false); return; }
    if (balance !== 0) {
      await supabase.from("safe_movements").insert({
        safe_id: data.id, amount: balance, movement_type: "deposit",
        notes: "رصيد افتتاحي", owner_id: user!.id,
      });
    }
    toast({ title: "تم إنشاء الخزينة" });
    setName(""); setInitBalance(""); setCreateOpen(false); setSaving(false);
    load();
  };

  const submitDeposit = async () => {
    if (!depositSafe) return;
    const amt = Number(depositAmount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const newBalance = Number(depositSafe.balance) + amt;
    const { error: e1 } = await supabase.from("safes").update({ balance: newBalance }).eq("id", depositSafe.id);
    if (e1) { toast({ title: "خطأ", description: e1.message, variant: "destructive" }); setSaving(false); return; }
    await supabase.from("safe_movements").insert({
      safe_id: depositSafe.id, amount: amt, movement_type: "deposit",
      notes: depositNotes || null, owner_id: user!.id,
    });
    toast({ title: "تمت إضافة القيمة" });
    setDepositOpen(false); setDepositAmount(""); setDepositNotes(""); setSaving(false);
    load();
  };

  const openMovements = async (safe: Safe) => {
    setMovementsSafe(safe); setMovementsOpen(true); setMovLoading(true);
    const { data } = await supabase.from("safe_movements")
      .select("id, amount, movement_type, notes, created_at")
      .eq("safe_id", safe.id).order("created_at", { ascending: false });
    setMovements((data as Movement[]) || []);
    setMovLoading(false);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6 text-primary" />الخزائن</h1>
          <p className="text-muted-foreground text-sm">إدارة الخزائن وعرض حركاتها</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" />إضافة خزينة</Button>
      </div>

      {safes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد خزائن. ابدأ بإضافة خزينة.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {safes.map((s) => (
            <Card key={s.id} className="card-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" />{s.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
                  <p className={`text-2xl font-bold ${Number(s.balance) >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {Number(s.balance).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => { setDepositSafe(s); setDepositOpen(true); }}>
                    <ArrowDownCircle className="w-4 h-4" />إضافة قيمة
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openMovements(s)}>
                    <History className="w-4 h-4" />الحركات
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create safe */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة خزينة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>اسم الخزينة</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>الرصيد الافتتاحي (اختياري)</Label><Input type="number" value={initBalance} onChange={(e) => setInitBalance(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button onClick={createSafe} disabled={saving || !name.trim()}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة قيمة إلى {depositSafe?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>المبلغ</Label><Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} /></div>
            <div><Label>ملاحظات</Label><Textarea value={depositNotes} onChange={(e) => setDepositNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>إلغاء</Button>
            <Button onClick={submitDeposit} disabled={saving || !depositAmount}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movements */}
      <Dialog open={movementsOpen} onOpenChange={setMovementsOpen}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>حركات خزينة: {movementsSafe?.name}</DialogTitle></DialogHeader>
          {movLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : movements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد حركات</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.created_at).toLocaleString("ar-SA")}</TableCell>
                    <TableCell>{TYPE_LABEL[m.movement_type] || m.movement_type}</TableCell>
                    <TableCell className={Number(m.amount) >= 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                      {Number(m.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm">{m.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Safes;
