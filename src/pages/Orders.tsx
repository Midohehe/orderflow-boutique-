import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, MapPin, Calendar, Loader2, Clock, Truck, CheckCircle, XCircle, Download, Trash2, Send, ImagePlus, Search, Eye, Plus, RefreshCw, PackageOpen, PhoneCall, PhoneOff, CalendarClock, MessageCircle, BarChart3, ShieldCheck, ShieldAlert, Hash, EyeOff } from "lucide-react";
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
import { isolateLatin } from "@/lib/bidi";

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  product_name: string;
  product_id?: string | null;
  price: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "settled" | "returned_received" | "unpacked";
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
  carrier_cancellation_reason_id?: string | null;
  carrier_notes?: string | null;
  confirmation_status?: "unconfirmed" | "confirmed" | "no_answer" | "postponed" | "cancelled" | null;
  confirmation_notes?: string | null;
  confirmation_attempts?: number | null;
  postponed_until?: string | null;
  confirmed_at?: string | null;
}

type ConfirmationStatus = "unconfirmed" | "confirmed" | "no_answer" | "postponed" | "cancelled";

const CONFIRMATION_LABELS: Record<ConfirmationStatus, string> = {
  unconfirmed: "بانتظار التأكيد",
  confirmed: "مؤكد",
  no_answer: "لم يرد",
  postponed: "مؤجل",
  cancelled: "ألغى الطلب",
};

