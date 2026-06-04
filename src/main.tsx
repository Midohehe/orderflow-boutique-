import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./hooks/useTheme";
import { isPublicPerformancePath } from "./lib/publicPaths";

initTheme();
createRoot(document.getElementById("root")!).render(<App />);

// PWA service worker — skip on conversion pages (faster first load) and in iframes
(() => {
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const skipPwa = inIframe || isPublicPerformancePath(window.location.pathname);
  if (skipPwa) {
    if (!inIframe) return;
    (async () => {
      try {
        const rs = await navigator.serviceWorker?.getRegistrations();
        const had = rs && rs.length > 0;
        await Promise.all((rs || []).map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if (had) location.reload();
      } catch {}
    })();
    return;
  }
  if ("serviceWorker" in navigator) {
    import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({ immediate: true });
    }).catch(() => {});
  }
})();
