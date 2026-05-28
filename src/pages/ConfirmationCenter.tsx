import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck, PhoneCall, PhoneOff, CalendarClock, ShieldAlert,
  MessageCircle, Search, Loader2, ListChecks, Clock, History,
  RefreshCcw, Settings as SettingsIcon, ChevronLeft, ChevronRight,
  AlertTriangle, Repeat, UserCheck, Send, CheckCheck, Check, XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { isolateLatin } from "@/lib/bidi";
import { renderTemplate } from "@/lib/confirmationTemplates";

type Status = "unconfirmed" | "confirmed" | "no_answer" | "postponed" | "cancelled";

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  product_name: string;
  price: number;
  quantity?: number;
  selected_color?: string | null;
  selected_size?: string | null;
  status: string;
  created_at: string;
  confirmation_status: Status;
  confirmation_notes?: string | null;
  confirmation_attempts?: number | null;
  postponed_until?: string | null;
  last_attempt_at?: string | null;
  cancellation_reason?: string | null;
  matched_zone_name?: string | null;
  matched_area_name?: string | null;
}

interface Template { id: string; name: string; body: string; is_default: boolean; channel: string }
interface CancellationReason { id: string; label: string }
interface Attempt {
  id: string; result: string; notes: string | null; created_at: string;
}

type WaStatus = "pending" | "sent" | "delivered" | "read" | "failed";
interface WaMsgInfo { status: WaStatus; created_at: string }

const WA_LABEL: Record<WaStatus, string> = {
  pending: "قيد الإرسال",
  sent: "تم الإرسال",
  delivered: "وصلت للعميل",
  read: "قُرئت",
  failed: "فشلت",
};
const WA_BADGE: Record<WaStatus, string> = {
  pending: "bg-muted text-muted-foreground border-muted-foreground/30",
  sent: "bg-primary/10 text-primary border-primary/30",
  delivered: "bg-success/10 text-success border-success/40",
  read: "bg-success text-success-foreground",
  failed: "bg-destructive/10 text-destructive border-destructive/40",
};
const WA_ICON: Record<WaStatus, any> = {
  pending: Clock, sent: Check, delivered: CheckCheck, read: CheckCheck, failed: XCircle,
};

const LABEL: Record<Status, string> = {
  unconfirmed: "بانتظار التأكيد",
  confirmed: "مؤكد",
  no_answer: "لم يرد",
  postponed: "مؤجل",
  cancelled: "ألغى",
};

