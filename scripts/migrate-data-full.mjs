#!/usr/bin/env node
/**
 * Full data migration: old Supabase project -> new Supabase project.
 *
 * Copies auth.* (users, passwords) + public.* (+ optional storage metadata).
 * Schema must already exist on the target (db push completed).
 *
 * Usage:
 *   OLD_DB_PASSWORD=xxx NEW_DB_PASSWORD=yyy node scripts/migrate-data-full.mjs
 *   node scripts/migrate-data-full.mjs --dry-run
 *   node scripts/migrate-data-full.mjs --confirm
 *
 * Or set OLD_DATABASE_URL / NEW_DATABASE_URL directly.
 */

import pg from "pg";

const OLD_REF = process.env.OLD_PROJECT_REF || "iyqooryhmshlajuhabmc";
const NEW_REF = process.env.NEW_PROJECT_REF || "sukehkrhvasfnoheyvvx";

const AUTH_TABLES = [
  "users",
  "identities",
  "sessions",
  "refresh_tokens",
  "mfa_factors",
  "mfa_challenges",
  "mfa_amr_claims",
  "one_time_tokens",
  "flow_state",
  "saml_providers",
  "sso_domains",
  "saml_relay_states",
];

const STORAGE_TABLES = ["buckets", "objects", "migrations"];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const CONFIRM = args.has("--confirm");

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function buildDbUrl(ref, password) {
  if (!password) throw new Error(`Missing password for project ${ref}`);
  const host = process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;
  const user = process.env.SUPABASE_DB_USER || "postgres";
  const port = process.env.SUPABASE_DB_PORT || "5432";
  const db = process.env.SUPABASE_DB_NAME || "postgres";
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${db}?sslmode=require`;
}

function resolveUrls() {
  const oldUrl =
    process.env.OLD_DATABASE_URL ||
    buildDbUrl(OLD_REF, process.env.OLD_DB_PASSWORD);
  const newUrl =
    process.env.NEW_DATABASE_URL ||
    buildDbUrl(NEW_REF, process.env.NEW_DB_PASSWORD);
  return { oldUrl, newUrl };
}

async function connect(label, url) {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Connected: ${label}`);
  return client;
}

async function tableExists(client, schema, table) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  );
  return rows.length > 0;
}

async function countRows(client, schema, table) {
  if (!(await tableExists(client, schema, table))) return null;
  const { rows } = await client.query(
    `SELECT count(*)::bigint AS c FROM ${quoteIdent(schema)}.${quoteIdent(table)}`
  );
  return Number(rows[0].c);
}

async function listPublicTables(client) {
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  return rows.map((r) => r.tablename);
}

async function getColumns(client, schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table]
  );
  return rows.map((r) => r.column_name);
}

