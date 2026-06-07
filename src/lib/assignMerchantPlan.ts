import { supabase } from "@/integrations/supabase/client";

export interface PlanOption {
  id: string;
  slug: string;
  name: string;
}

/** Assign a subscription plan to a merchant (admin only — via edge function + service role). */
export async function assignMerchantPlan(userId: string, planSlug: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: { action: "assign_plan", user_id: userId, plan_slug: planSlug },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
}

export function planAssignErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Forbidden") || msg.includes("forbidden")) {
    return "ليس لديك صلاحية تعيين الخطط — حساب أدمن مطلوب";
  }
  if (msg.includes("plan not found")) {
    return "الخطة المختارة غير موجودة";
  }
  return msg || "تعذر تعيين الخطة";
}
