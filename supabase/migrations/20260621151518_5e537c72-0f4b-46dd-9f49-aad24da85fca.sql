CREATE TABLE public.tratamentos_propostos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  paciente text NOT NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  tratamento text NOT NULL,
  valor_estimado numeric,
  data_proposta date NOT NULL,
  fase1_intervalo_dias integer NOT NULL DEFAULT 3,
  fase1_qtd integer NOT NULL DEFAULT 3,
  fase2_intervalo_dias integer NOT NULL DEFAULT 7,
  fase2_qtd integer NOT NULL DEFAULT 4,
  fase3_intervalo_dias integer NOT NULL DEFAULT 30,
  tentativas_feitas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'acompanhando',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tratamentos_propostos TO authenticated;
GRANT ALL ON public.tratamentos_propostos TO service_role;

ALTER TABLE public.tratamentos_propostos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tratamentos_propostos"
  ON public.tratamentos_propostos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tratamentos_propostos"
  ON public.tratamentos_propostos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tratamentos_propostos"
  ON public.tratamentos_propostos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tratamentos_propostos"
  ON public.tratamentos_propostos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.tentativas_contato (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tratamento_proposto_id uuid NOT NULL REFERENCES public.tratamentos_propostos(id) ON DELETE CASCADE,
  data date NOT NULL,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tentativas_contato TO authenticated;
GRANT ALL ON public.tentativas_contato TO service_role;

ALTER TABLE public.tentativas_contato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tentativas_contato"
  ON public.tentativas_contato FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tentativas_contato"
  ON public.tentativas_contato FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tentativas_contato"
  ON public.tentativas_contato FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tentativas_contato"
  ON public.tentativas_contato FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_tratamentos_propostos_status ON public.tratamentos_propostos (status);
CREATE INDEX idx_tentativas_contato_tratamento_proposto_id ON public.tentativas_contato (tratamento_proposto_id);