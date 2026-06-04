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
    const webpSrcSet = buildLandingSrcSet(src, [width, Math.round(width * 1.5), width * 2], {
      height,
      format: "webp",
    });
    const fallbackSrc = optimizeLandingImageUrl(src, { width, height, format: "origin" });

    return (
      <picture>
        <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
        <img src={fallbackSrc} {...imgProps} />
      </picture>
    );
  }

  return <img src={src} {...imgProps} />;
}
