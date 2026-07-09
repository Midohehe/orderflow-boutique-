/** Order form presets + public checkout config (fields, CTA, confirmation). */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderFormField } from "@/lib/landingOrderForm";
import { normalizePublicFormFields } from "@/lib/landingOrderForm";

export interface OrderFormPresetField {
  id?: string;
  field_key: string;
  label: string;
  placeholder: string;
  field_type: string;
  required: boolean;
  enabled: boolean;
  sort_order: number;
}

export interface OrderFormPreset {
  id: string;
  name: string;
  button_text: string;
  success_message: string;
  confirmation_enabled: boolean;
  confirmation_message: string;
  fields: OrderFormPresetField[];
  created_at?: string;
  updated_at?: string;
}

export interface PublicOrderFormConfig {
  fields: OrderFormField[];
  buttonText: string;
  successMessage: string;
  confirmationEnabled: boolean;
  confirmationMessage: string;
  presetId: string | null;
  presetName: string | null;
}

type RpcRow = {
  field_id: string | null;
  field_key: string | null;
  label: string | null;
  placeholder: string | null;
  field_type: string | null;
  required: boolean | null;
  button_text: string | null;
  success_message: string | null;
  confirmation_enabled: boolean | null;
  confirmation_message: string | null;
  preset_id: string | null;
  preset_name: string | null;
};

const DEFAULT_BUTTON = "اطلب الآن - الدفع عند الاستلام";
const DEFAULT_SUCCESS = "شكراً لك! تم استلام طلبك بنجاح";

export function parsePresetFields(raw: unknown): OrderFormPresetField[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any, i: number) => ({
    id: typeof item?.id === "string" ? item.id : undefined,
    field_key: String(item?.field_key || ""),
    label: String(item?.label || ""),
    placeholder: String(item?.placeholder || ""),
    field_type: String(item?.field_type || "text"),
    required: !!item?.required,
    enabled: item?.enabled !== false,
    sort_order: typeof item?.sort_order === "number" ? item.sort_order : i,
  })).filter((f) => f.field_key);
}

export function mapPresetRow(row: any): OrderFormPreset {
  return {
    id: row.id,
    name: row.name,
    button_text: row.button_text || "اطلب الآن",
    success_message: row.success_message || DEFAULT_SUCCESS,
    confirmation_enabled: !!row.confirmation_enabled,
    confirmation_message: row.confirmation_message || "",
    fields: parsePresetFields(row.fields),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowsToConfig(rows: RpcRow[]): PublicOrderFormConfig {
  const meta = rows[0];
  const fields = normalizePublicFormFields(
    rows
      .filter((r) => r.field_key)
      .map((r) => ({
        id: r.field_id || r.field_key || `field-${r.field_key}`,
        field_key: r.field_key!,
        label: r.label || r.field_key!,
        placeholder: r.placeholder || "",
        field_type: r.field_type || "text",
        required: !!r.required,
      })),
  );

  return {
    fields,
    buttonText: meta?.button_text || DEFAULT_BUTTON,
    successMessage: meta?.success_message || DEFAULT_SUCCESS,
    confirmationEnabled: !!meta?.confirmation_enabled,
    confirmationMessage: meta?.confirmation_message || "",
    presetId: meta?.preset_id || null,
    presetName: meta?.preset_name || null,
  };
}

/** Load public checkout config (preset or store default). */
export async function fetchPublicOrderFormConfig(
  supabase: SupabaseClient,
  ownerId: string,
  storeId: string | null,
  presetId: string | null = null,
): Promise<{ config: PublicOrderFormConfig; error: unknown }> {
  const { data, error } = await (supabase as any).rpc("get_public_order_form_config", {
    _owner_id: ownerId,
    _store_id: storeId,
    _preset_id: presetId,
  });

  if (!error && Array.isArray(data)) {
    return { config: rowsToConfig(data as RpcRow[]), error: null };
  }

  // Fallback: legacy fields RPC + store_settings
  const [{ data: fieldsData, error: fieldsError }, settingsQ] = await Promise.all([
    supabase.rpc("get_public_order_form_fields", {
      _owner_id: ownerId,
      _store_id: storeId,
    }),
    (() => {
      let q = supabase
        .from("store_settings")
        .select("button_text, success_message, confirmation_enabled, confirmation_message")
        .eq("owner_id", ownerId);
      if (storeId) q = q.eq("store_id", storeId);
      return q.maybeSingle();
    })(),
  ]);

  const fields = normalizePublicFormFields((fieldsData || []) as OrderFormField[]);
  const ss = settingsQ.data as any;

  return {
    config: {
      fields,
      buttonText: ss?.button_text || DEFAULT_BUTTON,
      successMessage: ss?.success_message || DEFAULT_SUCCESS,
      confirmationEnabled: !!ss?.confirmation_enabled,
      confirmationMessage: ss?.confirmation_message || "",
      presetId: null,
      presetName: null,
    },
    error: error ?? fieldsError ?? settingsQ.error ?? null,
  };
}
