import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "@/hooks/use-toast";
import {
  LayoutTemplate, Plus, ArrowUp, ArrowDown, Pencil, Trash2, Eye, Loader2, Save, X,
} from "lucide-react";
import { SECTION_REGISTRY, getMeta, type SectionType, type HomeSectionRow } from "@/lib/homeSections";
import ImageUpload from "@/components/ImageUpload";

const HomeBuilder = () => {
  const { activeStore } = useStoreContext();
  const storeId = activeStore?.id;
  const [sections, setSections] = useState<HomeSectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HomeSectionRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchSections = async () => {
    if (!storeId) return;
    setLoading(true);
    const { data } = await supabase
      .from("home_page_sections")
      .select("*")
      .eq("store_id", storeId)
      .order("position");
    setSections((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSections(); /* eslint-disable-next-line */ }, [storeId]);

  const addSection = async (type: SectionType) => {
    if (!storeId) return;
    const meta = getMeta(type);
    if (!meta) return;
    const position = sections.length > 0 ? Math.max(...sections.map((s) => s.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("home_page_sections")
      .insert({ store_id: storeId, section_type: type, position, config: meta.defaults, is_visible: true })
      .select("*").single();
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setSections([...sections, data as any]);
    setPickerOpen(false);
    setEditing(data as any);
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const a = sections[idx], b = sections[target];
    const newList = [...sections];
    newList[idx] = { ...b, position: a.position };
    newList[target] = { ...a, position: b.position };
    newList.sort((x, y) => x.position - y.position);
    setSections(newList);
    await Promise.all([
      supabase.from("home_page_sections").update({ position: b.position }).eq("id", a.id),
      supabase.from("home_page_sections").update({ position: a.position }).eq("id", b.id),
    ]);
  };

  const toggleVisible = async (s: HomeSectionRow) => {
    const next = !s.is_visible;
    setSections(sections.map((x) => x.id === s.id ? { ...x, is_visible: next } : x));
    await supabase.from("home_page_sections").update({ is_visible: next }).eq("id", s.id);
  };

  const remove = async (s: HomeSectionRow) => {
    if (!confirm("حذف هذا القسم؟")) return;
    setSections(sections.filter((x) => x.id !== s.id));
    await supabase.from("home_page_sections").delete().eq("id", s.id);
    toast({ title: "تم الحذف" });
  };

  const saveEdit = async (config: Record<string, any>) => {
    if (!editing) return;
    const { error } = await supabase.from("home_page_sections").update({ config }).eq("id", editing.id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setSections(sections.map((x) => x.id === editing.id ? { ...x, config } : x));
    setEditing(null);
    toast({ title: "تم الحفظ" });
  };

  const previewUrl = activeStore ? `/store/${activeStore.slug}` : "/store";

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={LayoutTemplate}
        title="بناء الصفحة الرئيسية"
        description="أضف وأعد ترتيب أقسام صفحة متجرك"
        iconGradient="from-indigo-500 to-purple-600"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(previewUrl, "_blank")}>
              <Eye className="w-4 h-4 ml-2" /> معاينة
            </Button>
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="w-4 h-4 ml-2" /> إضافة قسم
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : sections.length === 0 ? (
        <Card className="p-10 text-center">
          <LayoutTemplate className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">لا توجد أقسام بعد. ابدأ بإضافة قسم.</p>
          <Button onClick={() => setPickerOpen(true)}><Plus className="w-4 h-4 ml-2" /> إضافة قسم</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {sections.map((s, i) => {
            const meta = getMeta(s.section_type);
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <Card key={s.id} className={`p-3 flex items-center gap-3 ${!s.is_visible && "opacity-60"}`}>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center text-white flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{meta.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(s.config?.title || s.config?.text || s.config?.html || "")?.toString().replace(/<[^>]+>/g, "").slice(0, 60)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={s.is_visible} onCheckedChange={() => toggleVisible(s)} />
                  <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === sections.length - 1}><ArrowDown className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(s)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>اختر نوع القسم</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SECTION_REGISTRY.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.type}
                  onClick={() => addSection(m.type)}
                  className="flex flex-col items-center gap-2 p-4 border border-border rounded-lg hover:border-primary hover:bg-muted/50 transition"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${m.color} flex items-center justify-center text-white`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-center">{m.label}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor */}
      {editing && (
        <SectionEditor
          section={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
};

/* ============ Section Editor ============ */

const SectionEditor = ({
  section, onClose, onSave,
}: { section: HomeSectionRow; onClose: () => void; onSave: (c: any) => void }) => {
  const [config, setConfig] = useState<any>(section.config || {});
  const meta = getMeta(section.section_type);
  if (!meta) return null;

  const set = (k: string, v: any) => setConfig({ ...config, [k]: v });
  const updateItem = (idx: number, patch: any) => {
    const items = [...(config.items || [])];
    items[idx] = { ...items[idx], ...patch };
    set("items", items);
  };
  const addItem = (template: any) => set("items", [...(config.items || []), template]);
  const removeItem = (idx: number) => set("items", (config.items || []).filter((_: any, i: number) => i !== idx));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>تعديل: {meta.label}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          {section.section_type === "hero" && (
            <>
              <FieldImage label="صورة الخلفية" value={config.image} onChange={(v) => set("image", v)} />
              <Field label="العنوان"><Input value={config.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
              <Field label="العنوان الفرعي"><Input value={config.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} /></Field>
              <Field label="نص الزر"><Input value={config.button_text || ""} onChange={(e) => set("button_text", e.target.value)} /></Field>
              <Field label="رابط الزر"><Input value={config.button_link || ""} onChange={(e) => set("button_link", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="لون النص"><Input type="color" value={config.text_color || "#ffffff"} onChange={(e) => set("text_color", e.target.value)} /></Field>
                <Field label="شفافية التظليل (0-1)"><Input type="number" min="0" max="1" step="0.1" value={config.overlay ?? 0.4} onChange={(e) => set("overlay", parseFloat(e.target.value))} /></Field>
              </div>
            </>
          )}

          {section.section_type === "banner" && (
            <>
              <FieldImage label="الصورة" value={config.image} onChange={(v) => set("image", v)} />
              <Field label="الرابط عند الضغط"><Input value={config.link || ""} onChange={(e) => set("link", e.target.value)} /></Field>
              <Field label="نص بديل (alt)"><Input value={config.alt || ""} onChange={(e) => set("alt", e.target.value)} /></Field>
            </>
          )}

          {section.section_type === "products_grid" && (
            <>
              <Field label="العنوان"><Input value={config.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="عدد المنتجات"><Input type="number" min="1" max="50" value={config.limit || 8} onChange={(e) => set("limit", parseInt(e.target.value) || 8)} /></Field>
                <Field label="عدد الأعمدة">
                  <Select value={String(config.columns || 4)} onValueChange={(v) => set("columns", parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </>
          )}

          {section.section_type === "categories_grid" && (
            <>
              <Field label="العنوان"><Input value={config.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
              <ItemsEditor
                items={config.items || []}
                addLabel="إضافة فئة"
                template={{ label: "فئة جديدة", image: "", link: "" }}
                onAdd={addItem} onRemove={removeItem}
                render={(it, i) => (
                  <div className="space-y-2">
                    <Input placeholder="اسم الفئة" value={it.label || ""} onChange={(e) => updateItem(i, { label: e.target.value })} />
                    <Input placeholder="الرابط" value={it.link || ""} onChange={(e) => updateItem(i, { link: e.target.value })} />
                    <FieldImage label="صورة" value={it.image} onChange={(v) => updateItem(i, { image: v })} />
                  </div>
                )}
              />
            </>
          )}

          {section.section_type === "rich_text" && (
            <>
              <Field label="HTML"><Textarea rows={8} value={config.html || ""} onChange={(e) => set("html", e.target.value)} /></Field>
              <Field label="المحاذاة">
                <Select value={config.align || "center"} onValueChange={(v) => set("align", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">يمين</SelectItem>
                    <SelectItem value="center">وسط</SelectItem>
                    <SelectItem value="left">يسار</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {section.section_type === "video" && (
            <>
              <Field label="العنوان"><Input value={config.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
              <Field label="رابط YouTube"><Input value={config.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="https://youtube.com/watch?v=..." /></Field>
            </>
          )}

          {section.section_type === "faq" && (
            <>
              <Field label="العنوان"><Input value={config.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
              <ItemsEditor
                items={config.items || []}
                addLabel="إضافة سؤال"
                template={{ q: "سؤال جديد؟", a: "" }}
                onAdd={addItem} onRemove={removeItem}
                render={(it, i) => (
                  <div className="space-y-2">
                    <Input placeholder="السؤال" value={it.q || ""} onChange={(e) => updateItem(i, { q: e.target.value })} />
                    <Textarea placeholder="الإجابة" value={it.a || ""} onChange={(e) => updateItem(i, { a: e.target.value })} />
                  </div>
                )}
              />
            </>
          )}

          {section.section_type === "features" && (
            <>
              <Field label="العنوان"><Input value={config.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
              <ItemsEditor
                items={config.items || []}
                addLabel="إضافة ميزة"
                template={{ icon: "✨", title: "", desc: "" }}
                onAdd={addItem} onRemove={removeItem}
                render={(it, i) => (
                  <div className="space-y-2">
                    <Input placeholder="إيموجي" value={it.icon || ""} onChange={(e) => updateItem(i, { icon: e.target.value })} />
                    <Input placeholder="العنوان" value={it.title || ""} onChange={(e) => updateItem(i, { title: e.target.value })} />
                    <Input placeholder="الوصف" value={it.desc || ""} onChange={(e) => updateItem(i, { desc: e.target.value })} />
                  </div>
                )}
              />
            </>
          )}

          {section.section_type === "promo_bar" && (
            <>
              <Field label="النص"><Input value={config.text || ""} onChange={(e) => set("text", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="لون الخلفية"><Input type="color" value={config.bg || "#7c3aed"} onChange={(e) => set("bg", e.target.value)} /></Field>
                <Field label="لون النص"><Input type="color" value={config.color || "#ffffff"} onChange={(e) => set("color", e.target.value)} /></Field>
              </div>
            </>
          )}

          {section.section_type === "reviews" && (
            <>
              <Field label="العنوان"><Input value={config.title || ""} onChange={(e) => set("title", e.target.value)} /></Field>
              <ItemsEditor
                items={config.items || []}
                addLabel="إضافة تقييم"
                template={{ name: "", text: "", rating: 5 }}
                onAdd={addItem} onRemove={removeItem}
                render={(it, i) => (
                  <div className="space-y-2">
                    <Input placeholder="اسم العميل" value={it.name || ""} onChange={(e) => updateItem(i, { name: e.target.value })} />
                    <Textarea placeholder="التعليق" value={it.text || ""} onChange={(e) => updateItem(i, { text: e.target.value })} />
                    <Input type="number" min="1" max="5" placeholder="التقييم 1-5" value={it.rating || 5} onChange={(e) => updateItem(i, { rating: parseInt(e.target.value) || 5 })} />
                  </div>
                )}
              />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 ml-1" /> إلغاء</Button>
          <Button onClick={() => onSave(config)}><Save className="w-4 h-4 ml-1" /> حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
);

const FieldImage = ({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <ImageUpload images={value ? [value] : []} onImagesChange={(imgs) => onChange(imgs[0] || "")} maxImages={1} />
  </div>
);

const ItemsEditor = ({
  items, addLabel, template, onAdd, onRemove, render,
}: {
  items: any[]; addLabel: string; template: any;
  onAdd: (t: any) => void; onRemove: (i: number) => void;
  render: (it: any, i: number) => React.ReactNode;
}) => (
  <div className="space-y-3">
    {items.map((it, i) => (
      <Card key={i} className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">عنصر #{i + 1}</span>
          <Button size="icon" variant="ghost" onClick={() => onRemove(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </div>
        {render(it, i)}
      </Card>
    ))}
    <Button variant="outline" className="w-full" onClick={() => onAdd({ ...template })}>
      <Plus className="w-4 h-4 ml-1" /> {addLabel}
    </Button>
  </div>
);

export default HomeBuilder;