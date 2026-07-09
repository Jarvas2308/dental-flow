// Helpers de regra financeira para recebimentos / contas a receber.
//
// Princípio (regime de caixa): somente valores efetivamente RECEBIDOS entram
// no fluxo de caixa, dashboard, faturamento e lucro.
//
// Modelo flexível:
// - Atendimento À VISTA: conta quando status_pagamento != 'pendente'.
// - Atendimento PARCELADO: NÃO gera parcelas fixas. O valor combinado fica
//   como "contas a receber" e cada RECEBIMENTO real (de valor livre) é
//   contabilizado individualmente, na data em que foi recebido.
// - Compatibilidade: atendimentos antigos que possuírem registros na tabela
//   `parcelas` continuam sendo tratados pelas parcelas pagas.

import { monthKey } from "./format";

// Tipos-linha flexíveis para registros vindos do banco. Campos são opcionais
// porque cada fluxo (à vista, parcelado, legado) preenche um subconjunto deles.
type MonetaryRow = {
  valor_liquido?: number | string | null;
  valor_bruto?: number | string | null;
};

export type AtendimentoRow = MonetaryRow & {
  id: string;
  data: string;
  taxa?: number | string | null;
  parcelado?: boolean | null;
  status_pagamento?: string | null;
  forma_pagamento?: string | null;
  paciente?: string | null;
  procedimento?: string | null;
  parcelas_total?: number | string | null;
};

export type RecebimentoRow = {
  id?: string;
  atendimento_id: string;
  valor?: number | string | null;
  valor_liquido?: number | string | null;
  data: string;
  forma_pagamento?: string | null;
};

export type ParcelaRow = MonetaryRow & {
  id: string;
  atendimento_id: string;
  numero: number;
  total: number;
  status?: string | null;
  vencimento: string;
  data_pagamento?: string | null;
  forma_pagamento?: string | null;
  paciente?: string | null;
  procedimento?: string | null;
};

export type DespesaRow = {
  status?: string | null;
  valor?: number | string | null;
  vencimento?: string | null;
  data_pagamento?: string | null;
  data?: string | null;
};

export type Entrada = {
  data: string;
  valor_liquido: number;
  valor_bruto: number;
  forma_pagamento: string;
  paciente: string;
  procedimento: string;
};

export type AbertoItem = {
  id: string;
  atendimento_id: string;
  numero: number;
  total: number;
  vencimento: string;
  valor_liquido: number;
  valor_bruto: number;
  paciente: string;
  procedimento: string;
  forma_pagamento: string;
  parcela: boolean;
};

const liq = (r: MonetaryRow | null | undefined) => Number(r?.valor_liquido || 0);
const bru = (r: MonetaryRow | null | undefined) => Number(r?.valor_bruto || 0);

// Fator de conversão bruto -> líquido de um atendimento (considera a taxa).
export const fatorLiquido = (a: AtendimentoRow) => {
  const b = bru(a);
  if (b > 0) return liq(a) / b;
  return Math.max(0, 1 - Number(a?.taxa || 0) / 100);
};

export type StatusReceb = "aberto" | "parcial" | "quitado";

export type ResumoAtend = {
  total: number; // valor total combinado (bruto)
  recebido: number; // recebido acumulado (bruto)
  saldo: number; // saldo pendente (bruto)
  recebidoLiquido: number;
  saldoLiquido: number;
  qtd: number; // quantidade de recebimentos registrados
  parcelasCombinadas: number;
  status: StatusReceb;
};

