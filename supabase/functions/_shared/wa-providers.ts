// Shared provider dispatchers for WhatsApp (WhatChimp + Wati).
// Both providers expose: sendText, sendImage, sendTemplate.
// Returns { ok, messageId, raw } so callers can persist status uniformly.

export type WAResult = { ok: boolean; messageId: string | null; raw: any };

function normalizeBaseUrl(v: string | null | undefined, fallback: string): string {
  const s = String(v || "").trim();
  if (!s) return fallback;
  return s.replace(/\/$/, "");
}

function resolveEndpoint(raw: string | null | undefined, fallback: string): string {
  const value = String(raw || "").trim();
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value)) return value.replace(/\/$/, "");
  return `${fallback.replace(/\/$/, "")}/${value.replace(/^\/+/, "")}`;
}

function chimpOk(d: any): boolean {
  return d?.status === "1" || d?.status === 1 || d?.status === "success" ||
    d?.success === true || !!d?.wa_message_id || !!d?.message_id;
}
function chimpMsgId(d: any): string | null {
  return d?.wa_message_id || d?.message_id || d?.data?.wa_message_id || d?.data?.message_id || null;
}

function watiOk(res: Response, d: any): boolean {
  if (!res.ok) return false;
  if (d?.result === true || d?.result === "success") return true;
  if (d?.validWhatsAppNumber === true) return true;
  if (typeof d?.messages?.[0]?.id === "string") return true;
  return false;
}
function watiMsgId(d: any): string | null {
  return d?.messages?.[0]?.id || d?.id || d?.whatsappMessageId || null;
}

export function getProvider(settings: any): "wati" | "whatchimp" {
  const p = String(settings?.provider || "").toLowerCase();
  return p === "wati" ? "wati" : "whatchimp";
}

export function isConfigured(settings: any): boolean {
  if (!settings || !settings.enabled) return false;
  if (getProvider(settings) === "wati") {
    return !!(settings.wati_api_endpoint && settings.wati_access_token);
  }
  return !!(settings.whatchimp_api_key && settings.whatchimp_phone_number_id);
}

function watiAuthHeader(token: string): string {
  const t = String(token || "").trim();
  return t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`;
}

export async function sendText(settings: any, phone: string, text: string): Promise<WAResult> {
  if (getProvider(settings) === "wati") {
    const base = normalizeBaseUrl(settings.wati_api_endpoint, "");
    const url = `${base}/api/v1/sendSessionMessage/${phone}?messageText=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: watiAuthHeader(settings.wati_access_token), Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: watiOk(res, data), messageId: watiMsgId(data), raw: data };
  }
  // WhatChimp
  const base = normalizeBaseUrl(settings.whatchimp_api_url, "https://app.whatchimp.com");
  const endpoint = resolveEndpoint(settings.whatchimp_send_endpoint, `${base}/api/v1/whatsapp/send`);
  const body = new URLSearchParams();
  body.set("apiToken", settings.whatchimp_api_key);
  body.set("phone_number_id", settings.whatchimp_phone_number_id);
  body.set("phone_number", phone);
  body.set("message", text);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && chimpOk(data), messageId: chimpMsgId(data), raw: data };
}

export async function sendImage(settings: any, phone: string, mediaUrl: string, caption?: string): Promise<WAResult> {
  if (getProvider(settings) === "wati") {
    // Wati session media via URL — uses sendSessionFile but needs upload.
    // Fallback: send caption + URL as text so it still reaches the customer.
    const text = `${caption || ""}\n${mediaUrl}`.trim();
    return await sendText(settings, phone, text);
  }
  const base = normalizeBaseUrl(settings.whatchimp_api_url, "https://app.whatchimp.com");
  const endpoint = resolveEndpoint(settings.whatchimp_send_endpoint, `${base}/api/v1/whatsapp/send`);
  const body = new URLSearchParams();
  body.set("apiToken", settings.whatchimp_api_key);
  body.set("phone_number_id", settings.whatchimp_phone_number_id);
  body.set("phone_number", phone);
  body.set("message_type", "image");
  body.set("media_url", mediaUrl);
  if (caption) body.set("caption", caption);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && chimpOk(data), messageId: chimpMsgId(data), raw: data };
}

// Order confirmation template (4 variables: name, order_id, products, total)
export async function sendConfirmationTemplate(
  settings: any,
  phone: string,
  vars: { customer_name: string; order_id: string; products: string; total: string },
): Promise<WAResult> {
  if (getProvider(settings) === "wati") {
    const base = normalizeBaseUrl(settings.wati_api_endpoint, "");
    const templateName = String(settings.wati_template_name || "").trim();
    const broadcastName = String(settings.wati_broadcast_name || "order_confirmation").trim();
    if (!templateName) {
      return { ok: false, messageId: null, raw: { error: "wati_template_name not set" } };
    }
    const url = `${base}/api/v2/sendTemplateMessage?whatsappNumber=${encodeURIComponent(phone)}`;
    const payload = {
      template_name: templateName,
      broadcast_name: broadcastName,
      parameters: [
        { name: "1", value: vars.customer_name },
        { name: "2", value: vars.order_id },
        { name: "3", value: vars.products },
        { name: "4", value: vars.total },
      ],
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: watiAuthHeader(settings.wati_access_token),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: watiOk(res, data), messageId: watiMsgId(data), raw: data };
  }

  // WhatChimp template
  const base = normalizeBaseUrl(settings.whatchimp_api_url, "https://app.whatchimp.com");
  const sendEndpoint = resolveEndpoint(settings.whatchimp_send_endpoint, `${base}/api/v1/whatsapp/send`);
  const templateEndpoint = resolveEndpoint(settings.whatchimp_template_endpoint, `${base}/api/v1/whatsapp/send/template`);
  const templateId = String(settings.whatchimp_template_id || "").trim();
  const templateName = String(settings.whatchimp_template_name || "").trim();

  if (templateId) {
    const body = new URLSearchParams();
    body.set("apiToken", settings.whatchimp_api_key);
    body.set("phone_number_id", settings.whatchimp_phone_number_id);
    body.set("phone_number", phone);
    body.set("template_id", templateId);
    body.set("templateVariable-1-1", vars.customer_name);
    body.set("templateVariable-2-2", vars.order_id);
    body.set("templateVariable-3-3", vars.products);
    body.set("templateVariable-4-4", vars.total);
    const rawButtons = String(settings.whatchimp_template_buttons || "").trim();
    if (rawButtons) {
      const arr = rawButtons.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
      if (arr.length) body.set("template_quick_reply_button_values", JSON.stringify(arr));
    }
    const res = await fetch(templateEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && chimpOk(data), messageId: chimpMsgId(data), raw: data };
  }

  const body = new URLSearchParams();
  body.set("apiToken", settings.whatchimp_api_key);
  body.set("phone_number_id", settings.whatchimp_phone_number_id);
  body.set("phone_number", phone);
  body.set("template_name", templateName);
  body.set("language_code", String(settings.whatchimp_template_language || "ar"));
  body.set("variable1", vars.customer_name);
  body.set("variable2", vars.order_id);
  body.set("variable3", vars.products);
  body.set("variable4", vars.total);
  const res = await fetch(sendEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && chimpOk(data), messageId: chimpMsgId(data), raw: data };
}