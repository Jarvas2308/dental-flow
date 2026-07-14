
-- Função de updated_at (idempotente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============== dtm_acompanhamentos ==============
CREATE TABLE public.dtm_acompanhamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  paciente text NOT NULL,
  total_consultas integer NOT NULL CHECK (total_consultas > 0),
  status text NOT NULL DEFAULT 'em_acompanhamento'
    CHECK (status IN ('em_acompanhamento', 'concluido')),
  data_inicio date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dtm_acompanhamentos TO authenticated;
GRANT ALL ON public.dtm_acompanhamentos TO service_role;

ALTER TABLE public.dtm_acompanhamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dtm_acomp_select_own" ON public.dtm_acompanhamentos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dtm_acomp_insert_own" ON public.dtm_acompanhamentos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_acomp_update_own" ON public.dtm_acompanhamentos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_acomp_delete_own" ON public.dtm_acompanhamentos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_dtm_acompanhamentos_updated_at
  BEFORE UPDATE ON public.dtm_acompanhamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dtm_acomp_user ON public.dtm_acompanhamentos(user_id);
CREATE INDEX idx_dtm_acomp_paciente ON public.dtm_acompanhamentos(paciente_id);

-- ============== dtm_consultas ==============
CREATE TABLE public.dtm_consultas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acompanhamento_id uuid NOT NULL REFERENCES public.dtm_acompanhamentos(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero > 0),
  data_realizada date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (acompanhamento_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dtm_consultas TO authenticated;
GRANT ALL ON public.dtm_consultas TO service_role;

ALTER TABLE public.dtm_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dtm_cons_select_own" ON public.dtm_consultas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dtm_cons_insert_own" ON public.dtm_consultas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_cons_update_own" ON public.dtm_consultas
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_cons_delete_own" ON public.dtm_consultas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_dtm_cons_user ON public.dtm_consultas(user_id);
CREATE INDEX idx_dtm_cons_acomp ON public.dtm_consultas(acompanhamento_id);
