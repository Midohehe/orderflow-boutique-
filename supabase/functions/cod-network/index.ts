import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { findCurrency, resolveLandingCurrency } from '../_shared/currencies.ts';
import { COD_NETWORK_BASE, buildCodPayload, sameCodPhone, codError, codRemoteOrder, variantKey, type CodDraft, type CodEdits, type CodLine } from '../_shared/cod-network.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
type Client = ReturnType<typeof createClient>;
type Config = { enabled: boolean; country_code: string; currency_code: string; updated_at?: string };
type Order = { id: string; store_id: string; updated_at: string; order_code: string | null; customer_name: string; phone: string; address: string; city: string; governorate: string | null; product_id: string | null; product_name: string; price: number; shipping_fee: number; quantity: number; selected_color: string | null; selected_size: string | null; selected_product_code: string | null; currency_code: string | null; status: string; is_deleted: boolean; locked_insufficient_balance: boolean; shipping_reference: string | null; shipping_id: string | null; shipping_provider: string | null };
type Item = Omit<CodLine, 'sku' | 'variant_key'> & { order_id: string };
const defaults: Config = { enabled: false, country_code: 'SA', currency_code: 'SAR' };

async function loadDrafts(db: Client, storeId: string, ids: string[], config: Config): Promise<CodDraft[]> {
  // Read the parent revision first; item edits advance it under the same row lock
  // used by claim. A later item edit therefore invalidates this draft's revision.
  const orders = await db.from('orders').select('id,store_id,updated_at,order_code,customer_name,phone,address,city,governorate,product_id,product_name,price,shipping_fee,quantity,selected_color,selected_size,selected_product_code,currency_code,status,is_deleted,locked_insufficient_balance,shipping_reference,shipping_id,shipping_provider').eq('store_id', storeId).in('id', ids);
  const [items, shipments, currency] = await Promise.all([
    db.from('order_items').select('id,order_id,product_id,product_name,quantity,price,selected_color,selected_size,selected_product_code').eq('store_id', storeId).in('order_id', ids).order('id'),
    db.from('cod_network_shipments').select('order_id,state,reference,error_message').eq('store_id', storeId).in('order_id', ids),
    db.from('store_settings').select('currency_code,currency_symbol').eq('store_id', storeId).limit(1).maybeSingle(),
  ]);
  for (const result of [orders, items, shipments, currency]) if (result.error) throw result.error;
  if (orders.data?.length !== ids.length) throw Error('بعض الطلبات غير موجودة أو لا تتبع المتجر المحدد');
  const productIds = [...new Set([...(orders.data as Order[]).map(o => o.product_id), ...(items.data as Item[]).map(i => i.product_id)].filter((id): id is string => !!id))];
  const links = productIds.length ? await db.from('cod_network_sku_links').select('product_id,variant_key,sku').eq('store_id', storeId).in('product_id', productIds) : { data: [], error: null };
  if (links.error) throw links.error;
  return ids.map(id => {
    const order = (orders.data as Order[]).find(row => row.id === id)!;
    const saved = shipments.data?.find(row => row.order_id === id);
    const orderItems = (items.data as Item[]).filter(item => item.order_id === id);
    const source: Omit<CodLine, 'sku' | 'variant_key'>[] = orderItems.length ? orderItems : [{ ...order, id: 'main', quantity: order.quantity ?? 1, price: Number(order.price) / Math.max(1, Number(order.quantity) || 1) }];
    const lines = source.map(item => {
      const key = variantKey(item);
      return { ...item, quantity: Number(item.quantity), price: Number(item.price), variant_key: key,
        sku: links.data?.find(link => link.product_id === item.product_id && link.variant_key === key)?.sku || item.selected_product_code || '' };
    });
    const blocked = order.is_deleted || order.locked_insufficient_balance || !['pending', 'processing'].includes(order.status)
      || order.shipping_reference || order.shipping_id || (order.shipping_provider && !saved);
    return {
      id, order_code: order.order_code || id.slice(0, 12), updated_at: order.updated_at,
      review_key: JSON.stringify([order.updated_at, config.updated_at, config.country_code, config.currency_code, resolveLandingCurrency(order.currency_code, currency.data).currency_code, orderItems]),
      full_name: order.customer_name || '', phone: order.phone || '', address: order.address || '', city: order.city || '', area: order.governorate || '',
      country: config.country_code, currency_code: resolveLandingCurrency(order.currency_code, currency.data).currency_code,
      total: Math.round((Number(order.price) + Number(order.shipping_fee || 0)) * 100) / 100,
      items: lines, shipment: saved || null, issue: blocked ? 'الطلب مقفل أو مسند للشحن أو حالته غير متاحة للإرسال' : undefined,
    };
  });
}
async function tokenFor(db: Client, storeId: string): Promise<string> {
  const { data, error } = await db.from('cod_network_credentials').select('api_token').eq('store_id', storeId).maybeSingle();
  if (error) throw error;
  if (!data?.api_token) throw Error('بيانات الربط غير مكتملة؛ راجع السوبر أدمن');
  return data.api_token;
}
async function remote(token: string, suffix: string, payload?: unknown) {
  const response = await fetch(COD_NETWORK_BASE + suffix, { method: payload ? 'POST' : 'GET', redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(25000) });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}
