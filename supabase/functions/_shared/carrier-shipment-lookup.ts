export interface CarrierShipment {
  id: number | string;
  code: string;
  refNumber?: string | null;
  notes?: string | null;
  status?: { code?: string | null; name?: string | null } | null;
  deliveryType?: { code?: string | null } | null;
  returnType?: { code?: string | null } | null;
  cancellationReason?: { id?: number | string | null; name?: string | null } | null;
}

/** Legacy imports stored the public barcode in shipping_id. Resolve by the
 * exact reference, then persist the real ID only with the guarded order write. */
export async function resolveCarrierShipment(
  order: { shipping_id: unknown; shipping_reference?: string | null },
  lookup: (key: { id: number } | { code: string }) => Promise<CarrierShipment | null>,
): Promise<CarrierShipment> {
  const id = Number(order.shipping_id), validId = Number.isSafeInteger(id) && id > 0;
  const reference = String(order.shipping_reference || '').trim();
  const byCodeFirst = !!reference && (!validId || reference === String(order.shipping_id));
  const keys: Array<{ id: number } | { code: string }> = byCodeFirst
    ? [{ code: reference }, ...(validId ? [{ id }] : [])]
    : [...(validId ? [{ id }] : []), ...(reference ? [{ code: reference }] : [])];
  if (!keys.length) throw Error('معرّف الشحنة غير صالح ولا يوجد كود شحنة للبحث');
  let mismatched = false;
  for (const key of keys) {
    const shipment = await lookup(key);
    if (!shipment) continue;
    const actualId = Number(shipment.id);
    if (!Number.isSafeInteger(actualId) || actualId <= 0) throw Error('لم ترجع الشركة معرّفًا داخليًا صالحًا للشحنة');
    const matches = 'code' in key ? String(shipment.code).trim() === key.code
      : actualId === key.id && (!reference || [shipment.code, shipment.refNumber, String(actualId)].includes(reference));
    if (matches) return shipment;
    mismatched = true;
  }
  throw Error(mismatched ? 'بيانات الشحنة لدى الشركة لا تطابق كود الطلب؛ لم يتم تغيير حالته'
    : 'لم يُعثر على الشحنة لدى الشركة بالمعرّف أو الكود؛ راجع كود الشحنة وحساب الربط');
}
