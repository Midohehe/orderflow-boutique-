import { useEffect, useState, useCallback } from "react";

export type PanelTheme = "default" | "sport" | "gaming" | "boutique" | "luxury";

/** HSL CSS variable overrides applied to <html> for dashboard panel theming. */
const PALETTES: Record<PanelTheme, Record<string, string>> = {
  default: {},
  sport: {
    "--primary": "20 95% 55%",
    "--primary-foreground": "0 0% 5%",
    "--ring": "20 95% 55%",
    "--accent": "20 95% 55%",
    "--accent-foreground": "0 0% 5%",
  },
  gaming: {
    "--primary": "190 90% 50%",
    "--primary-foreground": "0 0% 5%",
    "--ring": "190 90% 50%",
    "--accent": "270 80% 60%",
    "--accent-foreground": "0 0% 100%",
  },
  boutique: {
    "--primary": "340 60% 50%",
    "--primary-foreground": "0 0% 100%",
    "--ring": "340 60% 50%",
    "--accent": "340 50% 90%",
    "--accent-foreground": "340 60% 25%",
  },
  luxury: {
    "--primary": "42 60% 52%",
    "--primary-foreground": "0 0% 8%",
    "--ring": "42 60% 52%",
    "--accent": "42 60% 52%",
    "--accent-foreground": "0 0% 8%",
  },
};

const KEY = "panel_theme";
const ALL: PanelTheme[] = ["default", "sport", "gaming", "boutique", "luxury"];

const getInitial = (): PanelTheme => {
  if (typeof window === "undefined") return "default";
  const v = localStorage.getItem(KEY) as PanelTheme | null;
  return v && ALL.includes(v) ? v : "default";
};

const apply = (t: PanelTheme) => {
  const root = document.documentElement;
  // Clear any previously set custom panel vars
  ALL.forEach((name) => {
    const vars = PALETTES[name];
    Object.keys(vars).forEach((k) => root.style.removeProperty(k));
  });
  const vars = PALETTES[t];
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
};

export const initPanelTheme = () => apply(getInitial());

export const usePanelTheme = () => {
  const [panelTheme, setState] = useState<PanelTheme>(getInitial);
  useEffect(() => {
    apply(panelTheme);
    localStorage.setItem(KEY, panelTheme);
  }, [panelTheme]);
  const setPanelTheme = useCallback((t: PanelTheme) => setState(t), []);
  return { panelTheme, setPanelTheme };
};