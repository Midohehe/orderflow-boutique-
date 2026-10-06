import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { codNetwork, buildCodPayload, type CodDraft, type CodEdits, type CodSettings } from '@/lib/codNetwork';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';

type Result = { ok: boolean; reference?: string; error?: string; warning?: string | null };
export function CodNetworkShippingButton({ storeId, orderIds, onDone, disabled = false }: { storeId: string | null; orderIds: string[]; onDone: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [preparing, setPreparing] = useState(false);
  const [drafts, setDrafts] = useState<CodDraft[]>([]), [edits, setEdits] = useState<Record<string, CodEdits>>({});
  const [results, setResults] = useState<Record<string, Result>>({}), [error, setError] = useState('');
  const [remoteIds, setRemoteIds] = useState<Record<string, string>>({}), [remember, setRemember] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const currentStore = useRef(storeId); currentStore.current = storeId;
  const submitting = useRef(false);
  const status = useQuery({ queryKey: ['cod-network-status', storeId], enabled: !!storeId,
    queryFn: () => codNetwork<CodSettings>('status', storeId!), staleTime: 30_000, refetchOnWindowFocus: true, retry: false });
  useEffect(() => { setOpen(false); setDrafts([]); setEdits({}); setResults({}); setError(''); }, [storeId]);
  async function prepare() {
    if (!storeId || !orderIds.length || submitting.current) return;
    const target = storeId;
    setOpen(true); setPreparing(true); setError(''); setDrafts([]); setResults({}); setEdits({}); setRemoteIds({}); setProgress({ done: 0, total: 0 });
    try {
      const response = await codNetwork<{ drafts: CodDraft[] }>('prepare', target, { order_ids: orderIds });
      if (currentStore.current === target) setDrafts(response.drafts);
    } catch (failure) { if (currentStore.current === target) setError(failure instanceof Error ? failure.message : 'تعذر تحميل الطلبات'); }
    finally { setPreparing(false); }
  }
  function issue(draft: CodDraft) {
    if (draft.shipment?.state === 'sent') return 'تم إرسال هذا الطلب سابقًا';
    if (['sending','uncertain'].includes(draft.shipment?.state || '')) return 'محاولة سابقة غير مؤكدة؛ تحقق من حساب الشركة واربط رقم الطلب أدناه';
    try { buildCodPayload(draft, edits[draft.id] || {}, status.data?.currency_code || 'SAR'); return ''; }
    catch (failure) { return failure instanceof Error ? failure.message : 'راجع بيانات الطلب'; }
  }
  const ready = drafts.filter(draft => !results[draft.id]?.ok && !issue(draft));
  async function send() {
    if (!storeId || submitting.current || !ready.length) return;
    submitting.current = true; setBusy(true); setError('');
    const target = storeId, batch = [...ready]; setProgress({ done: 0, total: batch.length });
    let completed = false;
    try {
      for (let index = 0; index < batch.length; index++) {
        if (currentStore.current !== target) break;
        const draft = batch[index];
        try {
          const result = await codNetwork<Result>('send', target, { order_id: draft.id, review_key: draft.review_key, edits: edits[draft.id] || {}, remember_skus: remember });
          if (currentStore.current === target) setResults(previous => ({ ...previous, [draft.id]: result }));
          completed = completed || result.ok;
        } catch (failure) {
          if (currentStore.current === target) setResults(previous => ({ ...previous, [draft.id]: { ok: false, error: failure instanceof Error ? failure.message : 'تعذر إرسال الطلب' } }));
        }
        if (currentStore.current === target) setProgress({ done: index + 1, total: batch.length });
      }
      // Reload durable outcomes (including ambiguous sends) before permitting retries.
      if (currentStore.current === target) {
        const refreshed = await codNetwork<{ drafts: CodDraft[] }>('prepare', target, { order_ids: drafts.map(draft => draft.id) });
        setDrafts(refreshed.drafts);
      }
    } catch (failure) { if (currentStore.current === target) setError(failure instanceof Error ? failure.message : 'أعد فتح النافذة للتحقق من نتيجة الإرسال'); }
    finally { submitting.current = false; setBusy(false); if (completed && currentStore.current === target) onDone(); }
  }
  async function reconcile(draft: CodDraft) {
    if (!storeId || submitting.current) return;
    const target = storeId; submitting.current = true; setBusy(true);
    try {
      const result = await codNetwork<Result>('reconcile', target, { order_id: draft.id, remote_id: remoteIds[draft.id] });
      if (currentStore.current === target) { setResults(previous => ({ ...previous, [draft.id]: result })); onDone(); }
    } catch (failure) { if (currentStore.current === target) setResults(previous => ({ ...previous, [draft.id]: { ok: false, error: failure instanceof Error ? failure.message : 'تعذر ربط الطلب' } })); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (!status.data?.enabled) return null;
  return <>
    <Button variant="outline" disabled={disabled || !storeId || !orderIds.length || busy || preparing} onClick={() => void prepare()}><Send className="w-4 h-4 ml-2" />إرسال لشركة سعودي نيتورك ({orderIds.length})</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy && !preparing) setOpen(value); }}><DialogContent dir="rtl" className="max-w-3xl max-h-[90dvh] overflow-y-auto">
      <DialogTitle>إرسال الطلبات إلى سعودي نيتورك</DialogTitle><DialogDescription>راجع العميل والعنوان ورموز SKU من حساب الشركة. مبلغ التحصيل يشمل توصيل الطلب، ويُرسل بالدفع عند الاستلام. الحد الأقصى 50 طلبًا في الدفعة.</DialogDescription>
      {preparing && <p role="status" className="flex gap-2"><Loader2 className="w-4 h-4 animate-spin" />جاري تجهيز الطلبات…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {drafts.map(draft => {
        const change = edits[draft.id] || {}, result = results[draft.id], problem = issue(draft);
        const sent = result?.ok || draft.shipment?.state === 'sent';
        const uncertain = ['sending','uncertain'].includes(draft.shipment?.state || '');
        const edit = (field: keyof CodEdits, value: string) => setEdits(previous => ({ ...previous, [draft.id]: { ...previous[draft.id], [field]: value } }));
        return <div key={draft.id} className="border rounded-xl p-4 space-y-3">
          <div className="flex justify-between gap-2 flex-wrap"><strong>الطلب {draft.order_code}</strong><span>التحصيل: {draft.total.toFixed(2)} {draft.currency_code} · {draft.country}</span></div>
          {sent ? <p className="text-emerald-600 flex gap-2" role="status"><CheckCircle2 className="w-4 h-4" />تم الإرسال — رقم الشركة: {result?.reference || draft.shipment?.reference}</p> : <>
            <div className="grid sm:grid-cols-2 gap-3">{(['full_name','phone','city','area','address'] as const).map(field => {
              const label = { full_name: 'اسم العميل', phone: 'الهاتف', city: 'المدينة', area: 'المنطقة / الحي', address: 'العنوان' }[field];
              return <div key={field} className="space-y-1"><Label htmlFor={`cod-${draft.id}-${field}`}>{label}</Label><Input id={`cod-${draft.id}-${field}`} disabled={busy || uncertain} value={change[field] ?? draft[field]} onChange={event => edit(field, event.target.value)} dir={field === 'phone' ? 'ltr' : undefined} /></div>;
            })}</div>
            {draft.items.map(item => <div key={item.id} className="grid sm:grid-cols-2 gap-2 items-center border-t pt-2"><div className="text-sm">{item.product_name} — {item.quantity} قطعة <span className="text-muted-foreground">{[item.selected_color, item.selected_size].filter(Boolean).join(' / ')}</span></div><div><Label className="sr-only" htmlFor={`cod-sku-${draft.id}-${item.id}`}>SKU {item.product_name}</Label><Input id={`cod-sku-${draft.id}-${item.id}`} dir="ltr" placeholder="SKU لدى سعودي نيتورك" disabled={busy || uncertain} value={change.skus?.[item.id] ?? item.sku} onChange={event => setEdits(previous => ({ ...previous, [draft.id]: { ...previous[draft.id], skus: { ...previous[draft.id]?.skus, [item.id]: event.target.value } } }))} /></div></div>)}
            {problem && <p className="text-amber-600 text-sm">{problem}</p>}
            {uncertain && <div className="space-y-2 bg-muted/40 p-3 rounded-md"><p className="text-xs">إذا وجدت الطلب في حساب الشركة، أدخل معرّفه الرقمي لربطه دون إنشاء شحنة ثانية. يُتحقق من الهاتف ومبلغ التحصيل. متاح بعد دقيقتين من المحاولة.</p><div className="flex gap-2"><Input aria-label={`رقم طلب الشركة ${draft.order_code}`} dir="ltr" placeholder="معرّف الطلب الرقمي لدى الشركة" value={remoteIds[draft.id] || ''} disabled={busy} onChange={event => setRemoteIds(previous => ({ ...previous, [draft.id]: event.target.value }))} /><Button variant="outline" disabled={busy || !remoteIds[draft.id]} onClick={() => void reconcile(draft)}>تحقق واربط</Button></div></div>}
          </>}
          {result?.warning && <p className="text-amber-600 text-sm">{result.warning}</p>}{result?.error && <p role="alert" className="text-destructive text-sm">{result.error}</p>}
        </div>;
      })}
      {!!drafts.length && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={remember} onChange={event => setRemember(event.target.checked)} />حفظ ربط رموز المنتجات للمرات القادمة</label><p role="status" className="text-sm">جاهز للإرسال: {ready.length} من {drafts.length}{progress.total > 0 && ` · تمت معالجة ${progress.done} من ${progress.total}`}</p><Button disabled={busy || preparing || !ready.length || !!error} onClick={() => void send()}>{busy ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-2" />}{busy ? `جاري الإرسال ${progress.done} / ${progress.total}` : `تأكيد إرسال ${ready.length} طلب`}</Button></>}
    </DialogContent></Dialog>
  </>;
}
