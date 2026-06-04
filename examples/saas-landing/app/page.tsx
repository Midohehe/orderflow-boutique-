import { SaasLandingPage } from "@/components/landing/SaasLandingPage";
import { getLandingContent } from "@/lib/landing-content";

/**
 * ISR: page is statically generated at build time, then revalidated in the
 * background every hour. CDN serves cached HTML → ~0ms origin response.
 */
export const revalidate = 3600;

/** Force static generation (no per-request dynamic APIs). */
export const dynamic = "force-static";

export default async function HomePage() {
  const content = await getLandingContent();
  return <SaasLandingPage content={content} />;
}
