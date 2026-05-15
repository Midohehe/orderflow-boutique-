import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { 
  Package, ShoppingCart, LogOut, Menu, X, FileText, Crosshair, Heart, Trash2,
  LayoutDashboard, DollarSign, Calculator, Store, LayoutTemplate, Truck, Settings as SettingsIcon, UserCircle, Wallet, Undo2, Boxes, ArrowLeftRight, Receipt, ShoppingBag, MessageCircle, Printer, ChevronDown, ChevronLeft, Shield, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const baseMenuGroups = [
  {
    label: null,
    items: [
      { icon: LayoutDashboard, label: "لوحة التحكم", path: "/dashboard", external: false, adminOnly: false, dynamicStore: false },
      { icon: Store, label: "مشاهدة المتجر", path: "/store", external: true, adminOnly: false, dynamicStore: true },
      { icon: Wallet, label: "محفظتي", path: "/dashboard/wallet", external: false, adminOnly: false, dynamicStore: false },
    ],
  },
  {
    label: "الطلبيات",
    items: [
      { icon: ShoppingCart, label: "الطلبيات", path: "/dashboard/orders", external: false, adminOnly: false, dynamicStore: false },
      { icon: Undo2, label: "استلام المرتجعات", path: "/dashboard/returns", external: false, adminOnly: false, dynamicStore: false },
    ],
  },
  {
    label: "المنتجات",
    items: [
      { icon: Package, label: "المنتجات", path: "/dashboard/products", external: false, adminOnly: false, dynamicStore: false },
      { icon: Trash2, label: "سلة المحذوفات", path: "/dashboard/products/trash", external: false, adminOnly: false, dynamicStore: false },
      { icon: Boxes, label: "منتجات ايزي اوردرز", path: "/dashboard/easyorders-products", external: false, adminOnly: false, dynamicStore: false },
      { icon: Boxes, label: "المخزون", path: "/dashboard/inventory", external: false, adminOnly: false, dynamicStore: false },
      { icon: ArrowLeftRight, label: "حركة المنتجات", path: "/dashboard/stock-movements", external: false, adminOnly: false, dynamicStore: false },
    ],
  },
  {
    label: "المالية",
    items: [
      { icon: Calculator, label: "الحسابات المالية", path: "/dashboard/financial", external: false, adminOnly: false, dynamicStore: false },
      { icon: Wallet, label: "الخزائن", path: "/dashboard/safes", external: false, adminOnly: false, dynamicStore: false },
      { icon: Receipt, label: "المصروفات", path: "/dashboard/expenses", external: false, adminOnly: false, dynamicStore: false },
      { icon: ShoppingBag, label: "المشتريات", path: "/dashboard/purchases", external: false, adminOnly: false, dynamicStore: false },
      { icon: Wallet, label: "استلام التسويات المالية", path: "/dashboard/settlements", external: false, adminOnly: false, dynamicStore: false },
      { icon: SettingsIcon, label: "كروت الشحن (أدمن)", path: "/dashboard/admin-cards", external: false, adminOnly: true, dynamicStore: false },
      { icon: Store, label: "المتاجر (أدمن)", path: "/dashboard/stores", external: false, adminOnly: true, dynamicStore: false },
      { icon: Shield, label: "الصلاحيات (أدمن)", path: "/dashboard/permissions", external: false, adminOnly: true, dynamicStore: false },
    ],
  },
  {
    label: "إعدادات المتجر",
    items: [
      { icon: Crosshair, label: "إعدادات البيكسل", path: "/dashboard/pixel", external: false, adminOnly: false, dynamicStore: false },
      { icon: FileText, label: "نموذج الطلب", path: "/dashboard/order-form", external: false, adminOnly: false, dynamicStore: false },
      { icon: Heart, label: "صفحة الشكر", path: "/dashboard/thank-you", external: false, adminOnly: false, dynamicStore: false },
      { icon: DollarSign, label: "العملة", path: "/dashboard/currency", external: false, adminOnly: false, dynamicStore: false },
      { icon: LayoutTemplate, label: "هيدر المتجر", path: "/dashboard/header", external: false, adminOnly: false, dynamicStore: false },
      { icon: MessageCircle, label: "WhatsApp", path: "/dashboard/whatsapp", external: false, adminOnly: false, dynamicStore: false },
      { icon: Users, label: "المستخدمون الفرعيون", path: "/dashboard/members", external: false, adminOnly: false, dynamicStore: false, ownerOnly: true },
    ],
  },
  {
    label: "الشحن",
    items: [
      { icon: Truck, label: "شركة الشحن", path: "/dashboard/shipping", external: false, adminOnly: false, dynamicStore: false },
      { icon: Printer, label: "تصميم ستيكر الشحن", path: "/dashboard/sticker-designer", external: false, adminOnly: false, dynamicStore: false },
    ],
  },
];

const adminSettingsItem = {
  icon: SettingsIcon,
  label: "الإعدادات",
  path: "/dashboard/settings",
  external: false,
};

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin, isSubUser, profile } = useUserContext();
  const [storeName, setStoreName] = useState("لوحة التحكم");
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem("sidebar_expanded_groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleGroup = (gi: number) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [gi]: !prev[gi] };
      localStorage.setItem("sidebar_expanded_groups", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      if (!profile?.user_id) return;
      const { data } = await supabase
        .from("header_settings")
        .select("logo_text")
        .eq("owner_id", profile.user_id)
        .limit(1)
        .maybeSingle();
      if (data?.logo_text) setStoreName(data.logo_text);
    })();
  }, [profile?.user_id]);

  const menuGroups = baseMenuGroups.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => !item.adminOnly || isAdmin)
      .filter((item: any) => !item.ownerOnly || !isSubUser)
      .map((item) => {
        if (item.dynamicStore && profile?.username) {
          return { ...item, path: `/store/${profile.username}` };
        }
        return item;
      }),
  }));

  useEffect(() => {
    const syncSidebarWithViewport = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };

    syncSidebarWithViewport();
    window.addEventListener("resize", syncSidebarWithViewport);
    return () => window.removeEventListener("resize", syncSidebarWithViewport);
  }, []);

  const handleLogout = async () => {
    await signOut();
    toast({ title: "تم تسجيل الخروج", description: "نراك قريباً!" });
    navigate("/");
  };

  const handleNavigation = (path: string, external: boolean) => {
    if (external) {
      window.open(path, "_blank");
    } else {
      navigate(path);
      if (window.innerWidth < 768) setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex overflow-x-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 right-0 left-0 z-40 bg-sidebar h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
        <h1 className="text-lg font-bold text-sidebar-foreground truncate">{storeName}</h1>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-foreground/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
           className={cn(
           "fixed inset-y-0 right-0 z-50 bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col max-w-[86vw] shadow-xl md:shadow-none",
          // Mobile: slide in/out
          "md:translate-x-0",
          sidebarOpen ? "translate-x-0 w-64" : "translate-x-full md:translate-x-0 md:w-20",
          // Desktop: always visible
          "md:w-64",
          !sidebarOpen && "md:w-20"
        )}
      >
        {/* Logo - Desktop only */}
        <div className="h-16 hidden md:flex items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-sidebar-foreground truncate">{storeName}</h1>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile: Close button inside sidebar */}
        <div className="h-14 flex md:hidden items-center justify-between px-4 border-b border-sidebar-border">
          <h1 className="text-lg font-bold text-sidebar-foreground truncate">{storeName}</h1>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 sm:p-3 space-y-1 overflow-y-auto min-h-0 overscroll-contain [-webkit-overflow-scrolling:touch]">
          {menuGroups.map((group, gi) => {
            const hasLabel = !!group.label;
            const isExpanded = expandedGroups[gi] ?? !hasLabel;
            const groupHasActive = group.items.some((item) => !item.external && location.pathname === item.path);
            const showItems = !hasLabel || isExpanded || groupHasActive;

            return (
              <div key={gi} className="space-y-1">
                {hasLabel && sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(gi)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  >
                    <span>{group.label}</span>
                    <ChevronLeft className={cn("w-4 h-4 transition-transform", showItems && "-rotate-90")} />
                  </button>
                )}
                {hasLabel && !sidebarOpen && (
                  <div className="hidden md:block mx-2 my-2 border-t border-sidebar-border" />
                )}
                {showItems && group.items.map((item) => {
                  const isActive = !item.external && location.pathname === item.path;
                  return (
                    <Button
                      key={item.path}
                      variant="ghost"
                      onClick={() => handleNavigation(item.path, item.external)}
                      className={cn(
                        "w-full min-h-11 justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary",
                        !sidebarOpen && "md:justify-center md:px-2",
                        hasLabel && sidebarOpen && "mr-2"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className={cn(!sidebarOpen && "md:hidden")}>{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-2 sm:p-3 border-t border-sidebar-border space-y-1">
          <Button
            variant="ghost"
            onClick={() => handleNavigation("/dashboard/account", false)}
            className={cn(
              "w-full min-h-11 justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              location.pathname === "/dashboard/account" && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary",
              !sidebarOpen && "md:justify-center md:px-2"
            )}
          >
            <UserCircle className="w-5 h-5 flex-shrink-0" />
            <span className={cn(!sidebarOpen && "md:hidden")}>حسابي</span>
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              onClick={() => handleNavigation(adminSettingsItem.path, adminSettingsItem.external)}
              className={cn(
                "w-full min-h-11 justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                location.pathname === adminSettingsItem.path && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary",
                !sidebarOpen && "md:justify-center md:px-2"
              )}
            >
              <adminSettingsItem.icon className="w-5 h-5 flex-shrink-0" />
              <span className={cn(!sidebarOpen && "md:hidden")}>{adminSettingsItem.label}</span>
            </Button>
          )}
        </div>

        {/* Logout */}
        <div className="p-2 sm:p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              "w-full min-h-11 justify-start gap-3 text-sidebar-foreground hover:bg-destructive hover:text-destructive-foreground",
              !sidebarOpen && "md:justify-center md:px-2"
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={cn(!sidebarOpen && "md:hidden")}>تسجيل الخروج</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 transition-all duration-300 w-full min-w-0",
          // Mobile: no margin, just padding top for header
          "pt-14 md:pt-0",
          // Desktop: margin for sidebar
          sidebarOpen ? "md:mr-64" : "md:mr-20"
        )}
      >
        <div className="p-3 sm:p-4 md:p-6 max-w-full overflow-x-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
