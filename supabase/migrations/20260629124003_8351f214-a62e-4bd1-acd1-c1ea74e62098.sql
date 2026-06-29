CREATE OR REPLACE FUNCTION public.salvar_atendimento_completo(
  p_atendimento_id uuid DEFAULT NULL,
  p_paciente_id uuid DEFAULT NULL,
  p_paciente text DEFAULT NULL,
  p_procedimento text DEFAULT NULL,
  p_valor_bruto numeric DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_taxa numeric DEFAULT 0,
  p_valor_liquido numeric DEFAULT NULL,
  p_nota_fiscal boolean DEFAULT false,
  p_data date DEFAULT NULL,
  p_status_pagamento text DEFAULT 'pago',
  p_parcelado boolean DEFAULT false,
  p_parcelas_total integer DEFAULT 1,
  p_procedimentos jsonb DEFAULT '[]'::jsonb,
  p_recebimentos jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  -- 1) Autenticação obrigatória.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 2) Campos principais obrigatórios.
  IF p_paciente IS NULL OR length(btrim(p_paciente)) = 0 THEN
    RAISE EXCEPTION 'Paciente é obrigatório';
  END IF;
  IF p_valor_bruto IS NULL OR p_valor_bruto < 0 THEN
    RAISE EXCEPTION 'Valor bruto inválido';
  END IF;
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Data do atendimento é obrigatória';
  END IF;

  -- 3) Paciente informado deve pertencer ao usuário autenticado.
  IF p_paciente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id = p_paciente_id AND user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'Paciente não encontrado ou não pertence ao usuário';
    END IF;
  END IF;

  -- 4) Criação ou atualização do atendimento.
  IF p_atendimento_id IS NULL THEN
    INSERT INTO public.atendimentos (
      user_id, paciente, paciente_id, procedimento, valor_bruto,
      forma_pagamento, taxa, valor_liquido, nota_fiscal, data,
      status_pagamento, parcelado, parcelas_total
    ) VALUES (
      v_uid, p_paciente, p_paciente_id, p_procedimento, p_valor_bruto,
      p_forma_pagamento, COALESCE(p_taxa, 0), p_valor_liquido, COALESCE(p_nota_fiscal, false), p_data,
      COALESCE(p_status_pagamento, 'pago'), COALESCE(p_parcelado, false), COALESCE(p_parcelas_total, 1)
    )
    RETURNING id INTO v_atendimento_id;
    v_created := true;
  ELSE
    -- Atualiza somente se pertencer ao usuário autenticado.
    UPDATE public.atendimentos SET
      paciente = p_paciente,
      paciente_id = p_paciente_id,
      procedimento = p_procedimento,
      valor_bruto = p_valor_bruto,
      forma_pagamento = p_forma_pagamento,
      taxa = COALESCE(p_taxa, 0),
      valor_liquido = p_valor_liquido,
      nota_fiscal = COALESCE(p_nota_fiscal, false),
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

  -- 5) Procedimentos: substitui integralmente.
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

  -- 6) Recebimentos iniciais (novos enviados pelo formulário).
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

      -- valor_liquido coerente com valor e taxa (tolerância R$ 0,01).
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

    -- Soma dos recebimentos iniciais não pode ultrapassar o total (tolerância R$ 0,005).
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
$$;

REVOKE ALL ON FUNCTION public.salvar_atendimento_completo(
  uuid, uuid, text, text, numeric, text, numeric, numeric, boolean, date, text, boolean, integer, jsonb, jsonb
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.salvar_atendimento_completo(
  uuid, uuid, text, text, numeric, text, numeric, numeric, boolean, date, text, boolean, integer, jsonb, jsonb
) TO authenticated, service_role;