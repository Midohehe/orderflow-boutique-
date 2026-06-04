/** Extended store theme — Shopify-style design tokens. */

export interface StoreThemeTokens {
  preset?: string;
  primary?: string;
  primaryForeground?: string;
  accent?: string;
  secondary?: string;
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  headerBg?: string;
  buttonRadius?: string;
  sectionRadius?: string;
  fontFamily?: string;
  headingFont?: string;
  buttonStyle?: "solid" | "gradient" | "outline";
  headerStyle?: "solid" | "transparent" | "blur";
  shadow?: "none" | "soft" | "medium" | "strong";
}

export const FONT_OPTIONS = [
  { id: "cairo", label: "Cairo — عصري", value: "Cairo, system-ui, sans-serif" },
  { id: "tajawal", label: "Tajawal — أنيق", value: "Tajawal, Cairo, sans-serif" },
  { id: "ibm", label: "IBM Plex Arabic", value: "'IBM Plex Sans Arabic', Cairo, sans-serif" },
  { id: "almarai", label: "Almarai — واضح", value: "Almarai, Cairo, sans-serif" },
  { id: "fraunces", label: "Fraunces + Cairo — فاخر", value: "Cairo, sans-serif", heading: "Fraunces, Cairo, serif" },
  { id: "noto", label: "Noto Sans Arabic", value: "'Noto Sans Arabic', Cairo, sans-serif" },
] as const;

export const DEFAULT_STORE_THEME: StoreThemeTokens = {
  preset: "ocean-pro",
  primary: "217 91% 50%",
  primaryForeground: "0 0% 100%",
  accent: "217 91% 45%",
  secondary: "217 40% 92%",
  background: "220 20% 97%",
  foreground: "222 47% 11%",
  card: "0 0% 100%",
  cardForeground: "222 47% 11%",
  muted: "220 14% 94%",
  mutedForeground: "220 10% 40%",
  border: "220 13% 88%",
  headerBg: "0 0% 100%",
  buttonRadius: "0.75rem",
  sectionRadius: "1rem",
  fontFamily: "Cairo, system-ui, sans-serif",
  headingFont: "Cairo, system-ui, sans-serif",
  buttonStyle: "gradient",
  headerStyle: "solid",
  shadow: "soft",
};

/** Legacy 5 presets — merged into extended catalog. */
export const LEGACY_THEME_PRESETS: Record<
  string,
  { label: string; description: string; tokens: StoreThemeTokens }
