import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { fetchUserContext, type UserProfile } from "@/lib/userContextQuery";

export type { UserProfile };

export const useUserContext = () => {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ["user-context", user?.id],
    enabled: !authLoading && !!user && user.app_metadata?.account_type !== "courier",
    queryFn: ({ signal }) => fetchUserContext(user!.id, signal),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const data = user ? query.data : undefined;
  const profile = data?.profile ?? null;
  const isAdmin = data?.isAdmin ?? false;
  const isSubUser = !!data?.member;
  const permissions = useMemo(() => new Set(data?.permissions ?? []), [data?.permissions]);
  const hasPermission = useCallback((key: string) => {
    if (!data) return false;
    return isAdmin || !isSubUser || permissions.has(key);
  }, [data, isAdmin, isSubUser, permissions]);

  return {
    profile, isAdmin, isSubUser, permissions, hasPermission,
    subscriptionActive: isAdmin || profile?.is_active === true,
    loading: authLoading || (!!user && user.app_metadata?.account_type !== "courier" && query.isPending),
    effectiveOwnerId: data?.ownerId ?? null,
  };
};
