import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, MapPin, Calendar, Loader2, Clock, Truck, CheckCircle, XCircle, Download, Trash2, Send, ImagePlus, Search, Eye, Plus } from "lucide-react";
import { OrderDetailsDialog } from "@/components/OrderDetailsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { EditMatchedCity } from "@/components/EditMatchedCity";

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  product_name: string;
  product_id?: string | null;
  price: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "settled" | "returned_received";
  created_at: string;
  selected_color?: string;
  selected_size?: string;
  selected_product_code?: string;
  quantity?: number;
  shipping_included?: boolean;
  shipping_reference?: string | null;
  matched_zone_name?: string | null;
  matched_area_name?: string | null;
  shipping_error?: string | null;
  link_error?: string | null;
  carrier_status?: string | null;
  carrier_status_updated_at?: string | null;
  carrier_status_raw?: any;
}

const statusLabels: Record<Order["status"], string> = {
  pending: "قيد الانتظار",
  processing: "قيد المعالجة",
  shipped: "جاري التوصيل",
  delivered: "تم الاستلام",
  cancelled: "ملغي",
  settled: "تم استلام القيمة المالية",
  returned_received: "تم استلام المرتجع",
};

const statusColors: Record<Order["status"], string> = {
  pending: "bg-warning text-warning-foreground",
  processing: "bg-primary text-primary-foreground",
  shipped: "bg-accent text-accent-foreground",
  delivered: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
  settled: "bg-success text-success-foreground",
  returned_received: "bg-muted text-muted-foreground",
};

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<Order["status"] | "">("");
  const [currencySymbol, setCurrencySymbol] = useState("د.إ");
  const [shipping, setShipping] = useState(false);
  const [shipProgress, setShipProgress] = useState<{ done: number; total: number } | null>(null);
  const [productFilter, setProductFilter] = useState<string>("all");
  const [shippingMode, setShippingMode] = useState<"included" | "excluded">("excluded");
  const [extracting, setExtracting] = useState(false);
  const [shippedSearch, setShippedSearch] = useState("");
  const [pendingDateFrom, setPendingDateFrom] = useState<string>("");
  const [pendingDateTo, setPendingDateTo] = useState<string>("");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [statusColorMap, setStatusColorMap] = useState<Record<string, string>>({});

  const COLOR_CLASSES: Record<string, string> = {
    default: "bg-accent text-accent-foreground",
    blue: "bg-blue-500 text-white",
    green: "bg-green-600 text-white",
    yellow: "bg-yellow-400 text-yellow-950",
    red: "bg-red-600 text-white",
    purple: "bg-purple-600 text-white",
    orange: "bg-orange-500 text-white",
    pink: "bg-pink-500 text-white",
    gray: "bg-gray-500 text-white",
  };

  const carrierStatusClass = (order: Order): string => {
    if (!order.carrier_status) return "bg-muted text-muted-foreground";
    const code = extractStatusCode(order);
    const color = code ? statusColorMap[code] : undefined;
    return COLOR_CLASSES[color || "default"] || COLOR_CLASSES.default;
  };

  const extractStatusCode = (order: Order): string | null => {
    const raw = order.carrier_status_raw;
    if (raw && typeof raw === "object") {
      const c = raw.shipmentStatusCode ?? raw.shipment_status_code ?? raw.status;
      if (c !== undefined && c !== null && c !== "") return String(c).trim();
    }
    // Fallback: parse trailing "(<code>)" from existing carrier_status text
    if (order.carrier_status) {
      const m = order.carrier_status.match(/\(([^)]+)\)\s*$/);
      if (m) return m[1].trim();
      // If it's just a code like "rits" with no parentheses
      if (statusMap[order.carrier_status.trim()]) return order.carrier_status.trim();
    }
    return null;
  };

  const displayCarrierStatus = (order: Order): string => {
    const code = extractStatusCode(order);
    if (code && statusMap[code]) return statusMap[code];
    return order.carrier_status || "في انتظار تحديث من شركة الشحن";
  };

  const handleCreateManualOrder = async () => {
    setCreating(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        toast({ title: "خطأ", description: "يجب تسجيل الدخول", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase
        .from("orders")
        .insert({
          owner_id: uid,
          customer_name: "بدون اسم",
          phone: "",
          address: "",
          city: "",
          product_name: "",
          price: 0,
          quantity: 1,
          status: "pending",
        })
        .select("id, customer_name, phone, address, city, product_name, product_id, price, status, created_at, selected_color, selected_size, selected_product_code, quantity, shipping_included, shipping_reference, matched_zone_name, matched_area_name, shipping_error, link_error, carrier_status, carrier_status_updated_at, carrier_status_raw")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setOrders((prev) => [data as Order, ...prev]);
        setDetailsId(data.id);
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر إنشاء الطلب", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast({ title: "خطأ", description: "يجب أن تكون الملفات صوراً", variant: "destructive" });
      return;
    }
    setExtracting(true);
    let success = 0;
    let failed = 0;
    const corrections: string[] = [];
    try {
      for (const file of images) {
        try {
          const dataUrl: string = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(file);
          });
          const { data, error } = await supabase.functions.invoke("extract-order-from-image", {
            body: { image: dataUrl },
          });
          if (error) throw error;
          success++;
          const ord = (data as any)?.order;
          const ext = (data as any)?.extracted;
          if (ord) {
            const origCity = ext?.city || "—";
            const origAddr = ext?.address || "—";
            const newCity = ord.matched_zone_name || ord.city || "—";
            const newArea = ord.matched_area_name || "—";
            const changed = newCity !== origCity || newArea !== origAddr;
            corrections.push(
              `• ${ord.customer_name || "بدون اسم"}: ${origCity} / ${origAddr} ← ${newCity} / ${newArea}${changed ? " ✓" : ""}`
            );
          }
        } catch (err: any) {
          console.error("Extract failed for", file.name, err);
          failed++;
        }
      }
      toast({
        title: `تم إنشاء ${success} طلب${failed ? ` — فشل ${failed}` : ""}`,
        description: corrections.length
          ? ((<div className="text-xs space-y-1 mt-1 max-h-48 overflow-y-auto" dir="rtl">
              <div className="font-semibold">المعلومات بعد التصحيح:</div>
              {corrections.map((c, i) => <div key={i}>{c}</div>)}
            </div>) as any)
          : undefined,
        variant: failed && !success ? "destructive" : "default",
      });
      fetchOrders();
    } finally {
      setExtracting(false);
    }
  };

  const handleShipToCompany = async () => {
    if (selectedOrders.length === 0) {
      toast({ title: "تنبيه", description: "حدد طلبات أولاً", variant: "destructive" });
      return;
    }
    setShipping(true);
    const ids = [...selectedOrders];
    setShipProgress({ done: 0, total: ids.length });
    let sent = 0;
    let lastError: string | null = null;
    try {
      for (let i = 0; i < ids.length; i++) {
        try {
          const { data, error } = await supabase.functions.invoke("ship-orders", {
            body: { order_ids: [ids[i]], shipping_included: shippingMode === "included" },
          });
          if (error) throw error;
          sent += (data as any)?.sent ?? 0;
        } catch (e: any) {
          lastError = e?.context?.error || e?.message || "حدث خطأ";
        }
        setShipProgress({ done: i + 1, total: ids.length });
      }
      toast({
        title: "تم الإرسال",
        description: `تم إرسال ${sent} من ${ids.length} طلب لشركة الشحن${lastError ? ` (آخر خطأ: ${lastError})` : ""}`,
        variant: lastError && sent === 0 ? "destructive" : "default",
      });
      setSelectedOrders([]);
      fetchOrders();
    } finally {
      setShipping(false);
      setShipProgress(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ordersRes, currencyRes, mapRes, productsRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, customer_name, phone, address, city, product_name, product_id, price, status, created_at, selected_color, selected_size, selected_product_code, quantity, shipping_included, shipping_reference, matched_zone_name, matched_area_name, shipping_error, link_error, carrier_status, carrier_status_updated_at, carrier_status_raw")
            .order("created_at", { ascending: false }),
          supabase.from("store_settings").select("currency_symbol").maybeSingle(),
          supabase.from("carrier_status_mappings").select("status_code, custom_label, color"),
          supabase.from("products").select("id, name"),
        ]);
        if (cancelled) return;
        if (ordersRes.error) throw ordersRes.error;
        setOrders((ordersRes.data || []) as Order[]);
        if (productsRes.data) {
          const pm: Record<string, string> = {};
          (productsRes.data as any[]).forEach((p) => { if (p?.id && p?.name) pm[p.id] = p.name; });
          setProductsMap(pm);
        }
        if (currencyRes.data) setCurrencySymbol(currencyRes.data.currency_symbol);
        if (mapRes.data) {
          const m: Record<string, string> = {};
          const cm: Record<string, string> = {};
          (mapRes.data as any[]).forEach((r) => {
            m[String(r.status_code)] = r.custom_label;
            if (r.color) cm[String(r.status_code)] = r.color;
          });
          setStatusMap(m);
          setStatusColorMap(cm);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء تحميل الطلبات",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchCurrencySettings = async () => {
    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("currency_symbol")
        .maybeSingle();
      if (error) throw error;
      if (data) setCurrencySymbol(data.currency_symbol);
    } catch (error) {
      console.error("Error fetching currency settings:", error);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name, phone, address, city, product_name, product_id, price, status, created_at, selected_color, selected_size, selected_product_code, quantity, shipping_included, shipping_reference, matched_zone_name, matched_area_name, shipping_error, link_error, carrier_status, carrier_status_updated_at, carrier_status_raw")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل الطلبات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: Order["status"]) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      setOrders(orders.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة الطلب بنجاح",
      });
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث الحالة",
        variant: "destructive",
      });
    }
  };

  const handleBulkStatusChange = async () => {
    if (selectedOrders.length === 0 || !bulkStatus) {
      toast({
        title: "تنبيه",
        description: "الرجاء تحديد الطلبات والحالة الجديدة",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: bulkStatus })
        .in("id", selectedOrders);

      if (error) throw error;

      setOrders(orders.map((order) =>
        selectedOrders.includes(order.id) ? { ...order, status: bulkStatus } : order
      ));
      
      setSelectedOrders([]);
      setBulkStatus("");
      
      toast({
        title: "تم التحديث",
        description: `تم تحديث ${selectedOrders.length} طلب بنجاح`,
      });
    } catch (error) {
      console.error("Error updating orders:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث الطلبات",
        variant: "destructive",
      });
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = (orderIds: string[]) => {
    if (orderIds.every((id) => selectedOrders.includes(id))) {
      setSelectedOrders((prev) => prev.filter((id) => !orderIds.includes(id)));
    } else {
      setSelectedOrders((prev) => [...new Set([...prev, ...orderIds])]);
    }
  };

  const handleBulkDelete = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    try {
      const { error } = await supabase.from("orders").delete().in("id", orderIds);
      if (error) throw error;
      setOrders((prev) => prev.filter((o) => !orderIds.includes(o.id)));
      setSelectedOrders((prev) => prev.filter((id) => !orderIds.includes(id)));
      toast({ title: "تم الحذف", description: `تم حذف ${orderIds.length} طلب. لا تؤثر هذه الطلبات على الأرباح أو المشتريات.` });
    } catch (e) {
      console.error(e);
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحذف", variant: "destructive" });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;

      setOrders(orders.filter((order) => order.id !== orderId));
      setSelectedOrders((prev) => prev.filter((id) => id !== orderId));
      
      toast({
        title: "تم الحذف",
        description: "تم حذف الطلب بنجاح",
      });
    } catch (error) {
      console.error("Error deleting order:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف الطلب",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ar-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const exportPendingOrders = () => {
    if (pendingOrders.length === 0) {
      toast({
        title: "تنبيه",
        description: "لا توجد طلبات قيد الانتظار للتصدير",
        variant: "destructive",
      });
      return;
    }

    // تنسيق ملف الإكسل المطلوب من شركة الشحن
    const excelData = pendingOrders.map((order, index) => ({
      "رقم السطر": index + 1,
      "الخدمة": "شحن عادي",
      "نوع الطلب": "FDP",
      "اسم المرسل اليه": order.customer_name,
      "المحافظه": order.city,
      "اسم المنطقه": order.city,
      "رقم الموبايل": order.phone,
      "رقم الهاتف": order.phone,
      "الرمز البريدي للمرسل اليه": "",
      "العنوان": order.address,
      "خط الطول": "",
      "خط العرض": "",
      "وصف الطرد": order.product_name,
      "عدد القطع": order.quantity || 1,
      "الوزن": 1,
      "السعر": Number(order.price) || 0,
      "نوع السعر": shippingMode === "included" ? "INCLD" : "EXCLD",
      "نوع التحصيل": "COLC",
      "رقم المرجع": order.id.slice(0, 12).toUpperCase(),
      "ملاحظات": order.selected_size || order.selected_color || "",
      "رقم البولويصة": "",
      "الراسل الفرعي": "",
      "المحافظة": order.city,
      "المنطقة": order.city,
      "رقم الموبايل ": order.phone,
      "رقم الهاتف ": order.phone,
      "الرمز البريدي للراسل": "",
      "العنوان ": order.address,
      "فتح الطرد": "N",
      "فئة العملات": "ANY",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws["!cols"] = Array(30).fill({ wch: 16 });

    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    // Generate filename with date
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const filename = `orders_${dateStr}_${timeStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);

    toast({
      title: "تم التصدير",
      description: `تم تصدير ${pendingOrders.length} طلب بنجاح`,
    });
  };

  const displayProductName = (o: Order): string =>
    (o.product_id && productsMap[o.product_id]) || o.product_name || "";
  const productNames = Array.from(
    new Set(orders.map(displayProductName).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ar"));
  const allPending = orders.filter((o) => o.status === "pending");
  const pendingOrders = allPending.filter((o) => {
    if (productFilter !== "all" && displayProductName(o) !== productFilter) return false;
    if (pendingDateFrom) {
      const from = new Date(pendingDateFrom);
      from.setHours(0, 0, 0, 0);
      if (new Date(o.created_at) < from) return false;
    }
    if (pendingDateTo) {
      const to = new Date(pendingDateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(o.created_at) > to) return false;
    }
    return true;
  });
  const allShipped = orders.filter((o) => o.status === "shipped");
  const shippedSearchNorm = shippedSearch.trim().toLowerCase();
  const shippedOrders = shippedSearchNorm
    ? allShipped.filter((o) =>
        (o.shipping_reference || "").toLowerCase().includes(shippedSearchNorm) ||
        (o.phone || "").toLowerCase().includes(shippedSearchNorm)
      )
    : allShipped;
  const deliveredOrders = orders.filter((o) => o.status === "delivered" || o.status === "settled");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const normalizePhone = (p: string | null | undefined) => (p || "").replace(/\D/g, "");
  const pendingPhoneCounts: Record<string, number> = {};
  pendingOrders.forEach((o) => {
    const k = normalizePhone(o.phone);
    if (!k) return;
    pendingPhoneCounts[k] = (pendingPhoneCounts[k] || 0) + 1;
  });

  const renderOrderCard = (order: Order, showCheckbox: boolean = false, duplicateCount: number = 0) => (
    <Card
      key={order.id}
      className={`card-shadow animate-slide-up ${duplicateCount > 1 ? "border-2 border-destructive bg-destructive/5" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {showCheckbox && (
              <Checkbox
                checked={selectedOrders.includes(order.id)}
                onCheckedChange={() => toggleOrderSelection(order.id)}
                className="mt-1"
              />
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{order.customer_name}</h3>
                <Badge className={statusColors[order.status]}>
                  {statusLabels[order.status]}
                </Badge>
                {duplicateCount > 1 && (
                  <Badge variant="destructive">
                    رقم مكرر ×{duplicateCount}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span dir="ltr">{order.phone}</span>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {order.address}، {order.city}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(order.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-foreground">{order.product_name}</span>
                <span className="text-primary font-bold">{order.price} {currencySymbol}</span>
                {order.shipping_reference && (
                  <Badge variant="outline" className="font-mono">
                    كود الشحن: {order.shipping_reference}
                  </Badge>
                )}
                {order.shipping_reference && (
                  <Badge className={carrierStatusClass(order)}>
                    حالة شركة التوصيل: {displayCarrierStatus(order)}
                  </Badge>
                )}
              </div>
              {order.link_error && (
                <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                  <span className="font-bold ml-1">⚠ تعذر الربط التلقائي:</span>
                  <span className="text-foreground/80">{order.link_error}</span>
                </div>
              )}
              {order.shipping_error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                  <span className="font-bold ml-1 text-destructive">✕ فشل الإرسال لشركة الشحن:</span>
                  <span className="text-foreground/80">{order.shipping_error}</span>
                </div>
              )}
              <EditMatchedCity
                orderId={order.id}
                city={order.matched_zone_name}
                area={order.matched_area_name}
                originalCity={order.city}
                originalAddress={order.address}
                onSaved={(nc, na) => setOrders((prev) => prev.map((p) => p.id === order.id ? { ...p, matched_zone_name: nc, matched_area_name: na } : p))}
              />
              
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select
              value={order.status}
              onValueChange={(value) => handleStatusChange(order.id, value as Order["status"])}
            >
              <SelectTrigger className="flex-1 md:w-40 md:flex-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="shipped">جاري التوصيل</SelectItem>
                <SelectItem value="delivered">تم الاستلام</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => setDetailsId(order.id)} title="تفاصيل وتعديل">
              <Eye className="w-4 h-4" />
            </Button>
            
            {order.status === "pending" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من حذف هذا الطلب؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم حذف طلب {order.customer_name} نهائياً ولا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteOrder(order.id)}>
                      حذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderEmptyState = (icon: React.ReactNode, message: string) => (
    <Card className="card-shadow">
      <CardContent className="flex flex-col items-center justify-center py-12">
        {icon}
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الطلبيات</h1>
        <p className="text-muted-foreground">إدارة طلبات العملاء</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingOrders.length}</p>
              <p className="text-muted-foreground text-sm">قيد الانتظار</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Truck className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{shippedOrders.length}</p>
              <p className="text-muted-foreground text-sm">جاري التوصيل</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{deliveredOrders.length}</p>
              <p className="text-muted-foreground text-sm">تم الاستلام</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{cancelledOrders.length}</p>
              <p className="text-muted-foreground text-sm">ملغي</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">قيد الانتظار</span> ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="shipped" className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            <span className="hidden sm:inline">جاري التوصيل</span> ({shippedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="hidden sm:inline">تم الاستلام</span> ({deliveredOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            <span className="hidden sm:inline">ملغي</span> ({cancelledOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {(
            <Card className="card-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center lg:justify-between gap-4">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={pendingOrders.length > 0 && pendingOrders.every((o) => selectedOrders.includes(o.id))}
                        onCheckedChange={() => toggleSelectAll(pendingOrders.map((o) => o.id))}
                      />
                      <span className="text-sm text-foreground">تحديد الكل ({selectedOrders.filter(id => pendingOrders.some(o => o.id === id)).length} محدد)</span>
                    </div>
                    <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as Order["status"])}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="اختر الحالة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shipped">جاري التوصيل</SelectItem>
                        <SelectItem value="delivered">تم الاستلام</SelectItem>
                        <SelectItem value="cancelled">ملغي</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleBulkStatusChange}
                      disabled={selectedOrders.length === 0 || !bulkStatus}
                      className="w-full sm:w-auto"
                    >
                      تحديث الحالة
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                    <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setSelectedOrders([]); }}>
                      <SelectTrigger className="w-full sm:w-52">
                        <SelectValue placeholder="فلتر حسب المنتج" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل المنتجات</SelectItem>
                        {productNames.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">من:</span>
                        <Input
                          type="date"
                          value={pendingDateFrom}
                          onChange={(e) => { setPendingDateFrom(e.target.value); setSelectedOrders([]); }}
                          className="w-full sm:w-40"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">إلى:</span>
                        <Input
                          type="date"
                          value={pendingDateTo}
                          onChange={(e) => { setPendingDateTo(e.target.value); setSelectedOrders([]); }}
                          className="w-full sm:w-40"
                        />
                      </div>
                      {(pendingDateFrom || pendingDateTo) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setPendingDateFrom(""); setPendingDateTo(""); }}
                        >
                          مسح
                        </Button>
                      )}
                    </div>
                    <Select value={shippingMode} onValueChange={(v) => setShippingMode(v as any)}>
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue placeholder="نوع الشحن" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excluded">غير شامل الشحن</SelectItem>
                        <SelectItem value="included">شامل الشحن</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleShipToCompany}
                      disabled={selectedOrders.length === 0 || shipping}
                      className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {shipping ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-2" />}
                      {shipping && shipProgress
                        ? `جاري الإرسال ${shipProgress.done} من ${shipProgress.total}`
                        : "إرسال لشركة الشحن"}
                    </Button>
                    <Button variant="outline" onClick={exportPendingOrders} className="w-full sm:w-auto">
                      <Download className="w-4 h-4 ml-2" />
                      تصدير Excel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById("order-image-input")?.click()}
                      disabled={extracting}
                      className="w-full sm:w-auto border-accent text-accent"
                    >
                      {extracting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <ImagePlus className="w-4 h-4 ml-2" />}
                      إنشاء طلب من صورة
                    </Button>
                    <Button
                      onClick={handleCreateManualOrder}
                      disabled={creating}
                      className="w-full sm:w-auto"
                    >
                      {creating ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Plus className="w-4 h-4 ml-2" />}
                      إضافة طلب
                    </Button>
                    <input
                      id="order-image-input"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {pendingOrders.length === 0 ? (
            renderEmptyState(
              <Clock className="w-16 h-16 text-muted-foreground mb-4" />,
              "لا توجد طلبات قيد الانتظار"
            )
          ) : (
            <div className="space-y-4">
              {pendingOrders.map((order) => renderOrderCard(order, true, pendingPhoneCounts[normalizePhone(order.phone)] || 0))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shipped" className="space-y-4">
          <Card className="card-shadow">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={shippedSearch}
                  onChange={(e) => setShippedSearch(e.target.value)}
                  placeholder="ابحث بكود الشحن أو رقم الهاتف"
                  className="pr-10"
                />
              </div>
            </CardContent>
          </Card>
          {shippedOrders.length === 0 ? (
            renderEmptyState(
              <Truck className="w-16 h-16 text-muted-foreground mb-4" />,
              shippedSearchNorm ? "لا توجد نتائج مطابقة" : "لا توجد طلبات جاري توصيلها"
            )
          ) : (
            <div className="space-y-4">
              {shippedOrders.map((order) => renderOrderCard(order))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="delivered" className="space-y-4">
          {deliveredOrders.length === 0 ? (
            renderEmptyState(
              <CheckCircle className="w-16 h-16 text-muted-foreground mb-4" />,
              "لا توجد طلبات مستلمة"
            )
          ) : (
            <div className="space-y-4">
              {deliveredOrders.map((order) => renderOrderCard(order))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-4">
          {cancelledOrders.length === 0 ? (
            renderEmptyState(
              <XCircle className="w-16 h-16 text-muted-foreground mb-4" />,
              "لا توجد طلبات ملغية"
            )
          ) : (
            <>
              <Card className="card-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={cancelledOrders.every((o) => selectedOrders.includes(o.id))}
                        onCheckedChange={() => toggleSelectAll(cancelledOrders.map((o) => o.id))}
                      />
                      <span className="text-sm text-foreground">
                        تحديد الكل ({selectedOrders.filter((id) => cancelledOrders.some((o) => o.id === id)).length} محدد)
                      </span>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          disabled={selectedOrders.filter((id) => cancelledOrders.some((o) => o.id === id)).length === 0}
                        >
                          <Trash2 className="w-4 h-4 ml-2" />
                          حذف المحدد
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>تأكيد حذف الطلبات الملغية</AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتم حذف الطلبات المحددة نهائياً. لا تؤثر الطلبات الملغية على الأرباح أو المخزون أو المشتريات.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleBulkDelete(
                                selectedOrders.filter((id) => cancelledOrders.some((o) => o.id === id))
                              )
                            }
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-4">
                {cancelledOrders.map((order) => renderOrderCard(order, true))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      <OrderDetailsDialog
        orderId={detailsId}
        open={!!detailsId}
        onOpenChange={(o) => !o && setDetailsId(null)}
        onSaved={(u) => setOrders((prev) => prev.map((p) => p.id === u.id ? { ...p, ...u } : p))}
      />
    </div>
  );
};

export default Orders;