// Resumo financeiro de um atendimento (à vista ou parcelado).
export function resumoAtendimento(
  a: any,
  recebimentos: any[] = [],
  parcelas: any[] = [],
): ResumoAtend {
  const total = bru(a);
  const f = fatorLiquido(a);

  const recs = recebimentos.filter((r) => r.atendimento_id === a.id);
  const legacy = parcelas.filter((p) => p.atendimento_id === a.id && p.status === "pago");

  // Atendimento sem recebimentos registrados nem parcelas legadas:
  // usa o status de pagamento (regime à vista).
  if (!a?.parcelado && recs.length === 0 && legacy.length === 0) {
    const pago = a?.status_pagamento !== "pendente";
    return {
      total,
      recebido: pago ? total : 0,
      saldo: pago ? 0 : total,
      recebidoLiquido: pago ? liq(a) : 0,
      saldoLiquido: pago ? 0 : liq(a),
      qtd: pago ? 1 : 0,
      parcelasCombinadas: 1,
      status: pago ? "quitado" : "aberto",
    };
  }

  const recebido =
    recs.reduce((s, r) => s + Number(r.valor || 0), 0) + legacy.reduce((s, p) => s + bru(p), 0);
  const saldo = Math.max(0, total - recebido);
  const qtd = recs.length + legacy.length;
  const status: StatusReceb = recebido <= 0.005 ? "aberto" : saldo <= 0.005 ? "quitado" : "parcial";

  const recebidoLiquido =
    recs.reduce(
      (s, r) => s + (r.valor_liquido != null ? Number(r.valor_liquido) : Number(r.valor || 0) * f),
      0,
    ) + legacy.reduce((s, p) => s + liq(p), 0);

  return {
    total,
    recebido,
    saldo,
    recebidoLiquido: Number(recebidoLiquido.toFixed(2)),
    saldoLiquido: Number((saldo * f).toFixed(2)),
    qtd,
    parcelasCombinadas: Number(a.parcelas_total || 1),
    status,
  };
}

// Entradas efetivamente recebidas (regime de caixa).
export function receitasRecebidas(
  atend: any[] = [],
  recebimentos: any[] = [],
  parcelas: any[] = [],
): Entrada[] {
  const out: Entrada[] = [];
  const legacyIds = new Set(parcelas.map((p) => p.atendimento_id));

  for (const a of atend) {
    if (legacyIds.has(a.id)) continue; // tratado via parcelas legadas
    const recs = recebimentos.filter((x) => x.atendimento_id === a.id);

    // Se há recebimentos registrados, cada um conta na SUA data (regime de caixa).
    if (recs.length > 0) {
      const f = fatorLiquido(a);
      for (const r of recs) {
        const vb = Number(r.valor || 0);
        out.push({
          data: r.data,
          valor_bruto: vb,
          valor_liquido:
            r.valor_liquido != null ? Number(r.valor_liquido) : Number((vb * f).toFixed(2)),
          forma_pagamento: r.forma_pagamento || a.forma_pagamento || "",
          paciente: a.paciente ?? "",
          procedimento: a.procedimento ?? "",
        });
      }
      continue;
    }

    // Sem recebimentos: atendimento à vista pago conta na data do atendimento.
    if (!a.parcelado && a.status_pagamento !== "pendente") {
      out.push({
        data: a.data,
        valor_liquido: liq(a),
        valor_bruto: bru(a),
        forma_pagamento: a.forma_pagamento ?? "",
        paciente: a.paciente ?? "",
        procedimento: a.procedimento ?? "",
      });
    }
  }

  // Parcelas legadas pagas.
  for (const p of parcelas) {
    if (p.status !== "pago") continue;
    out.push({
      data: p.data_pagamento || p.vencimento,
      valor_liquido: liq(p),
      valor_bruto: bru(p),
      forma_pagamento: p.forma_pagamento ?? "",
      paciente: p.paciente ?? "",
      procedimento: p.procedimento ?? "",
    });
  }

  return out;
}

