import Image from "next/image";
import Link from "next/link";
import type { LandingContent } from "@/lib/landing-content";

type HeroProps = LandingContent["hero"];

export function Hero({ eyebrow, title, subtitle, ctaPrimary, ctaSecondary, image }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24 lg:gap-16">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-600">{subtitle}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              {ctaPrimary}
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {ctaSecondary}
            </Link>
          </div>
        </div>

        <figure className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xl">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="h-full w-full object-cover"
          />
        </figure>
      </div>
    </section>
  );
}
