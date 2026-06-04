import { FunctionsHttpError } from "@supabase/supabase-js";

/** Extract a human-readable message from supabase.functions.invoke failures. */
export async function getEdgeFunctionErrorMessage(error: unknown, data?: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    return String((data as { error: unknown }).error);
  }
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body && typeof body === "object" && "error" in body) {
        return String((body as { error: unknown }).error);
      }
    } catch {
      /* ignore parse errors */
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "حدث خطأ غير متوقع";
}
