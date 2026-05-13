import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import Login from "./pages/Login";
import DashboardLayout from "./components/DashboardLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const EasyOrdersProducts = lazy(() => import("./pages/EasyOrdersProducts"));
const Orders = lazy(() => import("./pages/Orders"));
const PixelSettings = lazy(() => import("./pages/PixelSettings"));
const OrderFormSettings = lazy(() => import("./pages/OrderFormSettings"));
const ThankYouSettings = lazy(() => import("./pages/ThankYouSettings"));
const CurrencySettings = lazy(() => import("./pages/CurrencySettings"));
const FinancialAccounts = lazy(() => import("./pages/FinancialAccounts"));
const Settlements = lazy(() => import("./pages/Settlements"));
const SettlementDetail = lazy(() => import("./pages/SettlementDetail"));
const Returns = lazy(() => import("./pages/Returns"));
const ReturnDetail = lazy(() => import("./pages/ReturnDetail"));
const StockMovements = lazy(() => import("./pages/StockMovements"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Safes = lazy(() => import("./pages/Safes"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Purchases = lazy(() => import("./pages/Purchases"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const StoreFront = lazy(() => import("./pages/StoreFront"));
const HeaderSettings = lazy(() => import("./pages/HeaderSettings"));
const ShippingSettings = lazy(() => import("./pages/ShippingSettings"));
const WhatsAppPage = lazy(() => import("./pages/WhatsAppPage"));
const Settings = lazy(() => import("./pages/Settings"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  useEffect(() => {
    supabase.from("app_settings").select("system_name").limit(1).maybeSingle().then(({ data }) => {
      if (data?.system_name) document.title = data.system_name;
    });
  }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/store" element={<StoreFront />} />
              <Route path="/store/:username" element={<StoreFront />} />
              <Route path="/p/:slug" element={<LandingPage />} />
              <Route path="/p/:username/:slug" element={<LandingPage />} />
              <Route path="/thank-you" element={<ThankYou />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="easyorders-products" element={<EasyOrdersProducts />} />
                <Route path="orders" element={<Orders />} />
                <Route path="financial" element={<FinancialAccounts />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="safes" element={<Safes />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="settlements" element={<Settlements />} />
                <Route path="settlements/:id" element={<SettlementDetail />} />
                <Route path="returns" element={<Returns />} />
                <Route path="returns/:id" element={<ReturnDetail />} />
                <Route path="stock-movements" element={<StockMovements />} />
                <Route path="pixel" element={<PixelSettings />} />
                <Route path="order-form" element={<OrderFormSettings />} />
                <Route path="thank-you" element={<ThankYouSettings />} />
                <Route path="currency" element={<CurrencySettings />} />
                <Route path="header" element={<HeaderSettings />} />
                <Route path="shipping" element={<ShippingSettings />} />
                <Route path="whatsapp" element={<WhatsAppPage />} />
                <Route path="settings" element={<Settings />} />
                <Route path="account" element={<AccountSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