> = {
  ocean: {
    label: "أزرق المحيط",
    description: "كلاسيكي للمتاجر",
    tokens: { ...DEFAULT_STORE_THEME, preset: "ocean" },
  },
  emerald: {
    label: "زمردي",
    description: "منتجات طبيعية",
    tokens: {
      preset: "emerald",
      primary: "160 84% 35%",
      primaryForeground: "0 0% 100%",
      accent: "160 70% 30%",
      secondary: "150 30% 92%",
      background: "150 20% 97%",
      foreground: "160 30% 12%",
      card: "0 0% 100%",
      cardForeground: "160 30% 12%",
      muted: "150 15% 93%",
      mutedForeground: "160 15% 38%",
      border: "150 12% 86%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.75rem",
      sectionRadius: "1rem",
      fontFamily: "Cairo, system-ui, sans-serif",
      headingFont: "Cairo, system-ui, sans-serif",
      buttonStyle: "gradient",
      headerStyle: "solid",
      shadow: "soft",
    },
  },
  sunset: {
    label: "غروب",
    description: "عروض وتخفيضات",
    tokens: {
      preset: "sunset",
      primary: "24 95% 53%",
      primaryForeground: "0 0% 100%",
      accent: "14 90% 48%",
      secondary: "30 50% 94%",
      background: "30 30% 98%",
      foreground: "20 25% 15%",
      card: "0 0% 100%",
      cardForeground: "20 25% 15%",
      muted: "30 25% 94%",
      mutedForeground: "20 15% 42%",
      border: "30 18% 88%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.875rem",
      sectionRadius: "1.25rem",
      fontFamily: "Tajawal, Cairo, sans-serif",
      headingFont: "Tajawal, Cairo, sans-serif",
      buttonStyle: "gradient",
      headerStyle: "solid",
      shadow: "medium",
    },
  },
  royal: {
    label: "ملكي",
    description: "منتجات فاخرة",
    tokens: {
      preset: "royal",
      primary: "262 83% 58%",
      primaryForeground: "0 0% 100%",
      accent: "262 70% 48%",
      secondary: "260 30% 94%",
      background: "260 20% 98%",
      foreground: "260 25% 14%",
      card: "0 0% 100%",
      cardForeground: "260 25% 14%",
      muted: "260 18% 94%",
      mutedForeground: "260 12% 40%",
      border: "260 14% 88%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.625rem",
      sectionRadius: "0.875rem",
      fontFamily: "Cairo, sans-serif",
      headingFont: "Fraunces, Cairo, serif",
      buttonStyle: "solid",
      headerStyle: "blur",
      shadow: "medium",
    },
  },
  minimal: {
    label: "Minimal",
    description: "أبيض وأسود",
    tokens: {
      preset: "minimal",
      primary: "0 0% 9%",
      primaryForeground: "0 0% 100%",
      accent: "0 0% 25%",
      secondary: "0 0% 96%",
      background: "0 0% 99%",
      foreground: "0 0% 9%",
      card: "0 0% 100%",
      cardForeground: "0 0% 9%",
      muted: "0 0% 96%",
      mutedForeground: "0 0% 40%",
      border: "0 0% 90%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.375rem",
      sectionRadius: "0.5rem",
      fontFamily: "'IBM Plex Sans Arabic', Cairo, sans-serif",
      headingFont: "'IBM Plex Sans Arabic', Cairo, sans-serif",
      buttonStyle: "outline",
      headerStyle: "solid",
      shadow: "none",
    },
  },
};

export const THEME_PRESETS = LEGACY_THEME_PRESETS;

const SHADOW_CSS: Record<string, string> = {
  none: "none",
  soft: "0 2px 8px hsl(var(--store-primary) / 0.08)",
  medium: "0 8px 24px hsl(var(--store-primary) / 0.12)",
  strong: "0 16px 48px hsl(var(--store-primary) / 0.18)",
};

export function parseThemeTokens(raw: unknown): StoreThemeTokens {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STORE_THEME };
  const o = raw as Record<string, unknown>;
  const preset = typeof o.preset === "string" ? o.preset : DEFAULT_STORE_THEME.preset;
  const legacy = LEGACY_THEME_PRESETS[preset]?.tokens;
  const base = legacy ?? DEFAULT_STORE_THEME;
  const merged: StoreThemeTokens = {
    ...DEFAULT_STORE_THEME,
    ...base,
    ...Object.fromEntries(
      Object.entries(o).filter(([, v]) => typeof v === "string" && String(v).trim())
    ),
    preset,
  };
  if (typeof o.buttonStyle === "string") {
    merged.buttonStyle = o.buttonStyle as StoreThemeTokens["buttonStyle"];
  }
  if (typeof o.headerStyle === "string") {
    merged.headerStyle = o.headerStyle as StoreThemeTokens["headerStyle"];
  }
  if (typeof o.shadow === "string") {
    merged.shadow = o.shadow as StoreThemeTokens["shadow"];
  }
  return merged;
}

export function themeTokensToCssVars(tokens: StoreThemeTokens): Record<string, string> {
  const t = { ...DEFAULT_STORE_THEME, ...tokens };
  return {
    "--store-primary": t.primary!,
    "--store-primary-fg": t.primaryForeground!,
    "--store-accent": t.accent!,
    "--store-secondary": t.secondary || t.muted || "220 14% 94%",
    "--store-bg": t.background!,
    "--store-fg": t.foreground!,
    "--store-card": t.card || "0 0% 100%",
    "--store-card-fg": t.cardForeground || t.foreground!,
    "--store-muted": t.muted || "220 14% 94%",
    "--store-muted-fg": t.mutedForeground || "220 10% 40%",
    "--store-border": t.border || "220 13% 88%",
    "--store-header-bg": t.headerBg || "0 0% 100%",
    "--store-radius": t.buttonRadius || "0.75rem",
    "--store-section-radius": t.sectionRadius || "1rem",
    "--store-font": t.fontFamily || DEFAULT_STORE_THEME.fontFamily!,
    "--store-heading-font": t.headingFont || t.fontFamily || DEFAULT_STORE_THEME.fontFamily!,
    "--store-shadow": SHADOW_CSS[t.shadow || "soft"] || SHADOW_CSS.soft,
  };
}

