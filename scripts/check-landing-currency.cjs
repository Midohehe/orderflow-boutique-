// Offline integration checks: no production orders, messages, or network calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function load(file, globals = {}, imports = {}) {
  file = path.resolve(root, file);
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, console, URL, Request, Response, AbortController, setTimeout, clearTimeout,
    ...globals,
    require: name => {
      if (name in imports) return imports[name];
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name), globals, imports);
      throw Error('Unexpected dependency: ' + name);
    },
  };
  vm.runInNewContext(compile(file), context, { filename: file });
  return module.exports;
}
const currency = load('supabase/functions/_shared/currencies.ts');
const store = Object.freeze({ currency_code: 'LYD', currency_symbol: 'د.ل' });
assert.equal(currency.resolveLandingCurrency(null, store).currency_code, 'LYD');
assert.equal(currency.resolveLandingCurrency('', store).currency_code, 'LYD');
assert.equal(currency.resolveLandingCurrency('USD', store).currency_symbol, '$');
assert.equal(currency.resolveLandingCurrency('EUR', store).currency_symbol, '€');
assert.equal(currency.resolveLandingCurrency('BAD', store).currency_code, 'LYD');
assert.equal(currency.resolveLandingCurrency(null, { currency_code: 'EUR' }).currency_symbol, '€');
assert.equal(currency.resolveLandingCurrency(null, store).currency_symbol, 'د.ل', 'No override may leak into the shared store cache');
assert.equal(currency.currencies.length, 22);

function fixture(options = {}) {
  const product = { id: 'p1', slug: 'product', name: 'Test product', price: 45, owner_id: 'o1', store_id: 's1', is_visible: true, deleted_at: null, images: [], colors: [], sizes: [] };
  const page = { id: 'lp1', product_id: 'p1', owner_id: 'o1', store_id: 's1', slug: 'page', title: 'Test page', is_visible: true, price: 25, currency_code: options.pageCurrency ?? null };
  const tables = {
    products: [product], landing_pages: options.noPage ? [] : [page],
    store_settings: [{ owner_id: 'o1', store_id: 'other-store', currency_code: 'GBP', currency_symbol: '£' }, { owner_id: 'o1', store_id: 's1', currency_code: options.storeCurrency || 'LYD', currency_symbol: currency.findCurrency(options.storeCurrency || 'LYD').symbol }],
    app_settings: [{ system_name: 'Wasla' }], order_form_fields: [{ id: 'field1', store_id: 's1', enabled: true, field_key: 'delivery_city' }],
  };
  const reads = [], inserts = [], updates = [];
  const db = {
    from(table) {
      const filters = {}; let mode = 'read', payload;
      const result = single => {
        if (mode === 'insert') { inserts.push({ table, payload: JSON.parse(JSON.stringify(payload)) }); return { data: single ? { id: 'test-order' } : [], error: null }; }
        if (mode === 'update') { updates.push({ table, payload }); return { data: null, error: null }; }
        reads.push({ table, filters: { ...filters } });
        if (options.failCurrency && table === 'store_settings') return { data: null, error: { message: 'offline failure' } };
        const rows = (tables[table] || []).filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
        return { data: single ? rows[0] || null : rows, error: null };
      };
      const query = {
        select() { return this; }, limit() { return this; }, order() { return this; },
        eq(key, value) { filters[key] = value; return this; }, is(key, value) { filters[key] = value; return this; },
        insert(value) { mode = 'insert'; payload = value; return this; }, update(value) { mode = 'update'; payload = value; return this; },
        maybeSingle: async () => result(true), single: async () => result(true),
        then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
      };
      return query;
    },
    rpc: async name => ({ data: name === 'get_public_delivery_prices' ? [{ city_name: 'Tripoli', price: 10 }] : [], error: null }),
  };
  return { db, reads, inserts, updates, page };
}
async function edge(file, options, request) {
  const data = fixture(options); let handler; const background = [];
  load(file, {
    Deno: { env: { get: name => name === 'SUPABASE_URL' ? 'https://offline.invalid' : '' }, serve: value => { handler = value; } },
    EdgeRuntime: { waitUntil: task => background.push(task) },
    // Stub all side effects. This test never contacts carrier, WhatsApp, or Supabase.
    fetch: async () => new Response('{}', { status: 200 }),
    console: { ...console, error: () => {} },
  }, { 'https://esm.sh/@supabase/supabase-js@2.45.0': { createClient: () => data.db } });
  const response = await handler(request);
  await Promise.all(background);
  return { ...data, response };
}
const checkoutRequest = (body = {}) => new Request('https://offline.invalid/create-order', {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-ipcountry': 'LY' },
  body: JSON.stringify({ product_id: 'p1', landing_slug: 'page', phone: '0910000000', quantity: 2, city: 'Tripoli', currency_code: 'GBP', price: 0.01, ...body }),
});

