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

export function getProvider(settings: any): "wati" | "whatchimp" | "mazbot" {
  const p = String(settings?.provider || "").toLowerCase();
  if (p === "wati") return "wati";
  if (p === "mazbot") return "mazbot";
  return "whatchimp";
}

export function isConfigured(settings: any): boolean {
  if (!settings || !settings.enabled) return false;
  const provider = getProvider(settings);
  if (provider === "wati") {
    return !!(settings.wati_api_endpoint && settings.wati_access_token);
  }
  if (provider === "mazbot") {
    return !!(settings.mazbot_api_key && settings.mazbot_email && settings.mazbot_password);
  }
  return !!(settings.whatchimp_api_key && settings.whatchimp_phone_number_id);
}

// ============ MazBot helpers ============
function mazbotBase(settings: any): string {
  return normalizeBaseUrl(settings.mazbot_base_url, "https://mazbot.net/api");
}
function mazbotOk(res: Response, d: any): boolean {
  return res.ok && d?.success === true;
}
function mazbotMsgId(d: any): string | null {
  return d?.data?.message_id || d?.message_id || null;
}

async function mazbotLogin(settings: any): Promise<string | null> {
  const base = mazbotBase(settings);
  const res = await fetch(`${base}/login`, {
    method: "POST",
    headers: {
      apikey: String(settings.mazbot_api_key || ""),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: String(settings.mazbot_email || ""),
      password: String(settings.mazbot_password || ""),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return data?.data?.token || null;
}

// Look up contact by phone, create if missing. Returns numeric id or null.
async function mazbotEnsureContact(settings: any, jwt: string, phone: string, name?: string): Promise<number | null> {
  const base = mazbotBase(settings);
  const headers = {
    apikey: String(settings.mazbot_api_key || ""),
    Authorization: `Bearer ${jwt}`,
    Accept: "application/json",
  } as Record<string, string>;
  const digits = phone.replace(/\D+/g, "");
  const plus = `+${digits}`;
  const extractId = (d: any): number | null => {
    const candidates = [
      d?.data?.id, d?.data?.contact?.id, d?.contact?.id, d?.id,
      d?.data?.contacts?.[0]?.id, d?.contacts?.[0]?.id,
      d?.data?.data?.[0]?.id, d?.data?.data?.id,
    ];
    for (const c of candidates) {
      if (c != null && !Number.isNaN(Number(c))) return Number(c);
    }
    const list = d?.data?.contacts || d?.data?.data || d?.data || d?.contacts || [];
    if (Array.isArray(list)) {
      const hit = list.find((c: any) =>
        String(c?.phone || c?.mobile || c?.contact_name || "").replace(/\D+/g, "") === digits
      );
      if (hit?.id) return Number(hit.id);
    }
    return null;
  };
  // Try multiple search variations (with and without leading +)
  const searchUrls = [
    `${base}/contacts?search=${encodeURIComponent(phone)}`,
    `${base}/contacts?phone=${encodeURIComponent(phone)}`,
    `${base}/contacts?mobile=${encodeURIComponent(phone)}`,
    `${base}/contacts?search=${encodeURIComponent(digits)}`,
    `${base}/contacts?search=${encodeURIComponent(plus)}`,
    `${base}/contacts?phone=${encodeURIComponent(plus)}`,
    `${base}/contacts?mobile=${encodeURIComponent(plus)}`,
  ];
  let lastSearch: any = null;
  for (const url of searchUrls) {
    try {
      const r = await fetch(url, { headers });
      const d = await r.json().catch(() => ({}));
      lastSearch = { url, status: r.status, body: d };
      const id = extractId(d);
      if (id) return id;
    } catch (_) { /* ignore */ }
  }
  // Create (try FormData) — try both with and without +
  let lastCreate: any = null;
  try {
    const body = new FormData();
    body.set("name", name || phone);
    body.set("phone", plus);
    body.set("mobile", plus);
    body.set("type", "whatsapp");
    const cr = await fetch(`${base}/contacts`, { method: "POST", headers, body });
    const cd = await cr.json().catch(() => ({}));
    lastCreate = { status: cr.status, body: cd };
    const id = extractId(cd);
    if (id) return id;
  } catch (_) { /* ignore */ }
  // Create (try JSON)
  try {
    const cr = await fetch(`${base}/contacts`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || phone, phone: plus, mobile: plus, type: "whatsapp" }),
    });
    const cd = await cr.json().catch(() => ({}));
    lastCreate = { status: cr.status, body: cd };
    const id = extractId(cd);
    if (id) return id;
  } catch (_) { /* ignore */ }
  // Last attempt: re-search after creation
  for (const url of searchUrls) {
    try {
      const r = await fetch(url, { headers });
      const d = await r.json().catch(() => ({}));
      lastSearch = { url, status: r.status, body: d };
      const id = extractId(d);
      if (id) return id;
    } catch (_) { /* ignore */ }
  }
  console.log("[mazbotEnsureContact] FAILED phone=", phone,
    "lastSearch=", JSON.stringify(lastSearch).slice(0, 400),
    "lastCreate=", JSON.stringify(lastCreate).slice(0, 400));
  return null;
}

