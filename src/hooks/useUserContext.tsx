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
  const [effectiveOwnerId, setEffectiveOwnerId] = useState<string | null>(null);
  const [isSubUser, setIsSubUser] = useState(false);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      setEffectiveOwnerId(null);
      setIsSubUser(false);
      setPermissions(new Set());
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: prof }, { data: adminFlag }, { data: member }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.from("store_members").select("id, owner_id, group_id").eq("member_user_id", user.id).maybeSingle(),
      ]);
      const admin = adminFlag === true;
      setIsAdmin(admin);

      if (member) {
        // Sub-user: load parent profile + permissions
        setIsSubUser(true);
        setEffectiveOwnerId(member.owner_id);
        const { data: parentProf } = await supabase
          .rpc("get_owner_profile_safe", { _owner_id: member.owner_id })
          .maybeSingle();
        setProfile(parentProf as UserProfile | null);

        const perms = new Set<string>();
        if (member.group_id) {
          const { data: gPerms } = await supabase
            .from("permission_group_items").select("permission_key").eq("group_id", member.group_id);
          (gPerms || []).forEach((p: any) => perms.add(p.permission_key));
        }
        const { data: extra } = await supabase
          .from("store_member_permissions").select("permission_key").eq("member_id", member.id);
        (extra || []).forEach((p: any) => perms.add(p.permission_key));
        setPermissions(perms);
      } else {
        setProfile(prof as UserProfile | null);
        setIsSubUser(false);
        setEffectiveOwnerId(user.id);
        setPermissions(new Set()); // owner: has all (use hasPermission helper)
      }
      setLoading(false);
    })();
  }, [user, authLoading]);

  const subscriptionActive = isAdmin || profile?.is_active === true;

  const hasPermission = (key: string) => {
    if (isAdmin) return true;
    if (!isSubUser) return true; // store owner = full access
    return permissions.has(key);
  };

  return { profile, isAdmin, subscriptionActive, loading, effectiveOwnerId, isSubUser, permissions, hasPermission };
};
