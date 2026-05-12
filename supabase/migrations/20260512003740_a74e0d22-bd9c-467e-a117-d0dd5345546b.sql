-- Unified expenses table replacing gastos_fixos and gastos_variaveis
CREATE TABLE public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  recorrente BOOLEAN NOT NULL DEFAULT false,
  origem_id UUID,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select" ON public.despesas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.despesas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.despesas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.despesas FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_despesas_user_venc ON public.despesas(user_id, vencimento);

-- Migrate existing data
INSERT INTO public.despesas (user_id, nome, valor, vencimento, status, recorrente, observacoes, created_at)
SELECT user_id, nome, valor, data, 'pago', true, observacoes, created_at FROM public.gastos_fixos;

INSERT INTO public.despesas (user_id, nome, valor, vencimento, status, recorrente, observacoes, created_at)
SELECT user_id, nome, valor, data, 'pago', false, observacoes, created_at FROM public.gastos_variaveis;
