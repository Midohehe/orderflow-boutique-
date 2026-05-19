export type StickerField = {
  key: string;
  label: string;
  enabled: boolean;
};

export type StickerSettings = {
  page_width_mm: number;
  page_height_mm: number;
  font_size: number;
  header_text: string;
  footer_text: string;
  show_barcode: boolean;
  show_logo: boolean;
  fields: StickerField[];
};

export const AVAILABLE_FIELDS: { key: string; label: string }[] = [
  { key: "shipping_reference", label: "كود الشحن" },
  { key: "local_code", label: "رقم الطلب المحلي" },
  { key: "customer_name", label: "اسم العميل" },
  { key: "phone", label: "رقم الهاتف" },
  { key: "city", label: "المدينة (الأصلية)" },
  { key: "matched_zone_name", label: "المدينة المصححة" },
  { key: "matched_area_name", label: "المنطقة" },
  { key: "address", label: "العنوان" },
  { key: "product_name", label: "المنتج" },
  { key: "selected_color", label: "اللون" },
  { key: "selected_size", label: "المقاس" },
  { key: "selected_product_code", label: "كود المنتج" },
  { key: "quantity", label: "الكمية" },
  { key: "price", label: "السعر" },
  { key: "carrier_status", label: "حالة شركة الشحن" },
  { key: "created_at", label: "تاريخ الطلب" },
  { key: "store_name", label: "اسم المتجر" },
];

export const DEFAULT_STICKER_SETTINGS: StickerSettings = {
  page_width_mm: 100,
  page_height_mm: 150,
  font_size: 12,
  header_text: "",
  footer_text: "",
  show_barcode: true,
  show_logo: false,
  fields: AVAILABLE_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    enabled: ["shipping_reference", "customer_name", "phone", "matched_zone_name", "matched_area_name", "address", "product_name", "quantity", "price"].includes(f.key),
  })),
};

export type StickerOrder = {
  id: string;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  matched_zone_name?: string | null;
  matched_area_name?: string | null;
  product_name?: string | null;
  selected_color?: string | null;
  selected_size?: string | null;
  selected_product_code?: string | null;
  quantity?: number | null;
  price?: number | null;
  shipping_reference?: string | null;
  carrier_status?: string | null;
  created_at?: string | null;
  local_code?: string | null;
  items?: Array<{
    color?: string | null;
    size?: string | null;
    product_code?: string | null;
    product_name?: string | null;
  }> | null;
};

const escape = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const renderValue = (key: string, order: StickerOrder, currencySymbol: string, storeName: string): string => {
  switch (key) {
    case "store_name":
      return storeName || "";
    case "created_at":
      return order.created_at ? new Date(order.created_at).toLocaleString("ar-AE") : "";
    case "price":
      return order.price != null ? `${order.price} ${currencySymbol}` : "";
    case "shipping_reference":
      return order.shipping_reference || "";
    default:
      return (order as any)[key] != null ? String((order as any)[key]) : "";
  }
};

// Generate a real scannable Code-128 barcode SVG using JsBarcode.
// The caller HTML must load the JsBarcode CDN script before calling this.
const renderBarcode = (text: string, id: string): string => {
  if (!text) return "";
  return `<div style="text-align:center;margin:6px 0;direction:ltr;">
    <svg id="${id}"></svg>
    <div style="font-family:monospace;font-size:12px;letter-spacing:1px;margin-top:2px;">${escape(text)}</div>
  </div>`;
};


