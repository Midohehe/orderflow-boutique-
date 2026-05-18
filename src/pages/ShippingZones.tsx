import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, ChevronDown, ChevronLeft, MapPin } from "lucide-react";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useUserContext } from "@/hooks/useUserContext";

type Row = { id: string; external_id: number; name: string; display_name: string | null; kind: string; parent_external_id: number | null };

export default function ShippingZones() {
  const { isAdmin } = useUserContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shipping_zones")
      .select("id,external_id,name,display_name,kind,parent_external_id")
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
        (c.display_name || c.name).toLowerCase().includes(ql) ||
        c.name.toLowerCase().includes(ql) ||
        String(c.external_id).includes(ql) ||
        (areasByParent[c.external_id] || []).some((a) =>
          (a.display_name || a.name).toLowerCase().includes(ql) ||
          a.name.toLowerCase().includes(ql) ||
          String(a.external_id).includes(ql)
        )
      )
    : cities;

  const startEdit = (r: Row) => {
    setEditing(r.id);
    setEditVal(r.display_name || r.name);
  };
  const cancelEdit = () => { setEditing(null); setEditVal(""); };
  const saveEdit = async (r: Row) => {
    const newVal = editVal.trim();
    const payload = newVal && newVal !== r.name ? newVal : null;
    const { error } = await supabase
      .from("shipping_zones")
      .update({ display_name: payload })
      .eq("id", r.id);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, display_name: payload } : x));
    setEditing(null);
    toast({ title: "تم الحفظ" });
  };

  const renderName = (r: Row, prefix?: string) => {
    if (editing === r.id) {
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} className="h-7 text-sm" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(r); if (e.key === "Escape") cancelEdit(); }} />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(r)}><Check className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="w-4 h-4" /></Button>
        </div>
      );
    }
    const shown = r.display_name || r.name;
    return (
      <div className="flex items-center gap-2 group" onClick={(e) => e.stopPropagation()}>
        <span>{prefix}{shown}</span>
        {r.display_name && r.display_name !== r.name && (
          <span className="text-[10px] text-muted-foreground">({r.name})</span>
        )}
        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={() => startEdit(r)}>
          <Pencil className="w-3 h-3" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={MapPin}
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
          {isAdmin && (
            <Button onClick={sync} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="mr-2">مزامنة من شركة الشحن</span>
            </Button>
          )}
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
                  <Fragment key={c.external_id}>
                    <TableRow className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setOpen((p) => ({ ...p, [c.external_id]: !p[c.external_id] }))}>
                      <TableCell>
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </TableCell>
                      <TableCell><Badge variant="outline">{c.external_id}</Badge></TableCell>
                      <TableCell className="font-medium">{renderName(c)}</TableCell>
                      <TableCell>{areas.length}</TableCell>
                    </TableRow>
                    {isOpen && areas.map((a) => (
                      <TableRow key={`a-${a.id}`} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell><Badge variant="secondary">{a.external_id}</Badge></TableCell>
                        <TableCell className="pr-8 text-sm text-muted-foreground">{renderName(a, "↳ ")}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}