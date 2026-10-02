CREATE TABLE public.tutorial_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 150),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  video_url text CHECK (video_url ~ '^https://'),
  storage_path text,
  CHECK ((video_url IS NOT NULL AND storage_path IS NULL) OR (video_url IS NULL AND storage_path IS NOT NULL)),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tutorial_videos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tutorial_videos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tutorial_videos TO authenticated;
CREATE POLICY tutorial_read ON public.tutorial_videos FOR SELECT TO authenticated USING (true);
CREATE POLICY tutorial_admin ON public.tutorial_videos FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tutorial-videos', 'tutorial-videos', false, 104857600, ARRAY['video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY tutorial_files_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tutorial-videos');
CREATE POLICY tutorial_files_admin ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'tutorial-videos' AND public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (bucket_id = 'tutorial-videos' AND public.has_role((SELECT auth.uid()), 'admin'));
NOTIFY pgrst, 'reload schema';
