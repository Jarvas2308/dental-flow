DO $$
DECLARE
  v_tables text[] := ARRAY['atendimentos', 'consultas_previstas', 'tratamentos_propostos'];
  v_table text;
  v_linked int;
  v_pending int;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format($f$
      WITH norm AS (
        SELECT id AS rec_id, user_id,
               lower(regexp_replace(btrim(paciente), '\s+', ' ', 'g')) AS nkey
        FROM public.%1$I
        WHERE paciente_id IS NULL
          AND paciente IS NOT NULL
          AND btrim(paciente) <> ''
      ),
      pac AS (
        SELECT user_id,
               lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')) AS nkey,
               id AS pid
        FROM public.pacientes
        WHERE nome IS NOT NULL AND btrim(nome) <> ''
      ),
      matched AS (
        SELECT n.rec_id, (array_agg(DISTINCT p.pid))[1] AS pid
        FROM norm n
        JOIN pac p ON p.user_id = n.user_id AND p.nkey = n.nkey
        GROUP BY n.rec_id
        HAVING count(DISTINCT p.pid) = 1
      )
      UPDATE public.%1$I t
      SET paciente_id = m.pid
      FROM matched m
      WHERE t.id = m.rec_id
    $f$, v_table);
    GET DIAGNOSTICS v_linked = ROW_COUNT;

    EXECUTE format($f$
      SELECT count(*) FROM public.%1$I
      WHERE paciente_id IS NULL
        AND paciente IS NOT NULL
        AND btrim(paciente) <> ''
    $f$, v_table) INTO v_pending;

    RAISE NOTICE 'Tabela %: % registro(s) vinculado(s), % pendente(s) por ambiguidade ou ausencia de paciente.',
      v_table, v_linked, v_pending;
  END LOOP;
END $$;