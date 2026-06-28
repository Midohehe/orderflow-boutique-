/** Landing page order form — field resolution aligned with form_field_catalog keys. */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrderFormField {
  id: string;
  field_key: string;
  label: string;
  placeholder?: string;
  field_type: string;
  required: boolean;
}

export interface ResolvedOrderFields {
  customer_name: string;
  phone: string;
  city: string;
  address: string;
}

export function trimFormValues(formData: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(formData)) {
    out[k] = typeof v === "string" ? v.trim() : "";
  }
  return out;
}

/** First matching field with a non-empty value (avoids empty `phone` blocking `phone_alt`). */
function findFieldValue(
  formFields: OrderFormField[],
  data: Record<string, string>,
  ...keywords: string[]
): string {
  for (const fld of formFields) {
    const hay = `${fld.field_key || ""} ${fld.label || ""}`.toLowerCase();
    if (!keywords.some((k) => hay.includes(k.toLowerCase()))) continue;
    const v = (data[fld.field_key] || "").trim();
    if (v) return v;
  }
  return "";
}

/**
 * Maps catalog field keys to order columns:
 * full_name → customer_name, government → city, address + note → address
 */
export function resolveOrderFields(
  formFields: OrderFormField[],
  rawFormData: Record<string, string>
): ResolvedOrderFields {
  const d = trimFormValues(rawFormData);
  const byKey = (key: string) => (d[key] || "").trim();

  const customer_name =
    byKey("full_name") ||
    byKey("name") ||
    findFieldValue(formFields, d, "full_name", "name", "اسم");

  const phone =
    byKey("phone") ||
    findFieldValue(formFields, d, "phone", "tel", "هاتف", "جوال", "موبايل") ||
    byKey("phone_alt");

  const city =
    byKey("delivery_city") ||
    byKey("government") ||
    byKey("city") ||
    findFieldValue(formFields, d, "delivery_city", "government", "city", "مدينة", "محافظة", "ولاية", "توصيل");

  const area = byKey("note") || findFieldValue(formFields, d, "note", "حي");
  const street =
    byKey("address") ||
    findFieldValue(formFields, d, "address", "عنوان", "شارع", "تفصيل");

  const address = [street, area].filter(Boolean).join(" — ");

  return { customer_name, phone, city, address };
}

export function normalizeLibyanPhone(raw: string): string {
  let digits = (raw || "").toString().replace(/\D/g, "");
  digits = digits.replace(/^(00)?218/, "");
  if (digits.length === 9 && digits.startsWith("9")) digits = "0" + digits;
  return digits;
}

export function validatePhoneDigits(raw: string): boolean {
  const digits = normalizeLibyanPhone(raw);
  return digits.length >= 9 && digits.length <= 10;
}

export function validateRequiredFormFields(
  formFields: OrderFormField[],
  formData: Record<string, string>
): string | null {
  const d = trimFormValues(formData);
  const missing = formFields.filter((f) => f.required && !(d[f.field_key] || "").trim());
  if (missing.length > 0) {
    return "يرجى ملء جميع الحقول المطلوبة";
  }
  return null;
}

export function validateOrderPayload(
  formFields: OrderFormField[],
  formData: Record<string, string>
): string | null {
  const req = validateRequiredFormFields(formFields, formData);
  if (req) return req;

  const resolved = resolveOrderFields(formFields, formData);
  const d = trimFormValues(formData);

  const nameRequired = formFields.some(
    (f) => f.required && (f.field_key === "full_name" || f.field_key === "name")
  );
  if (nameRequired && !resolved.customer_name.trim()) {
    return "يرجى إدخال الاسم الكامل";
  }

  const phoneFields = formFields.filter(
    (f) => f.field_type === "phone" || f.field_key.includes("phone")
  );
  const phoneRequired = phoneFields.some((f) => f.required);
  const phoneValue =
    resolved.phone ||
    phoneFields.map((f) => d[f.field_key]).find((v) => v)?.trim() ||
    "";

  if (phoneRequired && !phoneValue) {
    return "يرجى إدخال رقم الهاتف";
  }
  if (phoneValue && !validatePhoneDigits(phoneValue)) {
    return "يرجى إدخال رقم هاتف صحيح (9 إلى 10 أرقام)";
  }

  const cityRequired = formFields.some(
    (f) =>
      f.required &&
      (f.field_key === "government" ||
        f.field_key === "city" ||
        isDeliverySelectField(f))
  );
  if (cityRequired && !resolved.city.trim()) {
    return "يرجى إدخال المدينة";
  }

  const needsAddress = formFields.some(
    (f) => f.required && (f.field_key === "address" || f.label.includes("عنوان"))
  );
  if (needsAddress && !resolved.address.trim()) {
    return "يرجى إدخال العنوان";
  }

  return null;
}

export function validateDeliveryCity(
  formFields: OrderFormField[],
  formData: Record<string, string>,
  prices: { city_name: string; price: number }[],
): string | null {
  if (!formFields.some(isDeliverySelectField)) {
    return null;
  }
  const resolved = resolveOrderFields(formFields, formData);
  const city = resolved.city.trim();
  if (!city) return null;
  if (prices.length === 0) return "أسعار التوصيل غير متوفرة حالياً";
  if (!prices.some((p) => p.city_name === city)) return "يرجى اختيار مدينة توصيل صالحة";
  return null;
}

