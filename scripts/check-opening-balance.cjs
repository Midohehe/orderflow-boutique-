// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE app_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE wallets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE NOT NULL, balance numeric NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now());
    CREATE TABLE wallet_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wallet_id uuid REFERENCES wallets(id), user_id uuid NOT NULL, amount numeric NOT NULL, type text NOT NULL, reference_id uuid, notes text);
    INSERT INTO app_settings DEFAULT VALUES;
    INSERT INTO auth.users DEFAULT VALUES;
  `);
  const migration = fs.readFileSync('supabase/migrations/20261001120000_new_account_opening_balance.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration); // safe to apply again
  const scalar = async sql => (await db.query(sql)).rows[0].value;
  await db.exec('INSERT INTO auth.users DEFAULT VALUES');
  assert.equal(await scalar('SELECT count(*)::int AS value FROM wallets'), 0);
  await db.exec('UPDATE app_settings SET opening_balance_enabled=true, opening_balance_amount=25.50');
  const { rows: [user] } = await db.query("INSERT INTO auth.users(raw_user_meta_data) VALUES ('{\"opening_balance_amount\":9999}') RETURNING id");
  assert.equal(Number(await scalar('SELECT balance AS value FROM wallets')), 25.5);
  assert.equal(await scalar('SELECT count(*)::int AS value FROM wallet_transactions'), 1);
  // A second trigger invocation for the same user cannot grant twice.
  await db.exec('CREATE TRIGGER repeat_grant AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION grant_new_account_opening_balance()');
  await db.query('UPDATE auth.users SET raw_user_meta_data=raw_user_meta_data WHERE id=$1', [user.id]);
  assert.equal(Number(await scalar('SELECT balance AS value FROM wallets')), 25.5);
  await db.exec("INSERT INTO auth.users(raw_user_meta_data) VALUES ('{\"sub_user\":true}')");
  assert.equal(await scalar('SELECT count(*)::int AS value FROM wallets'), 1);
  await db.exec('UPDATE app_settings SET opening_balance_enabled=false; INSERT INTO auth.users DEFAULT VALUES');
  assert.equal(await scalar('SELECT count(*)::int AS value FROM wallets'), 1);
  await db.exec('UPDATE app_settings SET opening_balance_enabled=true, opening_balance_amount=0; INSERT INTO auth.users DEFAULT VALUES');
  assert.equal(await scalar('SELECT count(*)::int AS value FROM wallets'), 1);
  await assert.rejects(db.exec('UPDATE app_settings SET opening_balance_amount=-1'));
  await assert.rejects(db.exec("UPDATE app_settings SET opening_balance_amount='NaN'"));
  assert.equal(await scalar("SELECT has_function_privilege('authenticated','grant_new_account_opening_balance()','EXECUTE') AS value"), false);
  await db.exec('UPDATE app_settings SET opening_balance_amount=10; BEGIN; INSERT INTO auth.users DEFAULT VALUES; ROLLBACK');
  assert.equal(await scalar('SELECT count(*)::int AS value FROM wallets'), 1);
  assert.equal(await scalar('SELECT count(*)::int AS value FROM wallet_transactions'), 1);
  await db.close();
  console.log('Opening balance: disabled/default, amount, metadata, idempotence, staff exclusion, constraints, privileges and rollback passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
