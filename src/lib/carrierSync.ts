import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

export interface CarrierSyncJob {
  id: string;
  total: number;
  processed: number;
  updated: number;
  failed: number;
  state: "running" | "completed";
  last_error: string | null;
  updated_at: string;
  errors: string[];
  codes: Array<{ code: string; count: number; label: string; mapped: boolean }>;
}

export async function requestCarrierSync(storeId: string, action: "start" | "batch" | "status", jobId?: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, action === "batch" ? 100_000 : 25_000);
  const timeoutMessage = "انتهت مهلة الانتظار. التقدّم محفوظ ويمكن استكمال المزامنة.";
  let rejectAbort: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error(timeoutMessage));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });
  try {
    const { data, error } = await Promise.race([supabase.functions.invoke("sync-carrier-statuses", {
      body: { store_id: storeId, action, job_id: jobId }, signal: controller.signal,
    }), interrupted]);
    if (controller.signal.aborted) throw new Error(timeoutMessage);
    if (error) throw new Error(await getEdgeFunctionErrorMessage(error, data));
    if (!data?.ok) throw new Error(data?.error || "تعذّرت المزامنة");
    return data as { ok: true; busy?: boolean; job: CarrierSyncJob | null };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
  }
}
