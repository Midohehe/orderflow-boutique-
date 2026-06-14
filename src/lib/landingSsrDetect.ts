/** True when edge SSR already painted a fallback shell (outside #root). */
export function hasLandingSsrShell(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector("#ssr-fallback, #ssr-puck-shell, #ssr-shell");
}

export function dismissLandingSsrShell(): void {
  document.getElementById("ssr-fallback")?.remove();
}
