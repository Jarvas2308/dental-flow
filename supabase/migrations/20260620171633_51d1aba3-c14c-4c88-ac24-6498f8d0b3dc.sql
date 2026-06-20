BEGIN;

-- 1. Deduplicar pacientes por (user_id, nome case-insensitive + trim), mantendo o mais antigo
DELETE FROM public.pacientes p
USING public.pacientes p2
WHERE p.user_id = p2.user_id
  AND lower(trim(p.nome)) = lower(trim(p2.nome))
  AND (
    p.created_at > p2.created_at
    OR (p.created_at = p2.created_at AND p.id > p2.id)
  );

-- 2. Índice único case-insensitive / trim por user_id
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_user_nome_ci_uidx
  ON public.pacientes (user_id, lower(trim(nome)));

-- 3. Inserir pacientes ausentes a partir dos nomes presentes em atendimentos
INSERT INTO public.pacientes (user_id, nome)
SELECT DISTINCT a.user_id, trim(a.paciente)
FROM public.atendimentos a
WHERE a.paciente IS NOT NULL
  AND trim(a.paciente) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.user_id = a.user_id
      AND lower(trim(p.nome)) = lower(trim(a.paciente))
  );

-- 4. Adicionar coluna paciente_id (nullable) com FK
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS paciente_id uuid
  REFERENCES public.pacientes(id) ON DELETE SET NULL;

-- 5. Backfill do paciente_id por match case-insensitive / trim e mesmo user_id
UPDATE public.atendimentos a
SET paciente_id = p.id
FROM public.pacientes p
WHERE p.user_id = a.user_id
  AND lower(trim(p.nome)) = lower(trim(a.paciente))
  AND a.paciente IS NOT NULL
  AND trim(a.paciente) <> '';

-- 5b. Verificação: nenhum atendimento com nome preenchido deve ficar sem paciente_id
DO $$
DECLARE
  faltando integer;
BEGIN
  SELECT count(*) INTO faltando
  FROM public.atendimentos a
  WHERE a.paciente IS NOT NULL
    AND trim(a.paciente) <> ''
    AND a.paciente_id IS NULL;

  IF faltando > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % atendimentos sem paciente_id', faltando;
  END IF;
END $$;

-- 6. Índice normal para performance
CREATE INDEX IF NOT EXISTS atendimentos_paciente_id_idx
  ON public.atendimentos (paciente_id);

COMMIT;