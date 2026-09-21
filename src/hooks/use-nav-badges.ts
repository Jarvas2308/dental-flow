import { useMemo } from "react";
import { useTable } from "@/hooks/use-data";
import type { Database } from "@/integrations/supabase/types";
import { todayISO } from "@/lib/format";
import { contarFollowupPendente } from "@/lib/followup";

type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

// Contagens exibidas como badge no item de nav correspondente. Mesmas fontes
// de dados do dashboard (react-query dedupa por chave, sem requisição extra).
export function useNavBadges() {
  const consultas = useTable<Tables<"consultas_previstas">>(
    "consultas_previstas",
    "data_prevista",
    true,
  );
  const tratamentosPropostos = useTable<Tables<"tratamentos_propostos">>(
    "tratamentos_propostos",
    "data_proposta",
    true,
  );
  const tentativasContato = useTable<Tables<"tentativas_contato">>(
    "tentativas_contato",
    "data",
    true,
  );

  const consultasHoje = useMemo(() => {
    const hoje = todayISO();
    return (consultas.data ?? []).filter((c) => !c.realizada && c.data_prevista === hoje).length;
  }, [consultas.data]);

  const followupPendentes = useMemo(
    () => contarFollowupPendente(tratamentosPropostos.data ?? [], tentativasContato.data ?? []),
    [tratamentosPropostos.data, tentativasContato.data],
  );

  return { consultasHoje, followupPendentes };
}
