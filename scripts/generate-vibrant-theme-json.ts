/**
 * Writes upgraded Vibrant Boutique theme JSON for import.
 * Run: npx tsx scripts/generate-vibrant-theme-json.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { buildVibrantBoutiqueExport } from "../src/lib/themes/vibrantBoutique";

const exported = buildVibrantBoutiqueExport("fasion");

const outDir = join(process.cwd(), "examples", "themes");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "vibrant-boutique-upgraded.json");
writeFileSync(outPath, JSON.stringify(exported, null, 2), "utf-8");

const downloadsPath = "C:/Users/Administrator/Downloads/theme-fasion-upgraded.json";
try {
  writeFileSync(downloadsPath, JSON.stringify(exported, null, 2), "utf-8");
  console.log("Written:", downloadsPath);
} catch {
  console.log("Skipped Downloads write");
}

console.log("Written:", outPath);
