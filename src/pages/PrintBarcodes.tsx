import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Printer, Barcode } from "lucide-react";

type ProductLite = {
  id: string;
  name: string;
  variant_skus: Record<string, string> | null;
};

const escape = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default function PrintBarcodes() {
  const { activeStoreId } = useStoreContext();
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [labelW, setLabelW] = useState(50);
  const [labelH, setLabelH] = useState(25);
  const [showName, setShowName] = useState(true);

  useEffect(() => {
    if (!activeStoreId) return;
    setLoading(true);
    supabase
      .from("products")
      .select("id, name, variant_skus")
      .eq("store_id", activeStoreId)
      .is("deleted_at", null)
      .order("name")
      .then(({ data, error }) => {
        if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
        setProducts((data || []) as any);
        setLoading(false);
      });
  }, [activeStoreId]);

  const selected = products.find((p) => p.id === selectedId);
  const variants = useMemo(() => {
    if (!selected?.variant_skus) return [] as Array<{ key: string; sku: string }>;
    return Object.entries(selected.variant_skus)
      .filter(([, v]) => !!v && String(v).trim())
      .map(([key, sku]) => ({ key, sku: String(sku).trim() }));
  }, [selected]);

  const totalLabels = variants.reduce((s, v) => s + (qty[v.key] || 0), 0);

  const printBarcodes = () => {
    const items: Array<{ sku: string; name: string; variant: string }> = [];
    variants.forEach((v) => {
      const n = qty[v.key] || 0;
      for (let i = 0; i < n; i++) {
        items.push({ sku: v.sku, name: selected?.name || "", variant: v.key });
      }
    });
    if (items.length === 0) return toast({ title: "تنبيه", description: "اختر كمية واحدة على الأقل", variant: "destructive" });

    const labels = items
      .map((it, idx) => {
        const id = `bc-${idx}`;
        return `<div class="label">
          ${showName ? `<div class="name">${escape(it.name)}</div><div class="variant">${escape(it.variant)}</div>` : ""}
          <svg id="${id}" data-bc="${escape(it.sku)}"></svg>
          <div class="code">${escape(it.sku)}</div>
        </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>طباعة باركود</title>
<style>
@page { size: ${labelW}mm ${labelH}mm; margin: 0; }
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#000;font-family:"Tajawal","Cairo","Segoe UI",sans-serif}
.label{width:${labelW}mm;height:${labelH}mm;padding:1.5mm;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always;break-after:page;overflow:hidden}
.label:last-child{page-break-after:auto;break-after:auto}
.name{font-weight:700;font-size:9px;line-height:1.1;text-align:center;max-height:3.2em;overflow:hidden}
.variant{font-size:8px;color:#444;text-align:center;margin-bottom:1mm}
.code{font-family:monospace;font-size:9px;letter-spacing:.5px;direction:ltr;margin-top:.5mm}
svg{max-width:100%}
@media screen{body{background:#f3f4f6;padding:16px}.label{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.1);margin:0 auto 8px}}
</style></head><body>
${labels}
<script>
function init(){document.querySelectorAll('[data-bc]').forEach(function(el){try{JsBarcode("#"+el.id,el.getAttribute('data-bc'),{format:"CODE128",lineColor:"#000",width:1.8,height:40,displayValue:false,margin:0});}catch(e){}});}
</script>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
  onload="init();setTimeout(function(){window.focus();window.print();},300);"></script>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return alert("الرجاء السماح بالنوافذ المنبثقة");
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Barcode className="w-6 h-6"/> طباعة باركود المنتجات</h1>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">المنتج</Label>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin"/> تحميل...</div>
              ) : (
                <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setQty({}); }}>
                  <SelectTrigger><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="mb-1 block">عرض mm</Label>
                <Input type="number" value={labelW} onChange={(e) => setLabelW(Number(e.target.value) || 50)} />
              </div>
              <div>
                <Label className="mb-1 block">ارتفاع mm</Label>
                <Input type="number" value={labelH} onChange={(e) => setLabelH(Number(e.target.value) || 25)} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                  اسم المنتج
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد أكواد SKU لهذا المنتج. أنشئ SKU من صفحة تعديل المنتج أولاً.</p>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-semibold">المتغيرات ({variants.length})</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      const n: Record<string, number> = {};
                      variants.forEach((v) => { n[v.key] = 1; });
                      setQty(n);
                    }}>الكل ×1</Button>
                    <Button variant="outline" size="sm" onClick={() => setQty({})}>تصفير</Button>
                  </div>
                </div>
                <div className="border rounded divide-y">
                  {variants.map((v) => (
                    <div key={v.key} className="flex items-center gap-3 p-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{v.key}</div>
                        <div className="text-xs font-mono text-muted-foreground">{v.sku}</div>
                      </div>
                      <Input
                        type="number" min={0} className="w-24"
                        value={qty[v.key] ?? 0}
                        onChange={(e) => setQty((p) => ({ ...p, [v.key]: Math.max(0, Number(e.target.value) || 0) }))}
                      />
                    </div>
                  ))}
                </div>
                <Button className="w-full" onClick={printBarcodes} disabled={totalLabels === 0}>
                  <Printer className="w-4 h-4 ml-1" /> طباعة ({totalLabels} ملصق)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}