const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict'), Module = require('node:module');
const deps = process.env.REACT_TEST_DEPS || path.resolve('../test-deps/node_modules');
const React = require(path.join(deps, 'react'));
const original = Module._load;
Module._load = function (name, ...args) { return name === 'react' ? React : original.call(this, name, ...args); };
const { act, create } = require(path.join(deps, 'react-test-renderer'));
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const shared = { exports: {} }; vm.runInNewContext(compile('supabase/functions/_shared/currencies.ts'), shared);
const host = tag => props => React.createElement(tag, props, props.children);
const wrap = host('div'), select = host('select-control');
const imports = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  '@/lib/currencies': shared.exports,
  'lucide-react': new Proxy({}, { get: () => () => null }),
};
const form = { exports: {}, require: name => {
  if (imports[name]) return imports[name];
  if (name.startsWith('@/components/')) return new Proxy({ __esModule: true }, { get: (_, key) => ({ __esModule: true, default: wrap, Input: host('input'), Label: host('label'), Button: host('button'), Select: select, SelectItem: host('option') }[key] || wrap) });
  throw Error(name);
} };
vm.runInNewContext(compile('src/components/LandingPageForm.tsx'), form);
async function run() {
  let tree, current;
  const products = [{ id: 'p1', name: 'Product', price: '45', images: [] }];
  function Harness() {
    const [data, setData] = React.useState({ ...form.exports.emptyLandingPageData, productId: 'p1', price: '25' });
    current = data;
    return React.createElement(form.exports.default, { data, onChange: setData, products, onSubmit() {}, submitText: 'حفظ' });
  }
  await act(async () => { tree = create(React.createElement(Harness)); });
  const control = () => tree.root.findByType('select-control');
  assert.equal(control().props.value, 'store_default');
  assert.equal(tree.root.findAllByType('option').length, 23);
  assert.equal(tree.root.findAllByType('label').some(node => node.props.htmlFor === 'landing-currency'), true);
  for (const code of ['USD', 'EUR', 'store_default']) {
    await act(async () => { control().props.onValueChange(code); });
    assert.equal(current.currencyCode, code === 'store_default' ? '' : code);
    assert.equal(control().props.value, code);
    assert.equal(current.price, '25');
    assert.equal(current.productId, 'p1');
  }
  assert.ok(JSON.stringify(tree.toJSON()).includes('دون تحويل بسعر صرف'));
  await act(async () => tree.unmount());
  console.log('PASS currency editor: labelled selector, 22 supported currencies plus store default, changing/resetting preserves prices and other page fields.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
