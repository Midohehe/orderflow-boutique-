import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StoreTemplate = "classic" | "fashion" | "stylish" | "luxury" | "editorial" | "vibrant" | "tech" | "sport" | "gaming" | "boutique";

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
        const allowed: StoreTemplate[] = ["classic", "fashion", "stylish", "luxury", "editorial", "vibrant", "tech", "sport", "gaming", "boutique"];
        if (allowed.includes(t)) setTemplate(t);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  return template;
}
