import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Plus, Copy, Download, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CardRow {
  id: string;
  code: string;
  value: number;
  batch_id: string | null;
  batch_label: string | null;
  used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

const AdminCards = () => {
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("100");
  const [count, setCount] = useState("10");
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<"all" | "unused" | "used">("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("recharge_cards").select("*").order("created_at", { ascending: false }).limit(500);
    setCards((data as CardRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (!ctxLoading && isAdmin) load(); else if (!ctxLoading) setLoading(false); }, [ctxLoading, isAdmin]);

  const handleGenerate = async () => {
    const v = Number(value); const c = Number(count);
    if (v <= 0 || c <= 0 || c > 1000) {
      toast({ title: "خطأ", description: "تحقق من القيمة والعدد (الحد الأقصى 1000)", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_recharge_cards", { _value: v, _count: c, _label: label || null });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) throw new Error(res?.error || "تعذر الإنشاء");
      toast({ title: "تم", description: `تم إنشاء ${c} كرت بقيمة ${v}` });
      setLabel(""); load();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "تم النسخ", description: code });
  };

  const deleteCard = async (id: string) => {
    const { error } = await supabase.from("recharge_cards").delete().eq("id", id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم الحذف" });
    load();
  };

  const exportBatch = (batchId: string | null) => {
    const rows = cards.filter((c) => c.batch_id === batchId && !c.used);
    if (!rows.length) return;
    const csv = "code,value\n" + rows.map((r) => `${r.code},${r.value}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cards-${batchId?.slice(0, 8) || "all"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (ctxLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <div className="p-6 text-center text-muted-foreground">هذا القسم مخصص للأدمن فقط.</div>;

  const filtered = cards.filter((c) => filter === "all" ? true : filter === "used" ? c.used : !c.used);

  // Group by batch
  const batches = new Map<string, { label: string | null; value: number; total: number; used: number; created: string }>();
  cards.forEach((c) => {
    const k = c.batch_id || "no-batch";
    const cur = batches.get(k) || { label: c.batch_label, value: c.value, total: 0, used: 0, created: c.created_at };
    cur.total++; if (c.used) cur.used++;
    batches.set(k, cur);
  });

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader icon={CreditCard} title="كروت الشحن" description="إنشاء وإدارة كروت شحن المحافظ" iconGradient="from-violet-500 to-purple-600" />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> إنشاء دفعة كروت</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2"><Label>قيمة الكرت</Label><Input type="number" min="1" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div className="space-y-2"><Label>عدد الكروت</Label><Input type="number" min="1" max="1000" value={count} onChange={(e) => setCount(e.target.value)} /></div>
          <div className="space-y-2"><Label>وصف الدفعة (اختياري)</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: عرض رمضان" /></div>
          <div className="space-y-2"><Label>&nbsp;</Label>
            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الدفعات</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Array.from(batches.entries()).map(([id, b]) => (
            <div key={id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{b.label || "بدون وصف"} — قيمة {b.value}</p>
                <p className="text-xs text-muted-foreground">{b.used}/{b.total} مستخدم • {new Date(b.created).toLocaleDateString("ar")}</p>
              </div>
              {id !== "no-batch" && (
                <Button size="sm" variant="outline" onClick={() => exportBatch(id)}>
                  <Download className="w-4 h-4 ml-1" /> تصدير غير المستخدم
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>الكروت ({filtered.length})</CardTitle>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="unused">غير مستخدم</SelectItem>
              <SelectItem value="used">مستخدم</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <code className="font-mono font-bold">{c.code}</code>
                <Badge variant="outline">{c.value}</Badge>
                {c.used ? <Badge variant="secondary">مستخدم</Badge> : <Badge>متاح</Badge>}
                {c.used_at && <span className="text-xs text-muted-foreground">{new Date(c.used_at).toLocaleDateString("ar")}</span>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => copyCode(c.code)}><Copy className="w-4 h-4" /></Button>
                {!c.used && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف الكرت؟</AlertDialogTitle>
                        <AlertDialogDescription>هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCard(c.id)}>حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCards;