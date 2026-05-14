import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, Loader2, Search, ChevronLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ReturnRow {
  id: string;
  code: string;
  return_date: string | null;
  payment_amount: number;
  due_fees: number;
  shipment_count: number;
  pieces_count: number;
  safe_name: string | null;
  notes: string | null;
  received: boolean;
  shipments_synced_at: string | null;
}

const Returns = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("returns")
      .select("id, code, return_date, payment_amount, due_fees, shipment_count, pieces_count, safe_name, notes, received, shipments_synced_at")
      .order("return_date", { ascending: false });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setRows((data as ReturnRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-returns");
      if (error) throw error;
      toast({ title: "تم التحديث", description: `تم جلب ${data?.count ?? 0} قائمة` });
      await load();
    } catch (e: any) {
      toast({ title: "تعذر التحديث", description: e?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (r.code || "").toLowerCase().includes(t)
      || (r.safe_name || "").toLowerCase().includes(t);
  });

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">قوائم استلام المرتجعات</h1>
          <p className="text-muted-foreground">قوائم تسليم المرتجعات (RTRN) القادمة من شركة الشحن</p>
        </div>
        <Button onClick={refresh} disabled={syncing}>
          {syncing ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
          تحديث من شركة الشحن
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">القوائم</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full sm:w-[320px] mb-4">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث بكود القائمة أو الخزنة"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pr-9"
            />
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              لا توجد قوائم. اضغط "تحديث من شركة الشحن" لجلب القوائم.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">كود القائمة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">عدد الشحنات</TableHead>
                    <TableHead className="text-right">القطع</TableHead>
                    <TableHead className="text-right">الخزنة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/dashboard/returns/${r.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.return_date ? new Date(r.return_date).toLocaleDateString("ar-LY") : "—"}
                      </TableCell>
                      <TableCell>{r.shipment_count}</TableCell>
                      <TableCell>{r.pieces_count}</TableCell>
                      <TableCell className="text-muted-foreground">{r.safe_name || "—"}</TableCell>
                      <TableCell>
                        {r.received ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10">
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            تم الاستلام
                          </Badge>
                        ) : (
                          <Badge variant="secondary">قيد الاستلام</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Returns;
