DROP POLICY IF EXISTS "Authenticated users can update app_settings" ON public.app_settings;

CREATE POLICY "Authenticated users can update app settings row"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (id = 1)
WITH CHECK (id = 1);