async function run() {
  for (const [pageCurrency, storeCurrency, expected] of [['USD', 'LYD', 'USD'], ['EUR', 'LYD', 'EUR'], [null, 'LYD', 'LYD'], [null, 'SAR', 'SAR']]) {
    const order = await edge('supabase/functions/create-order/index.ts', { pageCurrency, storeCurrency }, checkoutRequest());
    assert.equal(order.response.status, 200);
    const body = await order.response.json();
    assert.equal(body.currency_code, expected);
    assert.equal(body.currency_symbol, currency.findCurrency(expected).symbol);
    assert.equal(body.price, 50, 'The page price is used unchanged, without FX or trusting the submitted price');
    assert.equal(body.total, 60, 'Shipping and quantity stay numerically unchanged');
    const saved = order.inserts.find(row => row.table === 'orders').payload;
    assert.equal(saved.currency_code, expected);
    order.page.currency_code = 'GBP';
    assert.equal(saved.currency_code, expected, 'Changing a page cannot relabel historical orders');
    assert.ok(order.reads.some(row => row.table === 'landing_pages' && row.filters.product_id === 'p1'));
    assert.ok(order.reads.some(row => row.table === 'store_settings' && row.filters.store_id === 's1'));

    const ssr = await edge('supabase/functions/landing-ssr/index.ts', { pageCurrency, storeCurrency }, new Request('https://offline.invalid/p/page'));
    assert.equal(ssr.response.status, 200);
    const html = await ssr.response.text();
    const seed = JSON.parse(html.match(/id="landing-ssr-data">([\s\S]*?)<\/script>/)[1]);
    assert.equal(seed.v, 3);
    assert.equal(seed.landingCurrencyCode, pageCurrency);
    assert.equal(seed.store.currency_code, expected);
    assert.equal(seed.store.currency_symbol, currency.findCurrency(expected).symbol);
    assert.equal(seed.product.price, '25');
    assert.ok(html.includes('"priceCurrency":"' + expected + '"'), 'JSON-LD uses ISO currency, not an Arabic symbol');
    assert.ok(html.includes(currency.findCurrency(expected).symbol), 'First server paint carries the same currency as hydration');
  }
  const noPage = await edge('supabase/functions/create-order/index.ts', { noPage: true }, checkoutRequest({ landing_slug: 'another-products-page' }));
  const fallback = await noPage.response.json();
  assert.equal(fallback.currency_code, 'LYD'); assert.equal(fallback.price, 90);
  const failed = await edge('supabase/functions/create-order/index.ts', { failCurrency: true }, checkoutRequest());
  assert.notEqual(failed.response.status, 200); assert.equal(failed.inserts.length, 0);

  const print = load('src/lib/printSticker.ts', {}, { './currencies': currency });
  const html = print.buildStickerHtml([{ id: '1', price: 50, currency_code: 'USD' }, { id: '2', price: 30 }], print.DEFAULT_STICKER_SETTINGS, { currencySymbol: 'د.ل', storeName: 'test' });
  assert.ok(html.includes('50 $')); assert.ok(html.includes('30 د.ل'));
  const imported = fixture();
  const importer = load('src/lib/storeExportImport.ts', {}, {
    '@/lib/currencies': currency,
    '@/integrations/supabase/client': { supabase: imported.db },
    '@/lib/colorImages': { normalizeColorImages: value => value },
    '@/lib/imageStorage': { isHttpImageUrl: () => false },
  });
  const result = await importer.importLandingPagesFromExport({
    products: [{ id: 'export-product', slug: 'product' }],
    landing_pages: ['USD', null, 'ZZZ'].map((code, index) => ({ title: 'Imported ' + index, slug: 'import-' + index, product_id: 'export-product', currency_code: code, price: 25 })),
  }, { ownerId: 'o1', storeId: 's1', existingLandingSlugs: new Set(), productSlugToId: new Map([['product', 'p1']]) });
  assert.equal(result.imported, 2); assert.equal(result.errors.length, 1);
  assert.deepEqual(imported.inserts.map(row => row.payload.currency_code), ['USD', null]);

  // Exercise the actual purchase emitter in isolation from UI and remote pixels.
  const pageSource = fs.readFileSync(path.join(root, 'src/pages/LandingPage.tsx'), 'utf8');
  const parsed = ts.createSourceFile('LandingPage.tsx', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let emitter;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'trackPurchaseEvent') emitter = node.initializer.getText(parsed); ts.forEachChild(node, visit); }
  visit(parsed);
  const events = [], persisted = [];
  const emitterContext = { exports: {}, product: { id: 'p1', name: 'Product' }, quantity: 2, console: { log() {} }, sessionStorage: { setItem: (_, value) => persisted.push(JSON.parse(value)) }, window: {
    fbq: (...args) => events.push(args[2]), ttq: { track: (_, payload) => events.push(payload) },
    gtag: (...args) => events.push(args[2]), snaptr: (...args) => events.push(args[2]),
  } };
  vm.runInNewContext(ts.transpileModule('exports.emit = ' + emitter, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, emitterContext);
  emitterContext.exports.emit('USD', 60);
  assert.equal(events.length, 4);
  for (const event of [...events, ...persisted]) { assert.equal(event.currency, 'USD'); assert.equal(event.value ?? event.price, 60); }
  assert.ok(pageSource.includes('trackPurchaseEvent(checkoutCurrency.currency_code, orderPrice)'));
  console.log('PASS landing currency: inheritance/override/reset/isolation; real checkout and SSR handlers; authoritative order snapshot and purchase pixels; quantities/shipping unchanged; imports; mixed-currency stickers; failures prevent saving.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
