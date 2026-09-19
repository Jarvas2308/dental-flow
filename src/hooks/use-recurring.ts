import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Gera as despesas recorrentes de uma competência (mês) chamando a RPC
 * idempotente `gerar_despesas_recorrentes` no banco. A RPC processa apenas as
 * recorrências-base do usuário autenticado e evita duplicações via índice único.
 */
export function useGerarRecorrentes() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  // Trava síncrona. `loading` é estado e só reflete no render seguinte, então
  // duas chamadas disparadas no mesmo tick (a checagem automática do layout e a
  // da tela) passavam as duas pela checagem. A RPC é idempotente e não
  // duplicaria linhas, mas eram dois round-trips e duas invalidações por
  // abertura de tela.
  const emCurso = useRef(false);

  /**
   * @param mes chave do mês no formato "YYYY-MM".
   * @param notify se falso, não exibe toasts (usado na checagem automática ao abrir o app).
   */
  const gerar = useCallback(
    async (mes: string, notify = true) => {
      if (emCurso.current) return;
      emCurso.current = true;
      setLoading(true);
      try {
        const competencia = `${mes}-01`;
        const { data, error } = await supabase.rpc("gerar_despesas_recorrentes", {
          p_competencia: competencia,
        });
        if (error) throw error;

        const res = (data ?? {}) as { criadas?: number; existentes?: number };
        const criadas = res.criadas ?? 0;
        const existentes = res.existentes ?? 0;

        await qc.invalidateQueries({ queryKey: ["despesas"] });
        if (notify) toast.success(`${criadas} criada(s), ${existentes} já existente(s)`);
      } catch (e: unknown) {
        if (notify) {
          toast.error(e instanceof Error ? e.message : "Erro ao gerar despesas recorrentes");
        } else {
          console.error(e);
        }
      } finally {
        emCurso.current = false;
        setLoading(false);
      }
    },
    [qc],
  );

  return { gerar, loading };
}
