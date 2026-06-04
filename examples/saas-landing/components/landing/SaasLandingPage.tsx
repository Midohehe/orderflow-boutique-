import type { LandingContent } from "@/lib/landing-content";
import { Hero } from "./Hero";

type Props = {
  content: LandingContent;
};

export function SaasLandingPage({ content }: Props) {
  return (
    <main>
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-bold text-slate-900">Platform</span>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#pricing" className="hover:text-slate-900">
              Pricing
            </a>
            <a href="/login" className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
              Sign in
            </a>
          </div>
        </nav>
      </header>

      <Hero {...content.hero} />

      <section id="features" className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <ul className="grid gap-8 md:grid-cols-3">
          {content.features.map((feature) => (
            <li key={feature.title} className="rounded-2xl border border-slate-200 p-6">
              <h2 className="font-display text-xl font-bold text-slate-900">{feature.title}</h2>
              <p className="mt-3 text-slate-600">{feature.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-slate-100 bg-slate-50">
        <dl className="mx-auto grid max-w-6xl grid-cols-3 gap-6 px-6 py-12 text-center">
          {content.stats.map((stat) => (
            <div key={stat.label}>
              <dt className="font-display text-3xl font-extrabold text-brand-600">{stat.value}</dt>
              <dd className="mt-1 text-sm text-slate-600">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Platform. Built with Next.js SSG + ISR.
      </footer>
    </main>
  );
}
