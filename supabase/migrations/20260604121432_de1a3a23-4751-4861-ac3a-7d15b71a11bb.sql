-- Pacientes
CREATE TABLE public.pacientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacientes TO authenticated;
GRANT ALL ON public.pacientes TO service_role;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pacientes" ON public.pacientes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Itens de procedimento por atendimento
CREATE TABLE public.atendimento_procedimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  atendimento_id UUID NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  procedimento TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimento_procedimentos TO authenticated;
GRANT ALL ON public.atendimento_procedimentos TO service_role;
ALTER TABLE public.atendimento_procedimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own atendimento_procedimentos" ON public.atendimento_procedimentos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_atend_proc_atendimento ON public.atendimento_procedimentos(atendimento_id);

-- Consultas previstas
CREATE TABLE public.consultas_previstas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  paciente TEXT NOT NULL,
  data_prevista DATE NOT NULL,
  valor_estimado NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  realizada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultas_previstas TO authenticated;
GRANT ALL ON public.consultas_previstas TO service_role;
ALTER TABLE public.consultas_previstas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own consultas_previstas" ON public.consultas_previstas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);