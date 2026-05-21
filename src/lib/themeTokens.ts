import type { StoreTemplate } from "@/hooks/useStoreTemplate";

/** Returns CSS variable overrides + font family for the landing page wrapper. */
/** Convert #rrggbb to "H S% L%" string for CSS variable use. */
function hexToHsl(hex: string): string | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function getThemeTokens(template: StoreTemplate, bgOverride?: string | null): {
  style: React.CSSProperties;
  fontLink?: string;
  bodyClass?: string;
} {
  // HSL values to override --primary, --primary-foreground, --background
  const map: Record<string, { primary: string; primaryFg: string; bg?: string; font?: string; fontLink?: string }> = {
    classic:   { primary: "262 83% 58%", primaryFg: "0 0% 100%" },
    fashion:   { primary: "30 25% 25%",  primaryFg: "40 30% 95%", bg: "40 30% 97%" },
    stylish:   { primary: "0 0% 10%",    primaryFg: "0 0% 100%" },
    luxury:    { primary: "42 60% 52%",  primaryFg: "0 0% 5%",   bg: "0 0% 7%",  font: "Cormorant Garamond, serif", fontLink: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap" },
    editorial: { primary: "0 0% 10%",    primaryFg: "0 0% 100%", bg: "40 20% 98%" },
    vibrant:   { primary: "330 80% 55%", primaryFg: "0 0% 100%", bg: "24 100% 96%" },
    tech:      { primary: "160 84% 45%", primaryFg: "0 0% 5%",   bg: "220 20% 8%" },
    sport:     { primary: "20 95% 55%",  primaryFg: "0 0% 5%",   bg: "0 0% 5%" },
    gaming:    { primary: "190 90% 50%", primaryFg: "0 0% 5%",   bg: "240 30% 6%", font: "Orbitron, Cairo, sans-serif", fontLink: "https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Cairo:wght@500;700&display=swap" },
    boutique:  { primary: "340 50% 45%", primaryFg: "0 0% 100%", bg: "10 50% 97%", font: "Tajawal, sans-serif" },
    // Luxury dark presets (from "Arabiyat Prestige" set)
    noirGold:         { primary: "34 33% 64%",  primaryFg: "0 0% 5%",  bg: "240 14% 4%",  font: "Cormorant Garamond, serif", fontLink: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap" },
    emeraldGold:      { primary: "45 65% 52%",  primaryFg: "0 0% 5%",  bg: "163 75% 5%",  font: "Cormorant Garamond, serif", fontLink: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap" },
    midnightSapphire: { primary: "213 94% 68%", primaryFg: "0 0% 5%",  bg: "217 75% 5%",  font: "Cormorant Garamond, serif", fontLink: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap" },
    roseAmethyst:     { primary: "330 84% 71%", primaryFg: "0 0% 5%",  bg: "280 60% 6%",  font: "Cormorant Garamond, serif", fontLink: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap" },
  };
  const t = map[template] || map.classic;
  const overrideBg = bgOverride ? hexToHsl(bgOverride) : null;
  const bg = overrideBg || t.bg;
  const style: React.CSSProperties = {
    ["--primary" as any]: t.primary,
    ["--primary-foreground" as any]: t.primaryFg,
    ["--ring" as any]: t.primary,
    ["--accent" as any]: t.primary,
  };
  if (bg) {
    (style as any)["--background"] = bg;
    // tweak foreground contrast for dark bgs
    const lightness = parseInt(bg.split(" ")[2]);
    if (!isNaN(lightness) && lightness < 30) {
      (style as any)["--foreground"] = "0 0% 95%";
      (style as any)["--card"] = bg;
      (style as any)["--card-foreground"] = "0 0% 95%";
      (style as any)["--muted"] = "0 0% 15%";
      (style as any)["--muted-foreground"] = "0 0% 70%";
      (style as any)["--border"] = "0 0% 20%";
      (style as any)["--input"] = "0 0% 15%";
    }
  }
  if (t.font) style.fontFamily = t.font;
  return { style, fontLink: t.fontLink };
}