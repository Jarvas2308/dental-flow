import { useState } from "react";
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

  /**
   * @param mes chave do mês selecionado na tela no formato "YYYY-MM".
   */
  const gerar = async (mes: string) => {
    if (loading) return;
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
      toast.success(`${criadas} criada(s), ${existentes} já existente(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar despesas recorrentes");
    } finally {
      setLoading(false);
    }
  };

  return { gerar, loading };
}
