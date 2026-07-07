ALTER TABLE public.consultas_previstas
  ADD COLUMN IF NOT EXISTS paciente_id uuid;

ALTER TABLE public.consultas_previstas
  ADD CONSTRAINT consultas_previstas_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS consultas_previstas_paciente_id_idx
  ON public.consultas_previstas (paciente_id);