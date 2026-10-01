export interface AdCostInput {
  spendUsd: number;
  orders: number;
  deliveryPercent: number;
  messages: number;
  exchangeRate: number;
}

export function calculateAdCosts(input: AdCostInput) {
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
  const result = { expectedSales, localSpend, perOrder: cost(orders), perSale: cost(expectedSales), perMessage: cost(messages) };
  if (![expectedSales, localSpend, ...[result.perOrder, result.perSale, result.perMessage]
    .flatMap(value => value ? [value.usd, value.local] : [])].every(Number.isFinite)) {
    throw new Error("القيم المدخلة كبيرة جدًا للحساب.");
  }
  return result;
}
