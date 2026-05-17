import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShippingErrorAlias {
  pattern: string;
  match_type: string;
  short_label: string;
}

let cache: ShippingErrorAlias[] | null = null;
let cachePromise: Promise<ShippingErrorAlias[]> | null = null;

const fetchAliases = async (): Promise<ShippingErrorAlias[]> => {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = supabase
    .from("shipping_error_aliases")
    .select("pattern, match_type, short_label")
    .then(({ data }) => {
      cache = (data as ShippingErrorAlias[]) || [];
      return cache;
    });
  return cachePromise;
};

export const matchShippingError = (error: string | null | undefined, aliases: ShippingErrorAlias[]): string | null => {
  if (!error) return null;
  for (const a of aliases) {
    try {
      if (a.match_type === "exact" && error.trim() === a.pattern.trim()) return a.short_label;
      if (a.match_type === "regex" && new RegExp(a.pattern, "i").test(error)) return a.short_label;
      if (a.match_type === "contains" && error.toLowerCase().includes(a.pattern.toLowerCase())) return a.short_label;
    } catch {
      // ignore bad regex
    }
  }
  return null;
};

export const useShippingErrorAliases = () => {
  const [aliases, setAliases] = useState<ShippingErrorAlias[]>(cache || []);
  useEffect(() => {
    let mounted = true;
    fetchAliases().then((data) => { if (mounted) setAliases(data); });
    return () => { mounted = false; };
  }, []);
  return aliases;
};