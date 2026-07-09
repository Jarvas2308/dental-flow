import { normalizePacienteNome } from "@/lib/pacientes";
import { resumoAtendimento, type AtendimentoRow, type RecebimentoRow, type ParcelaRow } from "@/lib/finance";
import { todayISO } from "@/lib/format";

// Registro genérico que pode ser vinculado a um paciente por id (prioritário)
// ou pelo nome normalizado (fallback para dados antigos sem paciente_id).
type Vinculavel = { paciente_id?: string | null; paciente?: string | null };

// Decide se um registro pertence ao paciente. Prioriza paciente_id; usa o nome
// normalizado apenas quando o registro não possui paciente_id (dado legado).
export function pertenceAoPaciente(
  registro: Vinculavel,
  paciente: { id: string; nome?: string | null },
): boolean {
  if (registro.paciente_id) return registro.paciente_id === paciente.id;
  const nomeReg = normalizePacienteNome(registro.paciente ?? "").toLowerCase();
  const nomePac = normalizePacienteNome(paciente.nome ?? "").toLowerCase();
  return !!nomeReg && nomeReg === nomePac;
}

export type AtendimentoFull = AtendimentoRow & Vinculavel & { nota_fiscal_status?: string | null };
export type ConsultaFull = Vinculavel & {
  id: string;
  data_prevista: string;
  realizada?: boolean | null;
  valor_estimado?: number | null;
  observacao?: string | null;
};
export type PropostaFull = Vinculavel & {
  id: string;
  data_proposta: string;
  tratamento?: string | null;
  status?: string | null;
  valor_estimado?: number | null;
};
export type TentativaFull = {
  id: string;
  data: string;
  observacao?: string | null;
  tratamento_proposto_id: string;
};

export type ResumoPaciente = {
  totalAtendimentos: number;
  totalRecebido: number;
  totalEmAberto: number;
  consultasFuturas: number;
  followupsEmAberto: number;
};

export type EventoTipo = "atendimento" | "recebimento" | "consulta" | "proposta" | "tentativa";

export type EventoPaciente = {
  id: string;
  tipo: EventoTipo;
  data: string;
  titulo: string;
  detalhe?: string;
  valor?: number;
};

const isPropostaAberta = (status?: string | null) => status === "acompanhando";

// Consolida atendimentos, recebimentos, consultas, propostas e tentativas de um
// paciente. Reutiliza os cálculos financeiros existentes (resumoAtendimento)
// sem alterá-los.
export function dadosDoPaciente(
  paciente: { id: string; nome?: string | null },
  data: {
    atendimentos?: AtendimentoFull[];
    recebimentos?: RecebimentoRow[];
    parcelas?: ParcelaRow[];
    consultas?: ConsultaFull[];
    propostas?: PropostaFull[];
    tentativas?: TentativaFull[];
  },
): { resumo: ResumoPaciente; historico: EventoPaciente[] } {
  const atendimentos = (data.atendimentos ?? []).filter((a) => pertenceAoPaciente(a, paciente));
  const consultas = (data.consultas ?? []).filter((c) => pertenceAoPaciente(c, paciente));
  const propostas = (data.propostas ?? []).filter((p) => pertenceAoPaciente(p, paciente));

  const atendIds = new Set(atendimentos.map((a) => a.id));
  const recebimentos = (data.recebimentos ?? []).filter((r) => atendIds.has(r.atendimento_id));
  const parcelas = (data.parcelas ?? []).filter((p) => atendIds.has(p.atendimento_id));

  const propostaIds = new Set(propostas.map((p) => p.id));
  const tentativas = (data.tentativas ?? []).filter((t) => propostaIds.has(t.tratamento_proposto_id));

  // Resumo financeiro por atendimento reaproveita a regra existente.
  let totalRecebido = 0;
  let totalEmAberto = 0;
  for (const a of atendimentos) {
    const r = resumoAtendimento(a, recebimentos, parcelas);
    totalRecebido += r.recebido;
    totalEmAberto += r.saldo;
  }

  const hoje = todayISO();
  const consultasFuturas = consultas.filter((c) => !c.realizada && c.data_prevista >= hoje).length;
  const followupsEmAberto = propostas.filter((p) => isPropostaAberta(p.status)).length;

  const resumo: ResumoPaciente = {
    totalAtendimentos: atendimentos.length,
    totalRecebido: Number(totalRecebido.toFixed(2)),
    totalEmAberto: Number(totalEmAberto.toFixed(2)),
    consultasFuturas,
    followupsEmAberto,
  };

  const historico: EventoPaciente[] = [];

  for (const a of atendimentos) {
    historico.push({
      id: `atend-${a.id}`,
      tipo: "atendimento",
      data: a.data,
      titulo: a.procedimento || "Atendimento",
      detalhe: a.forma_pagamento || undefined,
      valor: Number(a.valor_bruto || 0),
    });
  }

  for (const r of recebimentos) {
    historico.push({
      id: `receb-${r.id ?? `${r.atendimento_id}-${r.data}`}`,
      tipo: "recebimento",
      data: r.data,
      titulo: "Recebimento",
      detalhe: r.forma_pagamento || undefined,
      valor: Number(r.valor || 0),
    });
  }

  for (const c of consultas) {
    historico.push({
      id: `consulta-${c.id}`,
      tipo: "consulta",
      data: c.data_prevista,
      titulo: c.realizada ? "Consulta realizada" : "Consulta prevista",
      detalhe: c.observacao || undefined,
      valor: c.valor_estimado != null ? Number(c.valor_estimado) : undefined,
    });
  }

  for (const p of propostas) {
    historico.push({
      id: `proposta-${p.id}`,
      tipo: "proposta",
      data: p.data_proposta,
      titulo: p.tratamento || "Tratamento proposto",
      detalhe: isPropostaAberta(p.status) ? "Em acompanhamento" : (p.status ?? undefined),
      valor: p.valor_estimado != null ? Number(p.valor_estimado) : undefined,
    });
  }

  const propostaTratamento = new Map(propostas.map((p) => [p.id, p.tratamento || "Tratamento"]));
  for (const t of tentativas) {
    historico.push({
      id: `tentativa-${t.id}`,
      tipo: "tentativa",
      data: t.data,
      titulo: "Tentativa de contato",
      detalhe: t.observacao || propostaTratamento.get(t.tratamento_proposto_id) || undefined,
    });
  }

  // Ordena do mais recente para o mais antigo.
  historico.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));

  return { resumo, historico };
}
