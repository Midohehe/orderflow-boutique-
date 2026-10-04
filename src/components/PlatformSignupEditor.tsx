import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, Eye, Globe, Loader2, Monitor, Plus, Save, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { fetchSignupPageEditor, saveSignupPage } from "@/lib/platformSignupPage";
import { defaultSignupContent, parseSignupContent, platformSignupSchema, type PlatformSignupContent } from "@/lib/platformSignupContent";
import PlatformSignupView from "./PlatformSignupView";

type TextKey = Exclude<keyof PlatformSignupContent, "features" | "steps" | "faqs">;
const sections: { title: string; fields: { key: TextKey; label: string; max: number; multiline?: boolean }[] }[] = [
  { title: "الهوية والمقدمة", fields: [
    { key: "brandName", label: "اسم المنصة", max: 40 }, { key: "badge", label: "العبارة فوق العنوان", max: 100 },
    { key: "title", label: "السطر الأول من العنوان", max: 120 }, { key: "highlight", label: "السطر الملوّن من العنوان", max: 100 },
    { key: "description", label: "وصف الصفحة", max: 500, multiline: true }, { key: "ctaText", label: "نص زر إنشاء المتجر", max: 40 },
  ] },
  { title: "نموذج التسجيل وعناوين الأقسام", fields: [
    { key: "formTitle", label: "عنوان نموذج التسجيل", max: 80 }, { key: "formDescription", label: "وصف النموذج", max: 200, multiline: true },
    { key: "featuresTitle", label: "عنوان المميزات", max: 120 }, { key: "stepsTitle", label: "عنوان خطوات البداية", max: 120 },
    { key: "faqTitle", label: "عنوان الأسئلة الشائعة", max: 120 }, { key: "closingTitle", label: "العنوان الختامي", max: 120 },
    { key: "closingDescription", label: "الوصف الختامي", max: 300, multiline: true },
  ] },
];
const publicUrl = "https://www.was-la.com/register";

