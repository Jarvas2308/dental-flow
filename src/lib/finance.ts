// Helpers de regra financeira para parcelamento / contas a receber.
//
// Princípio: somente valores efetivamente RECEBIDOS entram no caixa.
// - Atendimento NÃO parcelado: conta quando status_pagamento != 'pendente'.
// - Atendimento parcelado: cada PARCELA paga conta individualmente, na data
//   do pagamento (regime de caixa).

export type Entrada = {
  data: string; // data de recebimento (caixa)
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
  parcela: boolean; // true = veio da tabela parcelas
};

const liq = (r: any) => Number(r?.valor_liquido || 0);
const bru = (r: any) => Number(r?.valor_bruto || 0);

// Entradas recebidas (regime de caixa) provenientes de atendimentos + parcelas.
export function receitasRecebidas(atend: any[] = [], parcelas: any[] = []): Entrada[] {
  const out: Entrada[] = [];
  for (const a of atend) {
    if (a.parcelado) continue; // tratado via parcelas
    if (a.status_pagamento === "pendente") continue;
    out.push({
      data: a.data,
      valor_liquido: liq(a),
      valor_bruto: bru(a),
      forma_pagamento: a.forma_pagamento ?? "",
      paciente: a.paciente ?? "",
      procedimento: a.procedimento ?? "",
    });
  }
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
export function valoresEmAberto(atend: any[] = [], parcelas: any[] = []): AbertoItem[] {
  const out: AbertoItem[] = [];
  for (const a of atend) {
    if (a.parcelado) continue;
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
  }
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

// Agrupa contas a receber por atendimento, com progresso de parcelas.
export type ContaReceber = {
  atendimento_id: string;
  paciente: string;
  procedimento: string;
  forma_pagamento: string;
  total: number;
  pagas: number;
  restantes: number;
  valorRestante: number;
  valorTotal: number;
  proximoVencimento: string | null;
  parcelas: any[]; // todas as parcelas (pagas e pendentes) do atendimento
};

export function contasAReceber(atend: any[] = [], parcelas: any[] = []): ContaReceber[] {
  const byAtend = new Map<string, any[]>();
  for (const p of parcelas) {
    const arr = byAtend.get(p.atendimento_id) ?? [];
    arr.push(p);
    byAtend.set(p.atendimento_id, arr);
  }
  const atendMap = new Map(atend.map((a) => [a.id, a]));
  const out: ContaReceber[] = [];

  for (const [atId, ps] of byAtend) {
    const a = atendMap.get(atId);
    const sorted = [...ps].sort((x, y) => x.numero - y.numero);
    const pagas = sorted.filter((p) => p.status === "pago");
    const pend = sorted.filter((p) => p.status !== "pago");
    if (pend.length === 0) continue; // quitado, sai das contas a receber
    out.push({
      atendimento_id: atId,
      paciente: a?.paciente ?? sorted[0]?.paciente ?? "",
      procedimento: a?.procedimento ?? sorted[0]?.procedimento ?? "",
      forma_pagamento: a?.forma_pagamento ?? sorted[0]?.forma_pagamento ?? "",
      total: sorted.length,
      pagas: pagas.length,
      restantes: pend.length,
      valorRestante: pend.reduce((s, p) => s + liq(p), 0),
      valorTotal: sorted.reduce((s, p) => s + liq(p), 0),
      proximoVencimento: pend[0]?.vencimento ?? null,
      parcelas: sorted,
    });
  }

  // Atendimentos não parcelados pendentes também entram como conta a receber.
  for (const a of atend) {
    if (a.parcelado) continue;
    if (a.status_pagamento !== "pendente") continue;
    out.push({
      atendimento_id: a.id,
      paciente: a.paciente ?? "",
      procedimento: a.procedimento ?? "",
      forma_pagamento: a.forma_pagamento ?? "",
      total: 1,
      pagas: 0,
      restantes: 1,
      valorRestante: liq(a),
      valorTotal: liq(a),
      proximoVencimento: a.data,
      parcelas: [],
    });
  }

  return out.sort((x, y) =>
    (x.proximoVencimento ?? "").localeCompare(y.proximoVencimento ?? ""),
  );
}
