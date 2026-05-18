import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./hooks/useTheme";

initTheme();
createRoot(document.getElementById("root")!).render(<App />);

// PWA service worker registration — guarded against iframes and Lovable preview hosts
(() => {
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreview = host.includes("lovableproject.com") || host.includes("lovable.app") && host.includes("id-preview");
  if (inIframe || isPreview) {
    navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    return;
  }
  if ("serviceWorker" in navigator) {
    import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({ immediate: true });
    }).catch(() => {});
  }
})();