// Valores em aberto (contas a receber). Persistem até serem quitados.
export function valoresEmAberto(
  atend: any[] = [],
  recebimentos: any[] = [],
  parcelas: any[] = [],
): AbertoItem[] {
  const out: AbertoItem[] = [];
  const legacyIds = new Set(parcelas.map((p) => p.atendimento_id));

  for (const a of atend) {
    if (legacyIds.has(a.id)) continue;
    const recs = recebimentos.filter((r) => r.atendimento_id === a.id);

    // Atendimento à vista, sem recebimentos: aberto apenas se pendente.
    if (!a.parcelado && recs.length === 0) {
      if (a.status_pagamento !== "pendente") continue;
      out.push({
        id: a.id,
        atendimento_id: a.id,
        numero: 1,
        total: 1,
        vencimento: a.data,
        valor_liquido: liq(a),
        valor_bruto: bru(a),
        paciente: a.paciente ?? "",
        procedimento: a.procedimento ?? "",
        forma_pagamento: a.forma_pagamento ?? "",
        parcela: false,
      });
      continue;
    }

    // Atendimentos com recebimentos (parcelados ou à vista): saldo pendente.
    const f = fatorLiquido(a);
    const recebido = recs.reduce((s, r) => s + Number(r.valor || 0), 0);
    const saldoBruto = Math.max(0, bru(a) - recebido);
    if (saldoBruto <= 0.005) continue;
    out.push({
      id: a.id,
      atendimento_id: a.id,
      numero: 1,
      total: Number(a.parcelas_total || 1),
      vencimento: a.data,
      valor_liquido: Number((saldoBruto * f).toFixed(2)),
      valor_bruto: saldoBruto,
      paciente: a.paciente ?? "",
      procedimento: a.procedimento ?? "",
      forma_pagamento: a.forma_pagamento ?? "",
      parcela: true,
    });
  }

  // Parcelas legadas em aberto.
  for (const p of parcelas) {
    if (p.status === "pago") continue;
    out.push({
      id: p.id,
      atendimento_id: p.atendimento_id,
      numero: p.numero,
      total: p.total,
      vencimento: p.vencimento,
      valor_liquido: liq(p),
      valor_bruto: bru(p),
      paciente: p.paciente ?? "",
      procedimento: p.procedimento ?? "",
      forma_pagamento: p.forma_pagamento ?? "",
      parcela: true,
    });
  }

  return out;
}

// Contas a receber agrupadas por atendimento, com progresso de recebimentos.
export type ContaReceber = {
  atendimento_id: string;
  paciente: string;
  procedimento: string;
  forma_pagamento: string;
  total: number;
  recebido: number;
  saldo: number;
  qtd: number; // recebimentos registrados
  parcelasCombinadas: number;
  status: StatusReceb;
  data: string;
  recebimentos: any[];
};

export function contasAReceber(
  atend: any[] = [],
  recebimentos: any[] = [],
  parcelas: any[] = [],
): ContaReceber[] {
  const legacyIds = new Set(parcelas.map((p) => p.atendimento_id));
  const out: ContaReceber[] = [];

  for (const a of atend) {
    if (legacyIds.has(a.id)) continue; // legado tratado abaixo
    const temRecs = recebimentos.some((x) => x.atendimento_id === a.id);
    // À vista, quitado e sem recebimentos parciais: não é conta a receber.
    if (!a.parcelado && a.status_pagamento !== "pendente" && !temRecs) continue;

    const r = resumoAtendimento(a, recebimentos, parcelas);
    if (r.saldo <= 0.005) continue; // quitado

    const recs = recebimentos
      .filter((x) => x.atendimento_id === a.id)
      .sort((x, y) => (x.data ?? "").localeCompare(y.data ?? ""));

    out.push({
      atendimento_id: a.id,
      paciente: a.paciente ?? "",
      procedimento: a.procedimento ?? "",
      forma_pagamento: a.forma_pagamento ?? "",
      total: r.total,
      recebido: r.recebido,
      saldo: r.saldo,
      qtd: r.qtd,
      parcelasCombinadas: r.parcelasCombinadas,
      status: r.status,
      data: a.data,
      recebimentos: recs,
    });
  }

  // Atendimentos legados com parcelas em aberto.
  const byAtend = new Map<string, any[]>();
  for (const p of parcelas) {
    const arr = byAtend.get(p.atendimento_id) ?? [];
    arr.push(p);
    byAtend.set(p.atendimento_id, arr);
  }
  const atendMap = new Map(atend.map((a) => [a.id, a]));
  for (const [atId, ps] of byAtend) {
    const a = atendMap.get(atId);
    const sorted = [...ps].sort((x, y) => x.numero - y.numero);
    const pagas = sorted.filter((p) => p.status === "pago");
    const pend = sorted.filter((p) => p.status !== "pago");
    if (pend.length === 0) continue;
    const recebido = pagas.reduce((s, p) => s + bru(p), 0);
    const saldo = pend.reduce((s, p) => s + bru(p), 0);
    out.push({
      atendimento_id: atId,
      paciente: a?.paciente ?? sorted[0]?.paciente ?? "",
      procedimento: a?.procedimento ?? sorted[0]?.procedimento ?? "",
      forma_pagamento: a?.forma_pagamento ?? sorted[0]?.forma_pagamento ?? "",
      total: recebido + saldo,
      recebido,
      saldo,
      qtd: pagas.length,
      parcelasCombinadas: sorted.length,
      status: pagas.length === 0 ? "aberto" : "parcial",
      data: a?.data ?? sorted[0]?.vencimento ?? "",
      recebimentos: [],
    });
  }

  // Ordena por maior saldo pendente.
  return out.sort((x, y) => y.saldo - x.saldo);
}

