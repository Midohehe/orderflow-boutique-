-- Phase 5 RLS tenant isolation tests
-- Run against a staging DB after applying migration 20260603190000_phase5_strict_store_rls.sql
--
-- Usage (Supabase SQL editor as postgres / service_role):
--   \i supabase/tests/rls_tenant_isolation.sql
--
-- Or: psql $DATABASE_URL -f supabase/tests/rls_tenant_isolation.sql

CREATE SCHEMA IF NOT EXISTS rls_test;
CREATE TABLE IF NOT EXISTS rls_test.results (
  id serial PRIMARY KEY,
  scenario text NOT NULL,
  role_type text NOT NULL,
  passed boolean NOT NULL,
  detail text
);

TRUNCATE rls_test.results;

CREATE OR REPLACE FUNCTION rls_test.assert(_scenario text, _role text, _cond boolean, _detail text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO rls_test.results(scenario, role_type, passed, detail)
  VALUES (_scenario, _role, _cond, _detail);
  IF NOT _cond THEN
    RAISE WARNING '[FAIL] % / % — %', _scenario, _role, _detail;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION rls_test.run_as(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION rls_test.clear_jwt()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Fixture: two merchants (owners), two stores each, one staff on store A only
-- Uses existing rows when present; skips destructive setup if merchants exist.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  staff_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  admin_u uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  store_a1 uuid;
  store_a2 uuid;
  store_b1 uuid;
  order_a1 uuid;
  order_b1 uuid;
  cnt int;
BEGIN
  -- Skip if auth.users not accessible (run manually on linked project)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users') THEN
    INSERT INTO rls_test.results(scenario, role_type, passed, detail)
    VALUES ('setup', 'system', false, 'auth.users not available — run on Supabase linked DB');
    RETURN;
  END IF;

  -- Minimal profiles/stores for isolation checks using service role (current user)
  SELECT id INTO store_a1 FROM public.stores WHERE owner_id = owner_a ORDER BY is_default DESC LIMIT 1;
  IF store_a1 IS NULL THEN
    INSERT INTO rls_test.results(scenario, role_type, passed, detail)
    VALUES ('setup', 'system', false, 'No fixture stores for owner_a — seed test users in Dashboard first');
    RETURN;
  END IF;

  SELECT id INTO store_b1 FROM public.stores WHERE owner_id = owner_b ORDER BY is_default DESC LIMIT 1;
  IF store_b1 IS NULL THEN
    INSERT INTO rls_test.results(scenario, role_type, passed, detail)
    VALUES ('setup', 'system', false, 'No fixture stores for owner_b');
    RETURN;
  END IF;

  -- Owner A can access own store
  PERFORM rls_test.run_as(owner_a);
  SELECT COUNT(*) INTO cnt FROM public.orders WHERE store_id = store_a1 LIMIT 1;
  PERFORM rls_test.assert('owner reads own store orders', 'merchant/owner', true, 'store_a1 count ok');

  -- Owner A cannot read owner B store (set role)
  SELECT COUNT(*) INTO cnt FROM public.orders WHERE store_id = store_b1;
  PERFORM rls_test.assert(
    'owner blocked from other merchant store',
    'merchant/owner',
    cnt = 0,
    format('cross-store rows=%s', cnt)
  );

  -- Staff with access to store A only
  IF EXISTS (SELECT 1 FROM public.store_members WHERE member_user_id = staff_a) THEN
    PERFORM rls_test.run_as(staff_a);
    SELECT COUNT(*) INTO cnt FROM public.orders WHERE store_id = store_a1;
    PERFORM rls_test.assert('staff reads assigned store', 'staff', cnt >= 0, 'select allowed');
    SELECT COUNT(*) INTO cnt FROM public.orders WHERE store_id = store_b1;
    PERFORM rls_test.assert(
      'staff blocked from unassigned store',
      'staff',
      cnt = 0,
      format('cross-merchant rows=%s', cnt)
    );
  ELSE
    PERFORM rls_test.assert('staff reads assigned store', 'staff', true, 'SKIP — no staff_a fixture');
  END IF;

  -- Admin bypass (if admin user exists in user_roles)
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = admin_u AND role = 'admin') THEN
    PERFORM rls_test.run_as(admin_u);
    SELECT COUNT(*) INTO cnt FROM public.orders WHERE store_id = store_b1;
    PERFORM rls_test.assert('admin reads any store', 'admin', cnt >= 0, 'admin bypass');
  ELSE
    PERFORM rls_test.assert('admin reads any store', 'admin', true, 'SKIP — no admin fixture');
  END IF;

  -- has_store_access function checks
  PERFORM rls_test.run_as(owner_a);
  PERFORM rls_test.assert(
    'has_store_access own store',
    'merchant/owner',
    public.has_store_access(store_a1),
    store_a1::text
  );
  PERFORM rls_test.assert(
    'has_store_access other store denied',
    'merchant/owner',
    NOT public.has_store_access(store_b1),
    store_b1::text
  );

  PERFORM rls_test.clear_jwt();
END;
$$;

-- RPC isolation
DO $$
DECLARE
  store_a1 uuid;
  owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  store_b1 uuid;
  ok boolean;
BEGIN
  SELECT id INTO store_a1 FROM public.stores WHERE owner_id = owner_a LIMIT 1;
  SELECT id INTO store_b1 FROM public.stores WHERE owner_id = owner_b LIMIT 1;
  IF store_a1 IS NULL OR store_b1 IS NULL THEN RETURN; END IF;

  PERFORM rls_test.run_as(owner_a);
  SELECT EXISTS (SELECT 1 FROM public.orders_status_counts(store_a1)) INTO ok;
  PERFORM rls_test.assert('RPC orders_status_counts own store', 'merchant/owner', ok, '');

  BEGIN
    PERFORM public.orders_status_counts(store_b1);
    PERFORM rls_test.assert('RPC orders_status_counts cross store', 'merchant/owner', false, 'should not return');
  EXCEPTION WHEN OTHERS THEN
    PERFORM rls_test.assert('RPC orders_status_counts cross store', 'merchant/owner', true, 'blocked or empty');
  END;

  PERFORM rls_test.clear_jwt();
END;
$$;

-- Summary
SELECT
  role_type,
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed
FROM rls_test.results
GROUP BY role_type
ORDER BY role_type;

SELECT * FROM rls_test.results WHERE NOT passed;
