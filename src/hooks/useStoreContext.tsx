import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  is_default: boolean;
}

interface StoreContextType {
  stores: Store[];
  activeStoreId: string | null;
  activeStore: Store | null;
  setActiveStoreId: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEY = "active_store_id";

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    if (!user) {
      setStores([]);
      setActiveStoreIdState(null);
      setLoading(false);
      return;
    }
    // Get member record (if sub-user) to find allowed stores
    const { data: member } = await supabase
      .from("store_members")
      .select("id, owner_id")
      .eq("member_user_id", user.id)
      .maybeSingle();

    let list: Store[] = [];
    if (member) {
      // Sub-user: stores either explicitly granted, or all of owner's if none granted
      const { data: granted } = await supabase
        .from("store_member_stores")
        .select("store_id")
        .eq("member_id", member.id);
      const grantedIds = (granted || []).map((g: any) => g.store_id);
      let q = supabase.from("stores").select("*").eq("owner_id", member.owner_id);
      if (grantedIds.length > 0) q = q.in("id", grantedIds);
      const { data } = await q.order("is_default", { ascending: false }).order("created_at");
      list = (data || []) as Store[];
    } else {
      const { data } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at");
      list = (data || []) as Store[];
    }

    setStores(list);
    // Restore active from localStorage if still valid, else pick default/first
    const savedId = localStorage.getItem(`${STORAGE_KEY}:${user.id}`);
    const active = list.find((s) => s.id === savedId)
      || list.find((s) => s.is_default)
      || list[0]
      || null;
    setActiveStoreIdState(active?.id || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    fetchStores();
  }, [authLoading, user, fetchStores]);

  const setActiveStoreId = (id: string) => {
    setActiveStoreIdState(id);
    if (user) localStorage.setItem(`${STORAGE_KEY}:${user.id}`, id);
  };

  const activeStore = stores.find((s) => s.id === activeStoreId) || null;

  return (
    <StoreContext.Provider value={{ stores, activeStoreId, activeStore, setActiveStoreId, refresh: fetchStores, loading }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreContext = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStoreContext must be used within StoreProvider");
  return ctx;
};
