
-- 1) AI training general settings (one row per owner)
CREATE TABLE public.ai_training_settings (
  owner_id uuid PRIMARY KEY,
  custom_instructions text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_training_settings TO authenticated;
GRANT ALL ON public.ai_training_settings TO service_role;

ALTER TABLE public.ai_training_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read ai_training_settings"
  ON public.ai_training_settings FOR SELECT TO authenticated
  USING (public.is_member_of(owner_id));
CREATE POLICY "owner can insert ai_training_settings"
  ON public.ai_training_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.is_member_of(owner_id));
CREATE POLICY "owner can update ai_training_settings"
  ON public.ai_training_settings FOR UPDATE TO authenticated
  USING (public.is_member_of(owner_id));
CREATE POLICY "owner can delete ai_training_settings"
  ON public.ai_training_settings FOR DELETE TO authenticated
  USING (public.is_member_of(owner_id));

CREATE TRIGGER trg_ai_training_settings_updated_at
  BEFORE UPDATE ON public.ai_training_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) AI training Q&A pairs
CREATE TABLE public.ai_training_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_training_qa_owner_idx ON public.ai_training_qa(owner_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_training_qa TO authenticated;
GRANT ALL ON public.ai_training_qa TO service_role;

ALTER TABLE public.ai_training_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read ai_training_qa"
  ON public.ai_training_qa FOR SELECT TO authenticated
  USING (public.is_member_of(owner_id));
CREATE POLICY "owner can insert ai_training_qa"
  ON public.ai_training_qa FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.is_member_of(owner_id));
CREATE POLICY "owner can update ai_training_qa"
  ON public.ai_training_qa FOR UPDATE TO authenticated
  USING (public.is_member_of(owner_id));
CREATE POLICY "owner can delete ai_training_qa"
  ON public.ai_training_qa FOR DELETE TO authenticated
  USING (public.is_member_of(owner_id));

CREATE TRIGGER trg_ai_training_qa_updated_at
  BEFORE UPDATE ON public.ai_training_qa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
