
-- 1) Settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS order_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_enabled boolean NOT NULL DEFAULT false;

-- 2) Orders lock flag
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS locked_insufficient_balance boolean NOT NULL DEFAULT false;

-- 3) Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage wallets" ON public.wallets
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Recharge cards
CREATE TABLE IF NOT EXISTS public.recharge_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  value numeric NOT NULL,
  batch_id uuid,
  batch_label text,
  used boolean NOT NULL DEFAULT false,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recharge_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cards" ON public.recharge_cards
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own redeemed cards" ON public.recharge_cards
  FOR SELECT USING (used_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_recharge_cards_batch ON public.recharge_cards(batch_id);
CREATE INDEX IF NOT EXISTS idx_recharge_cards_used_by ON public.recharge_cards(used_by);

-- 5) Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL,
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tx" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage tx" ON public.wallet_transactions
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);

-- 6) Redeem function
CREATE OR REPLACE FUNCTION public.redeem_card(_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _card recharge_cards%ROWTYPE;
  _wallet_id uuid;
  _new_balance numeric;
BEGIN
  IF _uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO _card FROM recharge_cards WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'card_not_found');
  END IF;
  IF _card.used THEN
    RETURN json_build_object('success', false, 'error', 'card_used');
  END IF;

  INSERT INTO wallets (user_id, balance) VALUES (_uid, 0)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO _wallet_id FROM wallets WHERE user_id = _uid FOR UPDATE;

  UPDATE wallets SET balance = balance + _card.value, updated_at = now()
    WHERE id = _wallet_id
    RETURNING balance INTO _new_balance;

  UPDATE recharge_cards SET used = true, used_by = _uid, used_at = now()
    WHERE id = _card.id;

  INSERT INTO wallet_transactions (wallet_id, user_id, amount, type, reference_id, notes)
    VALUES (_wallet_id, _uid, _card.value, 'recharge', _card.id, 'كرت شحن: ' || _card.code);

  -- Unlock previously locked orders if balance is now >= 0
  IF _new_balance >= 0 THEN
    UPDATE orders SET locked_insufficient_balance = false
      WHERE owner_id = _uid AND locked_insufficient_balance = true;
  END IF;

  RETURN json_build_object('success', true, 'amount', _card.value, 'balance', _new_balance);
END;
$$;

-- 7) Generate cards (admin only)
CREATE OR REPLACE FUNCTION public.generate_recharge_cards(_value numeric, _count integer, _label text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _batch uuid := gen_random_uuid();
  _i integer;
  _code text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF _count <= 0 OR _count > 1000 OR _value <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_input');
  END IF;

  FOR _i IN 1.._count LOOP
    LOOP
      _code := upper(encode(extensions.gen_random_bytes(8), 'hex'));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM recharge_cards WHERE code = _code);
    END LOOP;
    INSERT INTO recharge_cards (code, value, batch_id, batch_label)
      VALUES (_code, _value, _batch, _label);
  END LOOP;

  RETURN json_build_object('success', true, 'batch_id', _batch, 'count', _count);
END;
$$;

-- 8) Deduct order fee trigger
CREATE OR REPLACE FUNCTION public.deduct_order_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fee numeric;
  _enabled boolean;
  _wallet_id uuid;
  _new_balance numeric;
BEGIN
  SELECT order_fee, wallet_enabled INTO _fee, _enabled FROM app_settings LIMIT 1;
  IF NOT COALESCE(_enabled, false) OR COALESCE(_fee, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO wallets (user_id, balance) VALUES (NEW.owner_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT id, balance INTO _wallet_id, _new_balance FROM wallets WHERE user_id = NEW.owner_id FOR UPDATE;

  UPDATE wallets SET balance = balance - _fee, updated_at = now()
    WHERE id = _wallet_id
    RETURNING balance INTO _new_balance;

  INSERT INTO wallet_transactions (wallet_id, user_id, amount, type, reference_id, notes)
    VALUES (_wallet_id, NEW.owner_id, -_fee, 'order_fee', NEW.id, 'رسوم طلب #' || substring(NEW.id::text, 1, 8));

  IF _new_balance < 0 THEN
    NEW.locked_insufficient_balance := true;
    UPDATE orders SET locked_insufficient_balance = true WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_order_fee ON public.orders;
CREATE TRIGGER trg_deduct_order_fee
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_order_fee();