async function finish(db: Client, orderId: string, attemptId: string, state: string, remoteId: string | null, reference: string | null, errorMessage: string | null) {
  const result = await db.rpc('finish_cod_network_order', { _order_id: orderId, _attempt_id: attemptId, _state: state, _remote_id: remoteId, _reference: reference, _error: errorMessage });
  if (result.error || result.data !== true) throw Error('تعذر حفظ نتيجة الإرسال. لا تعاود الإرسال؛ تحقق من الطلب لدى الشركة ثم اربطه برقم طلب الشركة');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);
    const raw = await req.text();
    if (raw.length > 100_000) return json({ error: 'حجم الطلب أكبر من المسموح' }, 413);
    const body = JSON.parse(raw), storeId = body.store_id;
    if (!uuid(storeId)) return json({ error: 'اختر متجرًا صحيحًا' }, 400);
    const adminAction = ['settings', 'save', 'test'].includes(body.action);
    const access = adminAction ? await caller.rpc('has_role', { _user_id: user.id, _role: 'admin' }) : await caller.rpc('has_store_access', { _store_id: storeId });
    if (access.error || access.data !== true) return json({ error: 'ليس لديك صلاحية لتنفيذ هذه العملية' }, 403);
    const settingsResult = await db.from('store_cod_network_settings').select('enabled,country_code,currency_code,updated_at').eq('store_id', storeId).maybeSingle();
    if (settingsResult.error) throw settingsResult.error;
    const config: Config = settingsResult.data || defaults;
    if (body.action === 'settings') {
      const credentials = await db.from('cod_network_credentials').select('store_id').eq('store_id', storeId).maybeSingle();
      if (credentials.error) throw credentials.error;
      return json({ ...config, has_token: !!credentials.data });
    }
    if (body.action === 'save') {
      const country = String(body.country_code || '').trim().toUpperCase();
      const currency = String(body.currency_code || '').trim().toUpperCase();
      const token = typeof body.api_token === 'string' ? body.api_token.trim().replace(/^Bearer\s+/i, '') : '';
      if (typeof body.enabled !== 'boolean' || !/^[A-Z]{2}$/.test(country) || !findCurrency(currency) || (token && (token.length < 8 || token.length > 4096 || /\s/.test(token)))) return json({ error: 'راجع البلد والعملة ورمز API Token' }, 400);
      const result = await db.rpc('save_cod_network_settings', { _store_id: storeId, _enabled: body.enabled, _country_code: country, _currency_code: currency, _api_token: token || null });
      if (result.error) throw result.error;
      return json({ ok: true });
    }
    if (body.action === 'test') {
      const token = await tokenFor(db, storeId);
      const result = await remote(token, '/orders?limit=1&fields=id');
      if (result.status !== 200 || result.body?.status !== 'success') return json({ error: codError(result.body, result.status, token) }, 400);
      return json({ ok: true, message: 'الاتصال ناجح' });
    }
    if (body.action === 'status') return json(config);
    if (!config.enabled) return json({ error: 'خدمة سعودي نيتورك غير مفعلة لهذا المتجر' }, 403);
    if (body.action === 'prepare') {
      const ids: string[] = [...new Set<string>(Array.isArray(body.order_ids) ? body.order_ids : [])];
      if (!ids.length || ids.length > 50 || !ids.every(uuid)) return json({ error: 'حدد من طلب واحد إلى 50 طلبًا في كل دفعة' }, 400);
      return json({ drafts: await loadDrafts(db, storeId, ids, config), config });
    }
    if (!uuid(body.order_id)) return json({ error: 'رقم الطلب غير صالح' }, 400);
    const previous = await db.from('cod_network_shipments').select('state,attempt_id,reference,request_payload,started_at').eq('store_id', storeId).eq('order_id', body.order_id).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data?.state === 'sent') return json({ ok: true, already_sent: true, reference: previous.data.reference });
    if (body.action === 'reconcile') {
      const saved = previous.data;
      if (!saved || !['sending','uncertain'].includes(saved.state) || Date.now() - Date.parse(saved.started_at) < 120_000) return json({ error: 'انتظر انتهاء محاولة الإرسال قبل ربط الطلب' }, 409);
      const remoteId = String(body.remote_id || '');
      if (!/^[1-9]\d{0,19}$/.test(remoteId)) return json({ error: 'أدخل معرّف الطلب الرقمي من حساب الشركة' }, 400);
      const result = await remote(await tokenFor(db, storeId), '/orders/' + remoteId);
      const order = codRemoteOrder(result.body);
      const expected = saved.request_payload as ReturnType<typeof buildCodPayload>;
      const total = expected.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (result.status !== 200 || !order || !sameCodPhone(order.phone, expected.phone, expected.country) || !Number.isFinite(order.total) || Math.abs(order.total - total) > 0.011) return json({ error: 'تعذر التحقق: رقم الهاتف أو مبلغ التحصيل لا يطابق الطلب. راجع رقم طلب الشركة' }, 400);
      await finish(db, body.order_id, saved.attempt_id, 'sent', order.id, order.reference, null);
      return json({ ok: true, reference: order.reference });
    }
    if (body.action !== 'send') return json({ error: 'عملية غير معروفة' }, 400);
    if (previous.data && ['sending','uncertain'].includes(previous.data.state)) return json({ error: 'نتيجة الإرسال السابق غير مؤكدة. تحقق من حساب الشركة ثم استخدم ربط الطلب برقم الشركة؛ لن نكرر الإرسال تلقائيًا', uncertain: true }, 409);
    const [draft] = await loadDrafts(db, storeId, [body.order_id], config);
    if (body.review_key !== draft.review_key) return json({ error: 'تغير الطلب أو إعدادات الربط؛ أعد فتح مراجعة الإرسال قبل التأكيد' }, 409);
    // Prices, quantities, country and currency are always recomputed server-side.
    const edits: CodEdits = body.edits && typeof body.edits === 'object' ? body.edits : {};
    const payload = buildCodPayload(draft, edits, config.currency_code);
    const token = await tokenFor(db, storeId);
    const claim = await db.rpc('claim_cod_network_order', { _order_id: draft.id, _store_id: storeId, _actor_id: user.id, _expected_updated_at: draft.updated_at, _expected_config_updated_at: config.updated_at, _payload: payload });
    if (claim.error) throw claim.error;
    if (claim.data.state === 'sent') return json({ ok: true, already_sent: true, reference: claim.data.reference });
    if (claim.data.state !== 'claimed') return json({ error: 'توجد محاولة إرسال سابقة تحتاج تحققًا قبل الإعادة', uncertain: true }, 409);
    const attemptId = claim.data.attempt_id;
    let result;
    try { result = await remote(token, '/orders', payload); }
    catch {
      const message = 'انقطع الاتصال أثناء الإرسال؛ قد تكون الشركة استلمت الطلب. تحقق من حساب الشركة واربط رقم الطلب قبل أي إعادة إرسال';
      await finish(db, draft.id, attemptId, 'uncertain', null, null, message);
      return json({ error: message, uncertain: true }, 409);
    }
    const sent = codRemoteOrder(result.body);
    if (result.status >= 200 && result.status < 300 && sent) {
      const warning = Number.isFinite(sent.total) && Math.abs(sent.total - draft.total) > 0.011 ? 'تم الإرسال، لكن إجمالي الشركة مختلف؛ راجع مبلغ التحصيل في حساب الشركة' : null;
      await finish(db, draft.id, attemptId, 'sent', sent.id, sent.reference, warning);
      if (body.remember_skus === true) {
        const links = draft.items.filter(item => item.product_id).map(item => ({ store_id: storeId, product_id: item.product_id!, variant_key: item.variant_key, sku: String(edits.skus?.[item.id] ?? item.sku).trim() }));
        const distinct = [...new Map(links.map(link => [link.product_id + link.variant_key, link])).values()];
        if (distinct.length) await db.from('cod_network_sku_links').upsert(distinct, { onConflict: 'store_id,product_id,variant_key' });
      }
      return json({ ok: true, reference: sent.reference, warning });
    }
    const definiteFailure = [400,401,403,404,405,413,415,422,429].includes(result.status);
    const message = definiteFailure ? codError(result.body, result.status, token) : 'رد الشركة غير مؤكد؛ تحقق من حساب الشركة واربط الطلب برقم الشركة قبل إعادة المحاولة';
    await finish(db, draft.id, attemptId, definiteFailure ? 'failed' : 'uncertain', null, null, message);
    return json({ error: message, uncertain: !definiteFailure }, definiteFailure ? 400 : 409);
  } catch (error) {
    // Supabase errors are safe DB messages; never log request bodies or credentials.
    return json({ error: error instanceof Error ? error.message : (error as { message?: string })?.message || 'تعذر تنفيذ العملية' }, 400);
  }
});
