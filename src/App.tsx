import { lazy, Suspense, useEffect } from "react";

import { Toaster } from "@/components/ui/toaster";

import { Toaster as Sonner } from "@/components/ui/sonner";

import { TooltipProvider } from "@/components/ui/tooltip";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import { Loader2 } from "lucide-react";

import { AuthProvider } from "@/hooks/useAuth";

import { StoreProvider } from "@/hooks/useStoreContext";

import { EasyOrdersEnabledProvider } from "@/hooks/useEasyOrdersEnabled";

import ProtectedRoute from "@/components/ProtectedRoute";

import { supabase } from "@/integrations/supabase/client";

import Login from "./pages/Login";

import Home from "./pages/Home";

import DashboardLayout from "./components/DashboardLayout";

import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

import PublicRoutes from "./PublicRoutes";

import { isPublicPerformancePath } from "@/lib/publicPaths";



const Dashboard = lazy(() => import("./pages/Dashboard"));

const Products = lazy(() => import("./pages/Products"));

const TrashedProducts = lazy(() => import("./pages/TrashedProducts"));

const EasyOrdersProducts = lazy(() => import("./pages/EasyOrdersProducts"));

const Orders = lazy(() => import("./pages/Orders"));

const PrepLists = lazy(() => import("./pages/PrepLists"));

const PrepOrders = lazy(() => import("./pages/PrepOrders"));

const PixelSettings = lazy(() => import("./pages/PixelSettings"));

const OrderFormSettings = lazy(() => import("./pages/OrderFormSettings"));

const ThankYouSettings = lazy(() => import("./pages/ThankYouSettings"));

const CurrencySettings = lazy(() => import("./pages/CurrencySettings"));
const ThemeSettings = lazy(() => import("./pages/ThemeSettings"));

const FinancialAccounts = lazy(() => import("./pages/FinancialAccounts"));

const ProfitLossReport = lazy(() => import("./pages/ProfitLossReport"));

const CashFlowReport = lazy(() => import("./pages/CashFlowReport"));

const ShippingKPI = lazy(() => import("./pages/ShippingKPI"));

const Settlements = lazy(() => import("./pages/Settlements"));

const SettlementDetail = lazy(() => import("./pages/SettlementDetail"));

const Returns = lazy(() => import("./pages/Returns"));

const ReturnDetail = lazy(() => import("./pages/ReturnDetail"));

const StockMovements = lazy(() => import("./pages/StockMovements"));

const Inventory = lazy(() => import("./pages/Inventory"));

const Safes = lazy(() => import("./pages/Safes"));

const Expenses = lazy(() => import("./pages/Expenses"));

const Purchases = lazy(() => import("./pages/Purchases"));

const AdWallets = lazy(() => import("./pages/AdWallets"));

const HeaderSettings = lazy(() => import("./pages/HeaderSettings"));

const ShippingSettings = lazy(() => import("./pages/ShippingSettings"));

const WhatsAppPage = lazy(() => import("./pages/WhatsAppPage"));

const AITrainingSettings = lazy(() => import("./pages/AITrainingSettings"));

const StickerDesigner = lazy(() => import("./pages/StickerDesigner"));

const PrintBarcodes = lazy(() => import("./pages/PrintBarcodes"));

const Settings = lazy(() => import("./pages/Settings"));

const AccountSettings = lazy(() => import("./pages/AccountSettings"));

const Wallet = lazy(() => import("./pages/Wallet"));

const MyPlan = lazy(() => import("./pages/MyPlan"));

const AdminCards = lazy(() => import("./pages/AdminCards"));

const AdminStores = lazy(() => import("./pages/AdminStores"));

const AdminStoreDetail = lazy(() => import("./pages/AdminStoreDetail"));

const AdminFacebookApp = lazy(() => import("./pages/AdminFacebookApp"));

const FacebookAds = lazy(() => import("./pages/FacebookAds"));

const FacebookPerformance = lazy(() => import("./pages/FacebookPerformance"));

const PermissionGroups = lazy(() => import("./pages/PermissionGroups"));

const StoreMembers = lazy(() => import("./pages/StoreMembers"));

const ConfirmationCenter = lazy(() => import("./pages/ConfirmationCenter"));

const ConfirmationSettings = lazy(() => import("./pages/ConfirmationSettings"));

const ShippingErrorAliases = lazy(() => import("./pages/ShippingErrorAliases"));

const ShippingZones = lazy(() => import("./pages/ShippingZones"));

const ShippingPriceLists = lazy(() => import("./pages/ShippingPriceLists"));

const MyStores = lazy(() => import("./pages/MyStores"));

const PuckBuilder = lazy(() => import("./pages/PuckBuilder"));

const LandingTemplates = lazy(() => import("./pages/LandingTemplates"));

const NotFound = lazy(() => import("./pages/NotFound"));

const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const Privacy = lazy(() => import("./pages/Privacy"));