async function resetSequences(client, schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
       AND column_default LIKE 'nextval(%'`,
    [schema, table]
  );
  for (const { column_name } of rows) {
    const seq = await client.query(
      `SELECT pg_get_serial_sequence($1, $2) AS seq`,
      [`${schema}.${table}`, column_name]
    );
    const seqName = seq.rows[0]?.seq;
    if (!seqName) continue;
    await client.query(
      `SELECT setval($1::regclass, COALESCE((SELECT MAX(${quoteIdent(column_name)}) FROM ${quoteIdent(schema)}.${quoteIdent(table)}), 1))`,
      [seqName]
    );
  }
}

async function copyTable(oldClient, newClient, schema, table) {
  const existsOld = await tableExists(oldClient, schema, table);
  const existsNew = await tableExists(newClient, schema, table);
  if (!existsOld || !existsNew) {
    console.log(`  skip ${schema}.${table} (missing on ${!existsOld ? "source" : "target"})`);
    return 0;
  }

  const oldCols = await getColumns(oldClient, schema, table);
  const newCols = await getColumns(newClient, schema, table);
  const cols = oldCols.filter((c) => newCols.includes(c));
  if (!cols.length) {
    console.log(`  skip ${schema}.${table} (no shared columns)`);
    return 0;
  }

  const oldCount = await countRows(oldClient, schema, table);
  if (!oldCount) {
    console.log(`  ${schema}.${table}: 0 rows`);
    return 0;
  }

  const colList = cols.map(quoteIdent).join(", ");
  const full = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const BATCH = 100;
  let copied = 0;
  let offset = 0;

  while (offset < oldCount) {
    const { rows } = await oldClient.query(
      `SELECT ${colList} FROM ${full} ORDER BY ${quoteIdent(cols[0])} LIMIT $1 OFFSET $2`,
      [BATCH, offset]
    );
    if (!rows.length) break;

    const values = [];
    const tuples = [];
    let i = 1;
    for (const row of rows) {
      const ph = cols.map(() => `$${i++}`);
      tuples.push(`(${ph.join(",")})`);
      for (const c of cols) values.push(row[c]);
    }

    await newClient.query(`INSERT INTO ${full} (${colList}) VALUES ${tuples.join(",")}`, values);
    copied += rows.length;
    offset += rows.length;
    process.stdout.write(`\r  ${schema}.${table}: ${copied}/${oldCount}`);
  }
  console.log("");
  await resetSequences(newClient, schema, table);
  return copied;
}

async function truncateTarget(newClient) {
  console.log("\nClearing target data (schema + auth + storage metadata)...");
  await newClient.query(`SET session_replication_role = replica`);

  const publicTables = await listPublicTables(newClient);
  if (publicTables.length) {
    const list = publicTables.map((t) => `public.${quoteIdent(t)}`).join(", ");
    await newClient.query(`TRUNCATE ${list} CASCADE`);
  }

  for (const t of [...AUTH_TABLES].reverse()) {
    if (await tableExists(newClient, "auth", t)) {
      await newClient.query(`TRUNCATE auth.${quoteIdent(t)} CASCADE`);
    }
  }

  for (const t of STORAGE_TABLES) {
    if (await tableExists(newClient, "storage", t)) {
      await newClient.query(`TRUNCATE storage.${quoteIdent(t)} CASCADE`);
    }
  }

  await newClient.query(`SET session_replication_role = DEFAULT`);
}

async function dryRun(oldClient, newClient) {
  console.log("\n=== DRY RUN — row counts ===\n");
  console.log("AUTH:");
  for (const t of AUTH_TABLES) {
    const oldC = await countRows(oldClient, "auth", t);
    const newC = await countRows(newClient, "auth", t);
    if (oldC === null && newC === null) continue;
    console.log(`  auth.${t}: source=${oldC ?? "—"} target=${newC ?? "—"}`);
  }

  console.log("\nPUBLIC (source):");
  const tables = await listPublicTables(oldClient);
  let total = 0;
  for (const t of tables) {
    const c = await countRows(oldClient, "public", t);
    if (c) {
      console.log(`  public.${t}: ${c}`);
      total += c;
    }
  }
  console.log(`\nPublic rows to copy (approx): ${total}`);
  console.log("\nRun with --confirm to migrate.");
}

async function migrate(oldClient, newClient) {
  await truncateTarget(newClient);

  console.log("\nCopying auth...");
  await newClient.query(`SET session_replication_role = replica`);
  let authTotal = 0;
  for (const t of AUTH_TABLES) {
    authTotal += await copyTable(oldClient, newClient, "auth", t);
  }

  console.log("\nCopying storage metadata...");
  let storageTotal = 0;
  for (const t of STORAGE_TABLES) {
    storageTotal += await copyTable(oldClient, newClient, "storage", t);
  }

  console.log("\nCopying public...");
  const publicTables = await listPublicTables(oldClient);
  let publicTotal = 0;
  for (const t of publicTables) {
    publicTotal += await copyTable(oldClient, newClient, "public", t);
  }

  await newClient.query(`SET session_replication_role = DEFAULT`);

  console.log("\n=== DONE ===");
  console.log(`Auth rows copied:    ${authTotal}`);
  console.log(`Storage rows copied: ${storageTotal}`);
  console.log(`Public rows copied:  ${publicTotal}`);
  console.log("\nNext:");
  console.log("  1. Redeploy edge functions + secrets on NEW project");
  console.log("  2. Re-copy storage FILES if you use uploads (metadata only was migrated)");
  console.log("  3. Update webhooks / OAuth redirect URLs to NEW project");
  console.log("  4. npm run dev — login with existing email/password from old project");
}

async function main() {
  const { oldUrl, newUrl } = resolveUrls();
  console.log(`Source: ${OLD_REF}`);
  console.log(`Target: ${NEW_REF}`);
  if (DRY_RUN) console.log("Mode: dry-run");
  if (CONFIRM) console.log("Mode: LIVE migrate");

  const oldClient = await connect("source", oldUrl);
  const newClient = await connect("target", newUrl);

  try {
    if (DRY_RUN) {
      await dryRun(oldClient, newClient);
      return;
    }
    if (!CONFIRM) {
      console.error("\nRefusing to migrate without --confirm (or use --dry-run first).");
      process.exit(1);
    }
    await migrate(oldClient, newClient);
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  if (/password authentication failed/i.test(err.message)) {
    console.error("Check database password: Dashboard → Project Settings → Database");
  }
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(err.message)) {
    console.error("Check connection host. Try direct: db.<project-ref>.supabase.co:5432");
  }
  process.exit(1);
});
