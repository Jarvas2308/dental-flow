-- Impede que uma mesma recorrência gere mais de uma despesa para a mesma
-- competência mensal. A cadeia de recorrência é identificada por
-- COALESCE(origem_id, id): a despesa base (origem_id nulo) usa o próprio id,
-- e as cópias geradas apontam para ela via origem_id. A competência é o mês
-- do vencimento. Índice parcial: só se aplica a despesas recorrentes.
CREATE UNIQUE INDEX IF NOT EXISTS despesas_recorrencia_competencia_uidx
ON public.despesas (
  user_id,
  COALESCE(origem_id, id),
  date_trunc('month', vencimento::timestamp)
)
WHERE recorrente = true;