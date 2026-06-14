import {
  buildLandingSrcSet,
  isOptimizableLandingImage,
  optimizeLandingImageUrl,
} from "@/lib/landingImageUrl";

type LandingImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** LCP hero — eager load + fetchPriority high */
  priority?: boolean;
  sizes?: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
};

export function LandingImage({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes = "(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 480px",
  className,
  onClick,
}: LandingImageProps) {
  const imgProps = {
    alt,
    width,
    height,
    sizes,
    className,
    onClick,
    loading: (priority ? "eager" : "lazy") as "eager" | "lazy",
    decoding: "async" as const,
    ...(priority ? { fetchPriority: "high" as const } : {}),
  };

  if (!src) return null;

  if (isOptimizableLandingImage(src)) {
    // Hero (priority) images are displayed near-full-width on mobile (~640px at
    // DPR 1.75). Offer smaller candidates so phones don't download an oversized
    // 800px+ asset; thumbnails keep their fixed small widths.
    const candidateWidths = priority
      ? [Math.round(width / 2), Math.round(width * 0.8), width, Math.round(width * 1.35)]
      : [width, Math.round(width * 1.5), width * 2];
    const webpSrcSet = buildLandingSrcSet(src, candidateWidths, {
      height,
      format: "webp",
    });
    const fallbackSrc = optimizeLandingImageUrl(src, { width, height, format: "origin" });

    // `display: contents` makes the <picture> wrapper layout-transparent so the
    // inner <img>'s sizing classes (e.g. w-full h-full) resolve against the
    // actual parent container instead of collapsing to the inline <picture>.
    return (
      <picture style={{ display: "contents" }}>
        <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
        <img src={fallbackSrc} {...imgProps} />
      </picture>
    );
  }

  return <img src={src} {...imgProps} />;
}
