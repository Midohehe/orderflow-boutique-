import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  subscription_starts_at: string;
  subscription_ends_at: string | null;
  is_active: boolean;
}

export const useUserContext = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      setProfile(prof as UserProfile | null);
      setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
      setLoading(false);
    })();
  }, [user, authLoading]);

  const subscriptionActive = isAdmin || (
    profile?.is_active === true &&
    (!profile?.subscription_ends_at || new Date(profile.subscription_ends_at) > new Date())
  );

  return { profile, isAdmin, subscriptionActive, loading };
};