export const buildStickerHtml = (
  orders: StickerOrder[],
  settings: StickerSettings,
  ctx: { currencySymbol: string; storeName: string },
): string => {
  const enabledFields = (settings.fields || []).filter((f) => f.enabled);
  const w = settings.page_width_mm;
  const h = settings.page_height_mm;

  const stickers = orders.map((order) => {
    const variantFieldKeys = new Set(["selected_color", "selected_size", "selected_product_code"]);
    const hasItems = Array.isArray(order.items) && order.items.length > 0;
    const showItemsBlock = hasItems && enabledFields.some((f) => variantFieldKeys.has(f.key));
    let itemsRendered = false;

    const rows = enabledFields.map((f) => {
      if (f.key === "shipping_reference" && settings.show_barcode) {
        const bcId = `bc-${order.id}-${Math.random().toString(36).slice(2, 9)}`;
        return `<div class="sticker-row sticker-barcode-row" data-barcode="${escape(renderValue(f.key, order, ctx.currencySymbol, ctx.storeName))}" id="${bcId}">
          <div class="sticker-label">${escape(f.label)}</div>
          ${renderBarcode(renderValue(f.key, order, ctx.currencySymbol, ctx.storeName), bcId)}
        </div>`;
      }
      // Replace flat color/size/code rows with a paired-per-piece block
      if (variantFieldKeys.has(f.key) && showItemsBlock) {
        if (itemsRendered) return "";
        itemsRendered = true;
        const showColor = enabledFields.some((x) => x.key === "selected_color");
        const showSize = enabledFields.some((x) => x.key === "selected_size");
        const showCode = enabledFields.some((x) => x.key === "selected_product_code");
        const lines = (order.items || []).map((it, idx) => {
          const parts: string[] = [];
          if (showColor && it.color) parts.push(`اللون: ${escape(String(it.color))}`);
          if (showSize && it.size) parts.push(`المقاس: ${escape(String(it.size))}`);
          if (showCode && it.product_code) parts.push(`الكود: ${escape(String(it.product_code))}`);
          return `<div class="sticker-item-row"><span class="sticker-item-num">${idx + 1}.</span> ${parts.join(" — ") || "—"}</div>`;
        }).join("");
        return `<div class="sticker-row sticker-items">
          <div class="sticker-label">تفاصيل القطع:</div>
          ${lines}
        </div>`;
      }
      const val = renderValue(f.key, order, ctx.currencySymbol, ctx.storeName);
      if (!val) return "";
      return `<div class="sticker-row">
        <span class="sticker-label">${escape(f.label)}:</span>
        <span class="sticker-value">${escape(val)}</span>
      </div>`;
    }).filter(Boolean).join("");

    return `<section class="sticker">
      ${settings.header_text ? `<div class="sticker-header">${escape(settings.header_text)}</div>` : ""}
      ${settings.show_logo && ctx.storeName ? `<div class="sticker-logo">${escape(ctx.storeName)}</div>` : ""}
      <div class="sticker-body">${rows}</div>
      ${settings.footer_text ? `<div class="sticker-footer">${escape(settings.footer_text)}</div>` : ""}
    </section>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>طباعة بيانات الشحنة</title>
<style>
  @page { size: ${w}mm ${h}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: "Tajawal","Cairo","Segoe UI",sans-serif; }
  body { font-size: ${settings.font_size}px; }
  .sticker {
    width: ${w}mm; height: ${h}mm;
    padding: 4mm;
    page-break-after: always;
    break-after: page;
    display: flex; flex-direction: column;
    border: 0;
    overflow: hidden;
  }
  .sticker:last-child { page-break-after: auto; break-after: auto; }
  .sticker-header { font-weight: bold; text-align: center; border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
  .sticker-logo { font-weight: 800; font-size: ${settings.font_size + 4}px; text-align: center; margin-bottom: 2mm; }
  .sticker-body { flex: 1; display: flex; flex-direction: column; gap: 1.5mm; }
  .sticker-row { line-height: 1.4; word-break: break-word; }
  .sticker-label { font-weight: 700; margin-left: 4px; }
  .sticker-value { }
  .sticker-barcode-row { text-align: center; }
  .sticker-items { background: #f7f7f7; border: 1px dashed #999; padding: 1.5mm 2mm; border-radius: 2mm; }
  .sticker-item-row { line-height: 1.5; padding: 0.5mm 0; border-bottom: 1px dotted #ccc; }
  .sticker-item-row:last-child { border-bottom: none; }
  .sticker-item-num { font-weight: 700; margin-left: 4px; }
  .sticker-footer { border-top: 1px dashed #000; padding-top: 2mm; margin-top: 2mm; text-align: center; font-size: ${Math.max(8, settings.font_size - 2)}px; }
  @media screen { body { background: #f3f4f6; padding: 16px; } .sticker { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.1); margin: 0 auto 16px; } }
</style>
</head>
<body>
${stickers || `<div style="padding:24px;text-align:center;">لا توجد طلبات للطباعة</div>`}
<script>
function initBarcodes(){
  var codes = document.querySelectorAll('[data-barcode]');
  codes.forEach(function(el){
    try {
      JsBarcode("#" + el.id, el.getAttribute('data-barcode'), {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 50,
        displayValue: false,
        margin: 0
      });
    } catch(e) {}
  });
}
</script>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
  onload="initBarcodes(); setTimeout(function(){ window.focus(); window.print(); }, 300);">
</script>
</body>
</html>`;
};

export const printStickers = (
  orders: StickerOrder[],
  settings: StickerSettings,
  ctx: { currencySymbol: string; storeName: string },
) => {
  const html = buildStickerHtml(orders, settings, ctx);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    alert("الرجاء السماح بالنوافذ المنبثقة لطباعة الستيكر");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
};