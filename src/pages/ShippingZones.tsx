import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, ChevronDown, ChevronLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";

type Row = { external_id: number; name: string; kind: string; parent_external_id: number | null };

export default function ShippingZones() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shipping_zones")
      .select("external_id,name,kind,parent_external_id")
      .order("name");
    if (error) toast({ title: "تعذر الجلب", description: error.message, variant: "destructive" });
    setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-shipping-zones", { body: {} });
    if (error || (data as any)?.error) {
      toast({ title: "فشل المزامنة", description: (data as any)?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "تمت المزامنة", description: `${(data as any).zones} مدينة • ${(data as any).areas} منطقة` });
      await load();
    }
    setSyncing(false);
  };

  const { cities, areasByParent } = useMemo(() => {
    const cities = rows.filter((r) => r.kind === "zone");
    const areasByParent: Record<number, Row[]> = {};
    for (const r of rows) {
      if (r.kind === "area" && r.parent_external_id != null) {
        (areasByParent[r.parent_external_id] ||= []).push(r);
      }
    }
    return { cities, areasByParent };
  }, [rows]);

  const ql = q.trim().toLowerCase();
  const visibleCities = ql
    ? cities.filter((c) =>
        c.name.toLowerCase().includes(ql) ||
        String(c.external_id).includes(ql) ||
        (areasByParent[c.external_id] || []).some((a) =>
          a.name.toLowerCase().includes(ql) || String(a.external_id).includes(ql)
        )
      )
    : cities;

  return (
    <div className="space-y-4">
      <PageHeader
        title="مدن ومناطق الشحن"
        description="قائمة المدن والمناطق المخزّنة محلياً من شركة الشحن."
      />
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث باسم المدينة/المنطقة أو الكود..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pr-9"
            />
          </div>
          <Button onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="mr-2">مزامنة من شركة الشحن</span>
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {cities.length} مدينة • {Object.values(areasByParent).reduce((s, a) => s + a.length, 0)} منطقة
        </div>

        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>الكود</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>عدد المناطق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </TableCell></TableRow>
              ) : visibleCities.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  لا توجد بيانات. اضغط "مزامنة" لجلبها من شركة الشحن.
                </TableCell></TableRow>
              ) : visibleCities.map((c) => {
                const areas = areasByParent[c.external_id] || [];
                const isOpen = !!open[c.external_id] || !!ql;
                return (
                  <>
                    <TableRow key={c.external_id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setOpen((p) => ({ ...p, [c.external_id]: !p[c.external_id] }))}>
                      <TableCell>
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </TableCell>
                      <TableCell><Badge variant="outline">{c.external_id}</Badge></TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{areas.length}</TableCell>
                    </TableRow>
                    {isOpen && areas.map((a) => (
                      <TableRow key={`a-${a.external_id}`} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell><Badge variant="secondary">{a.external_id}</Badge></TableCell>
                        <TableCell className="pr-8 text-sm text-muted-foreground">↳ {a.name}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}