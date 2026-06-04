import type { SupabaseClient } from "@supabase/supabase-js";
import type { ThemeApplyOptions, ThemePackage } from "./types";

export async function applyThemePackage(
  supabase: SupabaseClient,
  params: {
    ownerId: string;
    storeId: string;
    settingsId: string;
    pkg: ThemePackage;
    options: ThemeApplyOptions;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ownerId, storeId, settingsId, pkg, options } = params;

  if (options.applyTokens) {
    const { error } = await supabase
      .from("store_settings")
      .update({
        theme_tokens: pkg.tokens as unknown as Record<string, unknown>,
        theme_custom_css: pkg.customCss ?? null,
        theme_package_id: pkg.id,
        theme_config: {
          buttonStyle: pkg.tokens.buttonStyle,
          headerStyle: pkg.tokens.headerStyle,
          shadow: pkg.tokens.shadow,
        },
      } as never)
      .eq("id", settingsId);
    if (error) return { ok: false, error: error.message };
  }

  if (options.applyStoreHome && pkg.storeHome) {
    const { data: existing } = await supabase
      .from("store_page_layouts" as never)
      .select("id")
      .eq("store_id", storeId)
      .eq("page_key", "home")
      .maybeSingle();

    const payload = {
      store_id: storeId,
      owner_id: ownerId,
      page_key: "home",
      puck_data: pkg.storeHome,
      is_published: true,
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("store_page_layouts" as never)
        .update(payload as never)
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("store_page_layouts" as never).insert(payload as never);
      if (error) return { ok: false, error: error.message };
    }
  }

  if (options.applyLandingTemplates && pkg.landingTemplates?.length) {
    if (options.replaceExistingTemplates) {
      await supabase
        .from("landing_page_templates" as never)
        .delete()
        .eq("store_id", storeId);
    }

    let hasDefault = false;
    const { data: existingTemplates } = await supabase
      .from("landing_page_templates" as never)
      .select("id, is_default")
      .eq("store_id", storeId);
    hasDefault = (existingTemplates || []).some((t: { is_default?: boolean }) => t.is_default);

    for (const tpl of pkg.landingTemplates) {
      const isDefault = tpl.isDefault && !hasDefault;
      if (isDefault) hasDefault = true;
      const { error } = await supabase.from("landing_page_templates" as never).insert({
        name: tpl.name,
        store_id: storeId,
        owner_id: ownerId,
        puck_data: tpl.puckData,
        is_default: isDefault,
      } as never);
      if (error) return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

export async function exportCurrentStoreTheme(
  supabase: SupabaseClient,
  params: { ownerId: string; storeId: string; storeName: string }
) {
  const { ownerId, storeId, storeName } = params;

  const [settingsRes, layoutRes, templatesRes] = await Promise.all([
    supabase
      .from("store_settings")
      .select("theme_tokens, theme_custom_css, theme_package_id")
      .eq("owner_id", ownerId)
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .from("store_page_layouts" as never)
      .select("puck_data")
      .eq("store_id", storeId)
      .eq("page_key", "home")
      .maybeSingle(),
    supabase
      .from("landing_page_templates" as never)
      .select("name, puck_data, is_default")
      .eq("store_id", storeId),
  ]);

  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    name: storeName,
    packageId: (settingsRes.data as { theme_package_id?: string })?.theme_package_id ?? null,
    tokens: (settingsRes.data as { theme_tokens?: unknown })?.theme_tokens ?? {},
    customCss: (settingsRes.data as { theme_custom_css?: string })?.theme_custom_css ?? null,
    storeHome: (layoutRes.data as { puck_data?: unknown })?.puck_data ?? null,
    landingTemplates: ((templatesRes.data || []) as Array<{ name: string; puck_data: unknown; is_default?: boolean }>).map(
      (t) => ({
        name: t.name,
        puckData: t.puck_data,
        isDefault: t.is_default,
      })
    ),
  };
}
