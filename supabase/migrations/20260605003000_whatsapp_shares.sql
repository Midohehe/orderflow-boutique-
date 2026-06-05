-- WhatsApp integration sharing between merchants.
--
-- A merchant (sharer = owner_id) can grant another merchant
-- (recipient = shared_with_user_id) the ability to send order confirmations
-- through the sharer's configured WhatsApp integration. The recipient's own
-- configured integration always takes priority; the shared one is used only as
-- a fallback when the recipient has no working integration of their own.
--
-- Emails are snapshotted at creation time for display (auth.users.email is not
-- otherwise readable from the dashboard). Recipient resolution (email -> user
-- id) is done by the whatsapp-share edge function using the Auth Admin API, so
-- INSERTs happen with the service role and intentionally have no authenticated
-- INSERT policy.

CREATE TABLE IF NOT EXISTS public.whatsapp_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,            -- sharer (owns the WhatsApp integration)
  owner_email text,                  -- sharer email snapshot (for recipient UI)
  shared_with_user_id uuid NOT NULL, -- recipient merchant account
  shared_with_email text,            -- recipient email snapshot (for sharer UI)
  status text NOT NULL DEFAULT 'active',     -- 'active' | 'revoked' (sharer-controlled)
  recipient_active boolean NOT NULL DEFAULT true, -- recipient opt-in toggle
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_shares_no_self CHECK (owner_id <> shared_with_user_id),
  CONSTRAINT whatsapp_shares_unique UNIQUE (owner_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_shares_owner ON public.whatsapp_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_shares_recipient ON public.whatsapp_shares(shared_with_user_id);

ALTER TABLE public.whatsapp_shares ENABLE ROW LEVEL SECURITY;

-- Both sides (and their staff) can read the share row.
CREATE POLICY "wa_shares_select" ON public.whatsapp_shares
  FOR SELECT TO authenticated
  USING (
    public.is_member_of(owner_id)
    OR public.is_member_of(shared_with_user_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Sharer revokes/reactivates; recipient toggles recipient_active. Both allowed
-- to update; the edge function (service role) handles creation.
CREATE POLICY "wa_shares_update" ON public.whatsapp_shares
  FOR UPDATE TO authenticated
  USING (
    public.is_member_of(owner_id)
    OR public.is_member_of(shared_with_user_id)
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_member_of(owner_id)
    OR public.is_member_of(shared_with_user_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Only the sharer (or admin) can delete a share.
CREATE POLICY "wa_shares_delete" ON public.whatsapp_shares
  FOR DELETE TO authenticated
  USING (
    public.is_member_of(owner_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER trg_wa_shares_updated
  BEFORE UPDATE ON public.whatsapp_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
