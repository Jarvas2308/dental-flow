CREATE OR REPLACE FUNCTION public.gerar_despesas_recorrentes(p_competencia date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Somente recorrências-base: recorrente = true e sem origem_id (não é cópia)
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
$$;

GRANT EXECUTE ON FUNCTION public.gerar_despesas_recorrentes(date) TO authenticated;