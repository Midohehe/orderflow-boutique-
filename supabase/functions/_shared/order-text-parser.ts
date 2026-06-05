/**
 * Template-based order text parser (no AI).
 * Supports:
 *  【whatsapp】 product → price+shipping → phone → total
 *  【variants】  product → color/size/qty lines → customer info
 */

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  colors: string[] | null;
  sizes: string[] | null;
}

export interface ParsedOrderItem {
  product_name: string;
  selected_color: string | null;
  selected_size: string | null;
  quantity: number;
  unit_price: number | null;
}

export interface ParsedOrderFields {
  items: ParsedOrderItem[];
  customer_name: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  shipping_fee: number | null;
  total_price: number | null;
  template: "whatsapp" | "variants" | "mixed";
}

const SKIP_LINE = /^(تم\s|تم$|sent$|delivered$|read$|aa$|رسالة$)/i;
const PHONE_RE = /\b(0(?:91|92|94|95|96)\d{7}|02\d{8})\b/;
const TOTAL_RE = /الاجمال[يى]?[:\s]*(\d+)/;
const SHIPPING_RE = /(\d+)\s*\+\s*(\d+)\s*توصيل\s*(.+)/;
const QTY_RE = /الكمية\s*(\d+)/;
const PRICE_RE = /السعر\s*(\d+(?:\.\d+)?)/;

export const normAr = (s: unknown) => {
  let t = String(s ?? "").trim();
  t = t.replace(/[\u064B-\u0652\u0670]/g, "");
  t = t.replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
  t = t.replace(/\s+/g, " ").toLowerCase();
  t = t.replace(/^ال/, "");
  return t.trim();
};

const wordsOf = (s: string) => normAr(s).split(/[\s,،\-\/\.()]+/).filter(Boolean);

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function wordSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 3 && lev(a, b) <= Math.max(1, Math.floor(minLen * 0.25))) return true;
  return false;
}

export function productNamesMatch(extracted: string, catalog: string): boolean {
  const a = normAr(extracted);
  const b = normAr(catalog);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const wa = wordsOf(extracted);
  const wb = wordsOf(catalog);
  if (wa.length === 0 || wb.length === 0) return false;
  let hits = 0;
  for (const w of wa) {
    if (wb.some((cw) => wordSimilar(w, cw))) hits++;
  }
  const need = Math.max(1, Math.min(wa.length, wb.length) - (wa.length > 2 ? 1 : 0));
  return hits >= need;
}

export function findProduct(nameRaw: string, products: CatalogProduct[]): CatalogProduct | undefined {
  const n = normAr(nameRaw);
  if (!n) return undefined;
  const exact = products.find((p) => normAr(p.name) === n);
  if (exact) return exact;
  const partial = products.find((p) => productNamesMatch(nameRaw, p.name));
  if (partial) return partial;
  let best: CatalogProduct | undefined;
  let bestScore = Infinity;
  for (const p of products) {
    const d = lev(n, normAr(p.name));
    if (d < bestScore) {
      bestScore = d;
      best = p;
    }
  }
  if (best && bestScore <= Math.max(3, Math.floor(n.length * 0.35))) return best;
  return undefined;
}

function lineMatchesProduct(line: string, prod: CatalogProduct): boolean {
  return productNamesMatch(line, prod.name) || normAr(line).includes(normAr(prod.name));
}

function isMetadataLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 2) return true;
  if (SKIP_LINE.test(t)) return true;
  if (PHONE_RE.test(t) && t.replace(/\D/g, "").length >= 9) return true;
  if (TOTAL_RE.test(t)) return true;
  if (SHIPPING_RE.test(t)) return true;
  if (/^\d+\s*d\s*توصيل/i.test(t)) return true;
  return false;
}

function productHasVariants(prod: CatalogProduct): boolean {
  return ((prod.colors?.length ?? 0) > 0) || ((prod.sizes?.length ?? 0) > 0);
}

function pickFromList(raw: string, options: string[]): string | null {
  const n = normAr(raw);
  for (const opt of options) {
    if (n.includes(normAr(opt))) return opt;
  }
  for (const opt of options) {
    if (wordSimilar(n, normAr(opt))) return opt;
  }
  return null;
}

