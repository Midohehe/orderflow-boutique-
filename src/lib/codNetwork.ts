import { supabase } from '@/integrations/supabase/client';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionError';
export { buildCodPayload } from '../../supabase/functions/_shared/cod-network';
export type { CodDraft, CodEdits } from '../../supabase/functions/_shared/cod-network';
export interface CodSettings { enabled: boolean; country_code: string; currency_code: string; has_token?: boolean }
export async function codNetwork<T>(action: string, storeId: string, values: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cod-network', { body: { ...values, action, store_id: storeId } });
  if (error) throw Error(await getEdgeFunctionErrorMessage(error, data));
  if (data?.error) throw Error(String(data.error));
  return data as T;
}