export default function PlatformSignupEditor() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState<PlatformSignupContent>(() => structuredClone(defaultSignupContent));
  const [saved, setSaved] = useState("");
  const [published, setPublished] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [mobile, setMobile] = useState(false);
  const [campaign, setCampaign] = useState("store_signup");
  const [loadKey, setLoadKey] = useState(0);
  const dirty = Boolean(saved && saved !== JSON.stringify(content));
  const adUrl = `${publicUrl}?${new URLSearchParams({ utm_source: "facebook", utm_medium: "paid_social", utm_campaign: campaign.trim() || "store_signup" })}`;

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetchSignupPageEditor().then(row => {
      if (!active) return;
      setContent(row.draft); setSaved(JSON.stringify(row.draft)); setPublished(row.published);
      setRevision(row.revision); setPublishedAt(row.published_at);
    }).catch(() => { if (active) setError("تعذّر تحميل إعدادات صفحة التسجيل. تحقق من الاتصال ومن تطبيق تحديث قاعدة البيانات."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadKey]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const save = async (publish: boolean) => {
    if (saving) return;
    const result = platformSignupSchema.safeParse(content);
    if (!result.success) {
      toast({ title: "راجع حقول الصفحة", description: "أكمل الحقول المطلوبة والتزم بحدود النصوص قبل الحفظ أو النشر.", variant: "destructive" });
      setMode("edit"); return;
    }
    setSaving(publish ? "publish" : "draft");
    try {
      const next = await saveSignupPage(result.data, publish, revision);
      setRevision(next); setContent(result.data); setSaved(JSON.stringify(result.data));
      if (publish) {
        setPublished(result.data); setPublishedAt(new Date().toISOString());
        queryClient.setQueryData(["platform-signup-published"], result.data);
        await queryClient.invalidateQueries({ queryKey: ["platform-signup-published"] });
      }
      toast({ title: publish ? "تم نشر تعديلات صفحة التسجيل" : "تم حفظ المسودة", description: publish ? "التعديلات متاحة لزوار رابط التسجيل." : "المسودة محفوظة وتظهر للزوار فقط بعد النشر." });
    } catch (e) {
      const conflict = typeof e === "object" && e !== null && "code" in e && e.code === "40001";
      toast({ title: "تعذّر الحفظ", description: conflict ? "تم تعديل الصفحة من جلسة أخرى. انسخ تعديلاتك ثم أعد تحميل الصفحة قبل الحفظ." : "لم تُحفظ التعديلات. تحقق من الاتصال وحاول مجددًا.", variant: "destructive" });
    } finally { setSaving(null); }
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast({ title: "تم نسخ الرابط" }); }
    catch { toast({ title: "انسخ الرابط يدويًا من الخانة", variant: "destructive" }); }
  };

  if (loading) return <div role="status" className="flex justify-center gap-2 p-10"><Loader2 className="animate-spin" />جارٍ تحميل صفحة التسجيل…</div>;
  if (error) return <Card><CardContent className="p-6 space-y-4"><p role="alert">{error}</p><Button onClick={() => setLoadKey(v => v + 1)}>إعادة المحاولة</Button></CardContent></Card>;

  return <div className="space-y-5">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />صفحة تسجيل المتاجر</CardTitle><p className="text-sm text-muted-foreground">رابط مباشر لإعلاناتك، مع نموذج التسجيل داخل الصفحة. عدّل المحتوى، عاينه، ثم انشره.</p></CardHeader>
      <CardContent className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-2"><Label htmlFor="signup-direct-url">الرابط المباشر</Label><div className="flex gap-2"><Input id="signup-direct-url" value={publicUrl} readOnly dir="ltr" onFocus={e => e.target.select()} /><Button variant="outline" size="icon" onClick={() => copy(publicUrl)} aria-label="نسخ الرابط المباشر"><Copy className="h-4 w-4" /></Button></div><a href="/register" target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">فتح الصفحة المحفوظة</a></div>
        <div className="space-y-2"><Label htmlFor="signup-campaign">اسم الحملة لرابط إعلان فيسبوك</Label><Input id="signup-campaign" value={campaign} onChange={e => setCampaign(e.target.value)} dir="ltr" maxLength={100} /><div className="flex gap-2"><Input aria-label="رابط إعلان فيسبوك" value={adUrl} readOnly dir="ltr" onFocus={e => e.target.select()} /><Button variant="outline" size="icon" onClick={() => copy(adUrl)} aria-label="نسخ رابط إعلان فيسبوك"><Copy className="h-4 w-4" /></Button></div><p className="text-xs text-muted-foreground">يحفظ وسوم مصدر الحملة مع الحساب عند التسجيل. لا يغيّر محتوى الصفحة.</p></div>
      </CardContent></Card>
    <div className="flex flex-wrap justify-between items-center gap-3 rounded-xl border bg-card p-4">
      <div><div className="font-semibold text-sm">{dirty ? "تعديلات غير محفوظة" : "المسودة محفوظة"}</div><p className="text-xs text-muted-foreground mt-1">{publishedAt ? `آخر نشر: ${new Date(publishedAt).toLocaleString("ar-LY")}` : "المحتوى الافتراضي ظاهر حتى أول نشر."}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setMode(v => v === "edit" ? "preview" : "edit")}><Eye className="h-4 w-4 ml-2" />{mode === "edit" ? "معاينة الصفحة" : "العودة للتعديل"}</Button><Button variant="outline" disabled={Boolean(saving)} onClick={() => save(false)}>{saving === "draft" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}حفظ مسودة</Button><Button disabled={Boolean(saving)} onClick={() => save(true)}>{saving === "publish" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Globe className="h-4 w-4 ml-2" />}نشر التعديلات</Button></div>
    </div>
    {mode === "preview" ? <div className="space-y-4 rounded-xl border bg-muted/40 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">معاينة المسودة — التسجيل والروابط معطّلة هنا، ولا تُرسل أحداث بكسل.</p><div className="flex gap-2"><Button size="sm" variant={mobile ? "outline" : "default"} onClick={() => setMobile(false)}><Monitor className="h-4 w-4 ml-2" />كمبيوتر</Button><Button size="sm" variant={mobile ? "default" : "outline"} onClick={() => setMobile(true)}><Smartphone className="h-4 w-4 ml-2" />هاتف</Button></div></div>
      <div style={{ maxWidth: mobile ? 390 : "100%" }} className="mx-auto"><PlatformSignupView content={content} preview /></div>
    </div> : <fieldset disabled={Boolean(saving)} className="min-w-0 space-y-5">
      {sections.map(section => <Card key={section.title}><CardHeader><CardTitle className="text-lg">{section.title}</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 gap-4">
        {section.fields.map(field => <div key={field.key} className={`space-y-2 ${field.multiline ? "md:col-span-2" : ""}`}><Label htmlFor={`signup-edit-${field.key}`}>{field.label}</Label>{field.multiline ? <Textarea id={`signup-edit-${field.key}`} rows={3} value={content[field.key]} maxLength={field.max} onChange={e => setContent(c => ({ ...c, [field.key]: e.target.value }))} /> : <Input id={`signup-edit-${field.key}`} value={content[field.key]} maxLength={field.max} onChange={e => setContent(c => ({ ...c, [field.key]: e.target.value }))} />}</div>)}
        {section === sections[0] && <div className="space-y-2"><Label htmlFor="signup-edit-color">اللون الأساسي</Label><div className="flex gap-3 items-center"><input id="signup-edit-color" type="color" value={content.accentColor} onChange={e => setContent(c => ({ ...c, accentColor: e.target.value }))} className="h-10 w-16 cursor-pointer rounded border" /><span dir="ltr" className="text-sm">{content.accentColor}</span></div><p className="text-xs text-muted-foreground">يُضبط لون النص داخل الأزرار حسب اللون المختار.</p></div>}
      </CardContent></Card>)}
      {(["features", "steps", "faqs"] as const).map(key => {
        const title = key === "features" ? "المميزات" : key === "steps" ? "خطوات البداية" : "الأسئلة الشائعة";
        const max = key === "features" ? 6 : key === "steps" ? 4 : 8;
        const updateItem = (index: number, field: string, value: string) => setContent(c => ({ ...c, [key]: c[key].map((item,i) => i === index ? { ...item, [field]: value } : item) }));
        const move = (index: number, direction: number) => setContent(c => { const items = [...c[key]]; [items[index], items[index+direction]] = [items[index+direction],items[index]]; return { ...c, [key]: items }; });
        return <Card key={key}><CardHeader><CardTitle className="text-lg">{title} <span className="text-sm text-muted-foreground">({content[key].length}/{max})</span></CardTitle></CardHeader><CardContent className="space-y-4">
          {content[key].map((item,i) => <div key={i} className="rounded-lg border p-4 space-y-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{title} · {i+1}</span><div className="flex gap-1"><Button size="icon" variant="ghost" disabled={i===0} onClick={() => move(i,-1)} aria-label={`رفع ${title} ${i+1}`}><ArrowUp className="w-4 h-4" /></Button><Button size="icon" variant="ghost" disabled={i===content[key].length-1} onClick={() => move(i,1)} aria-label={`خفض ${title} ${i+1}`}><ArrowDown className="w-4 h-4" /></Button><Button size="icon" variant="ghost" disabled={key!=="faqs" && content[key].length===1} onClick={() => setContent(c => ({ ...c, [key]: c[key].filter((_,index) => index !== i) }))} aria-label={`حذف ${title} ${i+1}`}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></div>
            <Label htmlFor={`signup-${key}-${i}-title`}>{key === "faqs" ? "السؤال" : "العنوان"}</Label><Input id={`signup-${key}-${i}-title`} value={"question" in item ? item.question : item.title} maxLength={key === "faqs" ? 160 : 80} onChange={e => updateItem(i,key === "faqs" ? "question" : "title",e.target.value)} />
            <Label htmlFor={`signup-${key}-${i}-description`}>{key === "faqs" ? "الإجابة" : "الوصف"}</Label><Textarea id={`signup-${key}-${i}-description`} value={"answer" in item ? item.answer : item.description} maxLength={key === "faqs" ? 600 : 300} onChange={e => updateItem(i,key === "faqs" ? "answer" : "description",e.target.value)} />
          </div>)}
          <Button variant="outline" disabled={content[key].length>=max} onClick={() => setContent(c => ({ ...c, [key]: [...c[key], key === "faqs" ? { question: "", answer: "" } : { title: "", description: "" }] }))}><Plus className="h-4 w-4 ml-2" />إضافة {key === "faqs" ? "سؤال" : key === "steps" ? "خطوة" : "ميزة"}</Button>
        </CardContent></Card>;
      })}
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => setContent(parseSignupContent(published))}>استرجاع النسخة المنشورة إلى المحرّر</Button><Button variant="ghost" onClick={() => setContent(structuredClone(defaultSignupContent))}>استخدام المحتوى الافتراضي</Button></div>
      <p className="text-xs text-muted-foreground">حقول التسجيل والتحقق من البريد ثابتة لحماية عملية إنشاء الحساب. بكسل المنصة يُضبط من الإعدادات العامة، وحدث اكتمال التسجيل يُرسل بعد تأكيد البريد والدخول للوحة التحكم.</p>
    </fieldset>}
  </div>;
}
