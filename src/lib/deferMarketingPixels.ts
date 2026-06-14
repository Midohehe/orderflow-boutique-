/** Run marketing pixels after first paint — never block LCP. */
export function deferMarketingPixels(run: () => void): void {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    run();
  };

  const onInteract = () => {
    window.removeEventListener("scroll", onInteract, opts);
    window.removeEventListener("pointerdown", onInteract, opts);
    window.removeEventListener("keydown", onInteract, opts);
    fire();
  };
  const opts: AddEventListenerOptions = { capture: true, passive: true, once: true };

  window.addEventListener("scroll", onInteract, opts);
  window.addEventListener("pointerdown", onInteract, opts);
  window.addEventListener("keydown", onInteract, opts);

  window.addEventListener(
    "load",
    () => {
      window.setTimeout(fire, 4000);
    },
    { once: true },
  );

  if (typeof (window as any).requestIdleCallback === "function") {
    (window as any).requestIdleCallback(fire, { timeout: 8000 });
  }
}
