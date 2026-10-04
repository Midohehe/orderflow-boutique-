// Contact information only; this is not a verified Auth phone or an SMS login.
export function normalizeContactPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\s()-]/g, "")
    .replace(/^00/, "+");
}

export function isValidContactPhone(value: string): boolean {
  return /^\+?[0-9]{7,15}$/.test(value);
}