const queryClient = new QueryClient({

  defaultOptions: {

    queries: {

      staleTime: 60_000,

      gcTime: 5 * 60_000,

      refetchOnWindowFocus: false,

      retry: 1,

    },

  },

});



const PageFallback = () => (

  <div className="flex items-center justify-center min-h-[60vh]">

    <Loader2 className="w-8 h-8 animate-spin text-primary" />

  </div>

);



const DashboardRoutes = () => (

  <Suspense fallback={<PageFallback />}>

    <Routes>

      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/privacy" element={<Privacy />} />

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

        <Route path="products/trash" element={<TrashedProducts />} />

        <Route path="easyorders-products" element={<EasyOrdersProducts />} />

        <Route path="orders" element={<Orders />} />

        <Route path="prep-lists" element={<PrepLists />} />

        <Route path="prep-orders" element={<PrepOrders />} />

        <Route path="print-barcodes" element={<PrintBarcodes />} />

        <Route path="confirmation" element={<ConfirmationCenter />} />

        <Route path="confirmation/settings" element={<ConfirmationSettings />} />

        <Route path="financial" element={<FinancialAccounts />} />

        <Route path="profit-loss" element={<ProfitLossReport />} />

        <Route path="cash-flow" element={<CashFlowReport />} />

        <Route path="shipping-kpi" element={<ShippingKPI />} />

        <Route path="inventory" element={<Inventory />} />

        <Route path="safes" element={<Safes />} />

        <Route path="expenses" element={<Expenses />} />

        <Route path="purchases" element={<Purchases />} />

        <Route path="ad-wallets" element={<AdWallets />} />

        <Route path="settlements" element={<Settlements />} />

        <Route path="settlements/:id" element={<SettlementDetail />} />

        <Route path="returns" element={<Returns />} />

        <Route path="returns/:id" element={<ReturnDetail />} />

        <Route path="stock-movements" element={<StockMovements />} />

        <Route path="pixel" element={<PixelSettings />} />

        <Route path="order-form" element={<OrderFormSettings />} />

        <Route path="thank-you" element={<ThankYouSettings />} />

        <Route path="currency" element={<CurrencySettings />} />
        <Route path="theme" element={<ThemeSettings />} />

        <Route path="header" element={<HeaderSettings />} />

        <Route path="landing-templates" element={<LandingTemplates />} />

        <Route path="page-builder" element={<PuckBuilder />} />

        <Route path="shipping" element={<ShippingSettings />} />

        <Route path="shipping-error-aliases" element={<ShippingErrorAliases />} />

        <Route path="shipping-zones" element={<ShippingZones />} />

        <Route path="shipping-price-lists" element={<ShippingPriceLists />} />

        <Route path="my-stores" element={<MyStores />} />

        <Route path="whatsapp" element={<WhatsAppPage />} />

        <Route path="ai-training" element={<AITrainingSettings />} />

        <Route path="sticker-designer" element={<StickerDesigner />} />

        <Route path="settings" element={<Settings />} />

        <Route path="account" element={<AccountSettings />} />

        <Route path="wallet" element={<Wallet />} />

        <Route path="my-plan" element={<MyPlan />} />

        <Route path="admin-cards" element={<AdminCards />} />

        <Route path="stores" element={<AdminStores />} />

        <Route path="stores/:userId" element={<AdminStoreDetail />} />

        <Route path="facebook-app" element={<AdminFacebookApp />} />

        <Route path="facebook-ads" element={<FacebookAds />} />

        <Route path="facebook-performance" element={<FacebookPerformance />} />

        <Route path="permissions" element={<PermissionGroups />} />

        <Route path="members" element={<StoreMembers />} />

      </Route>

      <Route path="*" element={<NotFound />} />

    </Routes>

  </Suspense>

);



const AppShell = () => {

  const { pathname } = useLocation();

  const publicPerf = isPublicPerformancePath(pathname);



  useEffect(() => {

    if (publicPerf) return;

    supabase.from("app_settings").select("system_name").limit(1).maybeSingle().then(({ data }) => {

      if (data?.system_name) document.title = data.system_name;

    });

  }, [publicPerf]);



  if (publicPerf) {

    return (

      <QueryClientProvider client={queryClient}>

        <PublicRoutes />

      </QueryClientProvider>

    );

  }



  return (

    <QueryClientProvider client={queryClient}>

      <AuthProvider>

        <StoreProvider>

          <EasyOrdersEnabledProvider>

            <TooltipProvider>

              <Toaster />

              <Sonner />

              <PWAInstallPrompt />

              <DashboardRoutes />

            </TooltipProvider>

          </EasyOrdersEnabledProvider>

        </StoreProvider>

      </AuthProvider>

    </QueryClientProvider>

  );

};



const App = () => (

  <BrowserRouter>

    <AppShell />

  </BrowserRouter>

);



export default App;


