import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export function AcceptCountryOrdersButton({ storeId, orderIds, onDone }: { storeId: string | null; orderIds: string[]; onDone: (count: number) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const running = useRef(false), currentStore = useRef(storeId); currentStore.current = storeId;
  useEffect(() => { currentStore.current = storeId; setError(''); return () => { currentStore.current = null; }; }, [storeId]);
  async function move() {
    if (!storeId || !orderIds.length || running.current) return;
    const target = storeId; running.current = true; setBusy(true); setError('');
    try {
      const { data, error: failure } = await supabase.rpc('accept_country_orders', { _store_id: target, _order_ids: [...new Set(orderIds)] });
      if (failure) throw failure;
      if (currentStore.current === target) onDone(data ?? 0);
    } catch (failure) {
      if (currentStore.current === target) setError(failure instanceof Error ? failure.message : (failure as { message?: string })?.message || 'تعذر نقل الطلبات');
    } finally { running.current = false; setBusy(false); }
  }
  return <div className="space-y-2"><Button disabled={!storeId || !orderIds.length || busy} onClick={() => void move()}>{busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ArrowLeftRight className="ml-2 h-4 w-4" />}نقل المحدد إلى قيد الانتظار ({orderIds.length})</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
