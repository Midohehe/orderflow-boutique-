const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
function load(relative) {
  const file = path.resolve(__dirname, "../src", relative);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
    if (name.startsWith("./")) return load(path.join(path.dirname(relative), name + ".ts"));
    throw Error("Unexpected import: " + name);
  } });
  return exports;
}
const { normalizeColorImages } = load("lib/colorImages.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const colors = ["أحمر", "أزرق"];
assert.deepEqual(plain(normalizeColorImages(colors, null)), {});
assert.deepEqual(plain(normalizeColorImages(colors, ["https://example.com/red.webp"])), {});
assert.deepEqual(plain(normalizeColorImages(colors, {
  "أحمر": " https://example.com/red.webp ",
  "أزرق": "javascript:alert(1)",
  "قديم": "https://example.com/removed.webp",
})), { "أحمر": "https://example.com/red.webp" });
const saved = normalizeColorImages(colors, { "أحمر": "https://example.com/red.webp" });
assert.deepEqual(plain(normalizeColorImages(colors, JSON.parse(JSON.stringify(saved)))), plain(saved));
assert.deepEqual(plain(normalizeColorImages(["أزرق"], saved)), {});
assert.deepEqual(plain(normalizeColorImages([], saved)), {});
const { getProductVariantKeys, isColorOptionOutOfStock, getSingleVariantSelection } = load("lib/productVariants.ts");
const product = {
  colors, sizes: ["M"], product_codes: [],
  variant_stock: { "أحمر - M": 3, "أزرق - M": 0 },
};
const pictured = { ...product, color_images: saved };
assert.deepEqual(plain(getProductVariantKeys(pictured)), plain(getProductVariantKeys(product)));
assert.equal(isColorOptionOutOfStock(pictured, "أحمر", { size: "M" }, true), false);
assert.equal(isColorOptionOutOfStock(pictured, "أزرق", { size: "M" }, true), true);
assert.deepEqual(plain(getSingleVariantSelection({ colors: ["أحمر"], color_images: saved })), { color: "أحمر", size: "", productCode: "" });
console.log("PASS optional color images, saved mapping, removed colors, unsafe URLs, unchanged variant keys and stock availability");