export function mapCreateOrderError(code: string): string {
  switch (code) {
    case "missing_variant_color":
      return "يرجى اختيار اللون لكل قطعة";
    case "missing_variant_size":
      return "يرجى اختيار المقاس لكل قطعة";
    case "invalid_variant_color":
      return "اللون المختار غير متاح لهذا المنتج";
    case "invalid_variant_size":
      return "المقاس المختار غير متاح لهذا المنتج";
    case "Product unavailable":
    case "missing_product_id":
      return "المنتج غير متاح حالياً";
    case "missing_phone":
      return "رقم الهاتف مطلوب";
    case "invalid_delivery_city":
      return "يرجى اختيار مدينة توصيل صالحة";
    default:
      return "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى";
  }
}

export function inputTypeForField(field: OrderFormField): string {
  if (field.field_type === "phone") return "tel";
  if (field.field_type === "email") return "email";
  return "text";
}

const DELIVERY_LABEL_HINT = /منطقة\s*التوصيل|نوع\s*التوصيل|مكان\s*التوصيل/i;
const DELIVERY_PLACEHOLDER_HINT = /مكان\s*التوصيل|اختر\s*(ال)?(مدينة|منطقة)/i;

/** City delivery picker — must render as dropdown, not free text. */
export function isDeliverySelectField(
  field: Pick<OrderFormField, "field_key" | "field_type" | "label" | "placeholder">,
): boolean {
  const key = (field.field_key || "").trim().toLowerCase();
  const type = (field.field_type || "").trim().toLowerCase();
  if (key === "delivery_city" || type === "delivery_select") return true;
  const label = (field.label || "").trim();
  const placeholder = (field.placeholder || "").trim();
  return DELIVERY_LABEL_HINT.test(label) || DELIVERY_PLACEHOLDER_HINT.test(placeholder);
}

export function normalizePublicFormField(field: OrderFormField): OrderFormField {
  if (!isDeliverySelectField(field)) return field;
  return {
    ...field,
    field_type: "delivery_select",
    field_key: (field.field_key || "").trim() || "delivery_city",
  };
}

export const LANDING_FORM_FIELDS_CACHE_PREFIX = "libya_form_fields_v2";

export function landingFormFieldsCacheKey(ownerId: string, storeId: string | null): string {
  return `${LANDING_FORM_FIELDS_CACHE_PREFIX}_${ownerId}_${storeId || "_"}`;
}

export function clearLandingFormFieldsCache(ownerId: string, storeId: string | null): void {
  try {
    sessionStorage.removeItem(landingFormFieldsCacheKey(ownerId, storeId));
    sessionStorage.removeItem(`libya_form_fields_${ownerId}_${storeId || "_"}`);
  } catch {
    /* ignore */
  }
}

export function normalizePublicFormFields(fields: OrderFormField[]): OrderFormField[] {
  return fields.map(normalizePublicFormField);
}

/** Load enabled order-form fields for a public landing page (RPC + table fallback). */
export async function fetchPublicOrderFormFields(
  supabase: SupabaseClient,
  ownerId: string,
  storeId: string | null
): Promise<{ fields: OrderFormField[]; error: unknown }> {
  const { data, error } = await supabase.rpc("get_public_order_form_fields", {
    _owner_id: ownerId,
    _store_id: storeId,
  });

  if (!error && Array.isArray(data)) {
    return { fields: normalizePublicFormFields(data as OrderFormField[]), error: null };
  }

  const [{ data: catalog }, fieldsQuery] = await Promise.all([
    supabase.from("form_field_catalog").select("field_key").eq("admin_enabled", true),
    (() => {
      let q = supabase
        .from("order_form_fields")
        .select("id, field_key, label, placeholder, field_type, required")
        .eq("owner_id", ownerId)
        .eq("enabled", true)
        .order("sort_order");
      if (storeId) q = q.eq("store_id", storeId);
      return q;
    })(),
  ]);

  const allowed = new Set((catalog || []).map((c) => c.field_key));
  const fields = ((fieldsQuery.data || []) as OrderFormField[]).filter((f) =>
    allowed.has(f.field_key)
  );

  return { fields: normalizePublicFormFields(fields), error: error ?? fieldsQuery.error ?? null };
}

/** @deprecated Do not use as UI fallback — always load fields via get_public_order_form_fields. */
export const DEFAULT_LANDING_FORM_FIELDS: OrderFormField[] = [
  {
    id: "default-phone",
    field_key: "phone",
    label: "رقم الهاتف",
    placeholder: "09XXXXXXXX",
    field_type: "phone",
    required: true,
  },
  {
    id: "default-government",
    field_key: "government",
    label: "المدينة",
    placeholder: "طرابلس، بنغازي...",
    field_type: "text",
    required: true,
  },
  {
    id: "default-address",
    field_key: "address",
    label: "العنوان / المنطقة",
    placeholder: "اسم الحي أو المنطقة",
    field_type: "text",
    required: true,
  },
];

export function autocompleteForField(field: OrderFormField): string | undefined {
  switch (field.field_key) {
    case "full_name":
    case "name":
      return "name";
    case "phone":
    case "phone_alt":
      return "tel";
    case "email":
      return "email";
    case "government":
    case "city":
      return "address-level2";
    case "address":
      return "street-address";
    case "country":
      return "country-name";
    default:
      return undefined;
  }
}
