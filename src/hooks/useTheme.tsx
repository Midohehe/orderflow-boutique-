import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

const getInitial = (): Theme => {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme") as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (t: Theme) => {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
};

export const initTheme = () => applyTheme(getInitial());

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(getInitial);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((p) => (p === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme, setTheme: setThemeState };
};
