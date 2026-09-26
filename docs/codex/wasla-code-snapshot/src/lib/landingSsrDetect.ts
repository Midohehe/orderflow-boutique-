/** True when edge SSR already painted a fallback shell (outside #root). */
export function hasLandingSsrShell(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector("#ssr-fallback, #ssr-puck-shell, #ssr-shell");
}

export function dismissLandingSsrShell(): void {
  if (typeof document === "undefined") return;
  // Remove the wrapper and any shell variant directly, so React's first real
  // paint never overlaps the edge-rendered placeholder (no duplicate flash).
  document
    .querySelectorAll("#ssr-fallback, #ssr-puck-shell, #ssr-shell")
    .forEach((el) => el.remove());
}
