import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Search, ScanLine, CheckCircle2, Package, X } from "lucide-react";

type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  selected_color: string | null;
  selected_size: string | null;
  selected_product_code: string | null;
  quantity: number;
  matched_sku?: string | null;
  checked_count: number;
};

type LoadedOrder = {
  id: string;
  customer_name: string;
  phone: string;
  shipping_reference: string | null;
  order_code: string | null;
  status: string;
  items: OrderItemRow[];
};

const buildVariantKey = (color: string | null, size: string | null, code: string | null): string => {
  if (color && size) return `${color} - ${size}`;
  if (color) return color;
  if (size) return size;
  return code || "";
};

export default function PrepOrders() {
  const { activeStoreId } = useStoreContext();
  const [shipCode, setShipCode] = useState("");
  const [prodCode, setProdCode] = useState("");
  const [order, setOrder] = useState<LoadedOrder | null>(null);
  const [searching, setSearching] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const prodRef = useRef<HTMLInputElement>(null);

  const findOrder = async () => {
    if (!shipCode.trim() || !activeStoreId) return;
    setSearching(true);
    setOrder(null);
    const code = shipCode.trim();
    // Match by unified order_code (case-insensitive), fallback to shipping_reference
    const upper = code.toUpperCase();
    let { data: orders, error } = await supabase
      .from("orders")
      .select("id, customer_name, phone, shipping_reference, order_code, status")
      .eq("store_id", activeStoreId)
      .eq("prep_status", "preparing")
      .eq("is_deleted", false)
      .or(`order_code.eq.${upper},shipping_reference.eq.${code}`)
      .limit(1);
    if (error) {
      setSearching(false);
      return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
    if (!orders || orders.length === 0) {
      setSearching(false);
      return toast({ title: "غير موجود", description: "لا يوجد طلب بحالة (جاري التجهيز) بهذا الكود", variant: "destructive" });
    }
    const o = orders[0];
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("id, product_id, product_name, selected_color, selected_size, selected_product_code, quantity")
      .eq("order_id", o.id);
    let items: OrderItemRow[] = (itemsData || []).map((r: any) => ({
      ...r, checked_count: 0, matched_sku: null,
    }));
    // Fallback: if no order_items, use the order itself as a single item
    if (items.length === 0) {
      const { data: ord } = await supabase
        .from("orders")
        .select("product_id, product_name, selected_color, selected_size, selected_product_code, quantity")
        .eq("id", o.id)
        .maybeSingle();
      if (ord) {
        items = [{
          id: o.id, product_id: ord.product_id, product_name: ord.product_name,
          selected_color: ord.selected_color, selected_size: ord.selected_size,
          selected_product_code: ord.selected_product_code, quantity: ord.quantity,
          checked_count: 0, matched_sku: null,
        }];
      }
    }
    // fetch SKUs for each item from products.variant_skus
    const pids = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean))) as string[];
    if (pids.length > 0) {
      const { data: prods } = await supabase.from("products").select("id, variant_skus").in("id", pids);
      const skuMap: Record<string, Record<string, string>> = {};
      (prods || []).forEach((p: any) => { skuMap[p.id] = (p.variant_skus || {}) as any; });
      items = items.map((i) => {
        if (!i.product_id) return i;
        const key = buildVariantKey(i.selected_color, i.selected_size, i.selected_product_code);
        const sku = skuMap[i.product_id]?.[key] || null;
        return { ...i, matched_sku: sku };
      });
    }
    setOrder({ ...o, items });
    setSearching(false);
    setShipCode("");
    setTimeout(() => prodRef.current?.focus(), 50);
  };

  const scanProduct = () => {
    if (!order || !prodCode.trim()) return;
    const code = prodCode.trim();
    let matched = false;
    setOrder((o) => {
      if (!o) return o;
      const items = o.items.map((it) => {
        if (matched) return it;
        if (it.matched_sku && it.matched_sku.toLowerCase() === code.toLowerCase() && it.checked_count < it.quantity) {
          matched = true;
          return { ...it, checked_count: it.checked_count + 1 };
        }
        return it;
      });
      return { ...o, items };
    });
    if (matched) {
      toast({ title: "✓ مطابق", description: code });
    } else {
      toast({ title: "غير مطابق", description: `الكود ${code} غير موجود أو تم استكماله`, variant: "destructive" });
    }
    setProdCode("");
  };

  const allChecked = order && order.items.length > 0 && order.items.every((i) => i.checked_count >= i.quantity);

  const markPrepared = async () => {
    if (!order || !allChecked) return;
    setFinalizing(true);
    const { error } = await supabase.from("orders").update({ prep_status: "prepared" } as any).eq("id", order.id);
    setFinalizing(false);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    toast({ title: "تم", description: "تم تجهيز الطلب بنجاح" });
    setOrder(null);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="w-6 h-6" /> تجهيز الطلبات</h1>

      <Card>
        <CardContent className="p-4 space-y-3">
          <label className="text-sm font-medium block">كود الشحنة</label>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={shipCode}
              onChange={(e) => setShipCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findOrder()}
              placeholder="ادخل أو امسح كود الشحنة"
            />
            <Button onClick={findOrder} disabled={searching || !shipCode.trim()}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {order && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">{order.customer_name}</h3>
                <p className="text-sm text-muted-foreground">{order.phone}</p>
                <Badge variant="outline" className="mt-1 font-mono">{order.order_code || order.shipping_reference}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOrder(null)}><X className="w-4 h-4" /></Button>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">كود المنتج</label>
              <div className="flex gap-2">
                <Input
                  ref={prodRef}
                  value={prodCode}
                  onChange={(e) => setProdCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && scanProduct()}
                  placeholder="امسح كود SKU للمنتج"
                />
                <Button onClick={scanProduct} disabled={!prodCode.trim()}>
                  <ScanLine className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">المنتجات ({order.items.length})</h4>
              {order.items.map((it) => {
                const done = it.checked_count >= it.quantity;
                return (
                  <div key={it.id} className={`flex items-center justify-between p-3 border rounded ${done ? "bg-green-50 dark:bg-green-950 border-green-500" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[it.selected_color, it.selected_size].filter(Boolean).join(" - ") || "—"}
                        {it.matched_sku && <> | SKU: <span className="font-mono">{it.matched_sku}</span></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={done ? "default" : "secondary"}>
                        {it.checked_count} / {it.quantity}
                      </Badge>
                      {done && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button className="w-full" disabled={!allChecked || finalizing} onClick={markPrepared}>
              {finalizing ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
              تم التجهيز
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}