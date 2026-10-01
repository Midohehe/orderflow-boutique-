ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS opening_balance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opening_balance_amount numeric(12,2) NOT NULL DEFAULT 0
    CHECK (opening_balance_amount >= 0 AND opening_balance_amount <> 'NaN'::numeric);

-- One opening grant per account, recorded separately from purchased credit.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_opening_balance_once
  ON public.wallet_transactions (user_id) WHERE type = 'opening_balance';

CREATE OR REPLACE FUNCTION public.grant_new_account_opening_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
  _amount numeric;
  _wallet_id uuid;
  _transaction_id uuid;
BEGIN
  -- Staff accounts use their store owner's wallet.
  IF COALESCE(NEW.raw_user_meta_data->>'sub_user', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT opening_balance_enabled, opening_balance_amount INTO _enabled, _amount
  FROM public.app_settings ORDER BY id LIMIT 1;
  IF NOT COALESCE(_enabled, false) OR COALESCE(_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO _wallet_id FROM public.wallets WHERE user_id = NEW.id FOR UPDATE;
  INSERT INTO public.wallet_transactions (wallet_id, user_id, amount, type, reference_id, notes)
    VALUES (_wallet_id, NEW.id, _amount, 'opening_balance', NEW.id, 'رصيد افتتاحي للحساب الجديد')
    ON CONFLICT (user_id) WHERE type = 'opening_balance' DO NOTHING
    RETURNING id INTO _transaction_id;
  IF _transaction_id IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance + _amount, updated_at = now()
      WHERE id = _wallet_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_new_account_opening_balance() FROM PUBLIC, anon, authenticated;

-- Runs only on account creation; existing users and wallet balances are untouched.
DROP TRIGGER IF EXISTS z_grant_new_account_opening_balance ON auth.users;
CREATE TRIGGER z_grant_new_account_opening_balance
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.grant_new_account_opening_balance();

NOTIFY pgrst, 'reload schema';
