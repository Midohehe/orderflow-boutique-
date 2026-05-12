// Bidi isolation utilities for mixed Arabic/Latin text.
// Wraps Latin / digit runs with Unicode LRI (U+2066) ... PDI (U+2069)
// so sizes like "XL", "2XL", "XXL" and SKU codes never get reordered
// by the surrounding RTL context.
//
// Works in plain-text contexts too: DOM, Excel cells, WhatsApp messages,
// PDF/print, table sorting & copy-paste.

const LRI = "\u2066"; // Left-to-Right Isolate
const PDI = "\u2069"; // Pop Directional Isolate

// Latin letters / digits, optionally joined by . _ - / + (e.g. "2XL", "SKU-12/A")
const LATIN_RUN = /[A-Za-z0-9]+(?:[._\-+/][A-Za-z0-9]+)*/g;

/** Wrap Latin/digit runs in a string with LRI…PDI so they render LTR inside RTL. */
export function isolateLatin(input: unknown): string {
  if (input === null || input === undefined) return "";
  const s = String(input);
  if (!s) return s;
  // Skip if already contains isolate marks (avoid double wrapping)
  if (s.includes(LRI)) return s;
  return s.replace(LATIN_RUN, (m) => `${LRI}${m}${PDI}`);
}

/** Strip isolate marks (useful for search/filter/compare). */
export function stripBidi(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[\u2066-\u2069\u202A-\u202E]/g, "");
}
