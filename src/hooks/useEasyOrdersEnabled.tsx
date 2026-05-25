import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Ctx {
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EasyOrdersCtx = createContext<Ctx>({ enabled: false, loading: true, refresh: async () => {} });

export const EasyOrdersEnabledProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setEnabled(false); setLoading(false); return; }
    const { data } = await supabase.rpc("get_easyorders_enabled" as any);
    setEnabled(!!data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  return <EasyOrdersCtx.Provider value={{ enabled, loading, refresh }}>{children}</EasyOrdersCtx.Provider>;
};

export const useEasyOrdersEnabled = () => useContext(EasyOrdersCtx);