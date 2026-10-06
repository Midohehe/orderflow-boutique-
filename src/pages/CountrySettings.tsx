import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2, Save, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStoreContext } from '@/hooks/useStoreContext';
import { useUserContext } from '@/hooks/useUserContext';
import { useAuth } from '@/hooks/useAuth';
import { countries, countryName } from '@/lib/countries';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export function CountrySettingsForm({ storeId, initialCountries }: { storeId: string; initialCountries: string[] }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState(initialCountries), [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const visible = countries.filter(country => `${country.name} ${country.code}`.toLowerCase().includes(search.trim().toLowerCase()));
  async function save() {
    if (saving || !selected.length) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const { data, error: failure } = await supabase.rpc('save_store_order_countries', { _store_id: storeId, _countries: selected });
      if (failure) throw failure;
      setMessage(`تم حفظ دول المتجر${data ? ` ونقل ${data} طلب إلى قيد الانتظار` : ''}`);
      await Promise.all(['store-order-countries', 'orders-page', 'orders-page-meta'].map(key => client.invalidateQueries({ queryKey: [key, storeId] })));
    } catch (failure) { setError(failure instanceof Error ? failure.message : (failure as { message?: string })?.message || 'تعذر حفظ الدول'); }
    finally { setSaving(false); }
  }
  return <Card><CardContent className="p-5 space-y-5">
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>طلبات الدول المفعّلة تدخل إلى قيد الانتظار مباشرة. عند الحفظ، تُنقل أيضًا الطلبات الموجودة في قائمة المراجعة من هذه الدول.</p>
      <p>إيقاف دولة يسري على الطلبات الجديدة؛ الطلبات التي قبلتها سابقًا تبقى في مكانها. تقدر تنقل أي طلب من قائمة المراجعة يدويًا.</p>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="الدول المفعلة">{selected.map(code => <Badge key={code} variant="secondary">{countryName(code)}</Badge>)}</div>
    <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="ابحث عن دولة" placeholder="ابحث باسم الدولة أو رمزها…" className="pr-9" value={search} onChange={event => setSearch(event.target.value)} /></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto rounded-lg border p-3" aria-label="اختيار الدول">
      {visible.map(country => <label key={country.code} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selected.includes(country.code) ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}>
        <Checkbox checked={selected.includes(country.code)} disabled={saving} aria-label={country.name} onCheckedChange={checked => { setMessage(''); setSelected(previous => checked === true ? [...new Set([...previous, country.code])] : previous.filter(code => code !== country.code)); }} />
        <span className="flex-1 text-sm">{country.name}</span><span className="text-xs text-muted-foreground" dir="ltr">{country.code}</span>
      </label>)}
      {!visible.length && <p className="text-sm text-muted-foreground">لا توجد دول مطابقة للبحث.</p>}
    </div>
    <div className="flex justify-between items-center gap-3"><span className="text-sm">{selected.length} دولة مفعّلة</span><Button disabled={saving || !selected.length} onClick={() => void save()}>{saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}حفظ دول المتجر</Button></div>
    {!selected.length && <p className="text-sm text-destructive">اختَر دولة واحدة على الأقل.</p>}
    {message && <p role="status" className="text-emerald-600">{message}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
  </CardContent></Card>;
}

export default function CountrySettings() {
  const { activeStoreId, activeStore } = useStoreContext();
  const { user } = useAuth();
  const { isAdmin, loading } = useUserContext();
  const canManage = isAdmin || (!!user && activeStore?.owner_id === user.id);
  const settings = useQuery({ queryKey: ['store-order-countries', activeStoreId], enabled: !!activeStoreId && canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('operating_countries').eq('id', activeStoreId!).single();
      if (error) throw error; return data.operating_countries;
    } });
  if (!activeStoreId) return <p className="p-6">اختر متجرًا أولًا.</p>;
  if (loading) return <Loader2 className="m-8 animate-spin" />;
  if (!canManage) return <p className="p-6">إعداد دول المتجر متاح للمالك والسوبر أدمن فقط.</p>;
  return <div className="space-y-6" dir="rtl">
    <PageHeader icon={Globe} title="دول المتجر" description={`الدول التي يستقبل ${activeStore?.name || 'المتجر'} طلباتها مباشرة في قيد الانتظار.`} />
    {settings.isPending ? <Loader2 className="animate-spin" /> : settings.isError ? <div role="alert">تعذر تحميل دول المتجر. <Button variant="outline" onClick={() => void settings.refetch()}>إعادة المحاولة</Button></div> : <CountrySettingsForm key={activeStoreId} storeId={activeStoreId} initialCountries={settings.data || ['LY']} />}
    <p className="text-xs text-muted-foreground">تصنيف الدولة يعتمد على موقع الزائر وقت الطلب، وقد يختلف عن عنوان التوصيل. الطلبات غير محددة الدولة تظهر في قيد الانتظار.</p>
  </div>;
}
