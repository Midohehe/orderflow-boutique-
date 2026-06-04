#!/usr/bin/env node
/**
 * Sequential MCP migration applier — prints progress for agent batches.
 * Agent reads stdout and calls apply_migration per line JSON.
 * Usage: node scripts/migration-queue.mjs [--from 1] [--limit 20]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const from = process.argv.includes("--from")
  ? Number(process.argv[process.argv.indexOf("--from") + 1])
  : 0;
const limit = process.argv.includes("--limit")
  ? Number(process.argv[process.argv.indexOf("--limit") + 1])
  : 20;

const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const slice = files.slice(from, from + limit);

for (const file of slice) {
  const query = readFileSync(join(dir, file), "utf8");
  const name = file.replace(/\.sql$/, "").replace(/-/g, "_");
  process.stdout.write(JSON.stringify({ file, name, query }) + "\n");
}
