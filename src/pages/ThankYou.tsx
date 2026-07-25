import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle, Package, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ThankYouSettings {
  title: string;
  subtitle: string;
  contact_message: string;
  shipping_message: string;
  show_order_details: boolean;
  show_contact_info: boolean;
}

export type ThankYouOrderItem = {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
  original_price?: number;
  image?: string | null;
};

const DEFAULT_SETTINGS: ThankYouSettings = {
  title: "تم استلام طلبك بنجاح!",
  subtitle: "شكراً لك على ثقتك بنا",
  contact_message: "سنتواصل معك قريباً لتأكيد الطلب",
  shipping_message: "🚚 شحن سريع خلال 2-5 أيام عمل",
  show_order_details: true,
  show_contact_info: true,
};

const ThankYou = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderData = location.state?.orderData as
    | {
        productName?: string;
        price?: number | string;
        shippingFee?: number;
        currencySymbol?: string;
        currencyCode?: string;
        productId?: string;
        quantity?: number;
        customerName?: string;
        phone?: string;
        city?: string;
        address?: string;
        ownerId?: string | null;
        items?: ThankYouOrderItem[];
      }
    | undefined;
  const firedRef = useRef(false);
  const [settings, setSettings] = useState<ThankYouSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const ownerId = orderData?.ownerId;
    if (!ownerId) return;
    supabase
      .from("thank_you_settings")
      .select("title, subtitle, contact_message, shipping_message, show_order_details, show_contact_info")
      .eq("owner_id", ownerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as ThankYouSettings);
      });
  }, [orderData?.ownerId]);

  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);

  useEffect(() => {
    if (!orderData) {
      navigate("/");
      return;
    }

    if (firedRef.current) return;
    firedRef.current = true;

    let stored: any = null;
    try {
      const raw = sessionStorage.getItem("last_purchase_event");
      if (raw) stored = JSON.parse(raw);
    } catch {}

    const eventID =
      stored?.eventID ||
      `purchase_${orderData.productId || "p"}_${Date.now()}`;
    const value =
      stored?.value ??
      (parseFloat(String(orderData.price || "0")));
    const currency =
      stored?.currency || orderData.currencyCode || "LYD";
    const content_name = stored?.content_name || orderData.productName;
    const content_ids = stored?.content_ids ||
      (orderData.items?.map((i) => i.product_id).filter(Boolean) as string[]) ||
      [orderData.productId || "unknown"];
    const num_items =
      stored?.num_items ||
      orderData.items?.reduce((n, i) => n + (i.quantity || 1), 0) ||
      orderData.quantity ||
      1;

    const w = window as any;
    if (w.fbq) {
      w.fbq(
        "track",
        "Purchase",
        {
          value,
          currency,
          content_name,
          content_ids,
          content_type: "product",
          num_items,
        },
        { eventID },
      );
    }
    if (w.ttq && typeof w.ttq.track === "function") {
      w.ttq.track(
        "PlaceAnOrder",
        {
          value,
          currency,
          contents: [{ content_name, quantity: num_items }],
        },
        { event_id: eventID },
      );
    }
    if (w.gtag) {
      w.gtag("event", "purchase", {
        transaction_id: eventID,
        value,
        currency,
        items: [{ item_name: content_name, quantity: num_items }],
      });
    }
    if (w.snaptr) {
      w.snaptr("track", "PURCHASE", {
        price: value,
        currency,
        item_ids: content_ids,
        transaction_id: eventID,
      });
    }

    try {
      sessionStorage.removeItem("last_purchase_event");
    } catch {}
  }, [orderData, navigate]);

  if (!orderData) {
    return null;
  }

  const symbol = orderData.currencySymbol || "د.ل";
  const shippingFee = Number(orderData.shippingFee) || 0;
  const productsTotal = Number(orderData.price) || 0;
  const grandTotal = productsTotal + shippingFee;
  const items: ThankYouOrderItem[] =
    Array.isArray(orderData.items) && orderData.items.length > 0
      ? orderData.items
      : [
          {
            product_name: orderData.productName || "منتج",
            quantity: orderData.quantity || 1,
            price: productsTotal,
          },
        ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
            <CheckCircle className="w-14 h-14 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {settings.title}
          </h1>
          <p className="text-muted-foreground text-lg">
            {settings.subtitle}
          </p>
        </div>

        {settings.show_order_details && (
          <div className="bg-card rounded-2xl p-6 shadow-lg border mb-8 text-right">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2 justify-end">
              <span>تفاصيل الطلب</span>
              <Package className="w-5 h-5" />
            </h2>

            <div className="space-y-3 mb-4">
              {items.map((item, idx) => (
                <div
                  key={`${item.product_id || item.product_name}-${idx}`}
                  className="flex items-center gap-3 py-2 border-b border-border"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">
                      {item.product_name}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 justify-end">
                      {typeof item.original_price === "number" &&
                        item.original_price > item.price && (
                          <span className="line-through text-xs">
                            {item.original_price} {symbol}
                          </span>
                        )}
                      <span className="font-semibold text-foreground">
                        {item.price} {symbol}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-foreground font-medium">
                  {productsTotal} {symbol}
                </span>
                <span className="text-muted-foreground">مجموع المنتجات</span>
              </div>
              {shippingFee > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground font-medium">
                    {shippingFee} {symbol}
                  </span>
                  <span className="text-muted-foreground">الشحن</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-t border-border font-bold text-base">
                <span className="text-primary">
                  {grandTotal} {symbol}
                </span>
                <span>الإجمالي</span>
              </div>
            </div>

            <div className="space-y-3 mt-4 pt-3 border-t border-border">
              <div className="flex justify-between items-center py-1">
                <span className="text-foreground font-medium">{orderData.customerName}</span>
                <span className="text-muted-foreground">الاسم</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-foreground font-medium" dir="ltr">{orderData.phone}</span>
                <span className="text-muted-foreground">الهاتف</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-foreground font-medium">{orderData.city}</span>
                <span className="text-muted-foreground">المدينة</span>
              </div>
            </div>
          </div>
        )}

        {settings.show_contact_info && (
          <div className="bg-primary/10 rounded-xl p-4 mb-8 flex items-center gap-3 justify-center">
            <Phone className="w-5 h-5 text-primary" />
            <p className="text-foreground text-sm">
              {settings.contact_message}
            </p>
          </div>
        )}

        <p className="text-muted-foreground text-sm mb-6">
          {settings.shipping_message}
        </p>
      </div>
    </div>
  );
};

export default ThankYou;
