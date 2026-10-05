import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requestCarrierSync, type CarrierSyncJob } from "@/lib/carrierSync";

export default function CarrierSyncPanel({ storeId, onUpdated }: { storeId: string | null; onUpdated: () => void }) {
  const [job, setJob] = useState<CarrierSyncJob | null>(null);
  const [running, setRunning] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const stop = useRef(false);
  const active = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    stop.current = true;
    active.current = false;
    abort.current?.abort();
    setJob(null); setRunning(false); setPausing(false); setError(""); setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    if (storeId) void requestCarrierSync(storeId, "status", undefined, controller.signal).then(({ job: saved }) => {
      if (generation.current === current && !active.current && !controller.signal.aborted) setJob(saved);
    }).catch(() => { /* Starting sync surfaces any connection/auth error. */ });
    return () => { generation.current = current + 1; stop.current = true; controller.abort(); abort.current?.abort(); };
  }, [storeId]);

  async function run() {
    if (!storeId || active.current) return;
    const current = generation.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    active.current = true; stop.current = false;
    setRunning(true); setPausing(false); setError(""); setMessage("جاري تجهيز قائمة الشحنات...");
    const valid = () => generation.current === current && !controller.signal.aborted;
    try {
      let { job: latest } = await requestCarrierSync(storeId, "start", undefined, controller.signal);
      if (!valid()) return;
      setJob(latest);
      while (latest?.state === "running" && !stop.current && valid()) {
        setMessage("جاري الاتصال بشركة الشحن وتحديث الدفعة الحالية...");
        const result = await requestCarrierSync(storeId, "batch", latest.id, controller.signal);
        if (!valid()) return;
        latest = result.job;
        setJob(latest);
        if (result.busy) {
          setMessage("توجد دفعة قيد التنفيذ. انتظر قليلًا ثم اضغط استكمال لقراءة نتيجتها.");
          break;
        }
      }
      if (!valid()) return;
      if (latest?.state === "completed") setMessage(latest.total === 0 ? "لا توجد طلبات بحالة «جاري التوصيل» مرتبطة بشركة الشحن في هذا المتجر." : latest.failed ? "انتهت المزامنة مع وجود أخطاء موضّحة أدناه." : "اكتملت المزامنة بنجاح.");
      else if (stop.current) setMessage("توقّفت المزامنة مؤقتًا. يمكنك استكمالها من نفس المكان.");
      onUpdated();
    } catch (e) {
      if (!valid()) return;
      setError(e instanceof Error ? e.message : "تعذّرت المزامنة");
      setMessage("توقّفت المزامنة. التقدّم المحفوظ لن يُفقد عند الاستكمال.");
      try {
        const { job: saved } = await requestCarrierSync(storeId, "status", undefined, controller.signal);
        if (valid()) setJob(saved);
      } catch { /* Keep the last acknowledged progress on connection loss. */ }
      if (valid()) onUpdated();
    } finally {
      if (generation.current === current) { active.current = false; setRunning(false); setPausing(false); }
    }
  }

  const percent = job?.total ? Math.min(100, Math.round(job.processed / job.total * 100)) : 0;
  return <div className="w-full space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={() => void run()} disabled={running || !storeId} className="gap-2">
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {running ? `جاري المزامنة${job ? ` (${job.processed}/${job.total})` : ""}` : job?.state === "running" ? "استكمال مزامنة الشحنات" : "مزامنة حالات الشحن"}
      </Button>
      {running && <Button type="button" variant="outline" disabled={pausing} onClick={() => { stop.current = true; setPausing(true); setMessage("سيتم الإيقاف بعد انتهاء الدفعة الحالية..."); }}>إيقاف مؤقت</Button>}
      <span className="text-xs text-muted-foreground">تتم المزامنة فقط للطلبات التي حالتها «جاري التوصيل» في وصلة والمرتبطة بشركة الشحن، باستثناء الطلبات المحذوفة.</span>
    </div>
    {(running || job || error) && <div className="rounded-lg border p-3 space-y-2">
      <p role="status" aria-live="polite" className="text-sm">{message || (job?.state === "running" ? "مزامنة غير مكتملة — اضغط استكمال لمتابعتها." : "نتيجة آخر مزامنة")}</p>
      {job && <>
        <div role="progressbar" aria-label="تقدّم مزامنة الشحنات" aria-valuemin={0} aria-valuemax={job.total || 1} aria-valuenow={job.processed} className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div>
        <div className="flex flex-wrap gap-4 text-sm"><span>تم فحص <strong>{job.processed}</strong> من <strong>{job.total}</strong></span><span>تم تحديثه: <strong>{job.updated}</strong></span><span>فشل: <strong>{job.failed}</strong></span>{(job.skipped ?? 0) > 0 && <span>تم تجاوز: <strong>{job.skipped}</strong></span>}<span>متبقي: <strong>{job.total-job.processed}</strong></span></div>
        {(job.skipped ?? 0) > 0 && <p className="text-xs text-muted-foreground">تم تجاوز طلبات تغيّرت حالتها أو بيانات شحنتها أثناء المزامنة، دون احتسابها كأخطاء.</p>}
        <p className="text-xs text-muted-foreground">«تم تحديثه» يعني استلام حالة الشحنة وحفظها، حتى لو كانت نفس الحالة السابقة.</p>
        {job.codes.length > 0 && <div className="flex flex-wrap gap-2">{job.codes.map(code => <Badge key={code.code} variant="secondary">{code.label} ({code.count})</Badge>)}</div>}
        {job.errors.length > 0 && <details><summary className="text-sm cursor-pointer">تفاصيل الأخطاء (أول {job.errors.length})</summary><ul className="text-sm space-y-1 mt-2">{job.errors.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}
      </>}
      {(error || job?.last_error) && <p role="alert" className="text-sm text-destructive">{error || job?.last_error}</p>}
      {job?.state === "running" && <p className="text-xs text-muted-foreground">التقدّم محفوظ. الخروج من الصفحة يوقف إرسال دفعات جديدة؛ يمكنك الرجوع والاستكمال.</p>}
    </div>}
  </div>;
}
