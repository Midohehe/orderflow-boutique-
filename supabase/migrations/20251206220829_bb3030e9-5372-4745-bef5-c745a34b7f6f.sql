-- Drop existing restrictive policies on analytics_events
DROP POLICY IF EXISTS "Allow public insert analytics" ON public.analytics_events;
DROP POLICY IF EXISTS "Allow public read analytics" ON public.analytics_events;

-- Create new permissive policies for analytics_events
CREATE POLICY "Allow public insert analytics"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public read analytics"
ON public.analytics_events
FOR SELECT
TO anon, authenticated
USING (true);