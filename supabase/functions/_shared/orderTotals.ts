export function orderProductTotal(order: { price?: unknown }): number {
  return Number(order.price) || 0;
}

export function orderShippingFee(order: { shipping_fee?: unknown }): number {
  return Number(order.shipping_fee) || 0;
}

export function orderCollectableTotal(order: {
  price?: unknown;
  shipping_fee?: unknown;
}): number {
  return orderProductTotal(order) + orderShippingFee(order);
}

/** Spread delivery fee onto warehouse shipment lines so carrier COD matches order total. */
export function applyCollectableTotalToShipmentProducts(
  products: Array<{ productId: number; price: number; quantity: number }>,
  productTotal: number,
  collectableTotal: number,
): Array<{ productId: number; price: number; quantity: number }> {
  const delta = collectableTotal - productTotal;
  if (delta <= 0 || products.length === 0) return products;
  const out = products.map((p) => ({ ...p }));
  const target = out[out.length - 1];
  const qty = Math.max(1, Number(target.quantity) || 1);
  target.price = Math.round(((Number(target.price) || 0) + delta / qty) * 100) / 100;
  return out;
}
