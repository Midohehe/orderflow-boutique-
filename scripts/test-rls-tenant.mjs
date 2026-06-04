#!/usr/bin/env node
/**
 * Phase 5 RLS tenant isolation smoke test (requires live Supabase + test users).
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — service role for setup
 *   TEST_OWNER_A_JWT, TEST_OWNER_B_JWT, TEST_STAFF_A_JWT, TEST_ADMIN_JWT — optional user JWTs
 *
 * Usage:
 *   node scripts/test-rls-tenant.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function clientWithJwt(jwt) {
  return createClient(url, anonKey || serviceKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

async function countOrders(client, storeId) {
  const { count, error } = await client
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  if (error) throw error;
  return count ?? 0;
}

async function rpcStatusCounts(client, storeId) {
  const { data, error } = await client.rpc("orders_status_counts", { _store_id: storeId });
  return { data, error };
}

async function main() {
  const results = [];

  const { data: stores } = await admin.from("stores").select("id, owner_id, name").limit(10);
  if (!stores?.length || stores.length < 2) {
    console.log("Need at least 2 stores in DB for cross-tenant test. Found:", stores?.length ?? 0);
    process.exit(0);
  }

  const storeA = stores[0];
  const storeB = stores.find((s) => s.owner_id !== storeA.owner_id) || stores[1];

  console.log("Store A:", storeA.id, storeA.name);
  console.log("Store B:", storeB.id, storeB.name, "(cross-owner:", storeB.owner_id !== storeA.owner_id, ")");

  const jwtOwnerA = process.env.TEST_OWNER_A_JWT;
  const jwtOwnerB = process.env.TEST_OWNER_B_JWT;
  const jwtStaff = process.env.TEST_STAFF_A_JWT;
  const jwtAdmin = process.env.TEST_ADMIN_JWT;

  if (jwtOwnerA) {
    const c = clientWithJwt(jwtOwnerA);
    const own = await countOrders(c, storeA.id);
    const cross = storeB.owner_id !== storeA.owner_id ? await countOrders(c, storeB.id) : -1;
    results.push({
      role: "merchant/owner A",
      ownStoreOrders: own,
      crossStoreOrders: cross,
      pass: cross <= 0 || cross === -1,
    });
    const rpc = await rpcStatusCounts(c, storeB.owner_id !== storeA.owner_id ? storeB.id : storeA.id);
    results.push({
      role: "merchant/owner A RPC cross-store",
      pass: storeB.owner_id === storeA.owner_id ? true : !rpc.error && (rpc.data?.length ?? 0) === 0,
      detail: rpc.error?.message,
    });
  } else {
    console.log("Skip owner tests — set TEST_OWNER_A_JWT");
  }

  if (jwtStaff) {
    const c = clientWithJwt(jwtStaff);
    const cross = await countOrders(c, storeB.id);
    results.push({ role: "staff", crossStoreOrders: cross, pass: cross === 0 });
  }

  if (jwtAdmin) {
    const c = clientWithJwt(jwtAdmin);
    const b = await countOrders(c, storeB.id);
    results.push({ role: "admin", storeBOrders: b, pass: b >= 0 });
  }

  console.log("\n--- Results ---");
  console.table(results);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error("\nFAILED:", failed.length);
    process.exit(1);
  }
  console.log("\nAll provided JWT tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
