/** Only checkout intent belongs in the retry fingerprint, not changing attribution/IP. */
export async function checkoutFingerprint(payload: Record<string, unknown>): Promise<string> {
  const fields = ['product_id', 'landing_slug', 'quantity', 'customer_name', 'phone', 'address', 'city',
    'governorate', 'selected_color', 'selected_size', 'selected_product_code', 'shipping_included',
    'upsell_index', 'accepted_offer_id', 'append_to_order_id', 'checkout_token'];
  const intent = Object.fromEntries(fields.map(key => [key, payload[key] ?? null]));
  intent.items = Array.isArray(payload.items) ? payload.items.map((item: Record<string, unknown>) => ({
    color: item.color ?? null, size: item.size ?? null, product_code: item.product_code ?? null,
    quantity: item.quantity ?? 1,
  })) : null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(intent)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
