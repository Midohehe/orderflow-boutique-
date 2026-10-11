const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const Module = require('node:module');
const deps = process.env.REACT_TEST_DEPS || path.resolve('../test-deps/node_modules');
const React = require(path.join(deps, 'react'));
const originalLoad = Module._load;
Module._load = function(name, ...args) { return name === 'react' ? React : originalLoad.call(this, name, ...args); };
const { create, act } = require(path.join(deps, 'react-test-renderer'));
const { QueryClient, QueryClientProvider, useQuery } = require('@tanstack/react-query');

function load(file, imports) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(imports[name], `Missing test import: ${name}`); return imports[name];
  }, console, setTimeout, clearTimeout, AbortController });
  return exports;
}
const movement = i => ({
  id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
  owner_id: 'owner', store_id: 'store-a', product_id: 'product-a', product_name: 'منتج أ',
  created_at: '2026-10-11T12:00:00+00:00', qty: -1, unit_price: 20, reason: 'order_created',
  order_id: null, return_id: null, variant_key: null, warehouse_code: null, notes: null,
});
let sourceRows = Array.from({ length: 7165 }, (_, i) => movement(i + 1));
sourceRows.push({ ...movement(8000), owner_id: 'other', store_id: 'store-b' });
let calls = 0;
let failAt = 0;
const supabase = { from(table) {
  assert.equal(table, 'stock_movements');
  const filters = {}, order = [];
  let cursor, limit, signal;
  const b = {
    select: () => b, eq: (key, value) => { filters[key] = value; return b; },
    order: (key, options) => { order.push([key, options.ascending]); return b; },
    limit: n => { limit = n; return b; }, abortSignal: s => { signal = s; return b; },
    or: value => { cursor = value; return b; },
    then(resolve, reject) {
      calls++;
      assert.equal(filters.owner_id, 'owner'); assert.equal(filters.store_id, 'store-a');
      assert.deepEqual(order, [['created_at', false], ['id', false]]);
      assert.ok(signal);
      if (calls === failAt) return Promise.resolve({ data: null, error: { message: 'test network failure' } }).then(resolve, reject);
      // A newly inserted movement between pages must not shift the next page.
      if (calls === 2) sourceRows.push(movement(9000));
      let rows = sourceRows.filter(r => r.owner_id === filters.owner_id && r.store_id === filters.store_id);
      if (cursor) {
        const match = cursor.match(/^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.(.+)\)$/);
        assert.ok(match); assert.equal(match[1], match[2]);
        rows = rows.filter(r => r.created_at < match[1] || (r.created_at === match[1] && r.id < match[3]));
      }
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      return Promise.resolve({ data: rows.slice(0, limit), error: null }).then(resolve, reject);
    },
  };
  return b;
} };
const helpers = load('src/lib/stockMovements.ts', { '@/integrations/supabase/client': { supabase } });
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
async function settle() { for (let i = 0; i < 4; i++) await act(tick); }

