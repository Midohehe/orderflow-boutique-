import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";

export interface PlanInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  max_stores: number;
  max_orders_month: number;
  max_products: number;
  max_staff: number;
  price_monthly: number;
  currency: string;
  features: string[];
}

export interface PlanUsage {
  stores: number;
  products: number;
  staff: number;
  orders_month: number;
}

export function usePlanUsage() {
  const { effectiveOwnerId, isAdmin, loading: ctxLoading } = useUserContext();

  const query = useQuery({
    queryKey: ["merchant-usage", effectiveOwnerId],
    enabled: !!effectiveOwnerId && !ctxLoading,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("merchant_usage", {
        _owner_id: effectiveOwnerId!,
      });
      if (error) throw error;
      const payload = data as { error?: string; plan?: PlanInfo; usage?: PlanUsage };
      if (payload?.error) throw new Error(payload.error);
      return {
        plan: {
          ...payload.plan!,
          features: Array.isArray(payload.plan?.features)
            ? (payload.plan!.features as string[])
            : [],
        },
        usage: payload.usage!,
      };
    },
  });

  return {
    ...query,
    plan: query.data?.plan ?? null,
    usage: query.data?.usage ?? null,
    isAdmin,
  };
}