export function themeTokensToStyleObject(tokens: StoreThemeTokens): Record<string, string> {
  return themeTokensToCssVars(tokens);
}

export function buildThemeComponentCss(scope = ".store-theme-scope"): string {
  return `
${scope} h1, ${scope} h2, ${scope} h3, ${scope} .store-heading {
  font-family: var(--store-heading-font);
  letter-spacing: -0.02em;
}
${scope} .store-card {
  background: hsl(var(--store-card));
  color: hsl(var(--store-card-fg));
  border: 1px solid hsl(var(--store-border));
  border-radius: var(--store-section-radius);
  box-shadow: var(--store-shadow);
}
${scope} .store-btn-primary {
  border-radius: var(--store-radius);
  font-weight: 700;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
${scope} .store-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--store-shadow);
}
${scope} .store-btn-gradient {
  background: linear-gradient(135deg, hsl(var(--store-primary)), hsl(var(--store-accent))) !important;
  color: hsl(var(--store-primary-fg)) !important;
}
${scope} .store-btn-solid {
  background: hsl(var(--store-primary)) !important;
  color: hsl(var(--store-primary-fg)) !important;
}
${scope} .store-btn-outline {
  background: transparent !important;
  color: hsl(var(--store-primary)) !important;
  border: 2px solid hsl(var(--store-primary)) !important;
}
${scope} .store-header-solid {
  background: hsl(var(--store-header-bg));
  border-bottom: 1px solid hsl(var(--store-border));
}
${scope} .store-header-blur {
  background: hsl(var(--store-header-bg) / 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid hsl(var(--store-border) / 0.5);
}
${scope} .store-section-muted {
  background: hsl(var(--store-muted));
  color: hsl(var(--store-muted-fg));
}
`.trim();
}

export function themeTokensToSsrCssFromTokens(
  tokens: StoreThemeTokens,
  scope = "#root",
  customCss?: string | null
): string {
  const vars = themeTokensToCssVars(tokens);
  const entries = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join("");
  const componentCss = buildThemeComponentCss(`${scope}, .store-theme-scope`);
  const custom = customCss?.trim()
    ? `\n${scope} .store-theme-scope, .store-theme-scope { ${customCss} }`
    : "";
  return `${scope}, .store-theme-scope { ${entries} font-family: var(--store-font); direction: rtl; background: hsl(var(--store-bg)); color: hsl(var(--store-fg)); }
${componentCss}
${scope} .bg-primary, ${scope} button.bg-primary, ${scope} .gradient-primary, ${scope} .store-btn-primary { border-radius: var(--store-radius); }
${scope} .text-primary { color: hsl(var(--store-primary)) !important; }
${scope} .border-primary { border-color: hsl(var(--store-primary) / 0.2) !important; }${custom}`;
}

export function themeTokensToSsrCss(scope = "#root"): string {
  return themeTokensToSsrCssFromTokens(DEFAULT_STORE_THEME, scope);
}

/** Button class for current token buttonStyle */
export function primaryButtonClass(tokens: StoreThemeTokens): string {
  const base = "store-btn-primary ";
  if (tokens.buttonStyle === "outline") return base + "store-btn-outline";
  if (tokens.buttonStyle === "solid") return base + "store-btn-solid";
  return base + "store-btn-gradient";
}

export function headerClass(tokens: StoreThemeTokens): string {
  if (tokens.headerStyle === "blur") return "store-header-blur";
  if (tokens.headerStyle === "transparent") return "store-header-transparent";
  return "store-header-solid";
}
