/** Keep image metadata separate from color names used by orders and stock. */
export function normalizeColorImages(colors: string[], value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const images = value as Record<string, unknown>;
  return Object.fromEntries(colors.flatMap((color) => {
    const url = Object.prototype.hasOwnProperty.call(images, color) ? images[color] : null;
    return typeof url === "string" && /^https?:\/\//i.test(url.trim())
      ? [[color, url.trim()]]
      : [];
  }));
}
