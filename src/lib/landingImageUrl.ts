/** Supabase Storage → render/image (WebP + resize) for faster LCP on landing pages. */

const SUPABASE_PUBLIC_OBJECT =
  /^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+)$/i;

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

export function optimizeLandingImageUrl(src: string, opts: LandingImageOptions): string {
  if (!src) return src;
  const match = src.match(SUPABASE_PUBLIC_OBJECT);
  if (!match) return src;

  const [, origin, objectPath] = match;
  const params = new URLSearchParams();
  params.set("width", String(Math.round(opts.width)));
  if (opts.height) params.set("height", String(Math.round(opts.height)));
  params.set("quality", String(opts.quality ?? 82));
  params.set("resize", opts.resize ?? "contain");
  if (opts.format === "webp") params.set("format", "webp");

  return `${origin}/storage/v1/render/image/public/${objectPath}?${params.toString()}`;
}

export function buildLandingSrcSet(
  src: string,
  widths: number[],
  opts: Omit<LandingImageOptions, "width"> = {}
): string {
  const unique = [...new Set(widths.filter((w) => w > 0))].sort((a, b) => a - b);
  return unique
    .map((w) => `${optimizeLandingImageUrl(src, { ...opts, width: w, format: "webp" })} ${w}w`)
    .join(", ");
}

/** Hero LCP defaults — matches common breakpoints. */
export const LANDING_HERO_WIDTHS = [480, 640, 800, 960] as const;
export const LANDING_THUMB_WIDTHS = [80, 160] as const;

export function landingHeroPreloadHref(src: string): string {
  if (!src) return src;
  if (isOptimizableLandingImage(src)) {
    return optimizeLandingImageUrl(src, { width: 800, format: "webp" });
  }
  return src;
}
