#!/usr/bin/env node
/**
 * Fetch Lovable Cloud DB credentials via temporary migrate-helper edge function,
 * then run full data migration to the new Supabase project.
 *
 * Prerequisites:
 *   1. Deploy scripts/lovable-migrate-helper on Lovable (see index.ts header)
 *   2. New project schema already applied (db push done)
 *
 * Usage:
 *   node scripts/migrate-from-lovable.mjs --dry-run
 *   node scripts/migrate-from-lovable.mjs --confirm
 *
 * Env (optional):
 *   LOVABLE_HELPER_URL=https://iyqooryhmshlajuhabmc.supabase.co/functions/v1/migrate-helper
 *   LOVABLE_HELPER_ACCESS_KEY=your-key
 *   NEW_DB_PASSWORD=...
 */

import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const CONFIRM = args.has("--confirm");

async function prompt(label, envKey) {
  if (process.env[envKey]?.trim()) return process.env[envKey].trim();
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(label)).trim();
  } finally {
    rl.close();
  }
}

const OLD_ANON_KEY =
  process.env.LOVABLE_ANON_KEY ||
  process.env.OLD_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cW9vcnlobXNobGFqdWhhYm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNTE2MDgsImV4cCI6MjA5MzcyNzYwOH0.2TiusoOpuE9tpMYUMyAULURH9MDN-nJmAesyROtP0HU";

async function callHelper(url, accessKey, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OLD_ANON_KEY}`,
      apikey: OLD_ANON_KEY,
      "x-access-key": accessKey,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Helper response (${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`Helper error (${res.status}): ${data.error || text}`);
  }
  return data;
}

async function fetchSourceCreds(url, accessKey) {
  await callHelper(url, accessKey, { action: "ping" });
  return callHelper(url, accessKey, {});
}

async function main() {
  console.log("=== Lovable Cloud → Supabase data migration ===\n");

  const helperUrl = await prompt(
    "Lovable migrate-helper URL (Cloud → Edge Functions → migrate-helper → Copy URL): ",
    "LOVABLE_HELPER_URL"
  );
  const accessKey = await prompt("Access key (from lovable-migrate-helper/index.ts): ", "LOVABLE_HELPER_ACCESS_KEY");

  console.log("\nFetching source credentials from Lovable...");
  const creds = await fetchSourceCreds(helperUrl, accessKey);
  console.log("Source DB URL received.");

  let newPassword = process.env.NEW_DB_PASSWORD?.trim();
  if (!newPassword) {
    newPassword = await prompt(
      "New project DB password (sukehkrhvasfnoheyvvx → Dashboard → Database): ",
      "NEW_DB_PASSWORD"
    );
  }

  const childArgs = ["scripts/migrate-data-full.mjs"];
  if (DRY_RUN) childArgs.push("--dry-run");
  else if (CONFIRM) childArgs.push("--confirm");
  else {
    console.error("\nUse --dry-run first, then --confirm");
    process.exit(1);
  }

  const env = {
    ...process.env,
    OLD_DATABASE_URL: creds.supabase_db_url,
    NEW_DB_PASSWORD: newPassword,
    NEW_PROJECT_REF: process.env.NEW_PROJECT_REF || "sukehkrhvasfnoheyvvx",
  };

  const r = spawnSync(process.execPath, childArgs, { stdio: "inherit", env, cwd: process.cwd() });
  if (r.status !== 0) process.exit(r.status ?? 1);

  console.log("\n=== IMPORTANT ===");
  console.log("1. Delete migrate-helper edge function on Lovable NOW");
  console.log("2. Rotate service role / DB password on both projects if possible");
  console.log("3. npm run functions:deploy on new project");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
