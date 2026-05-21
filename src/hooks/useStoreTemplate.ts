import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StoreTemplate =
  | "classic" | "fashion" | "stylish" | "luxury" | "editorial" | "vibrant"
  | "tech" | "sport" | "gaming" | "boutique"
  | "noirGold" | "emeraldGold" | "midnightSapphire" | "roseAmethyst";

/**
 * Reads the visual template chosen by the store owner from header_settings.
 * Falls back to "classic" while loading or when no row exists.
 */
export function useStoreTemplate(ownerId?: string | null): StoreTemplate {
  const [template, setTemplate] = useState<StoreTemplate>("classic");

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    supabase
      .from("header_settings")
      .select("template")
      .eq("owner_id", ownerId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const t = (data as any).template;
        const allowed: StoreTemplate[] = ["classic","fashion","stylish","luxury","editorial","vibrant","tech","sport","gaming","boutique","noirGold","emeraldGold","midnightSapphire","roseAmethyst"];
        if (allowed.includes(t)) setTemplate(t);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  return template;
}

/** Reads the optional custom background color (hex) for the store's theme. */
export function useStoreBgColor(ownerId?: string | null): string | null {
  const [bg, setBg] = useState<string | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    supabase
      .from("header_settings")
      .select("bg_color")
      .eq("owner_id", ownerId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const c = (data as any).bg_color;
        if (typeof c === "string" && c.startsWith("#")) setBg(c);
      });
    return () => { cancelled = true; };
  }, [ownerId]);
  return bg;
}
