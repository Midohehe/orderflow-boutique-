import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, Check, Trash2, Pencil, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Theme = {
  id: string; name: string; description: string | null; thumbnail_url: string | null;
  puck_data: any; custom_html: string | null; custom_css: string | null; is_template: boolean;
};

const Themes = () => {
  const { activeStore } = useStoreContext();
  const { profile } = useUserContext();
  const navigate = useNavigate();
  const [list, setList] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [htmlText, setHtmlText] = useState("");
  const [cssText, setCssText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const ownerId = activeStore?.owner_id || profile?.user_id;
  const storeId = activeStore?.id;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("store_themes" as any).select("*")
      .or(`store_id.eq.${storeId},is_template.eq.true`).order("created_at", { ascending: false });
    setList((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { if (storeId) load(); }, [storeId]);

  const saveTheme = async () => {
    if (!name.trim()) return toast({ title: "أدخل اسم القالب", variant: "destructive" });
    const puck_data = (htmlText || cssText) ? {
      content: [{
        type: "HtmlBlock",
        props: { id: "HtmlBlock-imported", html: htmlText, css: cssText,
          padding_y: 0, padding_x: 0, max_width: "full", bg_color: "", min_height: 0,
          text_align: "center", hide_mobile: false, hide_desktop: false },
      }],
      root: { props: {} },
    } : { content: [], root: { props: {} } };

    const { error } = await supabase.from("store_themes" as any).insert({
      owner_id: ownerId, store_id: storeId, name, puck_data,
      custom_html: htmlText || null, custom_css: cssText || null,
    });
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    toast({ title: "تم حفظ القالب ✓" });
    setOpen(false); setName(""); setHtmlText(""); setCssText("");
    load();
  };

  const onFile = async (f: File) => {
    const txt = await f.text();
    if (f.name.endsWith(".json")) {
      try {
        const j = JSON.parse(txt);
        // Accept either a Puck data object or { puck_data, name, html, css }
        const puck_data = j.puck_data || (j.content ? j : { content: [], root: { props: {} } });
        const { error } = await supabase.from("store_themes" as any).insert({
          owner_id: ownerId, store_id: storeId,
          name: j.name || f.name.replace(/\.json$/, ""),
          puck_data,
          custom_html: j.custom_html || null, custom_css: j.custom_css || null,
        });
        if (error) throw error;
        toast({ title: "تم استيراد القالب ✓" });
        load();
      } catch (e: any) {
        toast({ title: "ملف JSON غير صالح", description: e.message, variant: "destructive" });
      }
    } else if (f.name.endsWith(".html") || f.name.endsWith(".htm")) {
      // Extract <style>...</style> and the body content
      const styleMatch = txt.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const css = styleMatch ? styleMatch[1] : "";
      const bodyMatch = txt.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const html = (bodyMatch ? bodyMatch[1] : txt).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
      setHtmlText(html.trim()); setCssText(css.trim());
      setName(f.name.replace(/\.html?$/, ""));
      setOpen(true);
    } else if (f.name.endsWith(".css")) {
      setCssText(txt); setOpen(true);
    } else {
      toast({ title: "صيغة غير مدعومة", description: "ارفع .html / .css / .json", variant: "destructive" });
    }
  };

  const applyToStore = async (t: Theme) => {
    if (!storeId) return;
    const { data: existing } = await supabase.from("store_page_layouts" as any)
      .select("id").eq("store_id", storeId).eq("page_key", "home").maybeSingle();
    const payload: any = { store_id: storeId, owner_id: ownerId, page_key: "home", puck_data: t.puck_data, is_published: true };
    const res = existing
      ? await supabase.from("store_page_layouts" as any).update(payload).eq("id", (existing as any).id)
      : await supabase.from("store_page_layouts" as any).insert(payload);
    if (res.error) return toast({ title: "خطأ", description: res.error.message, variant: "destructive" });
    toast({ title: "تم تطبيق القالب على المتجر ✓" });
  };

  const exportJson = (t: Theme) => {
    const blob = new Blob([JSON.stringify({ name: t.name, puck_data: t.puck_data, custom_html: t.custom_html, custom_css: t.custom_css }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${t.name}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const removeTheme = async (id: string) => {
    if (!confirm("حذف القالب؟")) return;
    await supabase.from("store_themes" as any).delete().eq("id", id);
    load();
  };

  const editInBuilder = async (t: Theme) => {
    // Apply then open builder
    await applyToStore(t);
    navigate("/dashboard/page-builder");
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">قوالب التصميم</h1>
        <div className="flex gap-2">
          <input ref={fileInput} type="file" accept=".html,.htm,.css,.json" className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="w-4 h-4 ml-1" /> رفع ملف (HTML/CSS/JSON)
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>قالب جديد</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto" dir="rtl">
              <DialogHeader><DialogTitle>إنشاء قالب</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>HTML</Label>
                  <textarea className="w-full h-40 border rounded p-2 font-mono text-sm" value={htmlText} onChange={(e) => setHtmlText(e.target.value)} />
                </div>
                <div><Label>CSS</Label>
                  <textarea className="w-full h-32 border rounded p-2 font-mono text-sm" value={cssText} onChange={(e) => setCssText(e.target.value)} />
                </div>
                <Button onClick={saveTheme} className="w-full">حفظ القالب</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div> :
        list.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد قوالب بعد. ارفع ملف HTML/CSS أو JSON للبدء.</CardContent></Card> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-3">
                <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                  {t.thumbnail_url ? <img src={t.thumbnail_url} className="w-full h-full object-cover" /> :
                    <span className="text-muted-foreground text-sm">{t.name}</span>}
                </div>
                <div>
                  <div className="font-bold">{t.name} {t.is_template && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded mr-1">جاهز</span>}</div>
                  {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" onClick={() => applyToStore(t)}><Check className="w-3 h-3 ml-1" />تطبيق</Button>
                  <Button size="sm" variant="outline" onClick={() => editInBuilder(t)}><Pencil className="w-3 h-3 ml-1" />تعديل</Button>
                  <Button size="sm" variant="outline" onClick={() => exportJson(t)}><Download className="w-3 h-3" /></Button>
                  {!t.is_template && <Button size="sm" variant="ghost" onClick={() => removeTheme(t.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      }
    </div>
  );
};

export default Themes;