import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  orderId: string;
  city: string | null | undefined;
  area: string | null | undefined;
  originalCity: string;
  originalAddress: string;
  onSaved: (city: string, area: string) => void;
}

export const EditMatchedCity = ({ orderId, city, area, originalCity, originalAddress, onSaved }: Props) => {
  const [editing, setEditing] = useState(false);
  const [c, setC] = useState(city || "");
  const [a, setA] = useState(area || "");
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState<Array<{ id: number; name: string }>>([]);
  const [areasMap, setAreasMap] = useState<Record<number, Array<{ id: number; name: string }>>>({});
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  const selectedZone = zones.find((z) => z.name === c);
  const filteredAreas = selectedZone ? (areasMap[selectedZone.id] || []) : [];

  useEffect(() => {
    if (!editing || zones.length > 0) return;
    setLoadingZones(true);
    (async () => {
      const { data, error } = await supabase.functions.invoke("list-shipping-dropdown", { body: {} });
      if (error || (data as any)?.error) {
        toast({ title: "تعذر جلب المدن", description: (data as any)?.error || error?.message, variant: "destructive" });
      } else {
        setZones(((data as any)?.zones || []).sort((a: any, b: any) => a.name.localeCompare(b.name, "ar")));
      }
      setLoadingZones(false);
    })();
  }, [editing]);

  useEffect(() => {
    if (!editing || !selectedZone || areasMap[selectedZone.id]) return;
    setLoadingAreas(true);
    (async () => {
      const { data, error } = await supabase.functions.invoke("list-shipping-dropdown", { body: { zoneId: selectedZone.id } });
      if (!error && !(data as any)?.error) {
        setAreasMap((prev) => ({ ...prev, [selectedZone.id]: (data as any)?.areas || [] }));
      }
      setLoadingAreas(false);
    })();
  }, [editing, selectedZone?.id]);

  const save = async () => {
    const newCity = c.trim();
    const newArea = a.trim();
    if (!newCity || !newArea) {
      toast({ title: "أدخل المدينة والمنطقة", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // 1) Update this order
      const { error: oErr } = await supabase
        .from("orders")
        .update({ matched_zone_name: newCity, matched_area_name: newArea })
        .eq("id", orderId);
      if (oErr) throw oErr;

      // 2) Save the correction so future identical inputs auto-resolve
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const inputText = `${originalCity || ""} ${originalAddress || ""}`.trim();
        await supabase.from("city_corrections").insert({
          owner_id: user.id,
          city: newCity,
          area: newArea,
          input_text: inputText || null,
        } as any);
      }

      toast({ title: "تم الحفظ", description: "سيُستخدم هذا التصحيح تلقائياً للطلبات المشابهة." });
      onSaved(newCity, newArea);
      setEditing(false);
    } catch (e: any) {
      toast({ title: "فشل الحفظ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 inline-flex items-center gap-2">
        <span><span className="font-semibold">المدينة المصححة:</span> {city || "—"}</span>
        {area && <span>• <span className="font-semibold">المنطقة:</span> {area}</span>}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(true)}>
          <Pencil className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-muted/50 rounded px-2 py-1">
      <Select value={c} onValueChange={(v) => { setC(v); setA(""); }} disabled={loadingZones}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder={loadingZones ? "جاري التحميل..." : "المدينة"} />
        </SelectTrigger>
        <SelectContent>
          {zones.map((z) => (
            <SelectItem key={z.external_id} value={z.name}>{z.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={a} onValueChange={setA} disabled={!selectedZone || loadingAreas || filteredAreas.length === 0}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder={!selectedZone ? "اختر المدينة أولاً" : (loadingAreas ? "جاري التحميل..." : (filteredAreas.length === 0 ? "لا مناطق" : "المنطقة"))} />
        </SelectTrigger>
        <SelectContent>
          {filteredAreas.map((ar) => (
            <SelectItem key={ar.id} value={ar.name}>{ar.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="icon" className="h-7 w-7" onClick={save} disabled={saving}>
        <Check className="w-3 h-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(false); setC(city || ""); setA(area || ""); }}>
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
};
