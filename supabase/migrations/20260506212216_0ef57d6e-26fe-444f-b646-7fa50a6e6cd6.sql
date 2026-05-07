ALTER TABLE public.city_corrections ADD COLUMN IF NOT EXISTS input_text text;
CREATE INDEX IF NOT EXISTS city_corrections_owner_input_idx ON public.city_corrections(owner_id, input_text);