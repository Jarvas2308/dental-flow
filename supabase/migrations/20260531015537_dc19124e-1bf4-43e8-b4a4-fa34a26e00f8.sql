-- Parcelamento de atendimentos: contas a receber
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS parcelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parcelas_total integer NOT NULL DEFAULT 1;

CREATE TABLE public.parcelas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  total integer NOT NULL,
  valor_bruto numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  data_pagamento date,
  paciente text,
  procedimento text,
  forma_pagamento text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcelas TO authenticated;
GRANT ALL ON public.parcelas TO service_role;

ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select" ON public.parcelas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.parcelas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.parcelas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.parcelas FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_parcelas_atendimento ON public.parcelas(atendimento_id);
CREATE INDEX idx_parcelas_user ON public.parcelas(user_id);