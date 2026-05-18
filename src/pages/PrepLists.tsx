import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Printer, CheckCircle2, ClipboardList } from "lucide-react";
import { printStickers, DEFAULT_STICKER_SETTINGS, type StickerSettings, type StickerOrder } from "@/lib/printSticker";

type PrepList = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  count?: number;
};

type OrderLite = {
  id: string;
  customer_name: string;
  phone: string;
  city: string;
  address: string;
  product_name: string;
  price: number;
  quantity: number;
  status: string;
  shipping_reference: string | null;
  matched_zone_name: string | null;
  matched_area_name: string | null;
  selected_color: string | null;
  selected_size: string | null;
  selected_product_code: string | null;
  carrier_status: string | null;
  created_at: string;
};

export default function PrepLists() {
  const { activeStoreId } = useStoreContext();
  const [lists, setLists] = useState<PrepList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [openList, setOpenList] = useState<PrepList | null>(null);
  const [listOrders, setListOrders] = useState<OrderLite[]>([]);
  const [pendingOrders, setPendingOrders] = useState<OrderLite[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [stickerSettings, setStickerSettings] = useState<StickerSettings>(DEFAULT_STICKER_SETTINGS);
  const [currencySymbol, setCurrencySymbol] = useState("د.ل");
  const [storeName, setStoreName] = useState("");

  const loadLists = async () => {
    if (!activeStoreId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("prep_lists")
      .select("id, name, status, created_at, confirmed_at, prep_list_orders(count)")
      .eq("store_id", activeStoreId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const rows = (data || []).map((r: any) => ({
      id: r.id, name: r.name, status: r.status,
      created_at: r.created_at, confirmed_at: r.confirmed_at,
      count: r.prep_list_orders?.[0]?.count ?? 0,
    }));
    setLists(rows);
    setLoading(false);
  };

  useEffect(() => {
    loadLists();
    if (!activeStoreId) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const [cur, stk, hd] = await Promise.all([
        supabase.from("store_settings").select("currency_symbol").eq("owner_id", uid!).maybeSingle(),
        uid ? supabase.from("sticker_settings").select("*").eq("owner_id", uid).maybeSingle() : Promise.resolve({ data: null } as any),
        supabase.from("header_settings").select("logo_text").eq("store_id", activeStoreId).maybeSingle(),
      ]);
      if (cur.data?.currency_symbol) setCurrencySymbol(cur.data.currency_symbol);
      if (stk?.data) {
        const s: any = stk.data;
        setStickerSettings({
          page_width_mm: s.page_width_mm ?? 100, page_height_mm: s.page_height_mm ?? 150,
          font_size: s.font_size ?? 12, header_text: s.header_text ?? "", footer_text: s.footer_text ?? "",
          show_barcode: s.show_barcode ?? true, show_logo: s.show_logo ?? false,
          fields: Array.isArray(s.fields) && s.fields.length > 0 ? s.fields : DEFAULT_STICKER_SETTINGS.fields,
        });
      }
      if (hd?.data?.logo_text) setStoreName(hd.data.logo_text);
    })();
  }, [activeStoreId]);

  const createList = async () => {
    if (!newName.trim() || !activeStoreId) return;
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    const { error } = await supabase.from("prep_lists").insert({
      name: newName.trim(), store_id: activeStoreId, owner_id: uid, created_by: uid,
    } as any);
    setCreating(false);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setNewName("");
    toast({ title: "تم", description: "تم إنشاء القائمة" });
    loadLists();
  };

  const deleteList = async (l: PrepList) => {
    if (l.status === "confirmed") return toast({ title: "غير مسموح", description: "القائمة مؤكدة", variant: "destructive" });
    if (!confirm(`حذف قائمة "${l.name}"؟`)) return;
    const { error } = await supabase.from("prep_lists").delete().eq("id", l.id);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    loadLists();
  };

  const openListDialog = async (l: PrepList) => {
    setOpenList(l);
    setSelectedToAdd([]);
    setDialogLoading(true);
    // load orders in list + available pending
    const [{ data: linked }, { data: pending }] = await Promise.all([
      supabase
        .from("prep_list_orders")
        .select("order_id, orders:order_id(id, customer_name, phone, city, address, product_name, price, quantity, status, shipping_reference, matched_zone_name, matched_area_name, selected_color, selected_size, selected_product_code, carrier_status, created_at)")
        .eq("list_id", l.id),
      l.status === "open"
        ? supabase
            .from("orders")
            .select("id, customer_name, phone, city, address, product_name, price, quantity, status, shipping_reference, matched_zone_name, matched_area_name, selected_color, selected_size, selected_product_code, carrier_status, created_at")
            .eq("store_id", activeStoreId)
            .eq("status", "pending")
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] } as any),
    ]);
    const lo = (linked || []).map((x: any) => x.orders).filter(Boolean) as OrderLite[];
    setListOrders(lo);
    const linkedIds = new Set(lo.map((o) => o.id));
    // exclude orders that are already in any other list
    const pendingFiltered = (pending || []).filter((o: any) => !linkedIds.has(o.id));
    // also exclude orders already linked to OTHER lists (avoid duplicates)
    if (pendingFiltered.length > 0 && l.status === "open") {
      const ids = pendingFiltered.map((o: any) => o.id);
      const { data: others } = await supabase
        .from("prep_list_orders")
        .select("order_id")
        .in("order_id", ids);
      const used = new Set((others || []).map((x: any) => x.order_id));
      setPendingOrders(pendingFiltered.filter((o: any) => !used.has(o.id)));
    } else {
      setPendingOrders(pendingFiltered);
    }
    setDialogLoading(false);
  };

  const addOrdersToList = async () => {
    if (!openList || selectedToAdd.length === 0) return;
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    const rows = selectedToAdd.map((order_id) => ({ list_id: openList.id, order_id, owner_id: uid }));
    const { error } = await supabase.from("prep_list_orders").insert(rows as any);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    toast({ title: "تم", description: `تمت إضافة ${selectedToAdd.length} طلب` });
    openListDialog(openList);
    loadLists();
  };

  const removeFromList = async (orderId: string) => {
    if (!openList || openList.status !== "open") return;
    const { error } = await supabase
      .from("prep_list_orders")
      .delete()
      .eq("list_id", openList.id)
      .eq("order_id", orderId);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    openListDialog(openList);
    loadLists();
  };

  const confirmList = async () => {
    if (!openList || listOrders.length === 0) return;
    if (!confirm(`تأكيد القائمة وتحويل ${listOrders.length} طلب إلى "جاري التجهيز"؟`)) return;
    const ids = listOrders.map((o) => o.id);
    const { error: ue } = await supabase.from("orders").update({ status: "preparing" } as any).in("id", ids);
    if (ue) return toast({ title: "خطأ", description: ue.message, variant: "destructive" });
    const { error: le } = await supabase
      .from("prep_lists")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() } as any)
      .eq("id", openList.id);
    if (le) return toast({ title: "خطأ", description: le.message, variant: "destructive" });
    toast({ title: "تم التأكيد", description: "تم تحويل الطلبات إلى جاري التجهيز" });
    setOpenList(null);
    loadLists();
  };

  const printList = () => {
    if (listOrders.length === 0) return toast({ title: "تنبيه", description: "لا توجد طلبات للطباعة", variant: "destructive" });
    const so: StickerOrder[] = listOrders.map((o) => ({
      id: o.id, customer_name: o.customer_name, phone: o.phone, address: o.address,
      city: o.city, matched_zone_name: o.matched_zone_name, matched_area_name: o.matched_area_name,
      product_name: o.product_name, selected_color: o.selected_color, selected_size: o.selected_size,
      selected_product_code: o.selected_product_code, quantity: o.quantity, price: o.price,
      shipping_reference: o.shipping_reference, carrier_status: o.carrier_status, created_at: o.created_at,
    }));
    printStickers(so, stickerSettings, { currencySymbol, storeName });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6" /> قوائم التجهيز</h1>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm mb-1 block">اسم القائمة الجديدة</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: قائمة 2026/05/18" />
          </div>
          <Button onClick={createList} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
            إنشاء قائمة
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : lists.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">لا توجد قوائم بعد</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <Card key={l.id} className="cursor-pointer hover:border-primary" onClick={() => openListDialog(l)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold truncate">{l.name}</h3>
                  <Badge variant={l.status === "confirmed" ? "default" : "secondary"}>
                    {l.status === "confirmed" ? "مؤكدة" : "مفتوحة"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{l.count ?? 0} طلب</p>
                <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-LY")}</p>
                {l.status === "open" && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteList(l); }}>
                    <Trash2 className="w-4 h-4 ml-1" /> حذف
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!openList} onOpenChange={(o) => !o && setOpenList(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{openList?.name} — {openList?.status === "confirmed" ? "مؤكدة" : "قيد التجهيز"}</DialogTitle>
          </DialogHeader>

          {dialogLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">طلبات القائمة ({listOrders.length})</h4>
                  <Button size="sm" variant="outline" onClick={printList}>
                    <Printer className="w-4 h-4 ml-1" /> طباعة الستيكرات
                  </Button>
                </div>
                {listOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد طلبات</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {listOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-2 border rounded text-sm gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{o.customer_name} — {o.phone}</p>
                          <p className="text-xs text-muted-foreground truncate">{o.product_name} | {o.matched_zone_name || o.city}</p>
                        </div>
                        {openList?.status === "open" && (
                          <Button size="sm" variant="ghost" onClick={() => removeFromList(o.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {openList?.status === "open" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">طلبات قيد الانتظار المتاحة ({pendingOrders.length})</h4>
                    <Button size="sm" onClick={addOrdersToList} disabled={selectedToAdd.length === 0}>
                      <Plus className="w-4 h-4 ml-1" /> إضافة المحدد ({selectedToAdd.length})
                    </Button>
                  </div>
                  {pendingOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد طلبات قيد الانتظار متاحة</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {pendingOrders.map((o) => (
                        <label key={o.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent text-sm">
                          <Checkbox
                            checked={selectedToAdd.includes(o.id)}
                            onCheckedChange={(c) => setSelectedToAdd((p) => c ? [...p, o.id] : p.filter((x) => x !== o.id))}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{o.customer_name} — {o.phone}</p>
                            <p className="text-xs text-muted-foreground truncate">{o.product_name} | {o.matched_zone_name || o.city}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {openList?.status === "open" && (
              <Button onClick={confirmList} disabled={listOrders.length === 0}>
                <CheckCircle2 className="w-4 h-4 ml-1" /> تأكيد القائمة وتحويلها لجاري التجهيز
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}