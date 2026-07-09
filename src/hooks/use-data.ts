import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { toast } from "sonner";

type TableName =
  | "procedimentos"
  | "formas_pagamento"
  | "laboratorios"
  | "tipos_trabalho"
  | "gastos_fixos"
  | "gastos_variaveis"
  | "despesas"
  | "atendimentos"
  | "custos_laboratorio"
  | "receitas_extras"
  | "parcelas"
  | "recebimentos"
  | "pacientes"
  | "atendimento_procedimentos"
  | "consultas_previstas"
  | "tratamentos_propostos"
  | "tentativas_contato";

export function useTable<T = unknown>(table: TableName, orderBy = "created_at", asc = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [table, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderBy, { ascending: asc });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

// Busca enxuta para a tela de consultório: carrega apenas os atendimentos
// relevantes ao mês selecionado + todas as pendências antigas (saldo em aberto),
// evitando trazer todo o histórico quitado. Também traz somente os recebimentos
// desses atendimentos.
//
// Regra de "pendência antiga": um atendimento só possui saldo em aberto quando
// foi salvo com status_pagamento = 'pendente' (o formulário força isso sempre
// que há parcelas/divisão) ou quando é parcelado (mecanismo legado de parcelas).
// Atendimentos à vista quitados nunca entram nessas condições, então ficam de fora.
export function useConsultorioData(mes: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["consultorio", user?.id, mes],
    enabled: !!user,
    queryFn: async () => {
      const [yy, mm] = mes.split("-").map(Number);
      const start = `${yy}-${String(mm).padStart(2, "0")}-01`;
      const lastDay = new Date(yy, mm, 0).getDate();
      const end = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data: atendimentos, error: aErr } = await supabase
        .from("atendimentos")
        .select("*")
        .or(`and(data.gte.${start},data.lte.${end}),status_pagamento.eq.pendente,parcelado.eq.true`)
        .order("data", { ascending: false });
      if (aErr) throw aErr;

      const ids = (atendimentos ?? []).map((a) => a.id);

      let recebimentos: any[] = [];
      let parcelas: any[] = [];
      if (ids.length) {
        const [{ data: recs, error: rErr }, { data: parc, error: pErr }] = await Promise.all([
          supabase.from("recebimentos").select("*").in("atendimento_id", ids),
          supabase.from("parcelas").select("*").in("atendimento_id", ids),
        ]);
        if (rErr) throw rErr;
        if (pErr) throw pErr;
        recebimentos = recs ?? [];
        parcelas = parc ?? [];
      }

      return {
        atendimentos: (atendimentos ?? []) as any[],
        recebimentos,
        parcelas,
      };
    },
  });
}

export function useCreate(table: TableName) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = { ...values, user_id: user!.id };
      const { data, error } = await (supabase.from(table) as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["consultorio"] });
      toast.success("Salvo com sucesso");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });
}

export function useUpdate(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await (supabase.from(table) as any).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["consultorio"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });
}

export function useDelete(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["consultorio"] });
      toast.success("Excluído");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });
}
