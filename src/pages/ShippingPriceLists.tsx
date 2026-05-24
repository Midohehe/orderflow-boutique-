import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Save, Truck, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import * as XLSX from "xlsx";

type Row = {
  id?: string;
  region: string;
  cities: string;
  price: number;
  duration: string | null;
  sort_order: number;
  _dirty?: boolean;
  _new?: boolean;
};

export default function ShippingPriceLists() {
  const { isAdmin } = useUserContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("shipping_price_lists")
      .select("*")
      .order("sort_order", { ascending: true });
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch, _dirty: true } : r));
  };

  const addRow = () => {
    const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    setRows((prev) => [...prev, { region: "", cities: "", price: 0, duration: "", sort_order: maxSort + 10, _new: true, _dirty: true }]);
  };

  const removeRow = async (i: number) => {
    const r = rows[i];
    if (r.id) {
      const { error } = await supabase.from("shipping_price_lists").delete().eq("id", r.id);
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    }
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    toast({ title: "تم الحذف" });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["المدينة", "السعر"],
      ["طرابلس", 30],
      ["بنغازي", 50],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "أسعار الشحن");
    XLSX.writeFile(wb, "shipping-prices-template.xlsx");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });

      const parsed: { city: string; price: number }[] = [];
      for (let i = 0; i < raw.length; i++) {
        const row = raw[i] || [];
        const city = String(row[0] ?? "").trim();
        const priceRaw = row[1];
        if (!city) continue;
        // Skip header row if it contains non-numeric price
        const price = Number(priceRaw);
        if (!Number.isFinite(price)) continue;
        parsed.push({ city, price });
      }

      if (parsed.length === 0) {
        toast({ title: "لم يتم العثور على بيانات صالحة", description: "تأكد أن العمود الأول للمدينة والثاني للسعر", variant: "destructive" });
        return;
      }

      const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
      const newRows: Row[] = parsed.map((p, idx) => ({
        region: "",
        cities: p.city,
        price: p.price,
        duration: "",
        sort_order: maxSort + (idx + 1) * 10,
        _new: true,
        _dirty: true,
      }));
      setRows((prev) => [...prev, ...newRows]);
      toast({ title: `تم استيراد ${parsed.length} مدينة`, description: "اضغط حفظ التغييرات لتأكيد الإضافة" });
    } catch (err: any) {
      toast({ title: "خطأ في قراءة الملف", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const toInsert = rows.filter((r) => r._new && r._dirty).map(({ _new, _dirty, id, ...rest }) => rest);
      const toUpdate = rows.filter((r) => !r._new && r._dirty && r.id);
      if (toInsert.length) {
        const { error } = await supabase.from("shipping_price_lists").insert(toInsert);
        if (error) throw error;
      }
      for (const r of toUpdate) {
        const { _new, _dirty, id, ...rest } = r;
        const { error } = await supabase.from("shipping_price_lists").update(rest).eq("id", id!);
        if (error) throw error;
      }
      toast({ title: "تم الحفظ" });
      await load();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Group by region for display
  const grouped = rows.reduce<Record<string, { row: Row; index: number }[]>>((acc, row, index) => {
    const key = row.region || "بدون منطقة";
    (acc[key] ||= []).push({ row, index });
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader icon={Truck} title="قوائم أسعار الشحن" description="أسعار التوصيل لكل مدينة، يستخدمها الذكاء الاصطناعي في المحادثات." />

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={addRow} variant="outline"><Plus className="w-4 h-4 ml-1" /> إضافة مدينة</Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={importing}>
            <FileSpreadsheet className="w-4 h-4 ml-1" /> {importing ? "جاري الاستيراد..." : "استيراد من Excel"}
          </Button>
          <Button onClick={downloadTemplate} variant="ghost">
            <Download className="w-4 h-4 ml-1" /> تنزيل قالب Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button onClick={saveAll} disabled={saving || !rows.some((r) => r._dirty)}>
            <Save className="w-4 h-4 ml-1" /> حفظ التغييرات
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([region, items]) => (
            <Card key={region} className="p-4">
              <h3 className="font-bold text-lg mb-3 text-primary">{region}</h3>
              <div className="space-y-2">
                <div className="hidden md:grid grid-cols-12 gap-2 text-sm font-semibold text-muted-foreground px-2">
                  <div className="col-span-5">المدن</div>
                  <div className="col-span-2">السعر</div>
                  <div className="col-span-2">المدة</div>
                  <div className="col-span-2">المنطقة</div>
                  <div className="col-span-1">حذف</div>
                </div>
                {items.map(({ row, index }) => (
                  <div key={row.id || `new-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <Input className="md:col-span-5" value={row.cities} onChange={(e) => update(index, { cities: e.target.value })} disabled={!isAdmin} placeholder="المدن" />
                    <Input className="md:col-span-2" type="number" value={row.price} onChange={(e) => update(index, { price: Number(e.target.value) })} disabled={!isAdmin} placeholder="السعر" />
                    <Input className="md:col-span-2" value={row.duration || ""} onChange={(e) => update(index, { duration: e.target.value })} disabled={!isAdmin} placeholder="مدة التوصيل" />
                    <Input className="md:col-span-2" value={row.region} onChange={(e) => update(index, { region: e.target.value })} disabled={!isAdmin} placeholder="المنطقة" />
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="md:col-span-1 text-destructive" onClick={() => removeRow(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {rows.length === 0 && <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>}
        </div>
      )}
    </div>
  );
}