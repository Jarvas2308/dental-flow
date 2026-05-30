ALTER TABLE public.atendimentos
ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'pago';

-- Garantir que registros existentes sejam tratados como pagos
UPDATE public.atendimentos SET status_pagamento = 'pago' WHERE status_pagamento IS NULL;