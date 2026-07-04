-- Lock down the SECURITY DEFINER RPC so it is NOT executable by anonymous users.
-- The function performs its own auth.uid() and ownership checks and must remain
-- callable by signed-in (authenticated) users from the app.
REVOKE ALL ON FUNCTION public.salvar_atendimento_completo(
  uuid, uuid, text, text, numeric, text, numeric, numeric, text, date, text, boolean, integer, jsonb, jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.salvar_atendimento_completo(
  uuid, uuid, text, text, numeric, text, numeric, numeric, text, date, text, boolean, integer, jsonb, jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.salvar_atendimento_completo(
  uuid, uuid, text, text, numeric, text, numeric, numeric, text, date, text, boolean, integer, jsonb, jsonb
) TO authenticated;

GRANT ALL ON FUNCTION public.salvar_atendimento_completo(
  uuid, uuid, text, text, numeric, text, numeric, numeric, text, date, text, boolean, integer, jsonb, jsonb
) TO service_role;