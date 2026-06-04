#!/usr/bin/env node
/**
 * Prints sorted migration files as JSON for MCP apply_migration batching.
 * Usage: node scripts/apply-migrations-mcp.mjs [--from N] [--limit N]
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "supabase", "migrations");

const args = process.argv.slice(2);
const fromIdx = args.includes("--from") ? Number(args[args.indexOf("--from") + 1]) : 0;
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

function toSnakeName(filename) {
  return filename.replace(/\.sql$/, "").replace(/-/g, "_");
}

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const slice = files.slice(fromIdx, fromIdx + limit);

const batch = [];
for (const file of slice) {
  const query = await readFile(join(dir, file), "utf8");
  batch.push({ file, name: toSnakeName(file), query, bytes: Buffer.byteLength(query) });
}

console.log(JSON.stringify({ total: files.length, from: fromIdx, count: batch.length, migrations: batch }));
