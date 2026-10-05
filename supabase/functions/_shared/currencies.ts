export const currencies = [
  { code: "AED", name: "درهم إماراتي", symbol: "د.إ" },
  { code: "SAR", name: "ريال سعودي", symbol: "ر.س" },
  { code: "EGP", name: "جنيه مصري", symbol: "ج.م" },
  { code: "KWD", name: "دينار كويتي", symbol: "د.ك" },
  { code: "BHD", name: "دينار بحريني", symbol: "د.ب" },
  { code: "QAR", name: "ريال قطري", symbol: "ر.ق" },
  { code: "OMR", name: "ريال عماني", symbol: "ر.ع" },
  { code: "JOD", name: "دينار أردني", symbol: "د.أ" },
  { code: "LBP", name: "ليرة لبنانية", symbol: "ل.ل" },
  { code: "IQD", name: "دينار عراقي", symbol: "د.ع" },
  { code: "SYP", name: "ليرة سورية", symbol: "ل.س" },
  { code: "YER", name: "ريال يمني", symbol: "ر.ي" },
  { code: "LYD", name: "دينار ليبي", symbol: "د.ل" },
  { code: "TND", name: "دينار تونسي", symbol: "د.ت" },
  { code: "DZD", name: "دينار جزائري", symbol: "د.ج" },
  { code: "MAD", name: "درهم مغربي", symbol: "د.م" },
  { code: "SDG", name: "جنيه سوداني", symbol: "ج.س" },
  { code: "USD", name: "دولار أمريكي", symbol: "$" },
  { code: "EUR", name: "يورو", symbol: "€" },
  { code: "GBP", name: "جنيه إسترليني", symbol: "£" },
  { code: "TRY", name: "ليرة تركية", symbol: "₺" },
  { code: "INR", name: "روبية هندية", symbol: "₹" },
];

export function findCurrency(code: unknown) {
  return typeof code === "string" ? currencies.find((currency) => currency.code === code) : undefined;
}

/** Null means inherit. Amounts are denominated as entered; no FX conversion. */
export function resolveLandingCurrency(
  pageCode: unknown,
  store?: { currency_code?: string | null; currency_symbol?: string | null } | null,
): { currency_code: string; currency_symbol: string } {
  const override = findCurrency(pageCode);
  if (override) return { currency_code: override.code, currency_symbol: override.symbol };
  const inherited = findCurrency(store?.currency_code) || findCurrency("LYD")!;
  return {
    currency_code: inherited.code,
    currency_symbol: store?.currency_symbol || inherited.symbol,
  };
}
