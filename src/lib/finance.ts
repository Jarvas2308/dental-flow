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

const liq = (r: any) => Number(r?.valor_liquido || 0);
const bru = (r: any) => Number(r?.valor_bruto || 0);

// Fator de conversão bruto -> líquido de um atendimento (considera a taxa).
export const fatorLiquido = (a: any) => {
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

  if (!a?.parcelado) {
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

  const recs = recebimentos.filter((r) => r.atendimento_id === a.id);
  const legacy = parcelas.filter((p) => p.atendimento_id === a.id && p.status === "pago");
  const recebido =
    recs.reduce((s, r) => s + Number(r.valor || 0), 0) +
    legacy.reduce((s, p) => s + bru(p), 0);
  const saldo = Math.max(0, total - recebido);
  const qtd = recs.length + legacy.length;
  const status: StatusReceb = recebido <= 0.005 ? "aberto" : saldo <= 0.005 ? "quitado" : "parcial";

  return {
    total,
    recebido,
    saldo,
    recebidoLiquido: Number((recebido * f).toFixed(2)),
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
    if (!a.parcelado) {
      if (a.status_pagamento === "pendente") continue;
      out.push({
        data: a.data,
        valor_liquido: liq(a),
        valor_bruto: bru(a),
        forma_pagamento: a.forma_pagamento ?? "",
        paciente: a.paciente ?? "",
        procedimento: a.procedimento ?? "",
      });
      continue;
    }
    if (legacyIds.has(a.id)) continue; // tratado via parcelas legadas
    const f = fatorLiquido(a);
    for (const r of recebimentos.filter((x) => x.atendimento_id === a.id)) {
      const vb = Number(r.valor || 0);
      out.push({
        data: r.data,
        valor_bruto: vb,
        valor_liquido: Number((vb * f).toFixed(2)),
        forma_pagamento: r.forma_pagamento || a.forma_pagamento || "",
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
    if (!a.parcelado) {
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
    if (legacyIds.has(a.id)) continue;
    const f = fatorLiquido(a);
    const recebido = recebimentos
      .filter((r) => r.atendimento_id === a.id)
      .reduce((s, r) => s + Number(r.valor || 0), 0);
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
    if (!a.parcelado && a.status_pagamento !== "pendente") continue;

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
