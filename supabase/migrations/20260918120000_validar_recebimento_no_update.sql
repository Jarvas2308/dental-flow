-- A validação de recebimento só existia para INSERT, então um UPDATE de
-- `recebimentos.valor` podia deixar a soma dos recebimentos acima do
-- `valor_bruto` do atendimento. O caminho existe: `useUpdate`
-- (src/hooks/use-data.ts) é genérico sobre TableName e aceita `recebimentos`,
-- e uma correção manual via SQL também passa por aqui.
--
-- A função ganha também lock explícito no atendimento. Sem ele, dois inserts
-- concorrentes para o mesmo atendimento leem a mesma soma, ambos passam na
-- checagem e o total final estoura o valor combinado.

CREATE OR REPLACE FUNCTION public.validar_recebimento_nao_excede()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_valor_bruto numeric;
  v_soma numeric;
  -- Id da linha a ignorar na soma. No UPDATE a própria linha já está na
  -- tabela: somá-la junto de NEW contaria o valor duas vezes e rejeitaria
  -- alterações legítimas. Fica numa variável porque referenciar OLD durante um
  -- INSERT levanta "record old is not assigned yet".
  v_ignorar uuid := NULL;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_ignorar := OLD.id;
  END IF;

  -- FOR UPDATE serializa as validações concorrentes do mesmo atendimento.
  SELECT valor_bruto INTO v_valor_bruto
  FROM public.atendimentos
  WHERE id = NEW.atendimento_id
  FOR UPDATE;

  IF v_valor_bruto IS NULL THEN
    RAISE EXCEPTION 'Atendimento % não encontrado para o recebimento', NEW.atendimento_id;
  END IF;

  SELECT COALESCE(sum(valor), 0) INTO v_soma
  FROM public.recebimentos
  WHERE atendimento_id = NEW.atendimento_id
    AND (v_ignorar IS NULL OR id <> v_ignorar);

  IF (v_soma + COALESCE(NEW.valor, 0)) - v_valor_bruto > 0.005 THEN
    RAISE EXCEPTION 'Recebimento excede o valor do atendimento: já recebido %, novo %, total do atendimento %',
      v_soma, NEW.valor, v_valor_bruto;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_recebimento_nao_excede ON public.recebimentos;
CREATE TRIGGER trg_validar_recebimento_nao_excede
BEFORE INSERT OR UPDATE OF valor, atendimento_id ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.validar_recebimento_nao_excede();
