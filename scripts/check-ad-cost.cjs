const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const output = ts.transpileModule(fs.readFileSync('src/lib/adCostCalculator.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const context = { exports: {} };
vm.runInNewContext(output.outputText, context);
const calculate = context.exports.calculateAdCosts;
const base = { spendUsd: 100, orders: 50, deliveryPercent: 80, messages: 200, exchangeRate: 7 };
const result = calculate(base);
assert.equal(result.expectedSales, 40);
assert.equal(result.perOrder.usd, 2);
assert.equal(result.perOrder.local, 14);
assert.equal(result.perSale.usd, 2.5);
assert.equal(result.perSale.local, 17.5);
assert.equal(result.perMessage.usd, 0.5);
assert.equal(result.perMessage.local, 3.5);
assert.equal(calculate({ ...base, orders: 0 }).perOrder, null);
assert.equal(calculate({ ...base, deliveryPercent: 0 }).perSale, null);
assert.equal(calculate({ ...base, messages: 0 }).perMessage, null);
assert.equal(calculate({ ...base, orders: 3, deliveryPercent: 50 }).expectedSales, 1.5);
assert.equal(calculate({ ...base, spendUsd: 0 }).perSale.usd, 0);
for (const invalid of [{ spendUsd: -1 }, { orders: 1.5 }, { messages: -1 }, { deliveryPercent: 101 }, { exchangeRate: 0 }, { spendUsd: NaN }, { exchangeRate: Infinity }, { spendUsd: Number.MAX_VALUE }]) {
  assert.throws(() => calculate({ ...base, ...invalid }));
}
console.log('Ad calculator: all checks passed');