export const STATUS_LABEL: Record<StatusReceb, string> = {
  aberto: "Em aberto",
  parcial: "Parcialmente recebido",
  quitado: "Quitado",
};

// ---------------------------------------------------------------------------
// Helpers financeiros compartilhados (Dashboard / Fluxo de Caixa / Consultório)
//
// Regras únicas para não divergir entre telas:
// - Recebimento entra pela DATA DO RECEBIMENTO.
// - Despesa PAGA entra pela DATA_PAGAMENTO.
// - Despesa PENDENTE entra pelo VENCIMENTO e NÃO reduz o caixa realizado.
// - Caixa realizado = recebimentos efetivos − despesas pagas.
// - Resultado previsto = caixa realizado − despesas pendentes.
// ---------------------------------------------------------------------------

// Verdadeiro quando a data (YYYY-MM-DD) pertence ao mês informado (YYYY-MM).
export const noMes = (dateStr: string | null | undefined, mes: string): boolean =>
  !!dateStr && monthKey(dateStr) === mes;

// Recebimentos efetivos posicionados pela data do recebimento, filtrados ao mês.
// Atendimentos antigos com saldo continuam existindo (aparecem no Consultório),
// mas seus recebimentos antigos só entram no mês em que ocorreram.
export function recebimentosNoMes(
  atend: any[] = [],
  recebimentos: any[] = [],
  parcelas: any[] = [],
  mes: string,
): Entrada[] {
  return receitasRecebidas(atend, recebimentos, parcelas).filter((e) => noMes(e.data, mes));
}

// Despesas pagas normalizadas: posicionadas pela data_pagamento (data da saída
// real). Cada item recebe `data = data_pagamento` para uso em fluxo de caixa.
export function despesasPagas(despesas: any[] = []): any[] {
  return (despesas ?? [])
    .filter((r: any) => r.status === "pago" && r.data_pagamento)
    .map((r: any) => ({ ...r, data: r.data_pagamento }));
}

// Despesas pagas do mês (pela data_pagamento).
export function despesasPagasNoMes(despesas: any[] = [], mes: string): any[] {
  return despesasPagas(despesas).filter((r: any) => noMes(r.data, mes));
}

export function totalDespesasPagasNoMes(despesas: any[] = [], mes: string): number {
  return despesasPagasNoMes(despesas, mes).reduce(
    (s: number, r: any) => s + Number(r.valor || 0),
    0,
  );
}

// Despesas pendentes: ainda não pagas. Posicionadas pelo vencimento.
export function despesasPendentes(despesas: any[] = []): any[] {
  return (despesas ?? []).filter((r: any) => r.status !== "pago");
}

// Despesas pendentes do mês (pelo vencimento).
export function despesasPendentesNoMes(despesas: any[] = [], mes: string): any[] {
  return despesasPendentes(despesas).filter((r: any) => noMes(r.vencimento, mes));
}

export function totalDespesasPendentesNoMes(despesas: any[] = [], mes: string): number {
  return despesasPendentesNoMes(despesas, mes).reduce(
    (s: number, r: any) => s + Number(r.valor || 0),
    0,
  );
}

// Caixa realizado = entradas efetivamente recebidas − saídas efetivamente pagas.
// (Despesas pendentes NÃO entram aqui.)
export function caixaRealizado(entradas: number, saidasPagas: number): number {
  return entradas - saidasPagas;
}

// Resultado previsto = caixa realizado − despesas ainda pendentes.
export function resultadoPrevisto(caixa: number, despesasPendentesTotal: number): number {
  return caixa - despesasPendentesTotal;
}
