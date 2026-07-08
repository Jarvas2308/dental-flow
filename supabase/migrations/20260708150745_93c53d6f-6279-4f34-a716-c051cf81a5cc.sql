REVOKE EXECUTE ON FUNCTION public.gerar_despesas_recorrentes(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_despesas_recorrentes(date) TO authenticated;