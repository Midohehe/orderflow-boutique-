import type { StoreThemeTokens } from "@/lib/themeTokens";

export type ThemeCategory =
  | "fashion"
  | "beauty"
  | "electronics"
  | "food"
  | "luxury"
  | "minimal"
  | "promo"
  | "general";

export type PuckData = {
  content: Array<{ type: string; props: Record<string, unknown> }>;
  root: { props: Record<string, unknown> };
};

export interface ThemeLandingTemplate {
  name: string;
  description?: string;
  puckData: PuckData;
  isDefault?: boolean;
}

/** Full importable theme package — Shopify-style theme with layouts */
export interface ThemePackage {
  version: 1;
  id: string;
  name: string;
  nameAr: string;
  description: string;
  category: ThemeCategory;
  tags: string[];
  previewGradient: string;
  tokens: StoreThemeTokens;
  customCss?: string;
  storeHome?: PuckData;
  productLanding?: PuckData;
  landingTemplates?: ThemeLandingTemplate[];
}

export interface ThemeApplyOptions {
  applyTokens: boolean;
  applyStoreHome: boolean;
  applyProductLanding: boolean;
  applyLandingTemplates: boolean;
  replaceExistingTemplates: boolean;
}

export const DEFAULT_APPLY_OPTIONS: ThemeApplyOptions = {
  applyTokens: true,
  applyStoreHome: true,
  applyProductLanding: true,
  applyLandingTemplates: true,
  replaceExistingTemplates: false,
};

export interface ExportedStoreTheme {
  version: 1;
  exportedAt: string;
  name: string;
  packageId?: string | null;
  tokens: StoreThemeTokens;
  customCss?: string | null;
  storeHome?: PuckData | null;
  landingTemplates?: ThemeLandingTemplate[];
}

export const THEME_CATEGORY_LABELS: Record<ThemeCategory, string> = {
  fashion: "أزياء",
  beauty: "جمال",
  electronics: "إلكترونيات",
  food: "أغذية",
  luxury: "فاخر",
  minimal: "Minimal",
  promo: "عروض",
  general: "عام",
};
