import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCouriers(storeId: string | null) {
  return useQuery({
    queryKey: ["couriers", storeId], enabled: !!storeId,
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("couriers").select("*").eq("store_id", storeId!).order("name").order("id").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
}
