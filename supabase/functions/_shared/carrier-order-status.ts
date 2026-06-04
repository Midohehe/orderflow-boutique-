export const DELIVERED_CARRIER_CODES = new Set(["DTR", "DTRC", "DTRCP", "DTRUC"]);

/** Maps carrier composite code to local orders.status when auto rules apply. */
export function carrierCodeToOrderStatus(
  code: string,
  autoMarkDelivered: boolean,
): string | null {
  const upper = String(code || "").toUpperCase();
  if (upper === "UPKBD" || upper === "UKDB" || upper === "UPKBL") return "unpacked";
  if (upper === "RTRN" || upper === "RCV") return "returned_received";
  if (autoMarkDelivered && DELIVERED_CARRIER_CODES.has(upper)) return "delivered";
  return null;
}
