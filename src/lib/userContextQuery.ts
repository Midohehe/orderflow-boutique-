import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  subscription_starts_at: string;
  subscription_ends_at: string | null;
  is_active: boolean;
}

export async function fetchUserContext(userId: string, signal: AbortSignal) {
  const [profile, role, membership] = await Promise.all([
    supabase.from("profiles").select("id, user_id, username, full_name, subscription_starts_at, subscription_ends_at, is_active").eq("user_id", userId).abortSignal(signal).maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }).abortSignal(signal),
    supabase.from("store_members").select("id, owner_id, group_id").eq("member_user_id", userId).abortSignal(signal).maybeSingle(),
  ]);
  for (const result of [profile, role, membership]) if (result.error) throw result.error;
  const member = membership.data;
  if (!member) return { profile: profile.data as UserProfile | null, isAdmin: role.data === true, member: null, ownerId: userId, permissions: [] as string[] };

  const [parent, group, extra] = await Promise.all([
    supabase.rpc("get_owner_profile_safe", { _owner_id: member.owner_id }).abortSignal(signal).maybeSingle(),
    member.group_id
      ? supabase.from("permission_group_items").select("permission_key").eq("group_id", member.group_id).abortSignal(signal)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("store_member_permissions").select("permission_key").eq("member_id", member.id).abortSignal(signal),
  ]);
  for (const result of [parent, group, extra]) if (result.error) throw result.error;
  return {
    profile: parent.data as UserProfile | null, isAdmin: role.data === true, member, ownerId: member.owner_id,
    permissions: [...(group.data || []), ...(extra.data || [])].map(item => item.permission_key),
  };
}
