-- Recria as RPCs como SECURITY INVOKER para eliminar o aviso do linter.
-- As operações já são 100% escopadas por auth.uid() = user_id e todas as
-- tabelas possuem RLS com políticas por usuário, portanto INVOKER preserva
-- exatamente o mesmo comportamento (RLS aplicada como o próprio usuário).

CREATE OR REPLACE FUNCTION public.gerar_despesas_recorrentes(p_competencia date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ano int;
  v_mes int;
  v_last_day int;
  v_criadas int := 0;
  v_existentes int := 0;
  v_base record;
  v_dia int;
  v_venc date;
  v_inserted uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF p_competencia IS NULL THEN
    RAISE EXCEPTION 'Competência é obrigatória';
  END IF;

  v_ano := extract(year from p_competencia)::int;
  v_mes := extract(month from p_competencia)::int;
  v_last_day := extract(day from (date_trunc('month', p_competencia) + interval '1 month - 1 day'))::int;

  FOR v_base IN
    SELECT id, nome, valor, vencimento, status, recorrente, observacoes, tipo_recorrencia
    FROM public.despesas
    WHERE user_id = v_uid
      AND recorrente = true
      AND origem_id IS NULL
  LOOP
    v_dia := LEAST(extract(day from v_base.vencimento)::int, v_last_day);
    v_venc := make_date(v_ano, v_mes, v_dia);

    INSERT INTO public.despesas (
      user_id, nome, valor, vencimento, data_pagamento, status,
      recorrente, origem_id, observacoes, tipo_recorrencia
    ) VALUES (
      v_uid,
      v_base.nome,
      CASE WHEN v_base.tipo_recorrencia = 'variavel' THEN NULL ELSE v_base.valor END,
      v_venc,
      NULL,
      'pendente',
      true,
      v_base.id,
      v_base.observacoes,
      COALESCE(v_base.tipo_recorrencia, 'fixo')
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_inserted;

    IF v_inserted IS NOT NULL THEN
      v_criadas := v_criadas + 1;
    ELSE
      v_existentes := v_existentes + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'criadas', v_criadas,
    'existentes', v_existentes
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_atendimento_completo(p_atendimento_id uuid DEFAULT NULL::uuid, p_paciente_id uuid DEFAULT NULL::uuid, p_paciente text DEFAULT NULL::text, p_procedimento text DEFAULT NULL::text, p_valor_bruto numeric DEFAULT NULL::numeric, p_forma_pagamento text DEFAULT NULL::text, p_taxa numeric DEFAULT 0, p_valor_liquido numeric DEFAULT NULL::numeric, p_nota_fiscal_status text DEFAULT 'pendente'::text, p_data date DEFAULT NULL::date, p_status_pagamento text DEFAULT 'pago'::text, p_parcelado boolean DEFAULT false, p_parcelas_total integer DEFAULT 1, p_procedimentos jsonb DEFAULT '[]'::jsonb, p_recebimentos jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_atendimento_id uuid;
  v_created boolean := false;
  v_proc_count integer := 0;
  v_receb_count integer := 0;
  v_item jsonb;
  v_soma_receb numeric := 0;
  v_valor numeric;
  v_receb_taxa numeric;
  v_receb_liq numeric;
  v_liq_esperado numeric;
  v_nf_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_paciente IS NULL OR length(btrim(p_paciente)) = 0 THEN
    RAISE EXCEPTION 'Paciente é obrigatório';
  END IF;
  IF p_valor_bruto IS NULL OR p_valor_bruto < 0 THEN
    RAISE EXCEPTION 'Valor bruto inválido';
  END IF;
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Data do atendimento é obrigatória';
  END IF;

  v_nf_status := COALESCE(p_nota_fiscal_status, 'pendente');
  IF v_nf_status NOT IN ('pendente', 'emitida', 'nao_emitida', 'nao_se_aplica') THEN
    RAISE EXCEPTION 'Status de nota fiscal inválido: %', v_nf_status;
  END IF;

  IF p_paciente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id = p_paciente_id AND user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'Paciente não encontrado ou não pertence ao usuário';
    END IF;
  END IF;

  IF p_atendimento_id IS NULL THEN
    INSERT INTO public.atendimentos (
      user_id, paciente, paciente_id, procedimento, valor_bruto,
      forma_pagamento, taxa, valor_liquido, nota_fiscal_status, data,
      status_pagamento, parcelado, parcelas_total
    ) VALUES (
      v_uid, p_paciente, p_paciente_id, p_procedimento, p_valor_bruto,
      p_forma_pagamento, COALESCE(p_taxa, 0), p_valor_liquido, v_nf_status, p_data,
      COALESCE(p_status_pagamento, 'pago'), COALESCE(p_parcelado, false), COALESCE(p_parcelas_total, 1)
    )
    RETURNING id INTO v_atendimento_id;
    v_created := true;
  ELSE
    UPDATE public.atendimentos SET
      paciente = p_paciente,
      paciente_id = p_paciente_id,
      procedimento = p_procedimento,
      valor_bruto = p_valor_bruto,
      forma_pagamento = p_forma_pagamento,
      taxa = COALESCE(p_taxa, 0),
      valor_liquido = p_valor_liquido,
      nota_fiscal_status = v_nf_status,
      data = p_data,
      status_pagamento = COALESCE(p_status_pagamento, 'pago'),
      parcelado = COALESCE(p_parcelado, false),
      parcelas_total = COALESCE(p_parcelas_total, 1)
    WHERE id = p_atendimento_id AND user_id = v_uid
    RETURNING id INTO v_atendimento_id;

    IF v_atendimento_id IS NULL THEN
      RAISE EXCEPTION 'Atendimento não encontrado ou não pertence ao usuário';
    END IF;
    v_created := false;
  END IF;

  DELETE FROM public.atendimento_procedimentos
  WHERE atendimento_id = v_atendimento_id AND user_id = v_uid;

  IF p_procedimentos IS NOT NULL AND jsonb_typeof(p_procedimentos) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_procedimentos)
    LOOP
      IF v_item->>'procedimento' IS NULL OR length(btrim(v_item->>'procedimento')) = 0 THEN
        RAISE EXCEPTION 'Procedimento com nome inválido';
      END IF;
      v_valor := COALESCE((v_item->>'valor')::numeric, 0);
      IF v_valor < 0 THEN
        RAISE EXCEPTION 'Valor de procedimento inválido';
      END IF;
      INSERT INTO public.atendimento_procedimentos (
        user_id, atendimento_id, procedimento, valor
      ) VALUES (
        v_uid, v_atendimento_id, btrim(v_item->>'procedimento'), v_valor
      );
      v_proc_count := v_proc_count + 1;
    END LOOP;
  END IF;

  IF p_recebimentos IS NOT NULL AND jsonb_typeof(p_recebimentos) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_recebimentos)
    LOOP
      v_valor := (v_item->>'valor')::numeric;
      v_receb_taxa := COALESCE((v_item->>'taxa')::numeric, 0);
      v_receb_liq := (v_item->>'valor_liquido')::numeric;

      IF v_valor IS NULL OR v_valor <= 0 THEN
        RAISE EXCEPTION 'Valor de recebimento deve ser maior que zero';
      END IF;
      IF v_receb_liq IS NULL OR v_receb_liq <= 0 THEN
        RAISE EXCEPTION 'Valor líquido de recebimento deve ser maior que zero';
      END IF;

      v_liq_esperado := round(v_valor * (1 - v_receb_taxa / 100.0), 2);
      IF abs(v_receb_liq - v_liq_esperado) > 0.01 THEN
        RAISE EXCEPTION 'Valor líquido incoerente com valor e taxa do recebimento';
      END IF;

      INSERT INTO public.recebimentos (
        user_id, atendimento_id, valor, data, forma_pagamento,
        observacao, taxa, valor_liquido
      ) VALUES (
        v_uid,
        v_atendimento_id,
        v_valor,
        COALESCE((v_item->>'data')::date, p_data),
        v_item->>'forma_pagamento',
        v_item->>'observacao',
        v_receb_taxa,
        v_receb_liq
      );
      v_soma_receb := v_soma_receb + v_valor;
      v_receb_count := v_receb_count + 1;
    END LOOP;

    IF v_soma_receb - p_valor_bruto > 0.005 THEN
      RAISE EXCEPTION 'Soma dos recebimentos (%) excede o valor do atendimento (%)', v_soma_receb, p_valor_bruto;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'atendimento_id', v_atendimento_id,
    'created', v_created,
    'procedimentos', v_proc_count,
    'recebimentos', v_receb_count
  );
END;
$function$;

-- Permissões: revoga acesso público/anon e concede execução apenas a authenticated.
REVOKE ALL ON FUNCTION public.gerar_despesas_recorrentes(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_atendimento_completo(uuid, uuid, text, text, numeric, text, numeric, numeric, text, date, text, boolean, integer, jsonb, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gerar_despesas_recorrentes(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_atendimento_completo(uuid, uuid, text, text, numeric, text, numeric, numeric, text, date, text, boolean, integer, jsonb, jsonb) TO authenticated;