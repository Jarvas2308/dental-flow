
-- Receitas extras
CREATE TABLE public.receitas_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data date NOT NULL,
  tipo text NOT NULL DEFAULT 'outros',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receitas_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.receitas_extras FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.receitas_extras FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.receitas_extras FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.receitas_extras FOR DELETE USING (auth.uid() = user_id);

-- Tipo de recorrência em despesas (fixo / variavel)
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS tipo_recorrencia text NOT NULL DEFAULT 'fixo';

-- Permitir valor nulo (para variável aguardando preenchimento)
ALTER TABLE public.despesas ALTER COLUMN valor DROP NOT NULL;
