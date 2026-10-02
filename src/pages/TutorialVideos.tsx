import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, Trash2, Video, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { tutorialSource } from "@/lib/tutorialVideo";
import { toast } from "@/hooks/use-toast";

export default function TutorialVideos() {
  const { isAdmin } = useUserContext();
  const cache = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<{ title: string; kind: string; url: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const { data: videos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["tutorial-videos"],
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("tutorial_videos").select("*").order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !isAdmin) return;
    setBusy(true); setError("");
    let uploaded: string | null = null;
    try {
      if (!title.trim()) throw new Error("أدخل عنوان الفيديو.");
      let videoUrl: string | null = url.trim();
      if (file) {
        if (!["video/mp4", "video/webm"].includes(file.type) || file.size > 100 * 1024 * 1024) throw new Error("اختر فيديو MP4 أو WebM بحجم لا يتجاوز 100 ميجابايت.");
        const path = `${crypto.randomUUID()}.${file.type === "video/mp4" ? "mp4" : "webm"}`;
        const { error } = await supabase.storage.from("tutorial-videos").upload(path, file);
        if (error) throw error;
        uploaded = path;
        videoUrl = null;
      } else { tutorialSource(videoUrl); }
      const { error } = await supabase.from("tutorial_videos").insert({ title: title.trim(), description: description.trim(), video_url: videoUrl, storage_path: uploaded });
      if (error) throw error;
      uploaded = null;
      await cache.invalidateQueries({ queryKey: ["tutorial-videos"] });
      setAdding(false); setTitle(""); setDescription(""); setUrl(""); setFile(null);
      toast({ title: "تمت إضافة الفيديو لكل المتاجر" });
    } catch (cause) {
      if (uploaded) await supabase.storage.from("tutorial-videos").remove([uploaded]);
      setError(cause instanceof Error ? cause.message : "تعذّرت إضافة الفيديو. حاول مرة أخرى.");
    } finally { setBusy(false); }
  }
  async function play(title: string, value: string | null, storagePath: string | null) {
    try {
      if (storagePath) {
        const { data, error } = await supabase.storage.from("tutorial-videos").createSignedUrl(storagePath, 14400);
        if (error) throw error;
        setPlaying({ title, kind: "video", url: data.signedUrl });
      } else setPlaying({ title, ...tutorialSource(value || "") });
    } catch { toast({ title: "تعذّر تشغيل الفيديو، حاول مرة أخرى", variant: "destructive" }); }
  }
  async function remove() {
    if (!deleting || busy || !isAdmin) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("tutorial_videos").delete().eq("id", deleting.id).select("storage_path").single();
      if (error) throw error;
      if (data.storage_path) {
        const { error: fileError } = await supabase.storage.from("tutorial-videos").remove([data.storage_path]);
        if (fileError) toast({ title: "تم حذف البطاقة، لكن تعذّر حذف الملف المخزّن", variant: "destructive" });
      }
      await cache.invalidateQueries({ queryKey: ["tutorial-videos"] });
      setDeleting(null);
    } catch { toast({ title: "تعذّر حذف الفيديو", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <div dir="rtl" className="max-w-6xl mx-auto space-y-6">
    <PageHeader icon={Video} title="الفيديوهات التعليمية" description="شروحات تساعدك على استخدام وصلة وإدارة متجرك." />
    {isAdmin && <Button onClick={() => { setError(""); setAdding(true); }}><Plus className="w-4 h-4 ml-2" />إضافة فيديو تعليمي</Button>}
    {isLoading && <p role="status">جاري تحميل الفيديوهات...</p>}
    {isError && <div role="alert">تعذّر تحميل الفيديوهات. <Button variant="outline" onClick={() => void refetch()}>إعادة المحاولة</Button></div>}
    {!isLoading && !isError && !videos.length && <Card><CardContent className="py-16 text-center text-muted-foreground"><Video className="mx-auto mb-4 w-16 h-16" />لا توجد فيديوهات تعليمية حتى الآن.</CardContent></Card>}
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">{videos.map(video => <Card key={video.id} className="overflow-hidden">
      <button className="w-full text-right group" onClick={() => void play(video.title, video.video_url, video.storage_path)} aria-label={`تشغيل ${video.title}`}>
        <div className="aspect-video bg-gradient-to-br from-amber-500/20 to-orange-600/30 flex items-center justify-center"><span className="rounded-full bg-primary text-primary-foreground p-5 group-hover:scale-110 transition-transform"><Play className="w-10 h-10" /></span></div>
        <div className="p-5 space-y-2"><h2 className="font-bold text-lg break-words">{video.title}</h2><p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{video.description}</p><span className="inline-block text-sm font-semibold text-primary">شاهد الشرح</span></div>
      </button>
      {isAdmin && <div className="px-5 pb-4"><Button variant="ghost" className="text-destructive" onClick={() => setDeleting(video)}><Trash2 className="w-4 h-4 ml-2" />حذف</Button></div>}
    </Card>)}</div>
    <Dialog open={adding} onOpenChange={open => { if (!busy) setAdding(open); }}><DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto"><DialogTitle>إضافة فيديو تعليمي</DialogTitle><DialogDescription>سيظهر الفيديو لكل المتاجر. ارفع ملفًا أو أضف رابطًا.</DialogDescription>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="tutorial-title">العنوان</Label><Input id="tutorial-title" required maxLength={150} value={title} onChange={e => setTitle(e.target.value)} disabled={busy} /></div>
        <div className="space-y-2"><Label htmlFor="tutorial-description">وصف مختصر (اختياري)</Label><Textarea id="tutorial-description" maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} disabled={busy} /></div>
        <div className="space-y-2"><Label htmlFor="tutorial-file">رفع فيديو MP4 أو WebM (حتى 100 ميجابايت)</Label><Input id="tutorial-file" type="file" accept="video/mp4,video/webm" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} /></div>
        <div className="space-y-2"><Label htmlFor="tutorial-url">أو رابط يوتيوب / فيديو مباشر</Label><Input id="tutorial-url" type="url" dir="ltr" required={!file} disabled={busy || !!file} value={url} onChange={e => setUrl(e.target.value)} /></div>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <Button disabled={busy} type="submit">{busy && <Loader2 className="animate-spin w-4 h-4 ml-2" />}{busy ? "جاري الحفظ..." : "إضافة لكل المتاجر"}</Button>
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!playing} onOpenChange={open => { if (!open) setPlaying(null); }}><DialogContent dir="rtl" className="max-w-4xl"><DialogTitle>{playing?.title}</DialogTitle><DialogDescription>شرح استخدام وصلة</DialogDescription>
      {playing?.kind === "youtube" ? <iframe className="w-full aspect-video" src={playing.url} title={playing.title} allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen /> : playing && <video key={playing.url} className="w-full max-h-[70vh] bg-black" src={playing.url} controls playsInline onError={() => toast({ title: "تعذّر تحميل ملف الفيديو", variant: "destructive" })} />}
    </DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!busy && !open) setDeleting(null); }}><DialogContent dir="rtl"><DialogTitle>حذف الفيديو؟</DialogTitle><DialogDescription>سيتم إزالة «{deleting?.title}» من قائمة الفيديوهات لدى كل المتاجر.</DialogDescription><Button variant="destructive" disabled={busy} onClick={() => void remove()}>تأكيد الحذف</Button></DialogContent></Dialog>
  </div>;
}
