// Matemática da Análise de Procedimentos.
//
// Duas regras vivem aqui, fora do componente, porque são as contas que
// respondem "qual procedimento dá lucro": o RATEIO do valor líquido e do custo
// de laboratório entre os itens de um mesmo atendimento, e a MARGEM resultante.
//
// O rateio é necessário porque atendimento é a unidade que tem valor líquido e
// custo de laboratório, enquanto a análise é por procedimento — e um
// atendimento pode ter vários. O peso de cada item é a fração que ele
// representa no bruto do atendimento.

import { monthKey } from "./format";

export type AtendimentoAnalise = {
  id: string;
  procedimento: string;
  valor_bruto: number | string;
  valor_liquido: number | string;
  data: string;
};

export type ItemProcedimento = {
  atendimento_id: string;
  procedimento?: string | null;
  valor: number | string | null;
};

export type CustoLab = {
  atendimento_id?: string | null;
  procedimento?: string | null;
  valor: number | string;
  data: string;
};

export type LinhaProcedimento = {
  procedimento: string;
  bruto: number;
  liquido: number;
  data: string;
  atendimentoId: string;
  // Peso do item dentro do atendimento (0..1). Vale 1 no atendimento legado,
  // que não tem itens e conta como um procedimento único.
  ratio: number;
};

export type ProcedimentoAgregado = {
  nome: string;
  qtd: number;
  bruto: number;
  liquido: number;
  lab: number;
  lucro: number;
  margem: number;
};

// Uma linha por procedimento realizado nos meses pedidos. Usa os itens
// detalhados quando existem e cai no campo de texto do atendimento para os
// registros antigos, que não têm itens.
export function linhasDeProcedimento(
  atendimentos: readonly AtendimentoAnalise[] = [],
  itens: readonly ItemProcedimento[] = [],
  meses: readonly string[] = [],
): LinhaProcedimento[] {
  const itensPorAtend = new Map<string, ItemProcedimento[]>();
  (itens ?? []).forEach((it) => {
    const arr = itensPorAtend.get(it.atendimento_id) ?? [];
    arr.push(it);
    itensPorAtend.set(it.atendimento_id, arr);
  });

  const out: LinhaProcedimento[] = [];
  (atendimentos ?? []).forEach((a) => {
    if (!meses.includes(monthKey(a.data))) return;
    const its = itensPorAtend.get(a.id);
    const liqTotal = Number(a.valor_liquido || 0);
    const bruTotal = Number(a.valor_bruto || 0);
    if (its && its.length > 0) {
      // O denominador cai no bruto do atendimento quando os itens somam zero, e
      // em 1 quando nem isso existe, só para não dividir por zero.
      const somaItens = its.reduce((s, it) => s + Number(it.valor || 0), 0) || bruTotal || 1;
      its.forEach((it) => {
        const bruto = Number(it.valor || 0);
        const ratio = somaItens > 0 ? bruto / somaItens : 0;
        out.push({
          procedimento: it.procedimento || "—",
          bruto,
          liquido: liqTotal * ratio,
          data: a.data,
          atendimentoId: a.id,
          ratio,
        });
      });
    } else {
      out.push({
        procedimento: a.procedimento || "—",
        bruto: bruTotal,
        liquido: liqTotal,
        data: a.data,
        atendimentoId: a.id,
        ratio: 1,
      });
    }
  });
  return out;
}

// Agrega as linhas por procedimento e desconta o custo de laboratório do
// próprio atendimento, rateado pelo peso do item. Custo de laboratório sem
// `atendimento_id` fica de fora: não há a que atendimento atribuí-lo.
export function agruparPorProcedimento(
  linhas: readonly LinhaProcedimento[] = [],
  custosLab: readonly CustoLab[] = [],
): ProcedimentoAgregado[] {
  const labPorAtend = new Map<string, number>();
  (custosLab ?? []).forEach((r) => {
    if (!r.atendimento_id) return;
    labPorAtend.set(
      r.atendimento_id,
      (labPorAtend.get(r.atendimento_id) ?? 0) + Number(r.valor || 0),
    );
  });

  const map = new Map<string, Omit<ProcedimentoAgregado, "lucro" | "margem">>();
  (linhas ?? []).forEach((r) => {
    const k = r.procedimento || "—";
    const cur = map.get(k) ?? { nome: k, qtd: 0, bruto: 0, liquido: 0, lab: 0 };
    cur.qtd += 1;
    cur.bruto += Number(r.bruto || 0);
    cur.liquido += Number(r.liquido || 0);
    cur.lab += (labPorAtend.get(r.atendimentoId) ?? 0) * Number(r.ratio || 0);
    map.set(k, cur);
  });

  return Array.from(map.values()).map((r) => ({
    ...r,
    lucro: r.liquido - r.lab,
    margem: r.bruto > 0 ? ((r.liquido - r.lab) / r.bruto) * 100 : 0,
  }));
}
