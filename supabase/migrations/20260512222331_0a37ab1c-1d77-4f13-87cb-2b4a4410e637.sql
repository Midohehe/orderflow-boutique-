-- carrier_status_mappings: public read, admin-only write
DROP POLICY IF EXISTS "Owner all carrier_status_mappings" ON public.carrier_status_mappings;
CREATE POLICY "Public read carrier_status_mappings" ON public.carrier_status_mappings
  FOR SELECT USING (true);
CREATE POLICY "Admin write carrier_status_mappings" ON public.carrier_status_mappings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- hidden_default_carrier_codes: public read, admin-only write
DROP POLICY IF EXISTS "Owner read hidden_default_carrier_codes" ON public.hidden_default_carrier_codes;
DROP POLICY IF EXISTS "Owner insert hidden_default_carrier_codes" ON public.hidden_default_carrier_codes;
DROP POLICY IF EXISTS "Owner delete hidden_default_carrier_codes" ON public.hidden_default_carrier_codes;
CREATE POLICY "Public read hidden_default_carrier_codes" ON public.hidden_default_carrier_codes
  FOR SELECT USING (true);
CREATE POLICY "Admin write hidden_default_carrier_codes" ON public.hidden_default_carrier_codes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- hidden_default_cities: public read, admin-only write
DROP POLICY IF EXISTS "Owner read hidden_default_cities" ON public.hidden_default_cities;
DROP POLICY IF EXISTS "Owner insert hidden_default_cities" ON public.hidden_default_cities;
DROP POLICY IF EXISTS "Owner delete hidden_default_cities" ON public.hidden_default_cities;
CREATE POLICY "Public read hidden_default_cities" ON public.hidden_default_cities
  FOR SELECT USING (true);
CREATE POLICY "Admin write hidden_default_cities" ON public.hidden_default_cities
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- city_corrections: public read stays; restrict writes to admin only
DROP POLICY IF EXISTS "Owner insert city_corrections" ON public.city_corrections;
DROP POLICY IF EXISTS "Owner update city_corrections" ON public.city_corrections;
DROP POLICY IF EXISTS "Owner delete city_corrections" ON public.city_corrections;
CREATE POLICY "Admin write city_corrections" ON public.city_corrections
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));