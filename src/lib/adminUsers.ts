import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

export type AccountKind = "admin" | "owner" | "staff" | "courier" | "unassigned";
export interface UserStoreLink {
  id: string; name: string; slug: string; owner_id: string; owner_name: string | null;
  relation: "owner" | "staff" | "courier"; group_name: string | null;
}
export interface DirectoryUser {
  user_id: string; username: string; full_name: string | null; email: string | null;
  created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null;
  kind: AccountKind; status: "active" | "disabled" | "unconfirmed";
  has_profile: boolean; profile_active: boolean | null; permission_group: string | null; stores: UserStoreLink[];
}
export interface DirectoryResult {
  users: DirectoryUser[]; total: number; page: number; page_size: number;
  summary: { total: number; active: number; owners: number; staff: number; couriers: number; unlinked: number };
}
export interface DirectoryFilters {
  search: string; kind: string; status: string; link: string; sort: string; page: number;
}
export async function fetchAdminUsers(filters: DirectoryFilters, signal: AbortSignal): Promise<DirectoryResult> {
  const { data, error } = await supabase.rpc("admin_user_directory", {
    _search: filters.search, _kind: filters.kind, _status: filters.status, _link: filters.link,
    _sort: filters.sort, _page: filters.page, _page_size: 25,
  }).abortSignal(AbortSignal.any([signal, AbortSignal.timeout(25_000)]));
  if (error) throw new Error(error.message);
  return data as unknown as DirectoryResult;
}
export async function manageAdminUser(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: { action, ...payload }, signal: AbortSignal.timeout(25_000),
  });
  if (error) throw new Error(await getEdgeFunctionErrorMessage(error, data));
  if (data?.error) throw new Error(data.error);
}
export const accountLabels: Record<AccountKind, string> = {
  admin: "سوبر أدمن", owner: "مالك متجر", staff: "موظف", courier: "مندوب", unassigned: "حساب بدون متجر",
};
export const statusLabels = { active: "نشط", disabled: "معطّل", unconfirmed: "بانتظار تأكيد البريد" };
