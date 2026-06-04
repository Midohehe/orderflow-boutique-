import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const StoreFront = lazy(() => import("@/pages/StoreFront"));
const ThankYou = lazy(() => import("@/pages/ThankYou"));

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

/** Minimal shell for conversion pages — no AuthProvider, StoreProvider, or PWA. */
export default function PublicRoutes() {
  return (
    <>
      <Toaster />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/p/:slug" element={<LandingPage />} />
          <Route path="/p/:username/:slug" element={<LandingPage />} />
          <Route path="/store" element={<StoreFront />} />
          <Route path="/store/:username" element={<StoreFront />} />
          <Route path="/thank-you" element={<ThankYou />} />
        </Routes>
      </Suspense>
    </>
  );
}