/** Parse one variant line using the product's color/size lists. */
function parseVariantLine(line: string, prod: CatalogProduct): ParsedOrderItem | null {
  let rest = line.trim();
  if (!rest || isMetadataLine(rest)) return null;

  let quantity = 1;
  const qtyM = rest.match(QTY_RE);
  if (qtyM) {
    quantity = Math.max(1, parseInt(qtyM[1], 10));
    rest = rest.replace(QTY_RE, " ").trim();
  }

  let unit_price: number | null = null;
  const priceM = rest.match(PRICE_RE);
  if (priceM) {
    unit_price = parseFloat(priceM[1]);
    rest = rest.replace(PRICE_RE, " ").trim();
  }

  const colors = prod.colors || [];
  const sizes = prod.sizes || [];
  const selected_color = colors.length ? pickFromList(rest, colors) : null;
  let sizeRest = rest;
  if (selected_color) {
    sizeRest = rest.replace(new RegExp(selected_color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ").trim();
  }
  const selected_size = sizes.length ? pickFromList(sizeRest, sizes) : null;

  if (colors.length || sizes.length) {
    if (!selected_color && !selected_size) return null;
  }

  return {
    product_name: prod.name,
    selected_color,
    selected_size,
    quantity,
    unit_price,
  };
}

function looksLikeVariantLine(line: string, prod: CatalogProduct): boolean {
  if (QTY_RE.test(line) || PRICE_RE.test(line)) return true;
  const colors = prod.colors || [];
  const sizes = prod.sizes || [];
  if (colors.some((c) => normAr(line).includes(normAr(c)))) return true;
  if (sizes.some((s) => normAr(line).includes(normAr(s)))) return true;
  return false;
}

function extractGlobals(lines: string[]) {
  let phone: string | null = null;
  let total_price: number | null = null;
  let shipping_fee: number | null = null;
  let address: string | null = null;
  let city: string | null = null;
  let customer_name: string | null = null;

  for (const line of lines) {
    const ph = line.match(PHONE_RE);
    if (ph && !phone) phone = ph[1];

    const tot = line.match(TOTAL_RE);
    if (tot && total_price === null) total_price = parseInt(tot[1], 10);

    const ship = line.match(SHIPPING_RE);
    if (ship) {
      shipping_fee = parseInt(ship[2], 10);
      address = ship[3].trim();
    }
  }

  return { phone, total_price, shipping_fee, address, city, customer_name };
}

/** WhatsApp bubble: product name line, then price+shipping, phone, total. */
function parseWhatsappTemplate(
  lines: string[],
  catalog: CatalogProduct[],
  globals: ReturnType<typeof extractGlobals>,
): ParsedOrderItem[] {
  const contentLines = lines.filter((l) => !isMetadataLine(l));
  if (contentLines.length === 0) return [];

  let productLine = contentLines[0];
  let unit_price: number | null = null;

  for (const line of lines) {
    const ship = line.match(SHIPPING_RE);
    if (ship) {
      unit_price = parseInt(ship[1], 10);
      break;
    }
  }

  const prod = findProduct(productLine, catalog);
  const name = prod?.name || productLine.trim();

  return [{
    product_name: name,
    selected_color: null,
    selected_size: null,
    quantity: 1,
    unit_price: unit_price ?? (prod ? Number(prod.price) : null),
  }];
}

/** Catalog list: product header then variant lines (color/size/qty). */
function parseVariantsTemplate(lines: string[], catalog: CatalogProduct[]): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || isMetadataLine(line)) {
      i++;
      continue;
    }

    const prod = findProduct(line, catalog);
    if (!prod || !productHasVariants(prod)) {
      i++;
      continue;
    }

    if (!lineMatchesProduct(line, prod) || normAr(line) === normAr(prod.name)) {
      // Header is exactly the product name — variant lines follow
      i++;
      while (i < lines.length) {
        const vLine = lines[i].trim();
        if (!vLine) { i++; continue; }
        if (isMetadataLine(vLine)) break;
        const nextProd = catalog.find((p) => p.id !== prod.id && lineMatchesProduct(vLine, p) && normAr(vLine) === normAr(p.name));
        if (nextProd) break;

        if (looksLikeVariantLine(vLine, prod)) {
          const parsed = parseVariantLine(vLine, prod);
          if (parsed) items.push(parsed);
          i++;
          continue;
        }
        break;
      }
      continue;
    }
    i++;
  }

  return items;
}

/** Scan lines: any variant line tied to nearest catalog product. */
function parseMixedVariantScan(lines: string[], catalog: CatalogProduct[]): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  let currentProd: CatalogProduct | undefined;

  for (const line of lines) {
    const t = line.trim();
    if (!t || isMetadataLine(t)) continue;

    const named = findProduct(t, catalog);
    if (named && lineMatchesProduct(t, named) && (normAr(t) === normAr(named.name) || wordsOf(t).length <= wordsOf(named.name).length + 1)) {
      currentProd = named;
      if (!productHasVariants(named)) {
        items.push({
          product_name: named.name,
          selected_color: null,
          selected_size: null,
          quantity: 1,
          unit_price: Number(named.price) || null,
        });
        currentProd = undefined;
      }
      continue;
    }

    if (currentProd && productHasVariants(currentProd)) {
      const parsed = parseVariantLine(t, currentProd);
      if (parsed) items.push(parsed);
    }
  }

  return items;
}

export function parseOrderText(rawText: string, catalog: CatalogProduct[]): ParsedOrderFields | null {
  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const globals = extractGlobals(lines);

  let items: ParsedOrderItem[] = [];
  let template: ParsedOrderFields["template"] = "whatsapp";

  const variantItems = parseVariantsTemplate(lines, catalog);
  if (variantItems.length > 0) {
    items = variantItems;
    template = "variants";
  } else {
    const mixed = parseMixedVariantScan(lines, catalog);
    if (mixed.length > 0) {
      items = mixed;
      template = "mixed";
    } else {
      items = parseWhatsappTemplate(lines, catalog, globals);
      template = "whatsapp";
    }
  }

  if (items.length === 0) return null;

  return {
    items,
    customer_name: globals.customer_name,
    phone: globals.phone,
    city: globals.city,
    address: globals.address,
    shipping_fee: globals.shipping_fee,
    total_price: globals.total_price,
    template,
  };
}