(async () => {
  const all = await helpers.fetchStoreStockMovements('owner', 'store-a');
  assert.equal(all.length, 7165); assert.equal(new Set(all.map(r => r.id)).size, 7165);
  assert.equal(calls, 8); assert.ok(!all.some(r => r.id === movement(9000).id));
  const before = calls;
  await assert.rejects(helpers.fetchStoreStockMovements('owner', null), /اختر المتجر/);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(helpers.fetchStoreStockMovements('owner', 'store-a', cancelled.signal));
  assert.equal(calls, before, 'No unscoped or cancelled request is sent');
  failAt = calls + 2;
  await assert.rejects(helpers.fetchStoreStockMovements('owner', 'store-a'), { message: 'test network failure' });

  let store = { activeStoreId: null, activeStore: null, loading: true };
  let user = { id: 'owner' };
  const fetches = [];
  let pendingResolve;
  let mode = 'success';
  const uiSupabase = { from() {
    const q = { select: () => q, eq: () => q, abortSignal: () => q, limit: () => q,
      then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject) };
    return q;
  } };
  const imports = {
    react: React, 'react/jsx-runtime': require(path.join(deps, 'react/jsx-runtime')),
    '@tanstack/react-query': { useQuery }, '@/integrations/supabase/client': { supabase: uiSupabase },
    '@/hooks/useStoreContext': { useStoreContext: () => store }, '@/hooks/useAuth': { useAuth: () => ({ user }) },
    '@/lib/bidi': { isolateLatin: s => s }, '@/components/PageHeader': { PageHeader: p => React.createElement('h1', null, p.title) },
    'lucide-react': Object.fromEntries(['Boxes', 'Loader2', 'ArrowDown', 'ArrowUp'].map(n => [n, () => null])),
    '@/lib/stockMovements': { ...helpers, fetchStoreStockMovements: (owner, id, signal) => {
      fetches.push({ owner, id, signal });
      if (mode === 'pending') return new Promise(resolve => { pendingResolve = resolve; });
      if (mode === 'error') return Promise.reject(new Error('انقطع الاتصال'));
      return Promise.resolve(id === 'store-a' ? all : [{ ...movement(2), product_name: 'منتج ب', store_id: id }]);
    } },
  };
  const ui = {
    card: { Card: 'section', CardContent: 'div', CardHeader: 'header', CardTitle: 'h2' },
    badge: { Badge: 'span' }, button: { Button: 'button' }, input: { Input: 'input' },
    select: { Select: 'select-test', SelectContent: 'options-test', SelectItem: 'option-test', SelectTrigger: 'trigger-test', SelectValue: 'value-test' },
    table: { Table: 'table', TableBody: 'tbody', TableCell: 'td', TableHead: 'th', TableHeader: 'thead', TableRow: 'tr' },
  };
  for (const [file, elements] of Object.entries(ui)) imports[`@/components/ui/${file}`] = Object.fromEntries(Object.entries(elements).map(([name, tag]) => [name, props => React.createElement(tag, props, props.children)]));
  const { default: Subject } = load('src/pages/StockMovements.tsx', imports);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const app = () => React.createElement(QueryClientProvider, { client }, React.createElement(Subject));
  let root;
  await act(async () => { root = create(app()); }); await settle();
  assert.equal(fetches.length, 0, 'Wait for a selected store before querying');
  store = { activeStoreId: 'store-a', activeStore: { owner_id: 'owner' }, loading: false };
  await act(async () => root.update(app())); await settle();
  const text = () => JSON.stringify(root.toJSON());
  const bodyRows = () => root.root.findAllByType('tbody').flatMap(body => body.findAllByType('tr'));
  const button = name => root.root.findAllByType('button').find(b => b.props.children === name);
  assert.equal(bodyRows().length, 50, 'Thousands of movements render only one page');
  assert.ok(text().includes('7165'), 'Totals include every movement, not only the visible page');
  await act(async () => button('التالي').props.onClick());
  assert.equal(bodyRows().length, 50); assert.ok(text().includes('51'));
  const search = root.root.findAllByType('input').find(i => i.props.placeholder);
  await act(async () => search.props.onChange({ target: { value: 'not-found' } }));
  assert.ok(text().includes('لا توجد حركات تطابق الفلاتر المحددة'));
  await act(async () => button('مسح الفلاتر').props.onClick());
  assert.equal(bodyRows().length, 50);
  await act(async () => button('تجميع حسب المنتج').props.onClick());
  assert.equal(bodyRows().length, 1); assert.ok(text().includes('7165'));

  // A late response for another store cannot replace the selected store's data.
  mode = 'pending'; store = { ...store, activeStoreId: 'store-pending' };
  await act(async () => root.update(app())); await settle();
  const pendingCall = fetches.at(-1);
  mode = 'success'; store = { ...store, activeStoreId: 'store-b' };
  await act(async () => root.update(app())); await settle();
  assert.ok(pendingCall.signal.aborted);
  await act(async () => pendingResolve(all)); await settle();
  assert.ok(text().includes('منتج ب')); assert.ok(!text().includes('منتج أ'));

  mode = 'error'; store = { ...store, activeStoreId: 'store-error' };
  await act(async () => root.update(app())); await settle();
  assert.ok(text().includes('تعذر تحميل حركة المنتجات')); assert.ok(text().includes('انقطع الاتصال'));
  assert.ok(!text().includes('لا توجد حركات مسجلة'));
  mode = 'success'; await act(async () => button('إعادة المحاولة').props.onClick()); await settle();
  assert.ok(text().includes('منتج ب')); assert.equal(root.root.findAllByProps({ role: 'alert' }).length, 0);
  user = null; await act(async () => root.update(app()));
  assert.equal(bodyRows().length, 0);
  await act(async () => root.unmount()); client.clear();
  console.log('PASS: 7,165 movements, stable cursor during inserts, store isolation/cancellation, 50-row pages, complete totals, filters/grouping, visible errors and retry.');
})().catch(error => { console.error(error); process.exitCode = 1; });
