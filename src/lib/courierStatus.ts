export const courierSubStatuses = {
  follow_up: "متابعة",
  delivered_by_courier: "تم التسليم لدى المندوب",
  returned_by_courier: "راجع لدى المندوب",
} as const;
export type CourierSubStatus = keyof typeof courierSubStatuses;
export const batchLabel = (code: number | string | null | undefined) => code == null ? "—" : `B-${String(code).padStart(6, "0")}`;
export const courierLoginEmail = (username: string) => `${username.trim().toLowerCase()}@couriers.wasla.invalid`;
