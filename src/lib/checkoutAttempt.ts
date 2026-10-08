import { checkoutFingerprint } from '../../supabase/functions/_shared/checkout-request';

function newRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** AbortController also works in older in-app browsers without AbortSignal.timeout. */
export async function withCheckoutTimeout<T>(submit: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try { return await submit(controller.signal); }
  finally { clearTimeout(timer); }
}

/** Keep uncertain submissions retryable across reloads without storing customer data. */
export function createCheckoutAttempt() {
  let current: { fingerprint: string; id: string } | null = null;
  const prefix = 'wasla.checkout-attempt.';
  return {
    async requestId(payload: Record<string, unknown>): Promise<string> {
      const fingerprint = await checkoutFingerprint(payload);
      if (current?.fingerprint === fingerprint) return current.id;
      let saved: { id?: string; at?: number } | null = null;
      try { saved = JSON.parse(sessionStorage.getItem(prefix + fingerprint) || 'null'); } catch { /* storage unavailable */ }
      const reusable = saved?.id && /^[0-9a-f-]{36}$/i.test(saved.id) && Date.now() - Number(saved.at) < 86400000;
      current = { fingerprint, id: reusable ? saved!.id! : newRequestId() };
      try { sessionStorage.setItem(prefix + fingerprint, JSON.stringify({ id: current.id, at: Date.now() })); } catch { /* ref still protects retries */ }
      return current.id;
    },
    acknowledge() {
      // The current form keeps its ID; a new checkout after success gets a new ID.
      if (current) try { sessionStorage.removeItem(prefix + current.fingerprint); } catch { /* storage unavailable */ }
    },
  };
}
