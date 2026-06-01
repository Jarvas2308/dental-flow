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
  | "recebimentos";

export function useTable<T = any>(table: TableName, orderBy = "created_at", asc = false) {
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

export function useCreate(table: TableName) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const payload = { ...values, user_id: user!.id };
      const { error } = await (supabase.from(table) as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Salvo com sucesso");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });
}

export function useUpdate(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
      const { error } = await (supabase.from(table) as any).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
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
      toast.success("Excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
}
