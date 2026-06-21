ALTER TABLE public.recebimentos
  ADD COLUMN taxa numeric NOT NULL DEFAULT 0;

ALTER TABLE public.recebimentos
  ADD COLUMN valor_liquido numeric NOT NULL DEFAULT 0;

UPDATE public.recebimentos r
SET taxa = COALESCE(a.taxa, 0)
FROM public.atendimentos a
WHERE r.atendimento_id = a.id;

UPDATE public.recebimentos
SET valor_liquido = round(valor * (1 - taxa / 100), 2);

ALTER TABLE public.recebimentos ALTER COLUMN taxa DROP DEFAULT;
ALTER TABLE public.recebimentos ALTER COLUMN valor_liquido DROP DEFAULT;