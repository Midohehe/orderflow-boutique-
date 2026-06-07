import { supabase } from "@/integrations/supabase/client";

export interface SubscribePlanResult {
  success: boolean;
  plan_slug?: string;
  plan_name?: string;
  amount?: number;
  balance?: number;
  renewal?: boolean;
  subscription_ends_at?: string;
  error?: string;
  required?: number;
}

export async function subscribeToPlan(planSlug: string): Promise<SubscribePlanResult> {
  const { data, error } = await supabase.rpc("subscribe_to_plan", { _plan_slug: planSlug });
  if (error) throw new Error(error.message);
  return (data ?? { success: false, error: "unknown" }) as SubscribePlanResult;
}

export function subscribePlanErrorMessage(res: SubscribePlanResult | { error?: string; required?: number; balance?: number }): string {
  switch (res.error) {
    case "unauthorized":
      return "يجب تسجيل الدخول أولاً";
    case "sub_user_forbidden":
      return "لا يمكن للموظفين الاشتراك — تواصل مع صاحب المتجر";
    case "plan_not_found":
      return "الخطة غير متاحة";
    case "already_on_plan":
      return "أنت مشترك في هذه الخطة بالفعل";
    case "downgrade_not_allowed":
      return "لا يمكن التخفيض من الخطة عبر المحفظة — تواصل مع الإدارة";
    case "insufficient_balance": {
      const req = "required" in res ? res.required : undefined;
      const bal = "balance" in res ? res.balance : undefined;
      if (req != null && bal != null) {
        return `رصيد المحفظة غير كافٍ (المطلوب ${req} — الرصيد ${bal})`;
      }
      return "رصيد المحفظة غير كافٍ — شحن المحفظة أولاً";
    }
    default:
      return res.error || "تعذر إتمام الاشتراك";
  }
}
