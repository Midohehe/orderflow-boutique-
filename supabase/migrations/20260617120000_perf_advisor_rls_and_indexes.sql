-- Performance Advisor fixes (project sukehkrhvasfnoheyvvx):
-- 1) Drop 5 duplicate indexes flagged by duplicate_index lint
-- 2) Wrap auth.*() calls in RLS policies with (select ...) for initplan
--    See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Note: multiple_permissive_policies (92 warnings) is intentionally out of scope
-- here — consolidating policies needs per-table review to avoid access regressions.

-- ---------------------------------------------------------------------------
-- 1) Duplicate indexes — keep the _id suffixed / constraint-backed names
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_landing_pages_owner;
DROP INDEX IF EXISTS public.idx_order_items_order;
DROP INDEX IF EXISTS public.idx_order_items_owner;
DROP INDEX IF EXISTS public.idx_return_shipments_return;
-- UNIQUE (user_id, role) already creates user_roles_user_id_role_key
DROP INDEX IF EXISTS public.user_roles_user_role_unique;

-- ---------------------------------------------------------------------------
-- 2) RLS initplan — rewrite auth.uid()/jwt()/role()/email() once per query
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.fix_rls_auth_initplan(expr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r text := expr;
BEGIN
  IF r IS NULL OR btrim(r) = '' THEN
    RETURN NULL;
  END IF;

  -- Preserve already-fixed subqueries (idempotent re-run).
  r := replace(r, '(select auth.uid())', '__RLS_UID__');
  r := replace(r, '(select auth.jwt())', '__RLS_JWT__');
  r := replace(r, '(select auth.role())', '__RLS_ROLE__');
  r := replace(r, '(select auth.email())', '__RLS_EMAIL__');

  r := replace(r, 'auth.uid()', '(select auth.uid())');
  r := replace(r, 'auth.jwt()', '(select auth.jwt())');
  r := replace(r, 'auth.role()', '(select auth.role())');
  r := replace(r, 'auth.email()', '(select auth.email())');

  r := replace(r, '__RLS_UID__', '(select auth.uid())');
  r := replace(r, '__RLS_JWT__', '(select auth.jwt())');
  r := replace(r, '__RLS_ROLE__', '(select auth.role())');
  r := replace(r, '__RLS_EMAIL__', '(select auth.email())');

  RETURN r;
END;
$$;

DO $$
DECLARE
  pol record;
  new_using text;
  new_check text;
BEGIN
  FOR pol IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname AS policy_name,
      pg_get_expr(p.polqual, p.polrelid) AS using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    new_using := pg_temp.fix_rls_auth_initplan(pol.using_expr);
    new_check := pg_temp.fix_rls_auth_initplan(pol.check_expr);

    IF new_using IS DISTINCT FROM pol.using_expr THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        pol.policy_name,
        pol.schema_name,
        pol.table_name,
        replace(new_using, '%', '%%')
      );
    END IF;

    IF new_check IS DISTINCT FROM pol.check_expr THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        pol.policy_name,
        pol.schema_name,
        pol.table_name,
        replace(new_check, '%', '%%')
      );
    END IF;
  END LOOP;
END;
$$;
