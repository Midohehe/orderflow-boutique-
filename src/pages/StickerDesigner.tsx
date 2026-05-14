import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Printer, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AVAILABLE_FIELDS,
  DEFAULT_STICKER_SETTINGS,
  buildStickerHtml,
  printStickers,
  type StickerSettings,
  type StickerField,
  type StickerOrder,
} from "@/lib/printSticker";

const SAMPLE_ORDER: StickerOrder = {
  id: "sample",
  customer_name: "محمد علي",
  phone: "0912345678",
  address: "شارع الجمهورية، بناية رقم 12",
  city: "طرابلس",
  matched_zone_name: "طرابلس",
  matched_area_name: "حي الأندلس",
  product_name: "ساعة ذكية",
  selected_color: "أسود",
  selected_size: "M",
  selected_product_code: "SW-001",
  quantity: 1,
  price: 250,
  shipping_reference: "TRB12345678",
  carrier_status: "جارى التجهيز",
  created_at: new Date().toISOString(),
  local_code: "01",
};

const StickerDesigner = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<StickerSettings>(DEFAULT_STICKER_SETTINGS);
  const [currencySymbol, setCurrencySymbol] = useState("د.إ");
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id;
        if (!uid) return;
        const [stk, currency, header] = await Promise.all([
          supabase.from("sticker_settings").select("*").eq("owner_id", uid).maybeSingle(),
          supabase.from("store_settings").select("currency_symbol").maybeSingle(),
          supabase.from("header_settings").select("logo_text").eq("owner_id", uid).maybeSingle(),
        ]);
        if (stk.data) {
          // Merge saved fields with any newly-added catalog fields so the UI shows them all.
          const saved = stk.data as any;
          const savedFields: StickerField[] = Array.isArray(saved.fields) ? saved.fields : [];
          const merged: StickerField[] = AVAILABLE_FIELDS.map((af) => {
            const found = savedFields.find((s) => s.key === af.key);
            return found || { key: af.key, label: af.label, enabled: false };
          });
          setSettings({
            page_width_mm: saved.page_width_mm ?? 100,
            page_height_mm: saved.page_height_mm ?? 150,
            font_size: saved.font_size ?? 12,
            header_text: saved.header_text ?? "",
            footer_text: saved.footer_text ?? "",
            show_barcode: saved.show_barcode ?? true,
            show_logo: saved.show_logo ?? false,
            fields: merged,
          });
        }
        if (currency.data?.currency_symbol) setCurrencySymbol(currency.data.currency_symbol);
        if (header.data?.logo_text) setStoreName(header.data.logo_text);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("يجب تسجيل الدخول");
      const payload = {
        owner_id: uid,
        page_width_mm: settings.page_width_mm,
        page_height_mm: settings.page_height_mm,
        font_size: settings.font_size,
        header_text: settings.header_text,
        footer_text: settings.footer_text,
        show_barcode: settings.show_barcode,
        show_logo: settings.show_logo,
        fields: settings.fields as any,
      };
      const { error } = await supabase
        .from("sticker_settings")
        .upsert(payload, { onConflict: "owner_id" });
      if (error) throw error;
      toast({ title: "تم الحفظ", description: "تم حفظ تصميم الستيكر" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (idx: number, patch: Partial<StickerField>) => {
    setSettings((s) => ({
      ...s,
      fields: s.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    setSettings((s) => {
      const next = [...s.fields];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...s, fields: next };
    });
  };

  const previewHtml = useMemo(
    () => buildStickerHtml([SAMPLE_ORDER], settings, { currencySymbol, storeName }),
    [settings, currencySymbol, storeName],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">تصميم ستيكر بيانات الشحنة</h1>
          <p className="text-muted-foreground">اختر البيانات والترتيب وحجم الورقة قبل الطباعة من تبويب "جاري التوصيل".</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => printStickers([SAMPLE_ORDER], settings, { currencySymbol, storeName })}
          >
            <Printer className="w-4 h-4 ml-2" />
            معاينة الطباعة
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-bold text-foreground">إعدادات الورقة</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>العرض (مم)</Label>
                  <Input
                    type="number" min={40} max={300}
                    value={settings.page_width_mm}
                    onChange={(e) => setSettings((s) => ({ ...s, page_width_mm: Number(e.target.value) || 100 }))}
                  />
                </div>
                <div>
                  <Label>الارتفاع (مم)</Label>
                  <Input
                    type="number" min={40} max={400}
                    value={settings.page_height_mm}
                    onChange={(e) => setSettings((s) => ({ ...s, page_height_mm: Number(e.target.value) || 150 }))}
                  />
                </div>
                <div>
                  <Label>حجم الخط</Label>
                  <Input
                    type="number" min={8} max={32}
                    value={settings.font_size}
                    onChange={(e) => setSettings((s) => ({ ...s, font_size: Number(e.target.value) || 12 }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">A4</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSettings((s) => ({ ...s, page_width_mm: 210, page_height_mm: 297 }))}>A4</Button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">10×15</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSettings((s) => ({ ...s, page_width_mm: 100, page_height_mm: 150 }))}>10×15</Button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">8×12</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSettings((s) => ({ ...s, page_width_mm: 80, page_height_mm: 120 }))}>8×12</Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>نص أعلى الستيكر (هيدر)</Label>
                  <Input value={settings.header_text} onChange={(e) => setSettings((s) => ({ ...s, header_text: e.target.value }))} placeholder="مثلاً: شركة الفجر للشحن" />
                </div>
                <div>
                  <Label>نص أسفل الستيكر (فوتر)</Label>
                  <Input value={settings.footer_text} onChange={(e) => setSettings((s) => ({ ...s, footer_text: e.target.value }))} placeholder="مثلاً: شكراً لتعاملكم معنا" />
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={settings.show_logo} onCheckedChange={(v) => setSettings((s) => ({ ...s, show_logo: v }))} />
                  <Label>إظهار اسم المتجر كشعار</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={settings.show_barcode} onCheckedChange={(v) => setSettings((s) => ({ ...s, show_barcode: v }))} />
                  <Label>إظهار باركود لكود الشحن</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">الحقول الظاهرة على الستيكر</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSettings(DEFAULT_STICKER_SETTINGS)}
                  className="gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> الافتراضي
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">فعّل/عطّل الحقول، عدّل التسمية الظاهرة، وغيّر الترتيب بالأسهم.</p>
              <div className="space-y-2">
                {settings.fields.map((f, idx) => (
                  <div key={f.key} className="flex items-center gap-2 border border-border rounded-md p-2 bg-card">
                    <Checkbox
                      checked={f.enabled}
                      onCheckedChange={(v) => updateField(idx, { enabled: !!v })}
                    />
                    <span className="text-xs text-muted-foreground font-mono w-32 truncate" title={f.key}>{f.key}</span>
                    <Input
                      value={f.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      className="h-8 flex-1"
                      placeholder="التسمية"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveField(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveField(idx, 1)} disabled={idx === settings.fields.length - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-foreground mb-3">معاينة مباشرة</h3>
              <div className="border-2 border-dashed border-border rounded-md overflow-hidden bg-muted/30">
                <iframe
                  title="sticker-preview"
                  className="w-full"
                  style={{ height: `${Math.min(700, settings.page_height_mm * 3.78 + 40)}px`, background: "#f3f4f6" }}
                  srcDoc={previewHtml.replace("<script>", "<script>/*").replace("</script>", "*/</script>")}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">المعاينة بالحجم الحقيقي تقريباً (1mm ≈ 3.78px).</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StickerDesigner;