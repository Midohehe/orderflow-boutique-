import { isPlatformSignupPath } from "./publicPaths";

type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: Pixel;
  loaded: boolean;
  version: string;
};

export const isPlatformMarketingPath = (path: string) => path === "/" || path === "/login" || isPlatformSignupPath(path);
let platformPixelLoaded = false;
let initializedId: string | null = null;
let lastView: string | null = null;

// A fresh document keeps the platform and merchants' independent pixel queues apart.
export function needsPixelDocumentReset(path: string): boolean {
  return isPlatformMarketingPath(path) || path.startsWith("/dashboard") || path === "/auth/confirm"
    ? Boolean(window.fbq && !platformPixelLoaded)
    : platformPixelLoaded;
}

export function initializePlatformPixel(id: string): boolean {
  if (!/^\d{5,20}$/.test(id)) return false;
  if (!window.fbq) {
    const pixel: Pixel = Object.assign(function (...args: unknown[]) {
      if (pixel.callMethod) pixel.callMethod(...args);
      else pixel.queue.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
    pixel.push = pixel;
    window.fbq = pixel;
    window._fbq = pixel;
    platformPixelLoaded = true;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  if (!platformPixelLoaded) return false;
  if (initializedId !== id) {
    window.fbq("set", "autoConfig", false, id);
    window.fbq("init", id);
    initializedId = id;
  }
  return true;
}

export function trackPlatformPageView(id: string, navigationKey: string): void {
  if (!isPlatformMarketingPath(window.location.pathname)) return;
  if (!initializePlatformPixel(id)) return;
  const view = `${id}:${navigationKey}`;
  if (lastView === view) return;
  window.fbq("trackSingle", id, "PageView");
  lastView = view;
}
