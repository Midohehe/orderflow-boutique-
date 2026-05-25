import { useState, useEffect, useMemo, useDeferredValue, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  TrendingUp, DollarSign, CheckCircle, Filter, Wallet, Receipt, ShoppingBag,
  Package, ArrowUpRight, ArrowDownRight, Percent, BarChart3, PieChart as PieIcon,
  CircleDollarSign, ShoppingCart, Hourglass, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useUserContext } from "@/hooks/useUserContext";
import { useStoreContext } from "@/hooks/useStoreContext";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

interface Order {
  id: string;
  product_name: string;
  price: number;
  status: string;
  customer_name: string;
  created_at: string;
  quantity: number;
}
interface ProductRow { id: string; name: string; purchase_price: number; }
interface OrderItemRow { id: string; order_id: string; product_id: string | null; product_name: string; price: number; quantity: number; }
interface ExpenseRow { id: string; amount: number; created_at: string; expense_type_id: string | null; }
interface PurchaseRow { id: string; amount: number; created_at: string; }
interface SafeRow { id: string; name: string; balance: number; }
interface ExpenseTypeRow { id: string; name: string; }
interface AdSpendRow { id: string; product_id: string | null; campaign_name: string | null; amount_local: number; spend_date: string; }
interface OrphanShipmentRow { id: string; paid_amount: number; shipment_date: string | null; created_at: string; shipment_code: string; }

