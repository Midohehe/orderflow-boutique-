import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { turboProductPlan, turboRevision, turboWeight, matchingTurboProduct, type TurboProductInput, type TurboRemoteProduct, type TurboSourceProduct } from '../_shared/turbo-products.ts';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const productFields = 'id,store_id,owner_id,name,price,colors,sizes,product_codes,variant_skus,variant_warehouse_codes,warehouse_linked,deleted_at';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const auth = await db.auth.getUser(authorization.slice(7));
    if (auth.error || !auth.data.user) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json(), storeId = body.store_id;
    if (!uuid(storeId) || !uuid(body.product_id)) return json({ error: 'اختر متجرًا ومنتجًا صحيحين' }, 400);
    const access = await caller.rpc('has_store_access', { _store_id: storeId });
    if (access.error || access.data !== true) return json({ error: 'ليس لديك صلاحية لهذا المتجر' }, 403);
    const [productResult, settingsResult, exportsResult] = await Promise.all([
      db.from('products').select(productFields).eq('id', body.product_id).eq('store_id', storeId).maybeSingle(),
      db.from('shipping_settings').select('email,password,endpoint,enabled').eq('store_id', storeId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('turbo_product_exports').select('variant_key,code,state,error_message,payload').eq('product_id', body.product_id).eq('store_id', storeId),
    ]);
    for (const result of [productResult, settingsResult, exportsResult]) if (result.error) throw result.error;
    if (!productResult.data) return json({ error: 'المنتج لا يتبع المتجر أو غير موجود' }, 404);
    const product = productResult.data as TurboSourceProduct;
    const settings = settingsResult.data;
    const plan = await turboProductPlan(product);
    if (body.action === 'prepare') return json({ enabled: !!(settings?.enabled && settings.email && settings.password),
      variants: plan.map(variant => ({ ...variant, state: variant.linked && !['sending','uncertain'].includes(exportsResult.data?.find(row => row.variant_key === variant.key)?.state || '') ? 'created' : exportsResult.data?.find(row => row.variant_key === variant.key)?.state || 'pending',
        error: exportsResult.data?.find(row => row.variant_key === variant.key)?.error_message })),
      weight: exportsResult.data?.find(row => row.payload?.weight)?.payload.weight || null });
    if (body.action !== 'sync') return json({ error: 'عملية غير معروفة' }, 400);
    if (!settings?.enabled || !settings.email || !settings.password) return json({ error: 'فعّل إعدادات توربو لهذا المتجر أولًا' }, 400);
    const variant = plan.find(row => row.key === body.variant_key);
    if (!variant) return json({ error: 'المتغير لم يعد موجودًا؛ أعد فتح النافذة' }, 400);
    const previous = exportsResult.data?.find(row => row.variant_key === variant.key);
    if (variant.linked && !['sending','uncertain'].includes(previous?.state || '')) return json({ ok: true, code: variant.code, linked: true });
    const input: TurboProductInput = { code: variant.code, name: variant.name, price: Number(product.price), weight: turboWeight(body.weight), active: true };
    const app = await db.from('app_settings').select('shipping_endpoint').maybeSingle();
    if (app.error) throw app.error;
    const endpoint = app.data?.shipping_endpoint || settings.endpoint || 'https://turboex.ly:8001/graphql';
    if (new URL(endpoint).protocol !== 'https:') throw Error('رابط توربو يجب أن يستخدم HTTPS');
    const fingerprint = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint + '|' + settings.email.trim().toLowerCase())));
    const accountKey = Array.from(fingerprint, byte => byte.toString(16).padStart(2, '0')).join('');
    const claim = await db.rpc('claim_turbo_product_export', { _product_id: product.id, _store_id: storeId, _variant_key: variant.key,
      _code: input.code, _account_key: accountKey, _payload: input, _revision: turboRevision(product) });
    if (claim.error?.code === '23505') throw Error('كود المتغير مستخدم لمنتج آخر في هذا المتجر؛ اختر كودًا مختلفًا');
    if (claim.error) throw claim.error;
    const saved = claim.data;
    if (['created','linked'].includes(saved.outcome)) return json({ ok: true, code: variant.code, linked: true });
    if (saved.outcome === 'busy') return json({ error: 'إنشاء هذا المتغير جارٍ بالفعل؛ أعد التحقق بعد دقيقتين' }, 409);
    const reconcile = saved.outcome === 'reconcile';
    const expected = (reconcile ? saved.payload : input) as TurboProductInput;
    const finish = async (state: string, remote: TurboRemoteProduct | null, error: string | null) => {
      const result = await db.rpc('finish_turbo_product_export', { _product_id: product.id, _variant_key: variant.key,
        _attempt_id: saved.attempt_id, _state: state, _remote: remote, _error: error });
      if (result.error || result.data !== true) throw Error('تعذر حفظ نتيجة توربو؛ أعد التحقق من الربط قبل أي إنشاء جديد');
    };
    let token = '', posted = false;
    const gql = async (query: string, variables: Record<string, unknown>) => {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query, variables }), redirect: 'error', signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw Error('تعذر الاتصال بتوربو');
      return await response.json();
    };
    try {
      const login = await gql('mutation($input:LoginInput!){login(input:$input){token}}', { input: { username: settings.email, password: settings.password, rememberMe: true } });
      token = login.data?.login?.token;
      if (!token) throw Error('فشل تسجيل الدخول إلى توربو؛ راجع إعدادات المتجر');
      // Exact-code lookup always precedes creation. Uncertain attempts ONLY look up.
      const lookup = await gql('query($input:ListProductsFilterInput,$page:Int!){listProducts(input:$input,first:100,page:$page){paginatorInfo{lastPage} data{id code name price weight availableQuantity}}}', { input: { code: [expected.code] }, page: 1 });
      if (lookup.errors || !lookup.data?.listProducts || lookup.data.listProducts.paginatorInfo.lastPage > 1) throw Error('تعذر التحقق من كود المنتج لدى توربو');
      const matches: TurboRemoteProduct[] = lookup.data.listProducts.data.filter((row: TurboRemoteProduct) => row.code === expected.code);
      if (matches.length) {
        if (reconcile && matches.length === 1 && matchingTurboProduct(matches[0], expected)) {
          await finish('created', matches[0], null); return json({ ok: true, code: expected.code, recovered: true });
        }
        throw Error('الكود موجود لدى توربو؛ راجع ربطه يدويًا أو استخدم كودًا مختلفًا');
      }
      if (reconcile) return json({ error: 'الإنشاء السابق غير مؤكد ولم يظهر الكود لدى توربو؛ لن نكرر الإنشاء تلقائيًا' }, 409);
      posted = true;
      const created = await gql('mutation($input:ProductInput){saveProduct(input:$input){id code name price weight availableQuantity}}', { input });
      if (created.errors?.length) {
        if (created.errors.every((error: { extensions?: { category?: string; validation?: unknown } }) => error.extensions?.category === 'validation' || !!error.extensions?.validation)) {
          posted = false;
          throw Error('رفضت توربو بيانات المنتج؛ راجع الكود والاسم والسعر والوزن قبل المحاولة التالية');
        }
        // Resolver errors can occur after a side effect: keep the attempt uncertain.
        throw Error('رفضت توربو الإنشاء أو لم تؤكد نتيجته؛ تحقق من الكود قبل إعادة المحاولة');
      }
      const remote = created.data?.saveProduct as TurboRemoteProduct;
      if (!remote || !matchingTurboProduct(remote, input)) throw Error('رد توربو لا يطابق المنتج؛ تحقق من نتيجة الإنشاء');
      await finish('created', remote, null);
      return json({ ok: true, code: remote.code });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'تعذر إنشاء المنتج لدى توربو';
      await finish(posted || reconcile ? 'uncertain' : 'failed', null, message);
      return json({ error: message }, posted || reconcile ? 409 : 400);
    }
  } catch (failure) { return json({ error: failure instanceof Error ? failure.message : 'تعذر تنفيذ ربط توربو' }, 400); }
});
