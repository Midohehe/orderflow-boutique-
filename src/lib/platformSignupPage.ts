import { supabase } from "@/integrations/supabase/client";
import { parseSignupContent, platformSignupSchema, type PlatformSignupContent } from "./platformSignupContent";

export async function fetchPublishedSignupPage(): Promise<PlatformSignupContent> {
  const { data, error } = await supabase.rpc("get_platform_signup_page");
  if (error) throw error;
  return parseSignupContent(data);
}

export async function fetchSignupPageEditor() {
  const { data, error } = await supabase.from("platform_signup_page")
    .select("draft,published,revision,updated_at,published_at").eq("id", true).single();
  if (error) throw error;
  return { ...data, draft: parseSignupContent(data.draft) };
}

export async function saveSignupPage(content: PlatformSignupContent, publish: boolean, revision: number) {
  const { data, error } = await supabase.rpc("save_platform_signup_page", {
    _content: platformSignupSchema.parse(content), _publish: publish, _expected_revision: revision,
  });
  if (error) throw error;
  return data;
}
