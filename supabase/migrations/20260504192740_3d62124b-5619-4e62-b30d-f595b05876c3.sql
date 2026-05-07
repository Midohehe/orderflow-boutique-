
-- Restrict purchases SELECT to authenticated only
DROP POLICY IF EXISTS "Allow public read purchases" ON public.purchases;

-- Restrict analytics_events SELECT to authenticated only
DROP POLICY IF EXISTS "Allow public read analytics" ON public.analytics_events;
CREATE POLICY "Authenticated users can read analytics"
ON public.analytics_events
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Remove public INSERT on orders; orders will be inserted via edge function using service role
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