const CONFIRMATION_BADGE_CLASS: Record<ConfirmationStatus, string> = {
  unconfirmed: "bg-muted text-muted-foreground",
  confirmed: "bg-success text-success-foreground",
  no_answer: "bg-warning text-warning-foreground",
  postponed: "bg-accent text-accent-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

const ORDER_SELECT_COLS = "id, customer_name, phone, address, city, product_name, product_id, price, status, created_at, selected_color, selected_size, selected_product_code, quantity, shipping_included, shipping_reference, matched_zone_name, matched_area_name, shipping_error, link_error, carrier_status, carrier_status_updated_at, carrier_status_raw, carrier_cancellation_reason_id, carrier_notes, confirmation_status, confirmation_notes, confirmation_attempts, postponed_until, confirmed_at";

const statusLabels: Record<Order["status"], string> = {
  pending: "قيد الانتظار",
  processing: "قيد المعالجة",
  shipped: "جاري التوصيل",
  delivered: "تم الاستلام",
  cancelled: "ملغي",
  settled: "تم استلام القيمة المالية",
  returned_received: "تم استلام المرتجع",
  unpacked: "تم التفريغ",
};

const statusColors: Record<Order["status"], string> = {
  pending: "bg-warning text-warning-foreground",
  processing: "bg-primary text-primary-foreground",
  shipped: "bg-accent text-accent-foreground",
  delivered: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
  settled: "bg-success text-success-foreground",
  returned_received: "bg-muted text-muted-foreground",
  unpacked: "bg-secondary text-secondary-foreground",
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
  const [openableMode, setOpenableMode] = useState<"yes" | "no">("yes");
  const [extracting, setExtracting] = useState(false);
  const [shippedSearch, setShippedSearch] = useState("");
  const [shippedCarrierFilter, setShippedCarrierFilter] = useState<string>("all");
  const [syncingCarrier, setSyncingCarrier] = useState(false);
  const [carrierSyncResult, setCarrierSyncResult] = useState<null | {
    total: number; updated: number; failed: number;
    codes: Array<{ code: string; count: number; label: string; mapped: boolean }>;
  }>(null);
  const [pendingDateFrom, setPendingDateFrom] = useState<string>("");
  const [pendingDateTo, setPendingDateTo] = useState<string>("");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [labelOrderMap, setLabelOrderMap] = useState<Record<string, number>>({});
  const [statusColorMap, setStatusColorMap] = useState<Record<string, string>>({});
  const [statusCategoryMap, setStatusCategoryMap] = useState<Record<string, string>>({});
  const [confirmationFilter, setConfirmationFilter] = useState<"all" | ConfirmationStatus>("all");
  const [confirmNoteOpen, setConfirmNoteOpen] = useState<string | null>(null);
  const [confirmNoteValue, setConfirmNoteValue] = useState("");
  const [confirmNoteAction, setConfirmNoteAction] = useState<ConfirmationStatus>("no_answer");
  const [confirmActionLoading, setConfirmActionLoading] = useState<string | null>(null);
  const [carrierRateProductFilter, setCarrierRateProductFilter] = useState<string>("all");
  const [showDeliveryStats, setShowDeliveryStats] = useState<boolean>(false);

  const COLOR_CLASSES: Record<string, string> = {
    default: "bg-accent text-accent-foreground",
    blue: "bg-blue-500 text-white",
    sky: "bg-sky-400 text-sky-950",
    indigo: "bg-indigo-600 text-white",
    cyan: "bg-cyan-500 text-white",
    teal: "bg-teal-500 text-white",
    green: "bg-green-600 text-white",
    lime: "bg-lime-500 text-lime-950",
    emerald: "bg-emerald-600 text-white",
    yellow: "bg-yellow-400 text-yellow-950",
    amber: "bg-amber-500 text-amber-950",
    red: "bg-red-600 text-white",
    rose: "bg-rose-600 text-white",
    fuchsia: "bg-fuchsia-600 text-white",
    purple: "bg-purple-600 text-white",
    violet: "bg-violet-600 text-white",
    orange: "bg-orange-500 text-white",
    pink: "bg-pink-500 text-white",
    brown: "bg-amber-800 text-white",
    stone: "bg-stone-500 text-white",
    slate: "bg-slate-600 text-white",
    zinc: "bg-zinc-600 text-white",
    black: "bg-black text-white",
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
      // Base status code can come from webhook payload (shipmentStatusCode)
      // or from sync-carrier-statuses (status.code)
      let base: any = raw.shipmentStatusCode ?? raw.shipment_status_code;
      if (base == null || base === "") {
        const st = raw.status;
        if (typeof st === "string") base = st;
        else if (st && typeof st === "object") base = st.code ?? st.name;
      }
      if (base != null && base !== "") {
        const baseStr = String(base).trim();
        if (baseStr.toUpperCase() === "DTR") return "DTR";
        const suffix = raw.deliveryTypeCode ?? raw.delivery_type_code
          ?? raw.returnTypeCode ?? raw.return_type_code;
        if (suffix != null && String(suffix).trim() !== "") {
          return baseStr + String(suffix).trim();
        }
        return baseStr;
      }
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
        .select(ORDER_SELECT_COLS)
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
            body: { order_ids: [ids[i]], shipping_included: shippingMode === "included", openable: openableMode === "yes" },
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
            .select(ORDER_SELECT_COLS)
            .order("created_at", { ascending: false }),
          supabase.from("store_settings").select("currency_symbol").maybeSingle(),
          supabase.from("carrier_status_mappings").select("status_code, custom_label, color, sort_order, category"),
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
          const lo: Record<string, number> = {};
          const catm: Record<string, string> = {};
          (mapRes.data as any[]).forEach((r) => {
            m[String(r.status_code)] = r.custom_label;
            if (r.color) cm[String(r.status_code)] = r.color;
            if (r.category) catm[String(r.status_code)] = r.category;
            const so = Number(r.sort_order ?? 0);
            if (so > 0) {
              const key = String(r.custom_label);
              if (lo[key] === undefined || so < lo[key]) lo[key] = so;
            }
          });
          setStatusMap(m);
          setStatusColorMap(cm);
          setLabelOrderMap(lo);
          setStatusCategoryMap(catm);
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
        .select(ORDER_SELECT_COLS)
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

  const handleSyncCarrierStatuses = async () => {
    setSyncingCarrier(true);
    setCarrierSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-carrier-statuses", { body: {} });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "فشل المزامنة");
      setCarrierSyncResult({
        total: data.total ?? 0,
        updated: data.updated ?? 0,
        failed: data.failed ?? 0,
        codes: data.codes ?? [],
      });
      toast({
        title: "تمت المزامنة",
        description: `تم تحديث ${data.updated} طلب من أصل ${data.total}`,
      });
      await fetchOrders();
    } catch (e: any) {
      toast({ title: "فشل المزامنة", description: e.message, variant: "destructive" });
    } finally {
      setSyncingCarrier(false);
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

  const handleConfirmationAction = async (
    order: Order,
    action: ConfirmationStatus,
    notes?: string,
  ) => {
    setConfirmActionLoading(order.id);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      const now = new Date().toISOString();
      const update: any = {
        confirmation_status: action,
        confirmation_attempts: (order.confirmation_attempts || 0) + 1,
      };
      if (action === "confirmed") {
        update.confirmed_at = now;
        update.confirmed_by = uid;
      }
      if (notes !== undefined) update.confirmation_notes = notes || null;
      if (action !== "postponed") update.postponed_until = null;

      const { error } = await supabase.from("orders").update(update).eq("id", order.id);
      if (error) throw error;

      if (uid) {
        await supabase.from("order_confirmation_attempts").insert({
          order_id: order.id,
          owner_id: uid,
          result: action,
          notes: notes || null,
          created_by: uid,
        });
      }

      // If marked cancelled in confirmation flow → cancel the order itself
      if (action === "cancelled") {
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                ...update,
                status: action === "cancelled" ? "cancelled" : o.status,
              }
            : o,
        ),
      );
      toast({ title: "تم", description: `تم تحديث حالة التأكيد: ${CONFIRMATION_LABELS[action]}` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر التحديث", variant: "destructive" });
    } finally {
      setConfirmActionLoading(null);
      setConfirmNoteOpen(null);
      setConfirmNoteValue("");
    }
  };

  const openWhatsApp = (phone: string, customerName: string, productName: string) => {
    const digits = (phone || "").replace(/\D/g, "");
    if (!digits) return;
    const text = encodeURIComponent(
      `السلام عليكم ${customerName || ""}، نتواصل معك لتأكيد طلبك (${productName || ""}). هل التوصيل والمواصفات لا تزال صحيحة؟`,
    );
    window.open(`https://wa.me/${digits}?text=${text}`, "_blank");
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
    const excelData = pendingOrders.map((order, index) => {
      const cityCorrected = (order as any).matched_zone_name || order.city;
      const areaCorrected = (order as any).matched_area_name || (order as any).matched_zone_name || order.city;
      const productName = isolateLatin(order.product_name);
      const notes = isolateLatin(order.selected_size || order.selected_color || "");
      const address = isolateLatin(order.address);
      const customerName = isolateLatin(order.customer_name);
      return {
        "رقم السطر": index + 1,
        "الخدمة": "شحن عادي",
        "نوع الطلب": "FDP",
        "اسم المرسل اليه": customerName,
        "المحافظه": cityCorrected,
        "اسم المنطقه": areaCorrected,
        "رقم الموبايل": order.phone,
        "رقم الهاتف": order.phone,
        "الرمز البريدي للمرسل اليه": "",
        "العنوان": address,
        "خط الطول": "",
        "خط العرض": "",
        "وصف الطرد": productName,
        "عدد القطع": order.quantity || 1,
        "الوزن": 1,
        "السعر": Number(order.price) || 0,
        "نوع السعر": shippingMode === "included" ? "INCLD" : "EXCLD",
        "نوع التحصيل": "COLC",
        "رقم المرجع": order.id.slice(0, 12).toUpperCase(),
        "ملاحظات": notes,
        "رقم البولويصة": "",
        "الراسل الفرعي": "",
        "المحافظة": cityCorrected,
        "المنطقة": areaCorrected,
        "رقم الموبايل ": order.phone,
        "رقم الهاتف ": order.phone,
        "الرمز البريدي للراسل": "",
        "العنوان ": address,
        "فتح الطرد": openableMode === "yes" ? "Y" : "N",
        "فئة العملات": "ANY",
      };
    });

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
  // Local sequential code per order: assigned in creation order (oldest = 01)
  const localCodeMap: Record<string, string> = (() => {
    const sorted = [...orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const map: Record<string, string> = {};
    sorted.forEach((o, i) => {
      map[o.id] = String(i + 1).padStart(2, "0");
    });
    return map;
  })();
  const productNames = Array.from(
    new Set(orders.map(displayProductName).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ar"));
  const allPending = orders.filter((o) => o.status === "pending");
  const pendingOrders = allPending.filter((o) => {
    if (productFilter !== "all" && displayProductName(o) !== productFilter) return false;
    if (confirmationFilter !== "all") {
      const cs = (o.confirmation_status as ConfirmationStatus | null) || "unconfirmed";
      if (cs !== confirmationFilter) return false;
    }
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
  const confirmationCounts = (() => {
    const c: Record<ConfirmationStatus, number> = {
      unconfirmed: 0, confirmed: 0, no_answer: 0, postponed: 0, cancelled: 0,
    };
    allPending.forEach((o) => {
      const k = ((o.confirmation_status as ConfirmationStatus | null) || "unconfirmed");
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  })();
  const allShipped = orders.filter((o) => o.status === "shipped");
  const shippedSearchNorm = shippedSearch.trim().toLowerCase();
  // Group by displayed label so codes that share the same custom_label
  // (merged in shipping settings) appear as a single filter option.
  const shippedCarrierOptions = (() => {
    const byLabel = new Map<string, string>(); // label -> first code seen
    let hasNone = false;
    for (const o of allShipped) {
      const code = extractStatusCode(o);
      if (code) {
        const label = statusMap[code] || displayCarrierStatus(o);
        if (!byLabel.has(label)) byLabel.set(label, code);
      } else {
        hasNone = true;
      }
    }
    const opts = Array.from(byLabel.entries()).map(([label, code]) => ({
      code: `label:${label}`,
      label,
      matchCode: code,
    }));
    opts.sort((a, b) => {
      const ao = labelOrderMap[a.label];
      const bo = labelOrderMap[b.label];
      if (ao !== undefined && bo !== undefined) return ao - bo;
      if (ao !== undefined) return -1;
      if (bo !== undefined) return 1;
      return a.label.localeCompare(b.label, "ar");
    });
    if (hasNone) opts.push({ code: "__none__", label: "بدون حالة", matchCode: "" });
    return opts;
  })();
  const shippedOrders = allShipped.filter((o) => {
    if (shippedSearchNorm) {
      const matches =
        (o.shipping_reference || "").toLowerCase().includes(shippedSearchNorm) ||
        (o.phone || "").toLowerCase().includes(shippedSearchNorm);
      if (!matches) return false;
    }
    if (shippedCarrierFilter !== "all") {
      const code = extractStatusCode(o);
      if (shippedCarrierFilter === "__none__") {
        if (code) return false;
      } else if (shippedCarrierFilter.startsWith("label:")) {
        const wanted = shippedCarrierFilter.slice("label:".length);
        const lbl = code ? (statusMap[code] || displayCarrierStatus(o)) : "";
        if (lbl !== wanted) return false;
      } else if (code !== shippedCarrierFilter) {
        return false;
      }
    }
    return true;
  });
  const deliveredOrders = orders.filter((o) => o.status === "delivered" || o.status === "settled");
  const unpackedOrders = orders.filter((o) => o.status === "unpacked");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  // Delivery rate by confirmation status — only orders that were sent to shipping
  const shippedFinalStatuses = new Set(["shipped", "delivered", "settled", "returned_received", "unpacked", "cancelled"]);
  const sentToCarrier = orders.filter((o) => !!o.shipping_reference || shippedFinalStatuses.has(o.status));
  const isConfirmed = (o: Order) => o.confirmation_status === "confirmed";
  const isDelivered = (o: Order) => o.status === "delivered" || o.status === "settled";
  const confirmedSent = sentToCarrier.filter(isConfirmed);
  const unconfirmedSent = sentToCarrier.filter((o) => !isConfirmed(o));
  const confirmedDelivered = confirmedSent.filter(isDelivered).length;
  const unconfirmedDelivered = unconfirmedSent.filter(isDelivered).length;
  const confirmedRate = confirmedSent.length > 0
    ? Math.round((confirmedDelivered / confirmedSent.length) * 100)
    : 0;
  const unconfirmedRate = unconfirmedSent.length > 0
    ? Math.round((unconfirmedDelivered / unconfirmedSent.length) * 100)
    : 0;

  // نسبة التسليم بناءً على تصنيف أكواد حالات شركة الشحن
  // (تم التسليم / راجع / قيد التنفيذ) — يعتمد على التصنيف المحدد في إعدادات الشحن.
  // اعرض فقط منتجات النظام الرئيسية (الموجودة في جدول المنتجات)
  const mainProductNames = new Set(Object.values(productsMap));
  const carrierRateProductOptions = Array.from(mainProductNames)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ar"));
  const carrierRateOrders =
    carrierRateProductFilter === "all"
      ? orders
      : orders.filter(
          (o) =>
            ((o.product_id && productsMap[o.product_id]) || o.product_name) ===
            carrierRateProductFilter,
        );
  const carrierCategoryCounts = carrierRateOrders.reduce(
    (acc, o) => {
      const code = extractStatusCode(o);
      const cat = code ? statusCategoryMap[code] : undefined;
      if (cat === "delivered") acc.delivered += 1;
      else if (cat === "returned") acc.returned += 1;
      else if (cat === "in_progress") acc.in_progress += 1;
      return acc;
    },
    { delivered: 0, returned: 0, in_progress: 0 },
  );
  const carrierCategorizedTotal =
    carrierCategoryCounts.delivered + carrierCategoryCounts.returned + carrierCategoryCounts.in_progress;
  const carrierDeliveryRate = carrierCategorizedTotal > 0
    ? Math.round((carrierCategoryCounts.delivered / carrierCategorizedTotal) * 100)
    : 0;
  const carrierReturnRate = carrierCategorizedTotal > 0
    ? Math.round((carrierCategoryCounts.returned / carrierCategorizedTotal) * 100)
    : 0;
  const carrierInProgressRate = carrierCategorizedTotal > 0
    ? Math.round((carrierCategoryCounts.in_progress / carrierCategorizedTotal) * 100)
    : 0;

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
                <Badge variant="outline" className="font-mono" title="كود الطلب المحلي">
                  <Hash className="w-3 h-3 ml-1" />
                  {localCodeMap[order.id] || "—"}
                </Badge>
                <h3 className="font-semibold text-foreground">{order.customer_name}</h3>
                <Badge className={statusColors[order.status]}>
                  {statusLabels[order.status]}
                </Badge>
                {(() => {
                  const cs = ((order.confirmation_status as ConfirmationStatus | null) || "unconfirmed");
                  return (
                    <Badge className={CONFIRMATION_BADGE_CLASS[cs]} title={order.confirmation_notes || undefined}>
                      {CONFIRMATION_LABELS[cs]}
                      {cs === "postponed" && order.postponed_until ? ` (${formatDate(order.postponed_until)})` : ""}
                      {(order.confirmation_attempts || 0) > 0 ? ` · ${order.confirmation_attempts} محاولة` : ""}
                    </Badge>
                  );
                })()}
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
                <span className="text-foreground">{isolateLatin(order.product_name)}</span>
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
              {(order.carrier_cancellation_reason_id || order.carrier_notes) && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs space-y-1">
                  {order.carrier_cancellation_reason_id && (
                    <div>
                      <span className="font-bold ml-1">سبب الإلغاء:</span>
                      <span className="text-foreground/80">{order.carrier_cancellation_reason_id}</span>
                    </div>
                  )}
                  {order.carrier_notes && (
                    <div>
                      <span className="font-bold ml-1">ملاحظات شركة الشحن:</span>
                      <span className="text-foreground/80 whitespace-pre-wrap">{order.carrier_notes}</span>
                    </div>
                  )}
                </div>
              )}
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
              {showCheckbox && order.status === "pending" && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t mt-2">
                  <span className="text-xs text-muted-foreground ml-1">تأكيد:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-success text-success hover:bg-success hover:text-success-foreground"
                    disabled={confirmActionLoading === order.id}
                    onClick={() => handleConfirmationAction(order, "confirmed")}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> مؤكد
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-warning text-warning hover:bg-warning hover:text-warning-foreground"
                    disabled={confirmActionLoading === order.id}
                    onClick={() => { setConfirmNoteAction("no_answer"); setConfirmNoteValue(order.confirmation_notes || ""); setConfirmNoteOpen(order.id); }}
                  >
                    <PhoneOff className="w-3.5 h-3.5" /> لم يرد
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    disabled={confirmActionLoading === order.id}
                    onClick={() => { setConfirmNoteAction("postponed"); setConfirmNoteValue(order.confirmation_notes || ""); setConfirmNoteOpen(order.id); }}
                  >
                    <CalendarClock className="w-3.5 h-3.5" /> تأجيل
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    disabled={confirmActionLoading === order.id}
                    onClick={() => { setConfirmNoteAction("cancelled"); setConfirmNoteValue(order.confirmation_notes || ""); setConfirmNoteOpen(order.id); }}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> إلغاء
                  </Button>
                  {order.phone && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-primary"
                        onClick={() => { window.location.href = `tel:${order.phone}`; }}
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> اتصال
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-success"
                        onClick={() => openWhatsApp(order.phone, order.customer_name, order.product_name)}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> واتساب
                      </Button>
                    </>
                  )}
                  {order.confirmation_notes && (
                    <span className="text-xs text-muted-foreground italic w-full">
                      📝 {order.confirmation_notes}
                    </span>
                  )}
                </div>
              )}
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

      {/* زر إظهار/إخفاء إحصائيات نسبة التسليم */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeliveryStats((v) => !v)}
          className="gap-2"
        >
          {showDeliveryStats ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showDeliveryStats ? "إخفاء نسب التسليم" : "إظهار نسب التسليم"}
        </Button>
      </div>

      {showDeliveryStats && (
      <>
      {/* نسبة التسليم حسب حالة التأكيد */}
      <Card className="card-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">نسبة التسليم حسب حالة التأكيد (للطلبات المرسلة لشركة الشحن)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border-2 border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-success" />
                <span className="font-semibold text-foreground">الطلبات المؤكدة</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-success">{confirmedRate}%</span>
                <span className="text-sm text-muted-foreground">
                  ({confirmedDelivered} من {confirmedSent.length})
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-success transition-all" style={{ width: `${confirmedRate}%` }} />
              </div>
            </div>
            <div className="rounded-lg border-2 border-warning/30 bg-warning/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-warning" />
                <span className="font-semibold text-foreground">الطلبات بدون تأكيد</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-warning">{unconfirmedRate}%</span>
                <span className="text-sm text-muted-foreground">
                  ({unconfirmedDelivered} من {unconfirmedSent.length})
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-warning transition-all" style={{ width: `${unconfirmedRate}%` }} />
              </div>
            </div>
          </div>
          {confirmedSent.length > 0 && unconfirmedSent.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              💡 الفرق: {confirmedRate - unconfirmedRate > 0 ? `+${confirmedRate - unconfirmedRate}` : confirmedRate - unconfirmedRate}% لصالح الطلبات المؤكدة
            </p>
          )}
        </CardContent>
      </Card>

      {/* نسبة التسليم بناءً على حالات شركة الشحن المصنّفة */}
      <Card className="card-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">نسبة التسليم حسب حالات شركة الشحن</h3>
            </div>
            <Select value={carrierRateProductFilter} onValueChange={setCarrierRateProductFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="اختر المنتج" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنتجات</SelectItem>
                {carrierRateProductOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {carrierCategorizedTotal === 0 ? (
            <p className="text-sm text-muted-foreground">
              لم يتم تصنيف أي حالة بعد. اذهب إلى <span className="font-semibold">إعدادات الشحن ← تخصيص أسماء حالات الشحن</span> وحدد لكل كود تصنيفه (تم التسليم / راجع / قيد التنفيذ) ليظهر الاحتساب هنا.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border-2 border-success/30 bg-success/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="font-semibold text-foreground">تم التسليم</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-success">{carrierDeliveryRate}%</span>
                    <span className="text-sm text-muted-foreground">
                      ({carrierCategoryCounts.delivered} من {carrierCategorizedTotal})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-success transition-all" style={{ width: `${carrierDeliveryRate}%` }} />
                  </div>
                </div>
                <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="font-semibold text-foreground">راجع</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-destructive">{carrierReturnRate}%</span>
                    <span className="text-sm text-muted-foreground">
                      ({carrierCategoryCounts.returned} من {carrierCategorizedTotal})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-destructive transition-all" style={{ width: `${carrierReturnRate}%` }} />
                  </div>
                </div>
                <div className="rounded-lg border-2 border-warning/30 bg-warning/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-warning" />
                    <span className="font-semibold text-foreground">قيد التنفيذ</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-warning">{carrierInProgressRate}%</span>
                    <span className="text-sm text-muted-foreground">
                      ({carrierCategoryCounts.in_progress} من {carrierCategorizedTotal})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-warning transition-all" style={{ width: `${carrierInProgressRate}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                يتم احتساب النسب من إجمالي الطلبات المصنّفة فقط ({carrierCategorizedTotal} طلب). لتعديل التصنيفات اذهب إلى إعدادات الشحن.
              </p>
            </>
          )}
        </CardContent>
      </Card>
      </>
      )}

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="unpacked" className="flex items-center gap-2">
            <PackageOpen className="w-4 h-4" />
            <span className="hidden sm:inline">تم التفريغ</span> ({unpackedOrders.length})
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
                    <Select value={confirmationFilter} onValueChange={(v) => { setConfirmationFilter(v as any); setSelectedOrders([]); }}>
                      <SelectTrigger className="w-full sm:w-52">
                        <SelectValue placeholder="فلتر حسب التأكيد" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل حالات التأكيد ({allPending.length})</SelectItem>
                        <SelectItem value="unconfirmed">بانتظار التأكيد ({confirmationCounts.unconfirmed})</SelectItem>
                        <SelectItem value="confirmed">مؤكد ({confirmationCounts.confirmed})</SelectItem>
                        <SelectItem value="no_answer">لم يرد ({confirmationCounts.no_answer})</SelectItem>
                        <SelectItem value="postponed">مؤجل ({confirmationCounts.postponed})</SelectItem>
                        <SelectItem value="cancelled">ألغى ({confirmationCounts.cancelled})</SelectItem>
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
                    <Select value={openableMode} onValueChange={(v) => setOpenableMode(v as any)}>
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue placeholder="فتح الطرد" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">غير مسموح بفتح الطرد</SelectItem>
                        <SelectItem value="yes">مسموح بفتح الطرد</SelectItem>
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
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={shippedSearch}
                    onChange={(e) => setShippedSearch(e.target.value)}
                    placeholder="ابحث بكود الشحن أو رقم الهاتف"
                    className="pr-10"
                  />
                </div>
                <Select value={shippedCarrierFilter} onValueChange={setShippedCarrierFilter}>
                  <SelectTrigger className="sm:w-64">
                    <SelectValue placeholder="فلترة حسب حالة الشحن" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات ({allShipped.length})</SelectItem>
                    {shippedCarrierOptions.map((opt) => {
                      const count = allShipped.filter((o) => {
                        const c = extractStatusCode(o);
                        if (opt.code === "__none__") return !c;
                        if (opt.code.startsWith("label:")) {
                          const wanted = opt.code.slice("label:".length);
                          const lbl = c ? (statusMap[c] || displayCarrierStatus(o)) : "";
                          return lbl === wanted;
                        }
                        return c === opt.code;
                      }).length;
                      return (
                        <SelectItem key={opt.code} value={opt.code}>
                          {opt.label} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSyncCarrierStatuses}
                  disabled={syncingCarrier}
                  className="gap-2"
                >
                  {syncingCarrier ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  مزامنة حالات الشحن
                </Button>
              </div>
              {carrierSyncResult && (
                <div className="mt-4 border-t pt-4 space-y-2">
                  <div className="text-sm text-muted-foreground">
                    تم فحص {carrierSyncResult.total} طلب — تحديث {carrierSyncResult.updated} — فشل {carrierSyncResult.failed}
                  </div>
                  {carrierSyncResult.codes.length === 0 ? (
                    <div className="text-sm">لم يتم استرجاع أي حالات.</div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">الأكواد المسترجعة من شركة الشحن:</div>
                      <div className="flex flex-wrap gap-2">
                        {carrierSyncResult.codes.map((c) => (
                          <Badge
                            key={c.code}
                            variant={c.mapped ? "default" : "secondary"}
                            className="text-xs"
                            title={c.label}
                          >
                            <span className="font-mono">{c.code}</span>
                            <span className="mx-1">·</span>
                            <span>{c.label}</span>
                            <span className="mx-1">·</span>
                            <span>{c.count}</span>
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        الأكواد بلون أزرق فاتح ليس لها تسمية مخصصة — يمكنك إضافتها من إعدادات شركة الشحن.
                      </div>
                    </div>
                  )}
                </div>
              )}
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

        <TabsContent value="unpacked" className="space-y-4">
          {unpackedOrders.length === 0 ? (
            renderEmptyState(
              <PackageOpen className="w-16 h-16 text-muted-foreground mb-4" />,
              "لا توجد طلبات تم تفريغها"
            )
          ) : (
            <div className="space-y-4">
              {unpackedOrders.map((order) => renderOrderCard(order))}
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

      <AlertDialog open={!!confirmNoteOpen} onOpenChange={(o) => { if (!o) { setConfirmNoteOpen(null); setConfirmNoteValue(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{CONFIRMATION_LABELS[confirmNoteAction]}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmNoteAction === "postponed"
                ? "اكتب موعد إعادة الاتصال أو أي ملاحظة (مثلاً: تأجيل ليوم الأحد)."
                : confirmNoteAction === "cancelled"
                ? "سيتم تغيير حالة الطلب إلى ملغي. اكتب سبب الإلغاء (اختياري)."
                : "اكتب ملاحظة (اختياري)، مثل: محاولة ثانية، الهاتف مغلق…"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmNoteValue}
            onChange={(e) => setConfirmNoteValue(e.target.value)}
            placeholder="ملاحظة..."
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const order = orders.find((o) => o.id === confirmNoteOpen);
                if (order) handleConfirmationAction(order, confirmNoteAction, confirmNoteValue);
              }}
            >
              حفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Orders;
