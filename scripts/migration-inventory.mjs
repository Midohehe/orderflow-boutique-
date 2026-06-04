#!/usr/bin/env node
/**
 * Parses supabase/migrations/*.sql and produces a schema inventory JSON.
 * Run: node scripts/migration-inventory.mjs
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const OUT_DIR = join(ROOT, "supabase", "migration-export");

const RE = {
  table: /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi,
  alterTable: /ALTER TABLE(?:\s+ONLY)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi,
  policy: /CREATE POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?([a-z_][a-z0-9_.]*)/gi,
  trigger: /CREATE TRIGGER\s+([a-z_][a-z0-9_]*)/gi,
  dropTrigger: /DROP TRIGGER IF EXISTS\s+([a-z_][a-z0-9_]*)/gi,
  function: /CREATE OR REPLACE FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi,
  view: /CREATE(?:\s+OR REPLACE)?(?:\s+MATERIALIZED)?\s+VIEW\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi,
  extension: /CREATE EXTENSION(?:\s+IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi,
  enum: /CREATE TYPE\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+AS ENUM/gi,
  bucket: /INSERT INTO\s+storage\.buckets|storage\.buckets\s*\(/gi,
  cron: /cron\.schedule\s*\(\s*'([^']+)'/gi,
  index: /CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi,
};

function addSet(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function parseTypesTs() {
  const path = join(ROOT, "src", "integrations", "supabase", "types.ts");
  return readFile(path, "utf8").then((text) => {
    const tables = [];
    const functions = [];
    let section = null;
    for (const line of text.split("\n")) {
      if (line.includes("Tables: {")) section = "tables";
      else if (line.includes("Views: {")) section = "views";
      else if (line.includes("Functions: {")) section = "functions";
      else if (line.includes("Enums: {")) section = "enums";
      else if (section === "tables") {
        const m = line.match(/^\s+([a-z_][a-z0-9_]*): \{/);
        if (m) tables.push(m[1]);
      } else if (section === "functions") {
        const m = line.match(/^\s+([a-z_][a-z0-9_]*): \{/);
        if (m) functions.push(m[1]);
      } else if (section === "enums" && line.trim() === "}") section = null;
    }
    return { tables, functions };
  });
}

function allMatches(re, text, group = 1) {
  const out = [];
  let m;
  const flags = re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
  while ((m = flags.exec(text)) !== null) out.push(m[group]);
  return out;
}

async function listEdgeFunctions() {
  const base = join(ROOT, "supabase", "functions");
  const entries = await readdir(base, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .sort();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const tablesCreated = new Map();
  const tablesAltered = new Set();
  const policies = new Map();
  const triggers = new Map();
  const functions = new Map();
  const views = new Set();
  const extensions = new Set();
  const enums = new Set();
  const indexes = new Map();
  const cronJobs = new Set();
  let storageBucketRefs = 0;

  const fileManifest = [];

  for (const file of files) {
    const content = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    fileManifest.push({ file, bytes: Buffer.byteLength(content, "utf8") });

    for (const t of allMatches(RE.table, content)) addSet(tablesCreated, t, file);
    for (const t of allMatches(RE.alterTable, content)) tablesAltered.add(t);
    for (const m of content.matchAll(RE.policy)) {
      addSet(policies, m[2].replace(/^public\./, ""), `${m[1]} (${file})`);
    }
    for (const tr of allMatches(RE.trigger, content)) addSet(triggers, tr, file);
    for (const fn of allMatches(RE.function, content)) addSet(functions, fn, file);
    for (const v of allMatches(RE.view, content)) views.add(v);
    for (const e of allMatches(RE.extension, content)) extensions.add(e);
    for (const en of allMatches(RE.enum, content)) enums.add(en);
    for (const idx of allMatches(RE.index, content)) addSet(indexes, idx, file);
    for (const c of allMatches(RE.cron, content)) cronJobs.add(c);
    if (RE.bucket.test(content)) storageBucketRefs++;
  }

  const edgeFunctions = await listEdgeFunctions();
  const typesTs = await parseTypesTs();

  const tablesFromMigrations = [...tablesCreated.keys()].sort();
  const functionsFromMigrations = [...functions.keys()].sort();
  const policiesCount = [...policies.values()].reduce((n, s) => n + s.size, 0);
  const triggersCount = [...triggers.values()].reduce((n, s) => n + s.size, 0);

  const inMigrationsNotTypes = tablesFromMigrations.filter(
    (t) => !typesTs.tables.includes(t),
  );
  const inTypesNotMigrationsCreate = typesTs.tables.filter(
    (t) => !tablesFromMigrations.includes(t),
  );
  const rpcInMigrationsNotTypes = functionsFromMigrations.filter(
    (f) => !typesTs.functions.includes(f),
  );

  const inventory = {
    generated_at: new Date().toISOString(),
    source_project_ref: "iyqooryhmshlajuhabmc",
    migration_files: files.length,
    counts: {
      tables_created_in_migrations: tablesFromMigrations.length,
      tables_altered: tablesAltered.size,
      rls_policies: policiesCount,
      triggers: triggersCount,
      functions: functionsFromMigrations.length,
      views: views.size,
      extensions: extensions.size,
      enums: enums.size,
      indexes: indexes.size,
      cron_jobs_referenced: cronJobs.size,
      storage_bucket_sql_refs: storageBucketRefs,
      edge_functions: edgeFunctions.length,
    },
    tables: tablesFromMigrations,
    tables_altered: [...tablesAltered].sort(),
    functions: functionsFromMigrations,
    views: [...views].sort(),
    extensions: [...extensions].sort(),
    enums: [...enums].sort(),
    cron_jobs: [...cronJobs].sort(),
    edge_functions: edgeFunctions,
    types_ts_tables: typesTs.tables.length,
    types_ts_functions: typesTs.functions.length,
    drift: {
      tables_in_migrations_not_in_types_ts: inMigrationsNotTypes,
      tables_in_types_ts_without_create_migration: inTypesNotMigrationsCreate,
      rpc_in_migrations_not_in_types_ts: rpcInMigrationsNotTypes,
      note:
        "types.ts is a snapshot from the OLD linked project; regenerate after db push on new project.",
    },
    policies_by_table: Object.fromEntries(
      [...policies.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([table, set]) => [table, [...set].sort()]),
    ),
    triggers_by_name: Object.fromEntries(
      [...triggers.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, set]) => [name, [...set].sort()]),
    ),
    migration_manifest: fileManifest,
  };

  await writeFile(
    join(OUT_DIR, "schema-inventory.json"),
    JSON.stringify(inventory, null, 2),
    "utf8",
  );

  await writeFile(
    join(OUT_DIR, "migration-file-list.txt"),
    files.join("\n"),
    "utf8",
  );

  console.log(JSON.stringify(inventory.counts, null, 2));
  if (inMigrationsNotTypes.length) {
    console.log("DRIFT tables:", inMigrationsNotTypes.join(", "));
  }
  if (rpcInMigrationsNotTypes.length) {
    console.log("DRIFT rpc:", rpcInMigrationsNotTypes.join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
