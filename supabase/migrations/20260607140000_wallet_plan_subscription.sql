-- Merchant self-service: subscribe / renew a plan from wallet balance.

CREATE OR REPLACE FUNCTION public.subscribe_to_plan(_plan_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan public.subscription_plans%ROWTYPE;
  _current public.subscription_plans%ROWTYPE;
  _wallet_id uuid;
  _balance numeric;
  _price numeric;
  _ends timestamptz;
  _renewal boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.member_user_id = _uid) THEN
    RETURN json_build_object('success', false, 'error', 'sub_user_forbidden');
  END IF;

  SELECT * INTO _plan
  FROM public.subscription_plans
  WHERE slug = trim(_plan_slug)
    AND is_public = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  SELECT sp.* INTO _current
  FROM public.profiles p
  JOIN public.subscription_plans sp
    ON sp.id = COALESCE(
      p.plan_id,
      (SELECT id FROM public.subscription_plans WHERE slug = 'free' LIMIT 1)
    )
  WHERE p.user_id = _uid;

  IF _current.id = _plan.id THEN
    IF _plan.price_monthly <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'already_on_plan');
    END IF;
    _renewal := true;
  ELSIF _plan.sort_order < _current.sort_order THEN
    RETURN json_build_object('success', false, 'error', 'downgrade_not_allowed');
  END IF;

  _price := GREATEST(0, COALESCE(_plan.price_monthly, 0));

  IF _price <= 0 THEN
    UPDATE public.profiles
    SET plan_id = _plan.id,
        subscription_starts_at = now(),
        subscription_ends_at = NULL,
        is_active = true,
        updated_at = now()
    WHERE user_id = _uid;

    RETURN json_build_object(
      'success', true,
      'plan_slug', _plan.slug,
      'plan_name', _plan.name,
      'amount', 0,
      'balance', COALESCE((SELECT balance FROM public.wallets WHERE user_id = _uid), 0),
      'renewal', false
    );
  END IF;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (_uid, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id, balance INTO _wallet_id, _balance
  FROM public.wallets
  WHERE user_id = _uid
  FOR UPDATE;

  IF _balance < _price THEN
    RETURN json_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'required', _price,
      'balance', _balance
    );
  END IF;

  UPDATE public.wallets
  SET balance = balance - _price,
      updated_at = now()
  WHERE id = _wallet_id
  RETURNING balance INTO _balance;

  SELECT GREATEST(
    now(),
    COALESCE(
      (SELECT subscription_ends_at FROM public.profiles WHERE user_id = _uid),
      now()
    )
  ) + interval '1 month'
  INTO _ends;

  UPDATE public.profiles
  SET plan_id = _plan.id,
      subscription_starts_at = COALESCE(subscription_starts_at, now()),
      subscription_ends_at = _ends,
      is_active = true,
      updated_at = now()
  WHERE user_id = _uid;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, amount, type, reference_id, notes)
  VALUES (
    _wallet_id,
    _uid,
    -_price,
    'plan_subscription',
    _plan.id,
    CASE
      WHEN _renewal THEN 'تجديد اشتراك: ' || _plan.name
      ELSE 'اشتراك خطة: ' || _plan.name
    END
  );

  RETURN json_build_object(
    'success', true,
    'plan_slug', _plan.slug,
    'plan_name', _plan.name,
    'amount', _price,
    'balance', _balance,
    'renewal', _renewal,
    'subscription_ends_at', _ends
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.subscribe_to_plan(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscribe_to_plan(text) TO authenticated, service_role;