const BADGE: Record<Status, string> = {
  unconfirmed: "bg-muted text-muted-foreground",
  confirmed: "bg-success text-success-foreground",
  no_answer: "bg-warning text-warning-foreground",
  postponed: "bg-accent text-accent-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

const arabicTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("ar-LY", { dateStyle: "short", timeStyle: "short" }) : "";

const sinceText = (d: string) => {
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3.6e6);
  if (h < 1) return `منذ ${Math.max(1, Math.floor(ms / 6e4))} د`;
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} يوم`;
};

export default function ConfirmationCenter() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status | "log">("unconfirmed");
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"oldest" | "newest" | "callback">("oldest");
  const [busyId, setBusyId] = useState<string | null>(null);

  // dialogs
  const [noteDialog, setNoteDialog] = useState<{ order: Order; action: Status } | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [postponeDate, setPostponeDate] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // drawer
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  // settings data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [reasons, setReasons] = useState<CancellationReason[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // global activity log
  const [allAttempts, setAllAttempts] = useState<(Attempt & { order_id: string })[]>([]);

  // confirmation whatsapp message status per order_id (latest outgoing msg)
  const [waByOrder, setWaByOrder] = useState<Record<string, WaMsgInfo>>({});
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) { setLoading(false); return; }
    const { data: ownerRow } = await (supabase as any).rpc("get_effective_owner_id", { _uid: u.user.id });
    const oid = (ownerRow as string) || u.user.id;
    setOwnerId(oid);
    const sid = (typeof window !== "undefined" && u.user.id)
      ? localStorage.getItem(`active_store_id:${u.user.id}`)
      : null;
    if (!sid) { setLoading(false); setOrders([]); setTemplates([]); setReasons([]); setAllAttempts([]); return; }

    const [oRes, tRes, rRes, aRes] = await Promise.all([
      supabase.from("orders")
        .select("id,customer_name,phone,address,city,product_name,price,quantity,selected_color,selected_size,status,created_at,confirmation_status,confirmation_notes,confirmation_attempts,postponed_until,last_attempt_at,cancellation_reason,matched_zone_name,matched_area_name")
        .eq("store_id", sid)
        .eq("is_deleted", false)
        .in("status", ["pending"])
        .order("created_at", { ascending: true })
        .limit(1000),
      (supabase as any).from("confirmation_templates").select("*").eq("store_id", sid).order("is_default", { ascending: false }),
      (supabase as any).from("cancellation_reasons").select("id,label").eq("store_id", sid).order("sort_order"),
      (supabase as any).from("order_confirmation_attempts").select("id,order_id,result,notes,created_at").eq("store_id", sid).order("created_at", { ascending: false }).limit(300),
    ]);
    const ordersList = (oRes.data as Order[]) || [];
    setOrders(ordersList);
    setTemplates((tRes.data as Template[]) || []);
    setReasons((rRes.data as CancellationReason[]) || []);
    setAllAttempts((aRes.data as any) || []);

    // Load latest outgoing whatsapp message per order (for confirmation status badge)
    const orderIds = ordersList.map(o => o.id);
    if (orderIds.length > 0) {
      const { data: msgs } = await supabase
        .from("whatsapp_messages")
        .select("order_id,status,created_at")
        .in("order_id", orderIds)
        .eq("direction", "out")
        .order("created_at", { ascending: false });
      const map: Record<string, WaMsgInfo> = {};
      for (const m of (msgs as any[]) || []) {
        if (m.order_id && !map[m.order_id]) {
          map[m.order_id] = { status: m.status as WaStatus, created_at: m.created_at };
        }
      }
      setWaByOrder(map);
    } else {
      setWaByOrder({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime: live-update confirmation message status
  useEffect(() => {
    if (!ownerId) return;
    const ch = supabase
      .channel(`wa-msg-status-${ownerId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "whatsapp_messages",
        filter: `owner_id=eq.${ownerId}`,
      }, (payload: any) => {
        const row = payload.new || payload.old;
        if (!row || row.direction !== "out" || !row.order_id) return;
        setWaByOrder(prev => {
          const cur = prev[row.order_id];
          if (cur && new Date(cur.created_at) > new Date(row.created_at)) return prev;
          return { ...prev, [row.order_id]: { status: row.status, created_at: row.created_at } };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ownerId]);

  // Send confirmation WhatsApp for a single order (uses server template + provider)
  const sendConfirmMessage = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      // optimistic pending
      setWaByOrder(prev => ({ ...prev, [orderId]: { status: "pending", created_at: new Date().toISOString() } }));
      const { data, error } = await supabase.functions.invoke("whatsapp-send-confirmation", {
        body: { order_id: orderId },
      });
      if (error) throw error;
      if ((data as any)?.skipped) {
        toast({ title: "تعذر الإرسال", description: "إعدادات الواتساب غير مفعّلة", variant: "destructive" });
        setWaByOrder(prev => { const c = { ...prev }; delete c[orderId]; return c; });
        return false;
      }
      if ((data as any)?.ok) {
        setWaByOrder(prev => ({ ...prev, [orderId]: { status: "sent", created_at: new Date().toISOString() } }));
        return true;
      }
      throw new Error((data as any)?.error || "فشل الإرسال");
    } catch (e: any) {
      setWaByOrder(prev => ({ ...prev, [orderId]: { status: "failed", created_at: new Date().toISOString() } }));
      toast({ title: "فشل الإرسال", description: e?.message || "خطأ", variant: "destructive" });
      return false;
    }
  }, []);

  const sendOneConfirm = async (order: Order) => {
    setBusyId(order.id);
    const ok = await sendConfirmMessage(order.id);
    if (ok) toast({ title: "تم", description: `تم إرسال رسالة التأكيد لـ ${order.customer_name}` });
    setBusyId(null);
  };

  const sendBulkConfirm = async () => {
    const targets = orders.filter(o => o.confirmation_status === "unconfirmed");
    if (targets.length === 0) {
      toast({ title: "لا يوجد", description: "لا توجد طلبات بانتظار التأكيد" });
      return;
    }
    setBulkSending(true);
    setBulkProgress({ done: 0, total: targets.length });
    let success = 0, fail = 0;
    // Sequential to avoid provider rate limits
    for (let i = 0; i < targets.length; i++) {
      const ok = await sendConfirmMessage(targets[i].id);
      ok ? success++ : fail++;
      setBulkProgress({ done: i + 1, total: targets.length });
      // small delay
      await new Promise(r => setTimeout(r, 350));
    }
    setBulkSending(false);
    setBulkProgress(null);
    toast({ title: "اكتمل الإرسال", description: `نجح: ${success} · فشل: ${fail}` });
  };

  // postponed callbacks reminder (every 60s)
  useEffect(() => {
    const i = setInterval(() => {
      const due = orders.filter(o => o.confirmation_status === "postponed" && o.postponed_until && new Date(o.postponed_until) <= new Date());
      if (due.length > 0) {
        toast({ title: "📞 موعد إعادة اتصال", description: `${due.length} طلب يحتاج إعادة اتصال الآن` });
      }
    }, 60_000);
    return () => clearInterval(i);
  }, [orders]);

  // counts & stats
  const counts = useMemo(() => {
    const c: Record<Status, number> = { unconfirmed: 0, confirmed: 0, no_answer: 0, postponed: 0, cancelled: 0 };
    orders.forEach(o => { c[o.confirmation_status] = (c[o.confirmation_status] || 0) + 1; });
    return c;
  }, [orders]);

  const stats = useMemo(() => {
    const total = orders.length;
    const processed = counts.confirmed + counts.cancelled + counts.no_answer + counts.postponed;
    const rate = processed > 0 ? Math.round((counts.confirmed / processed) * 100) : 0;
    const avgAttempts = orders.length
      ? (orders.reduce((s, o) => s + (o.confirmation_attempts || 0), 0) / orders.length).toFixed(1)
      : "0";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = orders.filter(o => new Date(o.created_at) >= today).length;
    return { total, rate, avgAttempts, todayCount, processed };
  }, [orders, counts]);

  // phone frequency for "repeat customer" badge
  const phoneFreq = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach(o => { const k = (o.phone || "").replace(/\D/g, ""); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return m;
  }, [orders]);

  const filteredBase = useMemo(() => {
    let arr = orders.slice();
    if (tab !== "log") arr = arr.filter(o => o.confirmation_status === tab);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter(o =>
        (o.customer_name || "").toLowerCase().includes(s) ||
        (o.phone || "").includes(s) ||
        o.id.toLowerCase().includes(s));
    }
    if (productFilter !== "all") arr = arr.filter(o => o.product_name === productFilter);
    if (cityFilter !== "all") arr = arr.filter(o => (o.matched_zone_name || o.city) === cityFilter);
    if (sortBy === "oldest") arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    else if (sortBy === "newest") arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sortBy === "callback") arr.sort((a, b) => (a.postponed_until ? +new Date(a.postponed_until) : Infinity) - (b.postponed_until ? +new Date(b.postponed_until) : Infinity));
    return arr;
  }, [orders, tab, search, productFilter, cityFilter, sortBy]);

  const productOptions = useMemo(() => Array.from(new Set(orders.map(o => o.product_name).filter(Boolean))), [orders]);
  const cityOptions = useMemo(() => Array.from(new Set(orders.map(o => o.matched_zone_name || o.city).filter(Boolean))) as string[], [orders]);

  // === actions ===
  const performAction = async (order: Order, action: Status, opts?: { notes?: string; postponed_until?: string; cancellation_reason?: string }) => {
    setBusyId(order.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      const now = new Date().toISOString();
      const update: any = {
        confirmation_status: action,
        confirmation_attempts: (order.confirmation_attempts || 0) + 1,
        last_attempt_at: now,
      };
      if (action === "confirmed") { update.confirmed_at = now; update.confirmed_by = uid; }
      if (opts?.notes !== undefined) update.confirmation_notes = opts.notes || null;
      if (action === "postponed") update.postponed_until = opts?.postponed_until || null;
      else update.postponed_until = null;
      if (action === "cancelled" && opts?.cancellation_reason) update.cancellation_reason = opts.cancellation_reason;

      const { error } = await supabase.from("orders").update(update).eq("id", order.id);
      if (error) throw error;

      if (uid && ownerId) {
        await (supabase as any).from("order_confirmation_attempts").insert({
          order_id: order.id, owner_id: ownerId,
          result: action, notes: opts?.notes || null, created_by: uid,
        });
      }
      if (action === "cancelled") {
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      }
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...update, status: action === "cancelled" ? "cancelled" : o.status } : o));
      toast({ title: "تم", description: `تم تحديث الحالة: ${LABEL[action]}` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل التحديث", variant: "destructive" });
    } finally {
      setBusyId(null);
      setNoteDialog(null);
      setNoteValue("");
      setPostponeDate("");
      setCancelReason("");
    }
  };

  const incrementAttempt = async (order: Order) => {
    try {
      const now = new Date().toISOString();
      await supabase.from("orders").update({
        confirmation_attempts: (order.confirmation_attempts || 0) + 1,
        last_attempt_at: now,
      }).eq("id", order.id);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, confirmation_attempts: (o.confirmation_attempts || 0) + 1, last_attempt_at: now } : o));
    } catch {}
  };

  const handleCall = (order: Order) => {
    if (!order.phone) return;
    incrementAttempt(order);
    window.location.href = `tel:${order.phone}`;
  };

  const openWhatsApp = (order: Order, template?: Template) => {
    const digits = (order.phone || "").replace(/\D/g, "");
    if (!digits) return;
    const body = template?.body || templates.find(t => t.is_default)?.body ||
      `السلام عليكم ${order.customer_name || ""}، نتواصل معك لتأكيد طلبك (${order.product_name || ""}).`;
    const text = renderTemplate(body, {
      customer_name: order.customer_name, product_name: order.product_name,
      price: order.price, city: order.matched_zone_name || order.city,
      quantity: order.quantity, order_id: order.id,
    });
    incrementAttempt(order);
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
  };

  // drawer
  const openDrawer = async (order: Order) => {
    setDrawerOrder(order);
    setAttempts([]);
    setCustomerOrders([]);
    if (!ownerId) return;
    const [a, c] = await Promise.all([
      (supabase as any).from("order_confirmation_attempts").select("id,result,notes,created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("id,customer_name,product_name,price,status,confirmation_status,created_at").eq("owner_id", ownerId).eq("phone", order.phone).neq("id", order.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setAttempts((a.data as Attempt[]) || []);
    setCustomerOrders((c.data as any) || []);
  };

  // keyboard shortcuts inside drawer
  useEffect(() => {
    if (!drawerOrder) return;
    const handler = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "c") performAction(drawerOrder, "confirmed");
      else if (k === "n") { setNoteDialog({ order: drawerOrder, action: "no_answer" }); setNoteValue(drawerOrder.confirmation_notes || ""); }
      else if (k === "p") { setNoteDialog({ order: drawerOrder, action: "postponed" }); setNoteValue(drawerOrder.confirmation_notes || ""); }
      else if (k === "x") { setNoteDialog({ order: drawerOrder, action: "cancelled" }); setNoteValue(drawerOrder.confirmation_notes || ""); }
      else if (k === "w") openWhatsApp(drawerOrder);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOrder]);

  const renderRow = (o: Order) => {
    const repeat = phoneFreq.get((o.phone || "").replace(/\D/g, "")) || 0;
    const isDue = o.postponed_until && new Date(o.postponed_until) <= new Date();
    const wa = waByOrder[o.id];
    const WaI = wa ? WA_ICON[wa.status] : null;
    return (
      <Card key={o.id} className={`card-shadow ${isDue ? "ring-2 ring-destructive" : ""}`}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-foreground">{o.customer_name}</h3>
                <Badge className={BADGE[o.confirmation_status]}>{LABEL[o.confirmation_status]}</Badge>
                {repeat > 1 && (
                  <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">
                    <Repeat className="w-3 h-3 ml-1" /> عميل متكرر ×{repeat}
                  </Badge>
                )}
                {wa && WaI && (
                  <Badge variant="outline" className={WA_BADGE[wa.status]} title={`رسالة التأكيد: ${WA_LABEL[wa.status]} · ${arabicTime(wa.created_at)}`}>
                    <WaI className="w-3 h-3 ml-1" /> {WA_LABEL[wa.status]}
                  </Badge>
                )}
                {!wa && o.confirmation_status === "unconfirmed" && (
                  <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-dashed">
                    لم تُرسل رسالة التأكيد
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{sinceText(o.created_at)}</span>
                {(o.confirmation_attempts || 0) > 0 && (
                  <span className="text-xs text-warning font-semibold">محاولات: {o.confirmation_attempts}</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-foreground">📞 <a href={`tel:${o.phone}`} className="font-semibold hover:underline">{isolateLatin(o.phone)}</a></div>
                <div className="text-foreground">🛒 {o.product_name} {o.quantity && o.quantity > 1 ? `× ${o.quantity}` : ""}</div>
                <div className="text-muted-foreground">📍 {o.matched_zone_name || o.city}{o.matched_area_name ? ` - ${o.matched_area_name}` : ""}</div>
                <div className="text-foreground font-semibold">💰 {o.price}</div>
                {(o.selected_color || o.selected_size) && (
                  <div className="text-xs text-muted-foreground col-span-2">
                    {o.selected_color && <span>اللون: {o.selected_color} · </span>}
                    {o.selected_size && <span>المقاس: {o.selected_size}</span>}
                  </div>
                )}
                {o.address && <div className="text-xs text-muted-foreground col-span-2">{o.address}</div>}
              </div>
              {o.postponed_until && (
                <div className={`text-xs ${isDue ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                  <Clock className="w-3 h-3 inline ml-1" />
                  موعد إعادة الاتصال: {arabicTime(o.postponed_until)} {isDue && "⚠ تأخر"}
                </div>
              )}
              {o.confirmation_notes && (
                <div className="text-xs text-muted-foreground italic">📝 {o.confirmation_notes}</div>
              )}
              {o.cancellation_reason && (
                <div className="text-xs text-destructive">سبب الإلغاء: {o.cancellation_reason}</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 md:flex-col md:items-stretch md:w-44">
              <Button size="sm" className="h-8 gap-1" disabled={busyId === o.id}
                onClick={() => performAction(o, "confirmed")}>
                <ShieldCheck className="w-3.5 h-3.5" /> مؤكد
              </Button>
              <div className="flex gap-1.5 w-full">
                <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 border-warning text-warning hover:bg-warning hover:text-warning-foreground"
                  onClick={() => { setNoteDialog({ order: o, action: "no_answer" }); setNoteValue(o.confirmation_notes || ""); }}>
                  <PhoneOff className="w-3.5 h-3.5" /> لم يرد
                </Button>
                <Button size="sm" variant="outline" className="h-8 flex-1 gap-1"
                  onClick={() => { setNoteDialog({ order: o, action: "postponed" }); setNoteValue(o.confirmation_notes || ""); setPostponeDate(o.postponed_until?.slice(0, 16) || ""); }}>
                  <CalendarClock className="w-3.5 h-3.5" /> تأجيل
                </Button>
              </div>
              <div className="flex gap-1.5 w-full">
                <Button size="sm" variant="ghost" className="h-8 flex-1 gap-1 text-primary"
                  onClick={() => handleCall(o)} disabled={!o.phone}>
                  <PhoneCall className="w-3.5 h-3.5" /> اتصال
                </Button>
                <Select onValueChange={(v) => {
                  const t = templates.find(x => x.id === v);
                  openWhatsApp(o, t);
                }}>
                  <SelectTrigger className="h-8 flex-1 gap-1 text-success border-input">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="text-xs">واتساب</span>
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 && <SelectItem value="default">رسالة افتراضية</SelectItem>}
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " ⭐" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1.5 w-full">
                <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => { setNoteDialog({ order: o, action: "cancelled" }); setNoteValue(o.confirmation_notes || ""); setCancelReason(o.cancellation_reason || ""); }}>
                  <ShieldAlert className="w-3.5 h-3.5" /> إلغاء
                </Button>
                <Button size="sm" variant="outline" className="h-8 flex-1 gap-1"
                  onClick={() => openDrawer(o)}>
                  <History className="w-3.5 h-3.5" /> تفاصيل
                </Button>
              </div>
              {o.confirmation_status === "unconfirmed" && (
                <Button size="sm" variant="outline" className="h-8 w-full gap-1 border-success text-success hover:bg-success hover:text-success-foreground"
                  disabled={busyId === o.id || wa?.status === "pending"}
                  onClick={() => sendOneConfirm(o)}>
                  {busyId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {wa ? "إعادة إرسال التأكيد" : "إرسال رسالة التأكيد"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={ShieldCheck}
        title="مركز تأكيد الطلبات"
        description="إدارة احترافية لمكالمات التأكيد، الرد، التأجيل، والإلغاء"
        iconGradient="from-emerald-500 to-teal-600"
        action={
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={sendBulkConfirm} disabled={bulkSending || counts.unconfirmed === 0}
              className="bg-success hover:bg-success/90 text-success-foreground">
              {bulkSending ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Send className="w-4 h-4 ml-1" />}
              {bulkSending && bulkProgress
                ? `جاري الإرسال ${bulkProgress.done}/${bulkProgress.total}`
                : `إرسال التأكيد للكل (${counts.unconfirmed})`}
            </Button>
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              <RefreshCcw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} /> تحديث
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/confirmation/settings"><SettingsIcon className="w-4 h-4 ml-1" /> الإعدادات</Link>
            </Button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="بانتظار" value={counts.unconfirmed} icon={ListChecks} color="text-muted-foreground" />
        <StatCard label="مؤكد" value={counts.confirmed} icon={ShieldCheck} color="text-success" />
        <StatCard label="لم يرد" value={counts.no_answer} icon={PhoneOff} color="text-warning" />
        <StatCard label="مؤجل" value={counts.postponed} icon={CalendarClock} color="text-primary" />
        <StatCard label="ألغى" value={counts.cancelled} icon={ShieldAlert} color="text-destructive" />
        <StatCard label="نسبة التأكيد" value={`${stats.rate}%`} icon={UserCheck} color="text-primary" />
      </div>

      <Card className="card-shadow">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>الإجمالي قيد المعالجة: <span className="font-bold">{stats.total}</span></div>
          <div>طلبات اليوم: <span className="font-bold">{stats.todayCount}</span></div>
          <div>متوسط المحاولات: <span className="font-bold">{stats.avgAttempts}</span></div>
          <div>تمت المعالجة: <span className="font-bold">{stats.processed}</span> / {stats.total}</div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="card-shadow">
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث برقم الهاتف / الاسم / كود الطلب"
              className="pr-9" />
          </div>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="المنتج" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المنتجات</SelectItem>
              {productOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="المدينة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المدن</SelectItem>
              {cityOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="oldest">الأقدم أولاً</SelectItem>
              <SelectItem value="newest">الأحدث أولاً</SelectItem>
              <SelectItem value="callback">حسب موعد الاتصال</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="w-full overflow-x-auto flex justify-start">
          <TabsTrigger value="unconfirmed">بانتظار ({counts.unconfirmed})</TabsTrigger>
          <TabsTrigger value="no_answer">لم يرد ({counts.no_answer})</TabsTrigger>
          <TabsTrigger value="postponed">مؤجل ({counts.postponed})</TabsTrigger>
          <TabsTrigger value="confirmed">مؤكد ({counts.confirmed})</TabsTrigger>
          <TabsTrigger value="cancelled">ألغى ({counts.cancelled})</TabsTrigger>
          <TabsTrigger value="log"><History className="w-4 h-4 ml-1" /> السجل</TabsTrigger>
        </TabsList>

        {(["unconfirmed", "no_answer", "postponed", "confirmed", "cancelled"] as Status[]).map(t => (
          <TabsContent key={t} value={t} className="mt-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filteredBase.length === 0 ? (
              <Card><CardContent className="p-10 text-center text-muted-foreground">لا توجد طلبات في هذا التبويب</CardContent></Card>
            ) : filteredBase.map(renderRow)}
          </TabsContent>
        ))}

        <TabsContent value="log" className="mt-4">
          <Card><CardContent className="p-4">
            {allAttempts.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">لا توجد محاولات مسجلة</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {allAttempts.map(a => {
                  const ord = orders.find(o => o.id === a.order_id);
                  return (
                    <div key={a.id} className="flex flex-wrap gap-2 items-center border-b pb-2 text-sm">
                      <Badge className={BADGE[a.result as Status] || "bg-muted"}>{LABEL[a.result as Status] || a.result}</Badge>
                      <span className="text-muted-foreground text-xs">{arabicTime(a.created_at)}</span>
                      {ord && <span className="font-semibold">{ord.customer_name}</span>}
                      {ord && <span className="text-xs text-muted-foreground">{ord.phone}</span>}
                      {a.notes && <span className="text-xs italic">— {a.notes}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Note dialog (no_answer / postponed / cancelled) */}
      <AlertDialog open={!!noteDialog} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {noteDialog?.action === "no_answer" && "تسجيل: لم يرد"}
              {noteDialog?.action === "postponed" && "تأجيل المكالمة"}
              {noteDialog?.action === "cancelled" && "إلغاء الطلب"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {noteDialog?.action === "cancelled"
                ? "اختر سبب الإلغاء (أو اكتب سبباً مخصصاً)."
                : noteDialog?.action === "postponed"
                ? "حدد موعد إعادة الاتصال + ملاحظة (اختياري)."
                : "اكتب ملاحظة (اختياري) عن سبب عدم الرد."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {noteDialog?.action === "postponed" && (
            <Input type="datetime-local" value={postponeDate} onChange={(e) => setPostponeDate(e.target.value)} />
          )}
          {noteDialog?.action === "cancelled" && reasons.length > 0 && (
            <Select value={cancelReason} onValueChange={(v) => setCancelReason(v)}>
              <SelectTrigger><SelectValue placeholder="اختر سبباً جاهزاً" /></SelectTrigger>
              <SelectContent>
                {reasons.map(r => <SelectItem key={r.id} value={r.label}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {noteDialog?.action === "cancelled" && (
            <Input placeholder="أو اكتب سبباً مخصصاً" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          )}

          <Textarea value={noteValue} onChange={(e) => setNoteValue(e.target.value)} placeholder="ملاحظة..." rows={3} />

          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => noteDialog && performAction(noteDialog.order, noteDialog.action, {
              notes: noteValue, postponed_until: postponeDate ? new Date(postponeDate).toISOString() : undefined,
              cancellation_reason: cancelReason || undefined,
            })}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Side drawer */}
      <Sheet open={!!drawerOrder} onOpenChange={(o) => !o && setDrawerOrder(null)}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto" dir="rtl">
          <SheetHeader>
            <SheetTitle>{drawerOrder?.customer_name}</SheetTitle>
          </SheetHeader>
          {drawerOrder && (
            <div className="mt-4 space-y-4 text-sm">
              <Card><CardContent className="p-3 space-y-1">
                <div>📞 <a href={`tel:${drawerOrder.phone}`} className="font-semibold">{isolateLatin(drawerOrder.phone)}</a></div>
                <div>🛒 {drawerOrder.product_name}</div>
                <div>📍 {drawerOrder.matched_zone_name || drawerOrder.city}</div>
                <div>💰 {drawerOrder.price}</div>
                <div className="text-xs text-muted-foreground">عمر الطلب: {sinceText(drawerOrder.created_at)}</div>
                <div className="text-xs text-muted-foreground">عدد المحاولات: {drawerOrder.confirmation_attempts || 0}</div>
              </CardContent></Card>

              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                ⌨ اختصارات: <kbd className="px-1 bg-background rounded">C</kbd> مؤكد ·
                <kbd className="px-1 bg-background rounded mx-1">N</kbd> لم يرد ·
                <kbd className="px-1 bg-background rounded">P</kbd> تأجيل ·
                <kbd className="px-1 bg-background rounded mx-1">X</kbd> إلغاء ·
                <kbd className="px-1 bg-background rounded">W</kbd> واتساب
              </div>

              <div>
                <h4 className="font-bold mb-2">سجل المحاولات</h4>
                {attempts.length === 0 ? (
                  <div className="text-muted-foreground text-xs">لا توجد محاولات سابقة.</div>
                ) : (
                  <div className="space-y-1">
                    {attempts.map(a => (
                      <div key={a.id} className="flex flex-wrap items-center gap-2 border-b pb-1 text-xs">
                        <Badge className={BADGE[a.result as Status] || "bg-muted"}>{LABEL[a.result as Status] || a.result}</Badge>
                        <span className="text-muted-foreground">{arabicTime(a.created_at)}</span>
                        {a.notes && <span className="italic">{a.notes}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold mb-2">طلبات هذا العميل السابقة ({customerOrders.length})</h4>
                {customerOrders.length === 0 ? (
                  <div className="text-muted-foreground text-xs">لا توجد طلبات سابقة.</div>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {customerOrders.map(co => (
                      <div key={co.id} className="border-b pb-1 text-xs flex flex-wrap gap-2 items-center">
                        <span>{co.product_name}</span>
                        <Badge className={BADGE[co.confirmation_status as Status] || "bg-muted"}>{LABEL[co.confirmation_status as Status] || co.confirmation_status}</Badge>
                        <span className="text-muted-foreground">{arabicTime(co.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}