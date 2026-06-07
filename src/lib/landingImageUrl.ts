/** Supabase Storage → render/image (WebP + resize) for faster LCP on landing pages. */

const SUPABASE_PUBLIC_OBJECT =
  /^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+)$/i;

const SUPABASE_STORAGE =
  /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\//i;

export type LandingImageOptions = {
  width: number;
  height?: number;
  quality?: number;
  format?: "webp" | "origin";
  resize?: "cover" | "contain" | "fill";
};

export function isOptimizableLandingImage(src: string): boolean {
  return SUPABASE_PUBLIC_OBJECT.test(src || "");
}

function isSupabaseStorageUrl(src: string): boolean {
  return SUPABASE_STORAGE.test(src || "");
}

/** Route Supabase storage URLs through Cloudflare Worker `/cdn/img` (edge-cached). */
export function wrapLandingCdnUrl(supabaseUrl: string, publicHost?: string | null): string {
  if (!supabaseUrl || !isSupabaseStorageUrl(supabaseUrl)) return supabaseUrl;
  if (typeof window !== "undefined" && import.meta.env?.DEV) return supabaseUrl;

  const path = `/cdn/img?u=${encodeURIComponent(supabaseUrl)}`;
  if (publicHost) return `https://${publicHost}${path}`;
  return path;
}

export function optimizeLandingImageUrl(
  src: string,
  opts: LandingImageOptions,
  publicHost?: string | null
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

export function buildLandingSrcSet(
  src: string,
  widths: number[],
  opts: Omit<LandingImageOptions, "width"> = {},
  publicHost?: string | null
): string {
  const unique = [...new Set(widths.filter((w) => w > 0))].sort((a, b) => a - b);
  return unique
    .map((w) => `${optimizeLandingImageUrl(src, { ...opts, width: w, format: "webp" }, publicHost)} ${w}w`)
    .join(", ");
}

/** Hero LCP defaults — matches common breakpoints. */
export const LANDING_HERO_WIDTHS = [480, 640, 800, 960] as const;
export const LANDING_THUMB_WIDTHS = [80, 160] as const;

export function landingHeroPreloadHref(src: string, publicHost?: string | null): string {
  if (!src) return src;
  if (isOptimizableLandingImage(src)) {
    return optimizeLandingImageUrl(src, { width: 800, format: "webp" }, publicHost);
  }
  return wrapLandingCdnUrl(src, publicHost);
}
