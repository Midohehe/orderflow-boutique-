/** Delivery-pricing dropdown labels — not real customer cities. */
const DELIVERY_ZONE_LABEL_RE = /^(داخل|خارج)\s/i;

export function isDeliveryZoneLabel(value: string | null | undefined): boolean {
  return DELIVERY_ZONE_LABEL_RE.test((value || "").trim());
}

/** City text for match-city — customer input only, never the delivery zone. */
export function customerCityForMatching(
  governorate: string | null | undefined,
  city: string | null | undefined,
): string {
  const gov = (governorate || "").trim();
  if (gov && gov !== "—") return gov;
  const c = (city || "").trim();
  if (c && c !== "—" && !isDeliveryZoneLabel(c)) return c;
  return "";
}
