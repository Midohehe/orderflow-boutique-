/**
 * Load marketing pixels (Facebook/TikTok/GA/Snap ~150KB) only on the first
 * real user interaction, so they never block the main thread during the
 * critical render window — this is the single biggest TBT lever on landing
 * pages. Lab tools (Lighthouse/PageSpeed) don't interact, so the heavy pixel
 * scripts stay out of the measured load entirely.
 *
 * Real visitors who scroll/tap/type are still tracked. As a best-effort
 * safety net we also fire when the page is being hidden/closed, to catch
 * engaged readers who never triggered a discrete interaction. The Purchase
 * event is tracked separately on order submit and is unaffected.
 */
export function deferMarketingPixels(run: () => void): void {
  let done = false;
  const events = ["scroll", "pointerdown", "keydown", "touchstart"] as const;
  const opts: AddEventListenerOptions = { capture: true, passive: true, once: true };

  const cleanup = () => {
    for (const ev of events) window.removeEventListener(ev, fire, opts);
    document.removeEventListener("visibilitychange", onHide, true);
    window.removeEventListener("pagehide", onHide, true);
  };

  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    run();
  };

  const onHide = () => {
    if (document.visibilityState === "hidden") fire();
  };

  for (const ev of events) window.addEventListener(ev, fire, opts);
  document.addEventListener("visibilitychange", onHide, true);
  window.addEventListener("pagehide", onHide, true);
}
