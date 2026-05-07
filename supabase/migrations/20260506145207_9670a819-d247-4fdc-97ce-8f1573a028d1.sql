
DROP POLICY IF EXISTS "Owner write city_corrections" ON public.city_corrections;
CREATE POLICY "Owner insert city_corrections" ON public.city_corrections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner update city_corrections" ON public.city_corrections FOR UPDATE TO authenticated
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner delete city_corrections" ON public.city_corrections FOR DELETE TO authenticated
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));
