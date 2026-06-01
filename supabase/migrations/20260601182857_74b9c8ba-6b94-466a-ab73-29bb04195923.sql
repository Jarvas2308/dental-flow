CREATE TABLE public.recebimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  atendimento_id uuid NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL,
  forma_pagamento text,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos TO authenticated;
GRANT ALL ON public.recebimentos TO service_role;

ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select" ON public.recebimentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.recebimentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.recebimentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.recebimentos FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_recebimentos_atendimento ON public.recebimentos (atendimento_id);
CREATE INDEX idx_recebimentos_user ON public.recebimentos (user_id);