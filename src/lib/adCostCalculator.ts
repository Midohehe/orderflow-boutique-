export interface AdCostInput {
  spendUsd: number;
  orders: number;
  deliveryPercent: number;
  messages: number;
  exchangeRate: number;
}

export interface AdProductInput {
  purchasePrice: number;
  salePrice: number;
  averageItems: number;
}

export function calculateAdCosts(input: AdCostInput, product?: AdProductInput) {
  const { spendUsd, orders, deliveryPercent, messages, exchangeRate } = input;
  if (!Object.values(input).every(Number.isFinite) || spendUsd < 0 ||
      !Number.isSafeInteger(orders) || orders < 0 ||
      !Number.isSafeInteger(messages) || messages < 0 ||
      deliveryPercent < 0 || deliveryPercent > 100 || exchangeRate <= 0) {
    throw new Error("أدخل قيمًا صحيحة: أعداد غير سالبة، نسبة تسليم بين 0 و100، وسعر دولار أكبر من صفر.");
  }
  const expectedSales = orders * (deliveryPercent / 100);
  const localSpend = spendUsd * exchangeRate;
  const cost = (count: number) => count > 0
    ? { usd: spendUsd / count, local: localSpend / count }
    : null;
  if (product && (!Object.values(product).every(Number.isFinite) || product.purchasePrice < 0 || product.salePrice < 0 || product.averageItems < 1)) {
    throw new Error("تحقق من أسعار المنتج ومتوسط القطع؛ يجب أن يكون المتوسط قطعة واحدة على الأقل.");
  }
  const expectedItems = product ? expectedSales * product.averageItems : 0;
  const revenue = product ? expectedItems * product.salePrice : 0;
  const purchaseCost = product ? expectedItems * product.purchasePrice : 0;
  const profit = product ? { expectedItems, revenue, purchaseCost, grossProfit: revenue - purchaseCost, netProfit: revenue - purchaseCost - localSpend } : null;
  const result = { expectedSales, localSpend, perOrder: cost(orders), perSale: cost(expectedSales), perMessage: cost(messages), profit };
  if (![expectedSales, localSpend, ...[result.perOrder, result.perSale, result.perMessage]
    .flatMap(value => value ? [value.usd, value.local] : []), ...Object.values(profit || {})].every(Number.isFinite)) {
    throw new Error("القيم المدخلة كبيرة جدًا للحساب.");
  }
  return result;
}
