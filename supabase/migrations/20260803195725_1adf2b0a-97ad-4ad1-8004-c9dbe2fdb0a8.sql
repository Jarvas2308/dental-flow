CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  logo_url text,
  logo_size integer NOT NULL DEFAULT 32,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app_settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update app_settings"
  ON public.app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (id) VALUES (1);

CREATE POLICY "Public can read logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated can upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Authenticated can update logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos') WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Authenticated can delete logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos');