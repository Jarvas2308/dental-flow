ALTER TABLE public.recebimentos
  ADD CONSTRAINT recebimentos_atendimento_id_fkey
  FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;