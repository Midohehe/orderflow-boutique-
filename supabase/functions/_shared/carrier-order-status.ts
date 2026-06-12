export const DELIVERED_CARRIER_CODES = new Set(["DTR", "DTRC", "DTRCP", "DTRUC"]);

/**
 * Maps carrier composite code to local orders.status.
 * Delivered (تم الاستلام) is intentionally excluded — only financial settlement
 * or manual merchant action may change order status to delivered/settled.
 */
export function carrierCodeToOrderStatus(code: string): string | null {
  const upper = String(code || "").toUpperCase();
  if (upper === "UPKBD" || upper === "UKDB" || upper === "UPKBL") return "unpacked";
  if (upper === "RTRN" || upper === "RCV") return "returned_received";
  return null;
}
