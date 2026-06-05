/** Shared helpers for Aura / fashion store themes. */

export const FASHION_STORE_PRESETS = new Set(["aura-fashion", "aura-mens-store", "vibrant-boutique"]);

export function isFashionStoreTheme(preset?: string | null): boolean {
  return !!preset && FASHION_STORE_PRESETS.has(preset);
}

export const AURA_FASHION_COLORS = {
  primary: "250 85% 60%",
  primaryForeground: "0 0% 100%",
  accent: "340 82% 52%",
  secondary: "45 93% 60%",
  background: "0 0% 99%",
  foreground: "230 25% 15%",
  card: "0 0% 100%",
  cardForeground: "230 25% 15%",
  muted: "250 30% 96%",
  mutedForeground: "230 15% 45%",
  border: "220 15% 90%",
  headerBg: "0 0% 100%",
  buttonRadius: "2rem",
  sectionRadius: "1.5rem",
  buttonStyle: "solid" as const,
  headerStyle: "blur" as const,
  shadow: "medium" as const,
};