function watiAuthHeader(token: string): string {
  const t = String(token || "").trim();
  return t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`;
}

export async function sendText(settings: any, phone: string, text: string): Promise<WAResult> {
  if (getProvider(settings) === "mazbot") {
    const jwt = await mazbotLogin(settings);
    if (!jwt) return { ok: false, messageId: null, raw: { error: "mazbot login failed" } };
    const contactId = await mazbotEnsureContact(settings, jwt, phone);
    const base = mazbotBase(settings);
    const headers = {
      apikey: String(settings.mazbot_api_key || ""),
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
    };
    // Primary: try with receiver_id (if we have contact)
    let attempt1: any = null;
    if (contactId) {
      const fd = new FormData();
      fd.set("receiver_id", String(contactId));
      fd.set("message", text);
      const res = await fetch(`${base}/send-message`, { method: "POST", headers, body: fd });
      const data = await res.json().catch(() => ({}));
      if (mazbotOk(res, data)) return { ok: true, messageId: mazbotMsgId(data), raw: data };
      attempt1 = { status: res.status, body: data };
    }
    // Fallback: send directly by mobile number (some Mazbot endpoints accept this)
    const fd2 = new FormData();
    fd2.set("mobile", phone);
    fd2.set("phone", phone);
    fd2.set("receiver", phone);
    fd2.set("message", text);
    fd2.set("type", "whatsapp");
    const res2 = await fetch(`${base}/send-message`, { method: "POST", headers, body: fd2 });
    const data2 = await res2.json().catch(() => ({}));
    return {
      ok: mazbotOk(res2, data2),
      messageId: mazbotMsgId(data2),
      raw: data2?.success ? data2 : {
        error: "mazbot send failed",
        contactId,
        attempt1,
        attempt2: { status: res2.status, body: data2 },
      },
    };
  }
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
  if (getProvider(settings) === "mazbot") {
    // Mazbot media-by-URL not directly supported in session endpoint; fall back to text+URL.
    const text = `${caption || ""}\n${mediaUrl}`.trim();
    return await sendText(settings, phone, text);
  }
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
  if (getProvider(settings) === "mazbot") {
    const templateId = String(settings.mazbot_template_id || "").trim();
    if (!templateId) {
      return { ok: false, messageId: null, raw: { error: "mazbot_template_id not set" } };
    }
    const jwt = await mazbotLogin(settings);
    if (!jwt) return { ok: false, messageId: null, raw: { error: "mazbot login failed" } };
    const base = mazbotBase(settings);
    const fd = new FormData();
    fd.set("template_id", templateId);
    fd.set("mobile", phone);
    // Indexes MUST start at 1 per Mazbot docs.
    const values = [vars.customer_name, vars.order_id, vars.products, vars.total];
    values.forEach((v, i) => {
      const idx = i + 1;
      fd.set(`body_matchs[${idx}]`, "input_value");
      fd.set(`body_values[${idx}]`, String(v ?? ""));
    });
    const res = await fetch(`${base}/whatsapp/send-template`, {
      method: "POST",
      headers: {
        apikey: String(settings.mazbot_api_key || ""),
        Authorization: `Bearer ${jwt}`,
        Accept: "application/json",
      },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: mazbotOk(res, data), messageId: mazbotMsgId(data), raw: data };
  }
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