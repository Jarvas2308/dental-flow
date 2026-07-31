import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth-context";
import { toast } from "sonner";
import type { AtendimentoRow, RecebimentoRow, ParcelaRow } from "@/lib/finance";
import { pertenceAoPaciente } from "@/lib/paciente-detalhe";

// Traduz o erro do Postgres para uma frase acionável. Sem isso o usuário
// recebia o texto cru do banco ("duplicate key value violates unique
// constraint ..."), que não diz o que fazer a respeito.
function mensagemDeErro(e: unknown, acaoPadrao: string): string {
  const bruto = e instanceof Error ? e.message : "";
  if (/duplicate key|already exists/i.test(bruto)) return "Já existe um registro com esses dados.";
  if (/violates foreign key/i.test(bruto)) {
    return "Este registro está vinculado a outros e não pode ser removido.";
  }
  if (/violates row-level security|permission denied/i.test(bruto)) {
    return "Você não tem permissão para esta ação.";
  }
  if (/network|fetch failed|Failed to fetch/i.test(bruto)) {
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  }
  return acaoPadrao;
}

type TableName =
  | "procedimentos"
  | "formas_pagamento"
  | "laboratorios"
  | "tipos_trabalho"
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
  | "tentativas_contato"
  | "dtm_acompanhamentos"
  | "dtm_consultas";

export function useTable<T = unknown>(table: TableName, orderBy = "created_at", asc = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [table, user?.id, orderBy, asc],
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

      let recebimentos: RecebimentoRow[] = [];
      let parcelas: ParcelaRow[] = [];
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
        atendimentos: (atendimentos ?? []) as AtendimentoRow[],
        recebimentos,
        parcelas,
      };
    },
  });
}

// Dados de um único paciente, para a tela de detalhe.
//
// Cuidado central: `pertenceAoPaciente` (lib/paciente-detalhe.ts) casa por
// `paciente_id` quando existe e cai no NOME normalizado para registros
// legados que não têm id. Um filtro server-side só por `paciente_id`
// perderia silenciosamente esses registros antigos — e num app financeiro
// "menos atendimentos do que a realidade" é a pior falha possível.
//
// Filtrar por nome no SQL também não serve: `normalizePacienteNome` colapsa
// espaços internos e o `ilike` do Postgres não faz isso, então "Ana  Maria"
// (com dois espaços) escaparia. Além disso o nome seria interpolado na
// gramática do `.or()`, onde vírgulas e parênteses (ex.: "Silva, Jr.")
// quebram o filtro.
//
// Por isso a busca traz um SUPERSET deliberado — os registros do paciente
// MAIS todos os registros sem `paciente_id` — e a decisão final continua
// sendo de `pertenceAoPaciente`, no cliente. O filtro SQL nunca é mais
// estreito que a regra real, então é correto por construção.
export function usePacienteDetalhe(pacienteId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["paciente-detalhe", user?.id, pacienteId],
    enabled: !!user && !!pacienteId,
    queryFn: async () => {
      const { data: paciente, error: pErr } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", pacienteId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!paciente) return null;

      const escopo = `paciente_id.eq.${pacienteId},paciente_id.is.null`;

      const [atd, cns, prp, dta] = await Promise.all([
        supabase.from("atendimentos").select("*").or(escopo).order("data", { ascending: false }),
        supabase.from("consultas_previstas").select("*").or(escopo),
        supabase.from("tratamentos_propostos").select("*").or(escopo),
        supabase.from("dtm_acompanhamentos").select("*").or(escopo),
      ]);
      for (const r of [atd, cns, prp, dta]) if (r.error) throw r.error;

      // Aplica a regra canônica já aqui: sem isso os `.in()` abaixo puxariam
      // os filhos de todo registro legado do banco, não só os deste paciente.
      const alvo = { id: paciente.id, nome: paciente.nome };
      const atendimentos = (atd.data ?? []).filter((r) => pertenceAoPaciente(r, alvo));
      const consultas = (cns.data ?? []).filter((r) => pertenceAoPaciente(r, alvo));
      const propostas = (prp.data ?? []).filter((r) => pertenceAoPaciente(r, alvo));
      const dtmAcomp = (dta.data ?? []).filter((r) => pertenceAoPaciente(r, alvo));

      const atendIds = atendimentos.map((a) => a.id);
      const propIds = propostas.map((p) => p.id);
      const acompIds = dtmAcomp.map((a) => a.id);
      const vazio = { data: [], error: null };

      const [rec, par, ten, dtc] = await Promise.all([
        atendIds.length
          ? supabase.from("recebimentos").select("*").in("atendimento_id", atendIds)
          : vazio,
        atendIds.length
          ? supabase.from("parcelas").select("*").in("atendimento_id", atendIds)
          : vazio,
        propIds.length
          ? supabase.from("tentativas_contato").select("*").in("tratamento_proposto_id", propIds)
          : vazio,
        acompIds.length
          ? supabase.from("dtm_consultas").select("*").in("acompanhamento_id", acompIds)
          : vazio,
      ]);
      for (const r of [rec, par, ten, dtc]) if (r.error) throw r.error;

      return {
        paciente,
        atendimentos,
        recebimentos: (rec.data ?? []) as RecebimentoRow[],
        parcelas: (par.data ?? []) as ParcelaRow[],
        consultas,
        propostas,
        tentativas: ten.data ?? [],
        dtmAcomp,
        dtmConsultas: dtc.data ?? [],
      };
    },
  });
}

// `mensagemSucesso: false` silencia o toast genérico para quem já exibe um
// aviso próprio, mais específico — evita dois toasts para uma única ação.
export function useCreate(table: TableName, opts?: { mensagemSucesso?: string | false }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mensagemSucesso = opts?.mensagemSucesso ?? "Salvo com sucesso";
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = { ...values, user_id: user!.id };
      const { data, error } = await supabase
        .from(table)
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["consultorio"] });
      qc.invalidateQueries({ queryKey: ["paciente-detalhe"] });
      if (mensagemSucesso !== false) toast.success(mensagemSucesso);
    },
    onError: (e: unknown) => toast.error(mensagemDeErro(e, "Não foi possível salvar.")),
  });
}

export function useUpdate(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await supabase
        .from(table)
        .update(values as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["consultorio"] });
      qc.invalidateQueries({ queryKey: ["paciente-detalhe"] });
      // Criar avisava e editar era silencioso: o diálogo simplesmente fechava
      // e não havia como saber se a alteração tinha sido gravada.
      toast.success("Alterações salvas");
    },
    onError: (e: unknown) =>
      toast.error(mensagemDeErro(e, "Não foi possível salvar as alterações.")),
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
      qc.invalidateQueries({ queryKey: ["paciente-detalhe"] });
      toast.success("Excluído");
    },
    onError: (e: unknown) => toast.error(mensagemDeErro(e, "Não foi possível excluir.")),
  });
}
