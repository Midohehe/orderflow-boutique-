import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
export interface TurboExportTarget { productId: string; storeId: string; weight?: number; auto?: boolean }
interface Variant { key: string; code: string; name: string; state: string; error?: string | null }
export default function TurboProductExportDialog({ target, onClose }: { target: TurboExportTarget | null; onClose: () => void }) {
  const [variants, setVariants] = useState<Variant[]>([]), [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), running = useRef(false);
  async function call<T>(action: string, context: TurboExportTarget, values: Record<string, unknown> = {}): Promise<T> {
    const result = await supabase.functions.invoke('create-turbo-products', { body: { action, product_id: context.productId, store_id: context.storeId, ...values } });
    if (result.error) throw Error(await getEdgeFunctionErrorMessage(result.error, result.data));
    if (result.data?.error) throw Error(String(result.data.error));
    return result.data;
  }
  async function execute(rows: Variant[], value: number, context: TurboExportTarget, version: number) {
    if (running.current) return;
    if (!Number.isFinite(value) || value <= 0 || value > 10000) { setError('أدخل وزن القطعة أكبر من صفر'); return; }
    running.current = true; setBusy(true); setError('');
    try {
      for (const variant of rows.filter(row => row.state !== 'created')) {
        if (version !== generation.current) break;
        try {
          await call('sync', context, { variant_key: variant.key, weight: value });
          if (version === generation.current) setVariants(previous => previous.map(row => row.key === variant.key ? { ...row, state: 'created', error: null } : row));
        } catch (failure) {
          if (version === generation.current) setVariants(previous => previous.map(row => row.key === variant.key ? { ...row, state: 'review', error: failure instanceof Error ? failure.message : 'تعذر الإنشاء' } : row));
        }
      }
    } finally { running.current = false; if (version === generation.current) setBusy(false); }
  }
  useEffect(() => {
    const version = ++generation.current;
    setVariants([]); setError(''); setBusy(false); setWeight(target?.weight ? String(target.weight) : '');
    if (!target) return;
    setLoading(true);
    void (async () => {
      try {
        const result = await call<{ enabled: boolean; variants: Variant[]; weight: number | null }>('prepare', target);
        if (version !== generation.current) return;
        setVariants(result.variants);
        const value = target.weight || result.weight;
        if (value) setWeight(String(value));
        if (!result.enabled) { setError('فعّل إعدادات توربو لهذا المتجر أولًا'); return; }
        if (target.auto && value) await execute(result.variants, value, target, version);
      } catch (failure) { if (version === generation.current) setError(failure instanceof Error ? failure.message : 'تعذر تجهيز متغيرات توربو'); }
      finally { if (version === generation.current) setLoading(false); }
    })();
    const versionRef = generation;
    return () => { versionRef.current++; };
    // Work is bound to this explicit target; changing inputs does not restart a batch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const count = variants.filter(row => row.state === 'created').length;
  return <Dialog open={!!target} onOpenChange={open => { if (!open && !busy && !loading) onClose(); }}>
    <DialogContent dir="rtl" className="max-w-2xl max-h-[90dvh] overflow-y-auto">
      <DialogTitle>إنشاء المنتجات في توربو</DialogTitle>
      <DialogDescription>كل متغير منتج مستقل باسم وكود خاصين، ويُحفظ ربطه تلقائيًا في وصلة.</DialogDescription>
      <div className="space-y-2"><Label htmlFor="turbo-export-weight">وزن القطعة</Label>
        <Input id="turbo-export-weight" type="number" min="0.001" step="0.001" value={weight} disabled={busy || loading} onChange={event => setWeight(event.target.value)} />
        <p className="text-xs text-muted-foreground">أدخل الوزن حسب وحدة الوزن المستخدمة في حساب توربو. إنشاء المنتج لا يضيف كمية إلى مخزن الشركة.</p>
      </div>
      <p role="status">{loading && !busy ? 'جاري التجهيز…' : `${busy ? 'جاري الإنشاء — ' : ''}تم ربط ${count} من ${variants.length}`}</p>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <div className="space-y-2">{variants.map(variant => <div key={variant.key} className="rounded-lg border p-3 space-y-1">
        <p className="font-medium">{variant.name}</p><p className="text-sm font-mono" dir="ltr">{variant.code}</p>
        <p className={variant.state === 'created' ? 'text-emerald-600 text-sm' : 'text-muted-foreground text-sm'}>{variant.state === 'created' ? 'مرتبط بتوربو' : variant.error || 'بانتظار الإنشاء أو التحقق'}</p>
      </div>)}</div>
      <Button disabled={busy || loading || !variants.length || count === variants.length || !!error} onClick={() => target && void execute(variants, Number(weight), target, generation.current)}>
        {busy ? 'جاري الإنشاء…' : 'إنشاء / التحقق ومتابعة المتغيرات'}</Button>
    </DialogContent>
  </Dialog>;
}
