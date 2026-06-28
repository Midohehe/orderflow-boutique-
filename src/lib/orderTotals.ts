/** Product subtotal stored on orders.price; delivery fee on orders.shipping_fee. */

export function orderProductTotal(order: { price?: unknown }): number {
  return Number(order.price) || 0;
}

export function orderShippingFee(order: { shipping_fee?: unknown }): number {
  return Number(order.shipping_fee) || 0;
}

/** Amount collected from customer / sent to carrier (COD). */
export function orderCollectableTotal(order: {
  price?: unknown;
  shipping_fee?: unknown;
}): number {
  return orderProductTotal(order) + orderShippingFee(order);
}

export function orderHasDeliveryFee(order: { shipping_fee?: unknown }): boolean {
  return orderShippingFee(order) > 0;
}
