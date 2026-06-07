-- Remove SaaS plan limits; billing stays per-order via wallet (order_fee).

DROP TRIGGER IF EXISTS trg_enforce_plan_orders ON public.orders;
DROP TRIGGER IF EXISTS trg_enforce_plan_stores ON public.stores;
DROP TRIGGER IF EXISTS trg_enforce_plan_products ON public.products;
DROP TRIGGER IF EXISTS trg_enforce_plan_staff ON public.store_members;

DROP FUNCTION IF EXISTS public.subscribe_to_plan(text);
DROP FUNCTION IF EXISTS public.admin_assign_plan(uuid, text);

-- Keep tables/columns for history; enforcement triggers are gone.
