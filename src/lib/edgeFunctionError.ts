import { FunctionsHttpError } from "@supabase/supabase-js";

/** Extract a human-readable message from supabase.functions.invoke failures. */
function formatBodyError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as { error?: unknown; hint?: unknown };
  if (!rec.error) return null;
  const msg = String(rec.error);
  if (rec.hint) return `${msg} — ${String(rec.hint)}`;
  return msg;
}

export async function getEdgeFunctionErrorMessage(error: unknown, data?: unknown): Promise<string> {
  const fromData = formatBodyError(data);
  if (fromData) return fromData;
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      const fromBody = formatBodyError(body);
      if (fromBody) return fromBody;
    } catch {
      /* ignore parse errors */
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "حدث خطأ غير متوقع";
}
