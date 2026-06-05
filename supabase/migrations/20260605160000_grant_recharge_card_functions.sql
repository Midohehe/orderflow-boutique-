-- Restore execute grants for wallet card RPCs.
-- A prior migration revoked from PUBLIC/anon but forgot to re-grant authenticated,
-- causing "permission denied for function generate_recharge_cards".

REVOKE EXECUTE ON FUNCTION public.generate_recharge_cards(numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_recharge_cards(numeric, integer, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.redeem_card(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_card(text) TO authenticated, service_role;
