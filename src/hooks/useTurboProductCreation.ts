import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function useTurboProductCreation(storeId: string | null) {
  const query = useQuery({ queryKey: ['turbo-product-creation', storeId], enabled: !!storeId,
    queryFn: async () => {
      const result = await supabase.from('shipping_settings').select('enabled').eq('store_id', storeId!)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (result.error) throw result.error;
      return result.data?.enabled === true;
    }, staleTime: 30_000, retry: false });
  return { enabled: query.data === true, loading: !!storeId && query.isPending };
}
