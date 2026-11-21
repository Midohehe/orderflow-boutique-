-- Split legacy admin FOR ALL policies into write-only policies. Their SELECT
-- branch was redundant because each table's read policy already includes the
-- admin-visible rows (or is public-readable).
DO $migration$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('app_settings', 'Admin write app_settings'),
      ('form_field_catalog', 'Admin write catalog'),
      ('permission_group_items', 'Admin write group items'),
      ('permission_groups', 'Admin write perm groups'),
      ('permissions', 'Admin write permissions'),
      ('recharge_cards', 'Admins manage cards'),
      ('shipping_error_aliases', 'Admin write shipping_error_aliases'),
      ('subscription_plans', 'Admin manage subscription plans'),
      ('tutorial_videos', 'tutorial_admin'),
      ('wallet_transactions', 'Admins manage tx'),
      ('wallets', 'Admins manage wallets')
    ) AS policies(table_name, policy_name)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', item.policy_name, item.table_name);
    EXECUTE format(
      'CREATE POLICY admin_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))',
      item.table_name
    );
    EXECUTE format(
      'CREATE POLICY admin_update ON public.%I FOR UPDATE TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin''::public.app_role)) WITH CHECK (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))',
      item.table_name
    );
    EXECUTE format(
      'CREATE POLICY admin_delete ON public.%I FOR DELETE TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))',
      item.table_name
    );
  END LOOP;
END
$migration$;

-- The profile read policy already includes admins. Merge the two UPDATE
-- branches and keep admin-only INSERT/DELETE behavior.
DROP POLICY "Admin manage profiles" ON public.profiles;
DROP POLICY "User update own profile" ON public.profiles;

CREATE POLICY profile_admin_insert
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY profile_user_or_admin_update
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
CREATE POLICY profile_admin_delete
  ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- offer_stats already has a dedicated SELECT policy. Preserve the exact
-- insert/update/delete checks without evaluating the old ALL policy on reads.
DROP POLICY store_tenant_upsert ON public.offer_stats;

CREATE POLICY store_tenant_insert
  ON public.offer_stats FOR INSERT TO authenticated
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_update
  ON public.offer_stats FOR UPDATE TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id))
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_delete
  ON public.offer_stats FOR DELETE TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id));

-- Merge the SELECT union for member permissions, then keep owner/admin writes
-- as command-specific policies.
DROP POLICY "Member read own perms" ON public.store_member_permissions;
DROP POLICY "Owner manage member perms" ON public.store_member_permissions;

CREATE POLICY member_or_owner_read_permissions
  ON public.store_member_permissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_permissions.member_id
        AND (
          sm.member_user_id = (SELECT auth.uid())
          OR sm.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  );
CREATE POLICY owner_manage_permissions_insert
  ON public.store_member_permissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_permissions.member_id
        AND (
          sm.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  );
CREATE POLICY owner_manage_permissions_update
  ON public.store_member_permissions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_permissions.member_id
        AND (
          sm.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_permissions.member_id
        AND (
          sm.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  );
CREATE POLICY owner_manage_permissions_delete
  ON public.store_member_permissions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_permissions.member_id
        AND (
          sm.owner_id = (SELECT auth.uid())
          OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    )
  );

-- store_assignment_read already contains the owner/admin SELECT branch.
DROP POLICY store_owner_manage_assignments ON public.store_member_stores;

CREATE POLICY store_owner_assignments_insert
  ON public.store_member_stores FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_stores.member_id
        AND sm.owner_id = (SELECT auth.uid())
    )
  );
CREATE POLICY store_owner_assignments_update
  ON public.store_member_stores FOR UPDATE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_stores.member_id
        AND sm.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_stores.member_id
        AND sm.owner_id = (SELECT auth.uid())
    )
  );
CREATE POLICY store_owner_assignments_delete
  ON public.store_member_stores FOR DELETE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_stores.member_id
        AND sm.owner_id = (SELECT auth.uid())
    )
  );

-- Merge member/owner/admin reads, and split owner/admin writes by command.
DROP POLICY "Member read self" ON public.store_members;
DROP POLICY "Owner manage store_members" ON public.store_members;

CREATE POLICY member_owner_or_admin_read
  ON public.store_members FOR SELECT TO authenticated
  USING (
    member_user_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
CREATE POLICY owner_manage_members_insert
  ON public.store_members FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
CREATE POLICY owner_manage_members_update
  ON public.store_members FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
CREATE POLICY owner_manage_members_delete
  ON public.store_members FOR DELETE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
