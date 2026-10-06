import { countryName } from '@/lib/countries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function OrderCountryFilter({ value, counts, onChange }: { value: string; counts: Record<string, number>; onChange: (code: string) => void }) {
  const codes = [...new Set([...Object.keys(counts), ...(value !== 'all' ? [value] : [])])].sort((a, b) => countryName(a).localeCompare(countryName(b), 'ar'));
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-full sm:w-52" aria-label="فلتر الطلبات حسب الدولة"><SelectValue placeholder="فلتر حسب الدولة" /></SelectTrigger>
    <SelectContent><SelectItem value="all">كل الدول</SelectItem>{codes.map(code => <SelectItem key={code} value={code}>{countryName(code)} ({counts[code] || 0})</SelectItem>)}</SelectContent>
  </Select>;
}
