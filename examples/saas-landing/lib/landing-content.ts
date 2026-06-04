export type LandingContent = {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    image: {
      src: string;
      alt: string;
      width: number;
      height: number;
    };
  };
  features: Array<{
    title: string;
    description: string;
  }>;
  stats: Array<{ value: string; label: string }>;
};

/** Static marketing copy — safe to bake at build time (SSG). */
export const landingContent: LandingContent = {
  hero: {
    eyebrow: "Ship faster. Scale smarter.",
    title: "The operating system for modern SaaS teams",
    subtitle:
      "Launch landing pages, capture leads, and automate fulfillment from one high-performance workspace.",
    ctaPrimary: "Start free trial",
    ctaSecondary: "Book a demo",
    image: {
      src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      alt: "SaaS analytics dashboard preview",
      width: 1200,
      height: 900,
    },
  },
  features: [
    {
      title: "Edge-first delivery",
      description: "Static pages served from the CDN with ISR for fresh content without cold starts.",
    },
    {
      title: "Conversion-ready UI",
      description: "Minimal DOM, optimized images, and zero layout shift typography out of the box.",
    },
    {
      title: "Built for operators",
      description: "Orders, inventory, and shipping workflows in one cohesive platform.",
    },
  ],
  stats: [
    { value: "99.9%", label: "Uptime SLA" },
    { value: "<100ms", label: "TTFB on CDN" },
    { value: "40+", label: "Integrations" },
  ],
};

/** Optional CMS fetch — cached + revalidated via ISR in page.tsx. */
export async function getLandingContent(): Promise<LandingContent> {
  return landingContent;
}
