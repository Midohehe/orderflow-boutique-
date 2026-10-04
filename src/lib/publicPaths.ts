export const isPlatformSignupPath = (path: string) => path === "/register" || path === "/register/";

/** Routes that skip dashboard/store context and PWA for faster first paint. */
export function isPublicPerformancePath(pathname: string): boolean {
  return (
    isPlatformSignupPath(pathname) ||
    pathname.startsWith("/p/") ||
    pathname === "/p" ||
    pathname.startsWith("/store") ||
    pathname === "/thank-you"
  );
}
