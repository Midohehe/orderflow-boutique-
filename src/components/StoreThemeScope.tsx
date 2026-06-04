import { useEffect, useId, type CSSProperties, type ReactNode } from "react";
import {
  buildThemeComponentCss,
  parseThemeTokens,
  themeTokensToCssVars,
  type StoreThemeTokens,
} from "@/lib/themeTokens";

interface StoreThemeScopeProps {
  tokens?: StoreThemeTokens | unknown;
  customCss?: string | null;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Applies per-store CSS variables + component styles + optional custom CSS. */
export function StoreThemeScope({ tokens, customCss, className, style, children }: StoreThemeScopeProps) {
  const scopeId = useId().replace(/:/g, "");
  const parsed = parseThemeTokens(tokens);
  const cssVars = themeTokensToCssVars(parsed) as CSSProperties;
  const componentCss = buildThemeComponentCss(".store-theme-scope");

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([k, v]) => {
      root.style.setProperty(k, String(v));
    });
    return () => {
      Object.keys(cssVars).forEach((k) => root.style.removeProperty(k));
    };
  }, [
    parsed.preset,
    parsed.primary,
    parsed.accent,
    parsed.background,
    parsed.buttonStyle,
    parsed.headerStyle,
  ]);

  const scopedCustom = customCss?.trim()
    ? `.store-theme-scope[data-theme-scope="${scopeId}"] { ${customCss} }`
    : "";

  return (
    <>
      <style>{componentCss}</style>
      {scopedCustom ? <style>{scopedCustom}</style> : null}
      <div
        data-theme-scope={scopeId}
        className={`store-theme-scope min-h-full ${className || ""}`}
        style={{
          ...cssVars,
          background: "hsl(var(--store-bg))",
          color: "hsl(var(--store-fg))",
          fontFamily: "var(--store-font)",
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );
}