const PIE_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const fmt = (n: number) => Number(n || 0).toLocaleString("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FinancialAccounts = () => {
  const { effectiveOwnerId, loading: ctxLoading } = useUserContext();
  const { activeStoreId } = useStoreContext();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [, startTabTransition] = useTransition();
  const deferredTab = useDeferredValue(activeTab);
  // Keep visited tabs mounted so re-clicking is instant (avoids re-mounting heavy tables/charts).
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(["overview"]));
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [safes, setSafes] = useState<SafeRow[]>([]);
  const [adSpends, setAdSpends] = useState<AdSpendRow[]>([]);
  const [orphanShipments, setOrphanShipments] = useState<OrphanShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");

  useEffect(() => {
    if (ctxLoading || !effectiveOwnerId || !activeStoreId) return;
    (async () => {
      setLoading(true);
      try {
        const [o, p, oi, e, et, pu, sa, ads] = await Promise.all([
          supabase.from("orders").select("id, product_name, price, status, customer_name, created_at, quantity, is_deleted").eq("store_id", activeStoreId).eq("is_deleted", false).order("created_at", { ascending: false }),
          supabase.from("products").select("id, name").eq("store_id", activeStoreId).is("deleted_at", null),
          supabase.from("order_items").select("id, order_id, product_id, product_name, price, quantity").eq("store_id", activeStoreId),
          supabase.from("expenses").select("id, amount, created_at, expense_type_id").eq("store_id", activeStoreId),
          supabase.from("expense_types").select("id, name").eq("store_id", activeStoreId),
          supabase.from("purchases").select("id, amount, created_at").eq("store_id", activeStoreId),
          supabase.from("safes").select("id, name, balance").eq("store_id", activeStoreId),
          supabase.from("ad_spends").select("id, product_id, campaign_name, amount_local, spend_date").eq("store_id", activeStoreId),
        ]);
        // Unlinked shipments from RECEIVED settlements = orphan revenue (cash received, no product link)
        const { data: orphData } = await supabase
          .from("settlement_shipments")
          .select("id, paid_amount, shipment_date, created_at, shipment_code, settlement_id, settlements!inner(received, store_id)")
          .is("order_id", null)
          .eq("settlements.received", true)
          .eq("settlements.store_id", activeStoreId);
        setOrphanShipments(((orphData as any[]) || []).map(r => ({
          id: r.id, paid_amount: Number(r.paid_amount || 0),
          shipment_date: r.shipment_date, created_at: r.created_at, shipment_code: r.shipment_code,
        })));
        setOrders((o.data as Order[]) || []);
        // Fetch sensitive purchase_price via secure RPC and merge
        const { data: costs } = await (supabase as any).rpc("get_owner_product_costs", { _product_ids: null });
        const cmap = new Map<string, number>((costs || []).map((c: any) => [c.id, Number(c.purchase_price || 0)]));
        setProducts(((p.data || []) as any[]).map((pr) => ({ ...pr, purchase_price: cmap.get(pr.id) ?? 0 })) as ProductRow[]);
        setOrderItems((oi.data as OrderItemRow[]) || []);
        setExpenses((e.data as ExpenseRow[]) || []);
        setExpenseTypes((et.data as ExpenseTypeRow[]) || []);
        setPurchases((pu.data as PurchaseRow[]) || []);
        setSafes((sa.data as SafeRow[]) || []);
        setAdSpends((ads.data as AdSpendRow[]) || []);
      } catch (err) {
        console.error(err);
        toast({ title: "خطأ", description: "تعذر تحميل البيانات", variant: "destructive" });
      } finally { setLoading(false); }
    })();
  }, [effectiveOwnerId, ctxLoading, activeStoreId]);

  const inDateRange = (iso: string) => {
    const t = new Date(iso).getTime();
    if (dateFrom) {
      const f = new Date(dateFrom); f.setHours(0,0,0,0);
      if (t < f.getTime()) return false;
    }
    if (dateTo) {
      const td = new Date(dateTo); td.setHours(23,59,59,999);
      if (t > td.getTime()) return false;
    }
    return true;
  };

  const productByName = useMemo(() => new Map(products.map(p => [p.name, p])), [products]);
  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItemRow[]>();
    orderItems.forEach(it => {
      if (!map.has(it.order_id)) map.set(it.order_id, []);
      map.get(it.order_id)!.push(it);
    });
    return map;
  }, [orderItems]);
  const purchasePriceOf = (item: OrderItemRow): number => {
    const pr = (item.product_id && productById.get(item.product_id)) || productByName.get(item.product_name);
    return pr ? Number(pr.purchase_price) : 0;
  };
  // An order is "linked" if at least one of its items/product maps to a local product
  const orderIsLinked = (o: Order): boolean => {
    const items = itemsByOrder.get(o.id);
    if (items && items.length > 0) {
      return items.some(it => (it.product_id && productById.has(it.product_id)) || productByName.has(it.product_name));
    }
    return productByName.has(o.product_name);
  };
  // Cost (COGS) for a single order — uses order_items if present, else fallback
  const orderCost = (o: Order): number => {
    const items = itemsByOrder.get(o.id);
    if (items && items.length > 0) {
      return items.reduce((s, it) => s + Number(it.quantity || 1) * purchasePriceOf(it), 0);
    }
    const pr = productByName.get(o.product_name);
    const qty = Number(o.quantity || 1);
    return pr ? Number(pr.purchase_price) * qty : 0;
  };

  const orderHasProduct = (o: Order, name: string): boolean => {
    if (o.product_name === name) return true;
    const items = itemsByOrder.get(o.id);
    return !!(items && items.some(it => it.product_name === name));
  };
  const filteredOrders = useMemo(
    () => orders.filter(o => inDateRange(o.created_at) && (selectedProduct === "all" || orderHasProduct(o, selectedProduct))),
    [orders, dateFrom, dateTo, selectedProduct, itemsByOrder]
  );
  const deliveredOrders = useMemo(() => filteredOrders.filter(o => o.status === "delivered" || o.status === "settled"), [filteredOrders]);
  // Orphan delivered orders: counted in revenue display but EXCLUDED from profit calc
  const linkedDelivered = useMemo(() => deliveredOrders.filter(orderIsLinked), [deliveredOrders, products, itemsByOrder]);
  const orphanDelivered = useMemo(() => deliveredOrders.filter(o => !orderIsLinked(o)), [deliveredOrders, products, itemsByOrder]);
  // Orphan settlement shipments (no matching order at all) — in selected date range
  const filteredOrphanShipments = useMemo(
    () => orphanShipments.filter(s => inDateRange(s.shipment_date || s.created_at)),
    [orphanShipments, dateFrom, dateTo]
  );
  const orphanRevenue =
    orphanDelivered.reduce((s, o) => s + Number(o.price), 0) +
    (selectedProduct === "all" ? filteredOrphanShipments.reduce((s, x) => s + Number(x.paid_amount), 0) : 0);
  const orphanCount = orphanDelivered.length + (selectedProduct === "all" ? filteredOrphanShipments.length : 0);
  const shippedOrders = useMemo(() => filteredOrders.filter(o => o.status === "shipped"), [filteredOrders]);
  const filteredExpenses = useMemo(() => expenses.filter(e => inDateRange(e.created_at)), [expenses, dateFrom, dateTo]);
  const filteredPurchases = useMemo(() => purchases.filter(p => inDateRange(p.created_at)), [purchases, dateFrom, dateTo]);
  const filteredAdSpends = useMemo(() => adSpends.filter(a => {
    if (!inDateRange(a.spend_date)) return false;
    if (selectedProduct === "all") return true;
    const pr = products.find(p => p.name === selectedProduct);
    return pr ? a.product_id === pr.id : false;
  }), [adSpends, dateFrom, dateTo, selectedProduct, products]);

  // Core financials
  const totalRevenue = deliveredOrders.reduce((s, o) => s + Number(o.price), 0)
    + (selectedProduct === "all" ? filteredOrphanShipments.reduce((s, x) => s + Number(x.paid_amount), 0) : 0);
  // Profit calculations use ONLY linked orders (we know their actual cost)
  const profitRevenue = linkedDelivered.reduce((s, o) => s + Number(o.price), 0);
  const totalCOGS = linkedDelivered.reduce((s, o) => s + orderCost(o), 0);
  const grossProfit = profitRevenue - totalCOGS;
  const totalRegularExpenses = selectedProduct === "all" ? filteredExpenses.reduce((s, e) => s + Number(e.amount), 0) : 0;
  const totalAdSpend = filteredAdSpends.reduce((s, a) => s + Number(a.amount_local), 0);
  const totalExpenses = totalRegularExpenses + totalAdSpend;
  const totalPurchases = selectedProduct === "all" ? filteredPurchases.reduce((s, p) => s + Number(p.amount), 0) : 0;
  const netProfit = grossProfit - totalExpenses;

  const grossMargin = profitRevenue > 0 ? (grossProfit / profitRevenue) * 100 : 0;
  const netMargin = profitRevenue > 0 ? (netProfit / profitRevenue) * 100 : 0;
  const roi = totalCOGS > 0 ? (grossProfit / totalCOGS) * 100 : 0;
  const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

  // Order status breakdown
  const statusCounts = filteredOrders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const totalOrders = filteredOrders.length;
  const deliveredCount = deliveredOrders.length;
  const conversionRate = totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0;
  const avgOrderValue = deliveredCount > 0 ? totalRevenue / deliveredCount : 0;

  const totalSafesBalance = safes.reduce((s, x) => s + Number(x.balance), 0);
  const pendingSettlement = orders.filter(o => o.status === "delivered" && inDateRange(o.created_at)).reduce((s, o) => s + Number(o.price), 0);

  // Monthly trends (last 12 months)
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; profit: number; expenses: number; purchases: number }> = {};
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[monthKey(d)] = { month: d.toLocaleDateString("ar-LY", { month: "short", year: "2-digit" }), revenue: 0, profit: 0, expenses: 0, purchases: 0 };
    }
    deliveredOrders.forEach(o => {
      if (!orderIsLinked(o)) return; // skip orphans from profit chart
      const k = monthKey(new Date(o.created_at));
      if (months[k]) {
        const cost = orderCost(o);
        months[k].revenue += Number(o.price);
        months[k].profit += Number(o.price) - cost;
      }
    });
    filteredExpenses.forEach(e => {
      const k = monthKey(new Date(e.created_at));
      if (months[k]) months[k].expenses += Number(e.amount);
    });
    filteredPurchases.forEach(p => {
      const k = monthKey(new Date(p.created_at));
      if (months[k]) months[k].purchases += Number(p.amount);
    });
    return Object.values(months);
  }, [deliveredOrders, filteredExpenses, filteredPurchases, productByName]);

  // Expenses by type
  const expensesByType = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const name = expenseTypes.find(t => t.id === e.expense_type_id)?.name || "غير محدد";
      map[name] = (map[name] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses, expenseTypes]);

  // Top products by revenue
  const topProducts = useMemo(() => {
    const map: Record<string, { revenue: number; profit: number; count: number; ad: number }> = {};
    const productIdByName = new Map(products.map(p => [p.name, p.id]));
    deliveredOrders.forEach(o => {
      const items = itemsByOrder.get(o.id);
      if (items && items.length > 0) {
        items.forEach(it => {
          const qty = Number(it.quantity || 1);
          const rev = Number(it.price) * qty;
          const cost = purchasePriceOf(it) * qty;
          if (!map[it.product_name]) map[it.product_name] = { revenue: 0, profit: 0, count: 0, ad: 0 };
          map[it.product_name].revenue += rev;
          map[it.product_name].profit += rev - cost;
          map[it.product_name].count += qty;
        });
      } else {
        const qty = Number(o.quantity || 1);
        const cost = orderCost(o);
        if (!map[o.product_name]) map[o.product_name] = { revenue: 0, profit: 0, count: 0, ad: 0 };
        map[o.product_name].revenue += Number(o.price);
        map[o.product_name].profit += Number(o.price) - cost;
        map[o.product_name].count += qty;
      }
    });
    // Apply ad spend per product
    filteredAdSpends.forEach(a => {
      if (!a.product_id) return;
      const pname = products.find(p => p.id === a.product_id)?.name;
      if (!pname) return;
      if (!map[pname]) map[pname] = { revenue: 0, profit: 0, count: 0, ad: 0 };
      map[pname].ad += Number(a.amount_local);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [deliveredOrders, productByName, itemsByOrder, filteredAdSpends, products]);

  // In-delivery aggregation by product
  const shippedByProduct = useMemo(() => {
    const map: Record<string, { revenue: number; cost: number; count: number }> = {};
    shippedOrders.forEach(o => {
      const items = itemsByOrder.get(o.id);
      if (items && items.length > 0) {
        items.forEach(it => {
          const qty = Number(it.quantity || 1);
          const rev = Number(it.price) * qty;
          const cost = purchasePriceOf(it) * qty;
          if (!map[it.product_name]) map[it.product_name] = { revenue: 0, cost: 0, count: 0 };
          map[it.product_name].revenue += rev;
          map[it.product_name].cost += cost;
          map[it.product_name].count += qty;
        });
      } else {
        const qty = Number(o.quantity || 1);
        const cost = orderCost(o);
        if (!map[o.product_name]) map[o.product_name] = { revenue: 0, cost: 0, count: 0 };
        map[o.product_name].revenue += Number(o.price);
        map[o.product_name].cost += cost;
        map[o.product_name].count += qty;
      }
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, profit: v.revenue - v.cost }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [shippedOrders, productByName, itemsByOrder]);
  const shippedTotals = useMemo(() => {
    const agg = shippedByProduct.reduce((acc, p) => ({
      revenue: acc.revenue + p.revenue,
      cost: acc.cost + p.cost,
      profit: acc.profit + p.profit,
    }), { revenue: 0, cost: 0, profit: 0 });
    return { ...agg, count: shippedOrders.length };
  }, [shippedByProduct, shippedOrders]);

  // Dropdown shows only main products from products table (not order names)
  const uniqueProducts = useMemo(
    () => products.map(p => p.name).filter(Boolean).sort(),
    [products]
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  const KPI = ({ icon: Icon, label, value, sub, color, trend }: any) => (
    <Card className={`bg-gradient-to-br ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-background/40 backdrop-blur"><Icon className="w-5 h-5" /></div>
        </div>
        {typeof trend === "number" && (
          <div className={`flex items-center gap-1 text-xs mt-2 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={CircleDollarSign}
        title="الحسابات المالية"
        description="لوحة محاسبية شاملة للمبيعات، المشتريات، المصروفات والأرباح"
        iconGradient="from-emerald-500 to-teal-600"
      />

      {/* Filters */}
      <Card className="card-shadow">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">الفلاتر</span></div>
          <div>
            <Label className="text-xs mb-1 block">من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">المنتج</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المنتجات</SelectItem>
                {uniqueProducts.filter(p => p && p.trim() !== "").map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(dateFrom || dateTo || selectedProduct !== "all") && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setDateFrom(""); setDateTo(""); setSelectedProduct("all"); }}>إلغاء الفلترة</Button>
          )}
        </CardContent>
      </Card>

      {/* Top KPIs */}
      {orphanCount > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                {orphanCount} شحنة/طلب مسلّم غير مرتبط بمنتج محلي — قيمتها {fmt(orphanRevenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                هذه الطلبات تظهر ضمن إجمالي المبيعات والخزينة، لكنها <span className="font-medium">غير محسوبة في الربح الصافي</span> لعدم توفر تكلفة الشراء.
                لاحتسابها قم بربط الشحنة بطلب/منتج في النظام أو سجّل تكلفتها كمصروف يدوي.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={DollarSign} label="إجمالي المبيعات" value={fmt(totalRevenue)} sub={orphanCount > 0 ? `${deliveredCount} طلب (+${orphanCount} غير مرتبط)` : `${deliveredCount} طلب مسلم`} color="from-green-500/10 to-green-600/5 border-green-500/20" />
        <KPI icon={Package} label="تكلفة البضاعة المباعة" value={fmt(totalCOGS)} sub={`من ${linkedDelivered.length} طلب مرتبط · هامش ${grossMargin.toFixed(1)}%`} color="from-blue-500/10 to-blue-600/5 border-blue-500/20" />
        <KPI icon={Receipt} label="المصروفات" value={fmt(totalExpenses)} sub={`${expenseRatio.toFixed(1)}% من المبيعات`} color="from-orange-500/10 to-orange-600/5 border-orange-500/20" />
        <KPI icon={TrendingUp} label="صافي الربح" value={fmt(netProfit)} sub={orphanCount > 0 ? `يستثني ${fmt(orphanRevenue)} غير مرتبطة` : `هامش صافي ${netMargin.toFixed(1)}%`} color={netProfit >= 0 ? "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20" : "from-red-500/10 to-red-600/5 border-red-500/20"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={ShoppingBag} label="المشتريات (مخزون)" value={fmt(totalPurchases)} sub="لا تؤثر على الأرباح" color="from-amber-500/10 to-amber-600/5 border-amber-500/20" />
        <KPI icon={Wallet} label="رصيد الخزائن" value={fmt(totalSafesBalance)} sub={`${safes.length} خزينة`} color="from-violet-500/10 to-violet-600/5 border-violet-500/20" />
        <KPI icon={Receipt} label="مصروف الإعلانات المستهلك" value={fmt(totalAdSpend)} sub="مدرج ضمن المصروفات" color="from-fuchsia-500/10 to-fuchsia-600/5 border-fuchsia-500/20" />
        <KPI icon={Hourglass} label="بانتظار التسوية" value={fmt(pendingSettlement)} sub="مسلّم وغير مستلم مالياً" color="from-cyan-500/10 to-cyan-600/5 border-cyan-500/20" />
        <KPI icon={ShoppingCart} label="متوسط قيمة الطلب" value={fmt(avgOrderValue)} sub={`نسبة التسليم ${conversionRate.toFixed(1)}%`} color="from-pink-500/10 to-pink-600/5 border-pink-500/20" />
      </div>

      {/* Ratios */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">هامش الربح الإجمالي</p><p className="text-lg font-bold">{grossMargin.toFixed(1)}%</p></div><Percent className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">هامش الربح الصافي</p><p className={`text-lg font-bold ${netMargin >= 0 ? "text-green-600" : "text-red-500"}`}>{netMargin.toFixed(1)}%</p></div><Percent className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">العائد على التكلفة (ROI)</p><p className="text-lg font-bold">{roi.toFixed(1)}%</p></div><Percent className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">نسبة المصروفات</p><p className="text-lg font-bold">{expenseRatio.toFixed(1)}%</p></div><Percent className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => startTabTransition(() => setActiveTab(v))}
      >
        <div className="-mx-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-max min-w-full gap-1 px-1">
            <TabsTrigger value="overview" className="shrink-0">نظرة عامة</TabsTrigger>
            <TabsTrigger value="trends" className="shrink-0">الاتجاهات الشهرية</TabsTrigger>
            <TabsTrigger value="products" className="shrink-0">أداء المنتجات</TabsTrigger>
            <TabsTrigger value="shipped" className="shrink-0">جاري التوصيل</TabsTrigger>
            <TabsTrigger value="expenses" className="shrink-0">تحليل المصروفات</TabsTrigger>
            <TabsTrigger value="orders" className="shrink-0">تفاصيل الطلبات</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" />ملخص الإيرادات والمصروفات</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: "المبيعات", value: totalRevenue, fill: "#10b981" },
                    { name: "تكلفة البضاعة", value: totalCOGS, fill: "#3b82f6" },
                    { name: "المصروفات", value: totalExpenses, fill: "#f59e0b" },
                    { name: "صافي الربح", value: netProfit, fill: netProfit >= 0 ? "#22c55e" : "#ef4444" },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Bar dataKey="value" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieIcon className="w-4 h-4" />حالات الطلبات</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(statusCounts).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                  ) : (
                    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                      const pct = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
                      return (
                        <div key={status}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{status}</span>
                            <span className="font-medium">{count} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">أرصدة الخزائن</CardTitle></CardHeader>
            <CardContent>
              {safes.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">لا توجد خزائن</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {safes.map(s => (
                    <div key={s.id} className="p-3 rounded-lg border bg-muted/30">
                      <p className="text-xs text-muted-foreground">{s.name}</p>
                      <p className={`text-lg font-bold ${Number(s.balance) >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(s.balance)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly trends */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">المبيعات والأرباح خلال 12 شهر</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: any) => fmt(Number(v))} /><Legend />
                  <Line type="monotone" dataKey="revenue" name="المبيعات" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" name="الربح" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">المصروفات والمشتريات شهرياً</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: any) => fmt(Number(v))} /><Legend />
                  <Bar dataKey="expenses" name="المصروفات" fill="#f59e0b" />
                  <Bar dataKey="purchases" name="المشتريات" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top products */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">أفضل المنتجات حسب الإيرادات</CardTitle></CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">لا توجد بيانات</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">عدد الطلبات</TableHead>
                    <TableHead className="text-right">الإيرادات</TableHead>
                    <TableHead className="text-right">الربح الإجمالي</TableHead>
                    <TableHead className="text-right">تكلفة الإعلان</TableHead>
                    <TableHead className="text-right">صافي الربح</TableHead>
                    <TableHead className="text-right">الهامش %</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {topProducts.map(p => {
                      const net = p.profit - p.ad;
                      const m = p.revenue > 0 ? (net / p.revenue) * 100 : 0;
                      return (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.count}</TableCell>
                          <TableCell>{fmt(p.revenue)}</TableCell>
                          <TableCell className={p.profit >= 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>{fmt(p.profit)}</TableCell>
                          <TableCell className="text-fuchsia-600">{fmt(p.ad)}</TableCell>
                          <TableCell className={net >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{fmt(net)}</TableCell>
                          <TableCell>{m.toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses analysis */}
        {/* In-delivery (shipped) */}
        <TabsContent value="shipped" className="space-y-4">
          {deferredTab !== "shipped" ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (<>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI icon={ShoppingCart} label="عدد الطلبات قيد التوصيل" value={shippedTotals.count} sub={selectedProduct === "all" ? "كل المنتجات" : selectedProduct} color="from-cyan-500/10 to-cyan-600/5 border-cyan-500/20" />
            <KPI icon={Package} label="إجمالي رأس المال" value={fmt(shippedTotals.cost)} sub="سعر شراء البضاعة" color="from-blue-500/10 to-blue-600/5 border-blue-500/20" />
            <KPI icon={DollarSign} label="إجمالي سعر البيع" value={fmt(shippedTotals.revenue)} sub="القيمة المتوقعة" color="from-green-500/10 to-green-600/5 border-green-500/20" />
            <KPI icon={TrendingUp} label="الربح المتوقع" value={fmt(shippedTotals.profit)} sub={shippedTotals.revenue > 0 ? `هامش ${((shippedTotals.profit/shippedTotals.revenue)*100).toFixed(1)}%` : ""} color={shippedTotals.profit >= 0 ? "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20" : "from-red-500/10 to-red-600/5 border-red-500/20"} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" />تفاصيل المنتجات قيد التوصيل</CardTitle></CardHeader>
            <CardContent>
              {shippedByProduct.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد طلبات قيد التوصيل</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-right">المنتج</TableHead>
                      <TableHead className="text-right">عدد القطع</TableHead>
                      <TableHead className="text-right">رأس المال (شراء)</TableHead>
                      <TableHead className="text-right">سعر البيع</TableHead>
                      <TableHead className="text-right">الربح المتوقع</TableHead>
                      <TableHead className="text-right">الهامش %</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {shippedByProduct.map(p => {
                        const m = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                        return (
                          <TableRow key={p.name}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>{p.count}</TableCell>
                            <TableCell className="text-blue-600 font-medium">{fmt(p.cost)}</TableCell>
                            <TableCell className="text-green-600 font-medium">{fmt(p.revenue)}</TableCell>
                            <TableCell className={p.profit >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{fmt(p.profit)}</TableCell>
                            <TableCell>{m.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/40 font-bold">
                        <TableCell>الإجمالي</TableCell>
                        <TableCell>{shippedTotals.count}</TableCell>
                        <TableCell className="text-blue-600">{fmt(shippedTotals.cost)}</TableCell>
                        <TableCell className="text-green-600">{fmt(shippedTotals.revenue)}</TableCell>
                        <TableCell className={shippedTotals.profit >= 0 ? "text-emerald-600" : "text-red-500"}>{fmt(shippedTotals.profit)}</TableCell>
                        <TableCell>{shippedTotals.revenue > 0 ? ((shippedTotals.profit/shippedTotals.revenue)*100).toFixed(1) : "0.0"}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          </>)}
        </TabsContent>

        {/* Expenses analysis */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieIcon className="w-4 h-4" />توزيع المصروفات حسب النوع</CardTitle></CardHeader>
              <CardContent className="h-72">
                {expensesByType.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">لا توجد مصروفات</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expensesByType} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => `${e.name}: ${fmt(e.value)}`}>
                        {expensesByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">تفاصيل أنواع المصروفات</CardTitle></CardHeader>
              <CardContent>
                {expensesByType.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">لا توجد مصروفات</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-right">النوع</TableHead><TableHead className="text-right">المبلغ</TableHead><TableHead className="text-right">النسبة</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {expensesByType.sort((a, b) => b.value - a.value).map(et => {
                        const pct = totalExpenses > 0 ? (et.value / totalExpenses) * 100 : 0;
                        return (
                          <TableRow key={et.name}>
                            <TableCell>{et.name}</TableCell>
                            <TableCell className="font-bold text-red-500">{fmt(et.value)}</TableCell>
                            <TableCell>{pct.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders detail */}
        <TabsContent value="orders" className="space-y-4">
          <Card className="border-green-500/30">
            <CardHeader className="bg-gradient-to-r from-green-500/10 to-transparent">
              <CardTitle className="flex items-center gap-2 text-green-600 text-base">
                <CheckCircle className="w-5 h-5" />الطلبات المسلّمة والأرباح ({deliveredOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deliveredOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>لا توجد طلبات مسلّمة</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">المنتج</TableHead>
                      <TableHead className="text-right">سعر البيع</TableHead>
                      <TableHead className="text-right">سعر الشراء</TableHead>
                      <TableHead className="text-right">الربح</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {deliveredOrders.map(o => {
                        const pp = orderCost(o);
                        const profit = Number(o.price) - pp;
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">{o.customer_name}</TableCell>
                            <TableCell>{o.product_name}</TableCell>
                            <TableCell>{fmt(o.price)}</TableCell>
                            <TableCell>{fmt(pp)}</TableCell>
                            <TableCell className={profit >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{fmt(profit)}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{new Date(o.created_at).toLocaleDateString("ar-LY")}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialAccounts;
