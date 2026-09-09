-- Índices para os padrões de leitura que o app realmente faz.
--
-- Toda consulta carrega o predicado de RLS `user_id = auth.uid()` e quase
-- sempre soma um recorte por data ou uma ordenação. Sem um índice composto o
-- Postgres varre a tabela inteira do usuário e ordena em memória a cada tela.
-- Com o volume atual isso não aparece; ele cresce junto com o histórico, que
-- num sistema financeiro nunca é apagado.
--
-- `IF NOT EXISTS` porque algumas tabelas já têm índice só por `user_id`; o
-- composto o substitui na prática (o Postgres usa o prefixo do índice), mas
-- remover os antigos fica para uma limpeza separada, com dados de uso.

CREATE INDEX IF NOT EXISTS idx_atendimentos_user_data
  ON public.atendimentos (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_recebimentos_user_data
  ON public.recebimentos (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_parcelas_user_venc
  ON public.parcelas (user_id, vencimento);

-- Despesas pagas entram no mês pela data de pagamento, não pelo vencimento
-- (ver lib/finance.ts). O índice por vencimento já existe; falta este.
CREATE INDEX IF NOT EXISTS idx_despesas_user_pagamento
  ON public.despesas (user_id, data_pagamento);

CREATE INDEX IF NOT EXISTS idx_receitas_extras_user_data
  ON public.receitas_extras (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_custos_laboratorio_user_data
  ON public.custos_laboratorio (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_pacientes_user_nome
  ON public.pacientes (user_id, nome);

CREATE INDEX IF NOT EXISTS idx_consultas_previstas_user_data
  ON public.consultas_previstas (user_id, data_prevista);

CREATE INDEX IF NOT EXISTS idx_tratamentos_propostos_user_status
  ON public.tratamentos_propostos (user_id, status);
