import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { codNetwork, type CodSettings } from '@/lib/codNetwork';
import { currencies } from '@/lib/currencies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Loader2, Save, PlugZap } from 'lucide-react';

export default function CodNetworkAdminSettings() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState('');
  const [config, setConfig] = useState<CodSettings>({ enabled: false, country_code: 'SA', currency_code: 'SAR' });
  const [token, setToken] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failure, setFailure] = useState('');
  const stores = useQuery({ queryKey: ['cod-network-admin-stores'], queryFn: async () => {
    const { data, error } = await supabase.from('stores').select('id,name,slug').order('name').limit(1000);
    if (error) throw error; return data;
  } });
  const settings = useQuery({ queryKey: ['cod-network-settings', storeId], enabled: !!storeId,
    queryFn: () => codNetwork<CodSettings>('settings', storeId) });
  useEffect(() => { setToken(''); setMessage(''); setFailure(''); }, [storeId]);
  useEffect(() => { if (settings.data) setConfig(settings.data); }, [settings.data]);
  async function perform(action: 'save' | 'test') {
    setBusy(true); setMessage(''); setFailure('');
    try {
      await codNetwork(action, storeId, action === 'save' ? { ...config, api_token: token } : {});
      if (action === 'save') {
        setToken('');
        await Promise.all([queryClient.invalidateQueries({ queryKey: ['cod-network-settings', storeId] }), queryClient.invalidateQueries({ queryKey: ['cod-network-status', storeId] })]);
      }
      setMessage(action === 'save' ? 'تم حفظ إعدادات الربط لهذا المتجر' : 'الاتصال بالشركة ناجح');
    } catch (error) { setFailure(error instanceof Error ? error.message : 'تعذر تنفيذ العملية'); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>سعودي نيتورك (COD Network)</CardTitle>
    <CardDescription>فعّل الخدمة للمتاجر المطلوبة فقط. بيانات الربط مستقلة عن شركة الشحن الحالية.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="space-y-2"><Label>المتجر</Label><SearchableSelect value={storeId} onChange={value => { if (!busy) setStoreId(value); }} placeholder="اختر متجرًا" searchPlaceholder="ابحث عن المتجر" options={(stores.data || []).map(store => ({ value: store.id, label: `${store.name} — ${store.slug}` }))} /></div>
      {stores.isError && <p role="alert" className="text-destructive">تعذر تحميل المتاجر</p>}
      {storeId && (settings.isPending ? <Loader2 className="animate-spin" /> : settings.isError ? <Button variant="outline" onClick={() => void settings.refetch()}>إعادة تحميل إعدادات الربط</Button> : <>
        <div className="flex items-center justify-between rounded-lg border p-4 gap-4"><div><Label htmlFor="cod-enabled">تفعيل سعودي نيتورك لهذا المتجر</Label><p className="text-xs text-muted-foreground mt-1">يظهر زر الإرسال في واجهة طلبات هذا المتجر عند التفعيل.</p></div><Switch id="cod-enabled" checked={config.enabled} disabled={busy} onCheckedChange={enabled => setConfig({ ...config, enabled })} /></div>
        <div className="space-y-2"><Label htmlFor="cod-token">API Token</Label><Input id="cod-token" type="password" dir="ltr" autoComplete="new-password" disabled={busy} value={token} onChange={e => setToken(e.target.value)} placeholder={config.has_token ? 'رمز محفوظ — اتركه فارغًا للإبقاء عليه' : 'أدخل رمز API Token'} /><p className="text-xs text-muted-foreground">تلقاه في حساب الشركة: My profile ← API developer ← API Token. الرمز المحفوظ لا يُعرض للمتجر.</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="cod-country">رمز بلد التوصيل</Label><Input id="cod-country" dir="ltr" maxLength={2} value={config.country_code} disabled={busy} onChange={e => setConfig({ ...config, country_code: e.target.value.toUpperCase() })} /><p className="text-xs text-muted-foreground">SA للسعودية. استخدم رمز البلد من حرفين.</p></div>
          <div className="space-y-2"><Label htmlFor="cod-currency">عملة التحصيل لدى الشركة</Label><select id="cod-currency" className="w-full h-10 border rounded-md px-3 bg-background" value={config.currency_code} disabled={busy} onChange={e => setConfig({ ...config, currency_code: e.target.value })}>{currencies.map(currency => <option key={currency.code} value={currency.code}>{currency.name} ({currency.code})</option>)}</select></div>
        </div>
        <p className="text-sm text-muted-foreground">اختَر عملة التحصيل المطابقة للبلد في حساب الشركة. يُمنع إرسال طلب بعملة مختلفة؛ لا يتم تحويل المبالغ بسعر صرف.</p>
        <div className="flex gap-2 flex-wrap"><Button disabled={busy || settings.isFetching} onClick={() => void perform('save')}>{busy ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}حفظ إعدادات المتجر</Button><Button variant="outline" disabled={busy || !config.has_token || !!token} onClick={() => void perform('test')}><PlugZap className="w-4 h-4 ml-2" />اختبار الاتصال المحفوظ</Button></div>
      </>)}
      {message && <p role="status" className="text-emerald-600">{message}</p>}{failure && <p role="alert" className="text-destructive">{failure}</p>}
    </CardContent></Card>;
}
