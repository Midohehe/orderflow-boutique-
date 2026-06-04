import { supabase } from "@/integrations/supabase/client";
import { uploadImageFromUrl, isHttpImageUrl } from "@/lib/imageStorage";

export interface StoreExportFile {
  version: number;
  exported_at?: string;
  counts?: { products?: number; landing_pages?: number };
  products?: ExportProduct[];
  landing_pages?: ExportLandingPage[];
}

export interface ExportProduct {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  price?: number;
  original_price?: number | null;
  purchase_price?: number;
  images?: string[];
  product_codes?: string[];
  colors?: string[];
  sizes?: string[];
  is_visible?: boolean;
  stock?: number;
  variant_stock?: Record<string, number>;
  variant_warehouse_codes?: Record<string, string>;
  variant_easyorders_ids?: Record<string, string>;
  variant_skus?: Record<string, string>;
  easyorders_product_id?: string | null;
  warehouse_linked?: boolean;
  upsell_enabled?: boolean;
  upsell_title?: string;
  upsell_offers?: Array<{ quantity: number; price: number; label?: string }>;
  order_form_on_top?: boolean;
  category_id?: string | null;
  size_chart_url?: string | null;
  reviews?: Array<{ name: string; rating: number; comment: string }>;
}

export interface ExportLandingPage {
  id?: string;
  product_id?: string;
  slug?: string;
  title: string;
  subtitle?: string | null;
  description?: string;
  images?: string[];
  price?: number | null;
  original_price?: number | null;
  upsell_enabled?: boolean;
  upsell_title?: string | null;
  upsell_offers?: Array<{ quantity: number; price: number; label?: string }>;
  order_form_on_top?: boolean;
  show_quantity?: boolean;
  is_visible?: boolean;
  faqs?: Array<{ question: string; answer: string }>;
  puck_data?: unknown;
  template_id?: string | null;
  size_chart?: {
    enabled?: boolean;
    title?: string;
    description?: string;
    columns?: string[];
    rows?: Array<{ enabled?: boolean; values?: string[]; note?: string }>;
  };
}

