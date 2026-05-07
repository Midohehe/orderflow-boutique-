import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, MapPin } from "lucide-react";
import defaults from "@/data/defaultCityAreas.json";

type Row = { id: string; city: string; area: string; builtin?: boolean };

const CityCorrections = () => {
  const { user } = useAuth();
  const [customRows, setCustomRows] = useState<Row[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");

  const builtinRows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const [c, areas] of Object.entries(defaults as Record<string, string[]>)) {
      for (const a of areas) out.push({ id: `builtin:${c}:${a}`, city: c, area: a, builtin: true });
    }
    return out;
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: corr }, { data: hid }] = await Promise.all([
      supabase.from("city_corrections").select("id, city, area").eq("owner_id", user.id).order("city"),
      supabase.from("hidden_default_cities" as any).select("city, area").eq("owner_id", user.id),
    ]);
    setCustomRows((corr as Row[]) || []);
    setHidden(new Set(((hid as any[]) || []).map((r) => `${r.city}||${r.area}`)));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const add = async () => {
    if (!user || !city.trim() || !area.trim()) {
      toast({ title: "أدخل المدينة والمنطقة", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("city_corrections").insert({
      owner_id: user.id, city: city.trim(), area: area.trim(),
    } as any);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      setCity(""); setArea("");
      toast({ title: "تمت الإضافة" });
      await load();
    }
    setAdding(false);
  };

  const removeCustom = async (id: string) => {
    if (!confirm("حذف هذا السجل؟")) return;
    const { error } = await supabase.from("city_corrections").delete().eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { setCustomRows(customRows.filter((r) => r.id !== id)); toast({ title: "تم الحذف" }); }
  };

  const hideBuiltin = async (r: Row) => {
    if (!user) return;
    if (!confirm(`إخفاء "${r.city} - ${r.area}" من القائمة؟`)) return;
    const { error } = await supabase.from("hidden_default_cities" as any).insert({
      owner_id: user.id, city: r.city, area: r.area,
    } as any);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      setHidden(new Set([...hidden, `${r.city}||${r.area}`]));
      toast({ title: "تم الإخفاء" });
    }
  };

  const visibleBuiltins = builtinRows.filter((r) => !hidden.has(`${r.city}||${r.area}`));
  const all: Row[] = [...visibleBuiltins, ...customRows];
  const filtered = all.filter((r) => {
    const q = filter.trim();
    if (!q) return true;
    return r.city.includes(q) || r.area.includes(q);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" /> قائمة المدن والمناطق (تصحيح تلقائي)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          عند إنشاء طلب، يتم البحث في هذه القائمة لتصحيح اسم المدينة والمنطقة قبل إرسالها لشركة الشحن.
          يمكنك حذف أي سجل (افتراضي أو مخصص) لتجاهله، وإضافة سجلات جديدة بالأسفل.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="المدينة (مثل: طرابلس)" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input placeholder="المنطقة (مثل: تاجوراء)" value={area} onChange={(e) => setArea(e.target.value)} />
          <Button onClick={add} disabled={adding}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="mr-2">إضافة</span>
          </Button>
        </div>

        <Input placeholder="بحث..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">لا توجد نتائج.</p>
        ) : (
          <div className="border rounded max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-right p-2">المدينة</th>
                  <th className="text-right p-2">المنطقة</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.city}</td>
                    <td className="p-2">{r.area}</td>
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => (r.builtin ? hideBuiltin(r) : removeCustom(r.id))}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          الافتراضية الظاهرة: {visibleBuiltins.length} | مخصصة: {customRows.length} | مخفية: {hidden.size}
        </p>
      </CardContent>
    </Card>
  );
};

export default CityCorrections;
