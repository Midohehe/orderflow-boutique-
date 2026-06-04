/** Routes that should skip dashboard auth, store context, and PWA for faster first paint. */
export function isPublicPerformancePath(pathname: string): boolean {
  return (
    pathname.startsWith("/p/") ||
    pathname === "/p" ||
    pathname.startsWith("/store") ||
    pathname === "/thank-you"
  );
}
