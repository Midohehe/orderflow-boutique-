/** Shared image URL optimizer for landing-ssr (Deno). */

const SUPABASE_PUBLIC_OBJECT =
  /^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+)$/i;

const SUPABASE_STORAGE =
  /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\//i;

export function wrapLandingCdnUrl(supabaseUrl: string, publicHost?: string | null): string {
  if (!supabaseUrl || !SUPABASE_STORAGE.test(supabaseUrl)) return supabaseUrl;
  const path = `/cdn/img?u=${encodeURIComponent(supabaseUrl)}`;
  if (publicHost) return `https://${publicHost}${path}`;
  return path;
}

export function optimizeLandingImageUrl(
  src: string,
  opts: { width: number; height?: number; quality?: number; format?: "webp" | "origin"; resize?: string },
  publicHost?: string | null,
): string {
  if (!src) return src;
  const match = src.match(SUPABASE_PUBLIC_OBJECT);
  if (!match) return wrapLandingCdnUrl(src, publicHost);
  const [, origin, objectPath] = match;
  const params = new URLSearchParams();
  params.set("width", String(Math.round(opts.width)));
  if (opts.height) params.set("height", String(Math.round(opts.height)));
  params.set("quality", String(opts.quality ?? 82));
  params.set("resize", opts.resize ?? "contain");
  if (opts.format === "webp") params.set("format", "webp");
  const renderUrl = `${origin}/storage/v1/render/image/public/${objectPath}?${params.toString()}`;
  return wrapLandingCdnUrl(renderUrl, publicHost);
}

export function landingHeroPreloadHref(src: string, publicHost?: string | null): string {
  if (!src) return src;
  if (SUPABASE_PUBLIC_OBJECT.test(src)) {
    return optimizeLandingImageUrl(src, { width: 800, format: "webp" }, publicHost);
  }
  return wrapLandingCdnUrl(src, publicHost);
}