export interface ImportContext {
  ownerId: string;
  storeId: string;
  existingProductSlugs: Set<string>;
  existingLandingSlugs: Set<string>;
  /** slug → local product id (for landing import) */
  productSlugToId?: Map<string, string>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function parseStoreExportFile(raw: unknown): StoreExportFile {
  if (!raw || typeof raw !== "object") {
    throw new Error("ملف JSON غير صالح");
  }
  const o = raw as StoreExportFile;
  if (o.version !== 1) {
    throw new Error("إصدار الملف غير مدعوم (المطلوب: 1)");
  }
  if (!Array.isArray(o.products) && !Array.isArray(o.landing_pages)) {
    throw new Error("الملف لا يحتوي على منتجات أو صفحات هبوط");
  }
  return o;
}

function uniqueSlug(base: string, taken: Set<string>): string {
  const cleaned = (base || "item").trim() || "item";
  if (!taken.has(cleaned)) {
    taken.add(cleaned);
    return cleaned;
  }
  for (let i = 2; i < 1000; i++) {
    const candidate = `${cleaned}-import-${i}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  const fallback = `${cleaned}-${Math.random().toString(36).slice(2, 8)}`;
  taken.add(fallback);
  return fallback;
}

async function uploadImages(
  urls: string[] | undefined,
  ownerId: string,
  storeId: string
): Promise<string[]> {
  if (!urls?.length) return [];
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    try {
      out.push(await uploadImageFromUrl(url, ownerId, storeId));
    } catch {
      if (isHttpImageUrl(url)) out.push(url);
    }
  }
  return out;
}

function normalizeUpsellOffers(
  offers: ExportProduct["upsell_offers"]
): Array<{ quantity: number; price: number; label: string }> {
  return (offers || [])
    .map((o) => ({
      quantity: Math.max(1, parseInt(String(o.quantity)) || 0),
      price: Math.max(0, parseFloat(String(o.price)) || 0),
      label: (o.label || "").trim(),
    }))
    .filter((o) => o.quantity > 0 && o.price > 0);
}

function normalizeReviews(reviews: ExportProduct["reviews"]) {
  return (reviews || [])
    .map((r) => ({
      name: (r.name || "").trim(),
      rating: Math.max(1, Math.min(5, parseInt(String(r.rating)) || 5)),
      comment: (r.comment || "").trim(),
    }))
    .filter((r) => r.name && r.comment);
}

function normalizeSizeChart(sc: ExportLandingPage["size_chart"]) {
  if (!sc) {
    return { enabled: false, title: "", description: "", columns: [], rows: [] };
  }
  return {
    enabled: !!sc.enabled,
    title: (sc.title || "").trim(),
    description: (sc.description || "").trim(),
    columns: (sc.columns || []).map((c) => (c || "").trim()),
    rows: (sc.rows || []).map((r) => ({
      enabled: r.enabled !== false,
      values: (r.values || []).map((v) => (v || "").trim()),
      note: (r.note || "").trim(),
    })),
  };
}

function buildExportProductSlugMap(products: ExportProduct[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of products || []) {
    if (p.id && p.slug) map.set(p.id, p.slug);
  }
  return map;
}

export async function importProductsFromExport(
  payload: StoreExportFile,
  ctx: ImportContext,
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> {
  const items = payload.products || [];
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  const slugSet = new Set(ctx.existingProductSlugs);

  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    onProgress?.(i, items.length);
    if (!p.name?.trim()) {
      result.skipped++;
      result.errors.push(`منتج ${i + 1}: بدون اسم`);
      continue;
    }

    try {
      const baseSlug =
        p.slug?.trim() ||
        p.name
          .toLowerCase()
          .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .replace(/[\u0600-\u06FF]/g, "")
          .replace(/-+/g, "-") ||
        "product";
      const slug = uniqueSlug(baseSlug, slugSet);
      const images = await uploadImages(p.images, ctx.ownerId, ctx.storeId);

      let sizeChartUrl = p.size_chart_url?.trim() || null;
      if (sizeChartUrl && sizeChartUrl.startsWith("data:")) {
        try {
          sizeChartUrl = await uploadImageFromUrl(sizeChartUrl, ctx.ownerId, ctx.storeId);
        } catch {
          sizeChartUrl = null;
        }
      }

      const { error } = await supabase.from("products").insert({
        owner_id: ctx.ownerId,
        store_id: ctx.storeId,
        name: p.name.trim(),
        slug,
        price: Number(p.price) || 0,
        original_price: p.original_price != null ? Number(p.original_price) : null,
        purchase_price: Number(p.purchase_price) || 0,
        description: p.description || "",
        images,
        product_codes: p.product_codes || [],
        colors: p.colors || [],
        sizes: p.sizes || [],
        stock: Number(p.stock) || 0,
        variant_stock: p.variant_stock || {},
        variant_warehouse_codes: p.variant_warehouse_codes || {},
        variant_skus: p.variant_skus || {},
        easyorders_product_id: p.easyorders_product_id?.trim() || null,
        variant_easyorders_ids: p.variant_easyorders_ids || {},
        warehouse_linked: p.warehouse_linked !== false,
        is_visible: p.is_visible !== false,
        upsell_enabled: !!p.upsell_enabled,
        upsell_title: (p.upsell_title?.trim() || "🎁 عروض خاصة"),
        upsell_offers: normalizeUpsellOffers(p.upsell_offers),
        order_form_on_top: !!p.order_form_on_top,
        category_id: null,
        size_chart_url: sizeChartUrl,
        reviews: normalizeReviews(p.reviews),
      });

      if (error) {
        if (error.code === "23505") {
          result.skipped++;
          result.errors.push(`«${p.name}»: الرابط مستخدم مسبقاً`);
        } else {
          result.errors.push(`«${p.name}»: ${error.message}`);
        }
        continue;
      }
      result.imported++;
    } catch (e) {
      result.errors.push(`«${p.name}»: ${e instanceof Error ? e.message : "خطأ غير معروف"}`);
    }
  }

  onProgress?.(items.length, items.length);
  return result;
}

export async function importLandingPagesFromExport(
  payload: StoreExportFile,
  ctx: ImportContext,
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> {
  const items = payload.landing_pages || [];
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  const slugSet = new Set(ctx.existingLandingSlugs);
  const exportIdToSlug = buildExportProductSlugMap(payload.products);

  let localSlugToId = ctx.productSlugToId;
  if (!localSlugToId) {
    const { data } = await supabase
      .from("products")
      .select("id, slug")
      .eq("store_id", ctx.storeId)
      .is("deleted_at", null);
    localSlugToId = new Map((data || []).map((r) => [r.slug as string, r.id as string]));
  }

  for (let i = 0; i < items.length; i++) {
    const lp = items[i];
    onProgress?.(i, items.length);
    if (!lp.title?.trim()) {
      result.skipped++;
      result.errors.push(`صفحة ${i + 1}: بدون عنوان`);
      continue;
    }

    const exportProductSlug = lp.product_id ? exportIdToSlug.get(lp.product_id) : undefined;
    const localProductId = exportProductSlug ? localSlugToId.get(exportProductSlug) : undefined;
    if (!localProductId) {
      result.skipped++;
      result.errors.push(`«${lp.title}»: المنتج المرتبط غير موجود (${exportProductSlug || "غير معروف"})`);
      continue;
    }

    try {
      const baseSlug =
        lp.slug?.trim() ||
        lp.title
          .toLowerCase()
          .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .replace(/[\u0600-\u06FF]/g, "")
          .replace(/-+/g, "-") ||
        "landing";
      const slug = uniqueSlug(baseSlug, slugSet);
      const images = await uploadImages(lp.images, ctx.ownerId, ctx.storeId);

      const { error } = await supabase.from("landing_pages").insert({
        owner_id: ctx.ownerId,
        store_id: ctx.storeId,
        product_id: localProductId,
        slug,
        title: lp.title.trim(),
        subtitle: lp.subtitle?.trim() || null,
        description: lp.description || "",
        images,
        price: lp.price != null ? Number(lp.price) : null,
        original_price: lp.original_price != null ? Number(lp.original_price) : null,
        upsell_enabled: !!lp.upsell_enabled,
        upsell_title: lp.upsell_title?.trim() || null,
        upsell_offers: normalizeUpsellOffers(lp.upsell_offers),
        order_form_on_top: !!lp.order_form_on_top,
        show_quantity: lp.show_quantity !== false,
        is_visible: lp.is_visible !== false,
        faqs: (lp.faqs || [])
          .map((f) => ({
            question: (f.question || "").trim(),
            answer: (f.answer || "").trim(),
          }))
          .filter((f) => f.question && f.answer),
        size_chart: normalizeSizeChart(lp.size_chart),
        template_id: null,
        puck_data: lp.puck_data ?? null,
      } as any);

      if (error) {
        if (error.code === "23505") {
          result.skipped++;
          result.errors.push(`«${lp.title}»: الرابط مستخدم مسبقاً`);
        } else {
          result.errors.push(`«${lp.title}»: ${error.message}`);
        }
        continue;
      }
      result.imported++;
    } catch (e) {
      result.errors.push(`«${lp.title}»: ${e instanceof Error ? e.message : "خطأ غير معروف"}`);
    }
  }

  onProgress?.(items.length, items.length);
  return result;
}
