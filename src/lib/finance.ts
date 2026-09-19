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

import { monthKey, todayISO } from "./format";

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
  // Só as recorrentes de valor variável nascem sem valor, esperando o boleto
  // do mês. Elas precisam ser distinguidas de uma pendência comum.
  recorrente?: boolean | null;
  tipo_recorrencia?: string | null;
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

// Tolerância para comparações de valores monetários (arredondamento).
// Acima disso, não é "quitado" / "zero" / "negligenciável".
export const MONETARY_EPSILON = 0.005;

// IDs de atendimento que têm ao menos um recebimento no sistema ATUAL
// (tabela `recebimentos`). Um atendimento pode ter parcelas legadas E
// recebimentos novos ao mesmo tempo (ex.: 1ª parcela paga no sistema antigo,
// 2ª parcela registrada já no fluxo atual). Ponto único de verdade: qualquer
// função que precise decidir "trato este atendimento pelo fluxo novo ou caio
// no fallback de parcelas legadas?" deve consultar este Set, nunca
// reimplementar a checagem localmente — foi exatamente a duplicação dessa
// lógica em cada função que fez o mesmo bug (atendimento com estado misto
// sendo pulado por inteiro) escapar em uma função, ser corrigido, e
// reaparecer em outra.
export function idsComRecebimentoNovo(recebimentos: RecebimentoRow[]): Set<string> {
  return new Set(recebimentos.map((r) => r.atendimento_id));
}

// IDs de atendimento que têm ao menos uma linha na tabela legada `parcelas`
// (independente de status pago/pendente). Companheiro de idsComRecebimentoNovo
// acima — usar SEMPRE este helper em vez de recriar o Set localmente em cada
// função, pelo mesmo motivo.
export function idsComParcelaLegada(parcelas: ParcelaRow[]): Set<string> {
  return new Set(parcelas.map((p) => p.atendimento_id));
}

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

// Agrupa linhas-filhas por `atendimento_id`.
//
// Construir o índice uma vez e consultá-lo dentro do laço troca O(n·m) por
// O(n+m). Antes cada função varria a lista inteira de recebimentos (e de
// parcelas) uma vez por atendimento, então o custo das telas crescia com o
// QUADRADO do histórico — e histórico financeiro nunca é apagado.
export function porAtendimento<T extends { atendimento_id: string }>(rows: T[]): Map<string, T[]> {
  const indice = new Map<string, T[]>();
  for (const r of rows) {
    const atual = indice.get(r.atendimento_id);
    if (atual) atual.push(r);
    else indice.set(r.atendimento_id, [r]);
  }
  return indice;
}

// Resumo financeiro de um atendimento (à vista ou parcelado).
export function resumoAtendimento(
  a: AtendimentoRow,
  recebimentos: RecebimentoRow[] = [],
  parcelas: ParcelaRow[] = [],
): ResumoAtend {
  return resumoDeLinhas(
    a,
    recebimentos.filter((r) => r.atendimento_id === a.id),
    parcelas.filter((p) => p.atendimento_id === a.id && p.status === "pago"),
  );
}

// Mesma conta de `resumoAtendimento` para vários atendimentos de uma vez.
// Use esta quando houver um laço: `resumoAtendimento` refiltra as listas
// completas a cada chamada.
export function resumosPorAtendimento(
  atend: AtendimentoRow[] = [],
  recebimentos: RecebimentoRow[] = [],
  parcelas: ParcelaRow[] = [],
): Map<string, ResumoAtend> {
  const recsPorAtend = porAtendimento(recebimentos);
  const parcPorAtend = porAtendimento(parcelas);
  const out = new Map<string, ResumoAtend>();
  for (const a of atend) {
    out.set(a.id, resumoDeLinhas(a, recsPorAtend.get(a.id) ?? [], pagasDe(parcPorAtend, a.id)));
  }
  return out;
}

const pagasDe = (indice: Map<string, ParcelaRow[]>, id: string) =>
  (indice.get(id) ?? []).filter((p) => p.status === "pago");

// Núcleo do cálculo: recebe as linhas do atendimento já separadas.
function resumoDeLinhas(
  a: AtendimentoRow,
  recs: RecebimentoRow[],
  legacy: ParcelaRow[],
): ResumoAtend {
  const total = bru(a);
  const f = fatorLiquido(a);

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
  const status: StatusReceb =
    recebido <= MONETARY_EPSILON ? "aberto" : saldo <= MONETARY_EPSILON ? "quitado" : "parcial";

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
  atend: AtendimentoRow[] = [],
  recebimentos: RecebimentoRow[] = [],
  parcelas: ParcelaRow[] = [],
): Entrada[] {
  const out: Entrada[] = [];
  const legacyIds = idsComParcelaLegada(parcelas);
  const recsPorAtend = porAtendimento(recebimentos);

  for (const a of atend) {
    const recs = recsPorAtend.get(a.id) ?? [];

    // Se há recebimentos registrados, cada um conta na SUA data (regime de caixa),
    // mesmo que o atendimento também tenha parcelas legadas (ex.: 1ª parcela paga
    // no sistema antigo e 2ª registrada já no fluxo atual de recebimentos).
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

    if (legacyIds.has(a.id)) continue; // sem recebimentos novos: tratado via parcelas legadas abaixo

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
  atend: AtendimentoRow[] = [],
  recebimentos: RecebimentoRow[] = [],
  parcelas: ParcelaRow[] = [],
): AbertoItem[] {
  const out: AbertoItem[] = [];
  const legacyIds = idsComParcelaLegada(parcelas);
  const recsPorAtend = porAtendimento(recebimentos);

  for (const a of atend) {
    const recs = recsPorAtend.get(a.id) ?? [];

    // Sem recebimentos novos e com parcelas legadas: tratado no bloco de
    // parcelas legadas abaixo (evita ignorar recebimentos novos de
    // atendimentos que também têm parcelas legadas antigas).
    if (recs.length === 0 && legacyIds.has(a.id)) continue;

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
    if (saldoBruto <= MONETARY_EPSILON) continue;
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
  recebimentos: RecebimentoRow[];
};

export function contasAReceber(
  atend: AtendimentoRow[] = [],
  recebimentos: RecebimentoRow[] = [],
  parcelas: ParcelaRow[] = [],
): ContaReceber[] {
  const legacyIds = idsComParcelaLegada(parcelas);
  const recIds = idsComRecebimentoNovo(recebimentos);
  const recsPorAtend = porAtendimento(recebimentos);
  const parcPorAtend = porAtendimento(parcelas);
  const out: ContaReceber[] = [];

  for (const a of atend) {
    const temRecs = recIds.has(a.id);
    // Sem recebimentos novos e com parcela legada: tratado no bloco de
    // parcelas legadas abaixo (evita ignorar recebimentos novos de
    // atendimentos que também têm parcelas legadas antigas — ver
    // idsComRecebimentoNovo/idsComParcelaLegada acima).
    if (!temRecs && legacyIds.has(a.id)) continue;
    // À vista, quitado e sem recebimentos parciais: não é conta a receber.
    if (!a.parcelado && a.status_pagamento !== "pendente" && !temRecs) continue;

    const r = resumoDeLinhas(a, recsPorAtend.get(a.id) ?? [], pagasDe(parcPorAtend, a.id));
    if (r.saldo <= MONETARY_EPSILON) continue; // quitado

    // Cópia antes de ordenar: o array vem do índice e é compartilhado.
    const recs = [...(recsPorAtend.get(a.id) ?? [])].sort((x, y) =>
      (x.data ?? "").localeCompare(y.data ?? ""),
    );

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

  // Atendimentos legados com parcelas em aberto — só quando NÃO há
  // recebimento novo para o mesmo atendimento_id, pois esses já foram
  // tratados no loop acima (via resumoAtendimento, que combina as duas
  // fontes). Sem esse filtro, um atendimento misto entraria duas vezes,
  // ou a versão legada (que ignora `recebimentos`) sobrescreveria/duplicaria
  // a entrada correta.
  const byAtend = new Map<string, ParcelaRow[]>();
  for (const p of parcelas) {
    if (recIds.has(p.atendimento_id)) continue;
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
  atend: AtendimentoRow[] = [],
  recebimentos: RecebimentoRow[] = [],
  parcelas: ParcelaRow[] = [],
  mes: string,
): Entrada[] {
  return receitasRecebidas(atend, recebimentos, parcelas).filter((e) => noMes(e.data, mes));
}

// ---------------------------------------------------------------------------
// Status de despesa
//
// Ponto único de verdade, pelo mesmo motivo de idsComRecebimentoNovo acima: a
// tela de Despesas mantinha a própria `computeStatus`, que considerava paga
// qualquer linha com `status = 'pago'`, enquanto despesasPagas/despesasPendentes
// (Dashboard, Fluxo de Caixa e ferramenta MCP) exigem `data_pagamento` para
// posicionar a saída no caixa. Uma despesa marcada como paga sem data aparecia
// PAGA numa tela e PENDENTE na outra, para o mesmo mês.
// ---------------------------------------------------------------------------

export type StatusDespesa = "pago" | "aguardando" | "atrasado" | "pendente";

// `aguardando`: recorrente de valor variável ainda sem valor preenchido.
// `atrasado`: vencida e não paga. A comparação é entre strings YYYY-MM-DD, que
// ordenam lexicograficamente igual à ordem cronológica.
export function statusDespesa(d: DespesaRow, hojeISO: string = todayISO()): StatusDespesa {
  if (d.status === "pago" && d.data_pagamento) return "pago";
  if (
    d.recorrente &&
    d.tipo_recorrencia === "variavel" &&
    (d.valor == null || Number(d.valor) === 0)
  ) {
    return "aguardando";
  }
  if (!d.vencimento) return "pendente";
  return d.vencimento < hojeISO ? "atrasado" : "pendente";
}

export type ComStatusDespesa<T> = Omit<T, "status"> & { status: StatusDespesa };

// Aplica o status canônico a uma lista, preservando os demais campos.
export function comStatusDespesa<T extends DespesaRow>(
  rows: T[] = [],
  hojeISO: string = todayISO(),
): ComStatusDespesa<T>[] {
  return (rows ?? []).map((r) => ({ ...r, status: statusDespesa(r, hojeISO) }));
}

export type TotaisDespesas = {
  pago: number;
  pendente: number;
  atrasado: number;
  geral: number;
  // Contagem, não soma: uma despesa "aguardando" é justamente a que ainda não
  // tem valor, então somá-la produziria sempre zero.
  aguardando: number;
};

export function totaisPorStatusDespesa(rows: ComStatusDespesa<DespesaRow>[] = []): TotaisDespesas {
  const soma = (st: StatusDespesa) =>
    rows.filter((r) => r.status === st).reduce((s, r) => s + Number(r.valor || 0), 0);
  const pago = soma("pago");
  const pendente = soma("pendente");
  const atrasado = soma("atrasado");
  return {
    pago,
    pendente,
    atrasado,
    geral: pago + pendente + atrasado,
    aguardando: rows.filter((r) => r.status === "aguardando").length,
  };
}

// Despesas cujo VENCIMENTO cai no mês (regime de competência). É o recorte da
// tela de Despesas e é diferente de despesasPagasNoMes, que posiciona a saída
// pela data_pagamento (regime de caixa) para o Dashboard e o Fluxo de Caixa. As
// duas visões divergem de propósito quando uma conta vence num mês e é paga em
// outro.
export function despesasDoMesPorVencimento<T extends DespesaRow>(rows: T[] = [], mes: string): T[] {
  return (rows ?? []).filter((r) => noMes(r.vencimento, mes));
}

// Despesas pagas normalizadas: posicionadas pela data_pagamento (data da saída
// real). Cada item recebe `data = data_pagamento` para uso em fluxo de caixa.
export function despesasPagas(despesas: DespesaRow[] = []): DespesaRow[] {
  return (despesas ?? [])
    .filter((r) => statusDespesa(r) === "pago")
    .map((r) => ({ ...r, data: r.data_pagamento }));
}

// Despesas pagas do mês (pela data_pagamento).
export function despesasPagasNoMes(despesas: DespesaRow[] = [], mes: string): DespesaRow[] {
  return despesasPagas(despesas).filter((r) => noMes(r.data, mes));
}

export function totalDespesasPagasNoMes(despesas: DespesaRow[] = [], mes: string): number {
  return despesasPagasNoMes(despesas, mes).reduce((s, r) => s + Number(r.valor || 0), 0);
}

// Despesas pendentes: ainda não pagas, ou marcadas como pagas sem data_pagamento
// (não podem ser posicionadas em despesasPagas, então continuam pendentes pelo
// vencimento até que a data de pagamento seja preenchida).
export function despesasPendentes(despesas: DespesaRow[] = []): DespesaRow[] {
  return (despesas ?? []).filter((r) => statusDespesa(r) !== "pago");
}

// Despesas pendentes do mês (pelo vencimento).
export function despesasPendentesNoMes(despesas: DespesaRow[] = [], mes: string): DespesaRow[] {
  return despesasPendentes(despesas).filter((r) => noMes(r.vencimento, mes));
}

export function totalDespesasPendentesNoMes(despesas: DespesaRow[] = [], mes: string): number {
  return despesasPendentesNoMes(despesas, mes).reduce((s, r) => s + Number(r.valor || 0), 0);
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

// Linha datada genérica (receitas_extras / custos_laboratorio), ambas
// posicionadas pela própria `data`.
export type ValorDatadoRow = { data?: string | null; valor?: number | string | null };

export type ResumoMensalInput = {
  atendimentos?: AtendimentoRow[];
  recebimentos?: RecebimentoRow[];
  parcelas?: ParcelaRow[];
  despesas?: DespesaRow[];
  ganhos?: ValorDatadoRow[];
  lab?: ValorDatadoRow[];
};

export type ResumoMensal = {
  recebidoBruto: number;
  recebidoLiquido: number;
  ganhos: number;
  receitaTotal: number;
  despesasPagas: number;
  despesasPendentes: number;
  custosLaboratorio: number;
  caixaRealizado: number;
  resultadoPrevisto: number;
};

const somaValor = (rows: ValorDatadoRow[], mes: string) =>
  rows.filter((r) => noMes(r.data, mes)).reduce((s, r) => s + Number(r.valor || 0), 0);

// Resumo financeiro consolidado de um mês. Ponto único de verdade: o Dashboard
// e a ferramenta MCP `resumo_financeiro` consomem esta função em vez de repetir
// a fórmula, porque quando o MCP a reimplementava em SQL ele ignorava
// atendimentos à vista sem linha em `recebimentos`, parcelas legadas pagas,
// `receitas_extras` e `custos_laboratorio` — reportando um caixa diferente do
// que a tela mostrava para o mesmo mês.
export function resumoMensal(input: ResumoMensalInput, mes: string): ResumoMensal {
  const recebidasMes = recebimentosNoMes(
    input.atendimentos ?? [],
    input.recebimentos ?? [],
    input.parcelas ?? [],
    mes,
  );

  const recebidoBruto = recebidasMes.reduce((s, r) => s + r.valor_bruto, 0);
  const recebidoLiquido = recebidasMes.reduce((s, r) => s + r.valor_liquido, 0);
  const ganhos = somaValor(input.ganhos ?? [], mes);
  const receitaTotal = recebidoLiquido + ganhos;

  const despPagas = totalDespesasPagasNoMes(input.despesas ?? [], mes);
  const despPendentes = totalDespesasPendentesNoMes(input.despesas ?? [], mes);
  const custosLaboratorio = somaValor(input.lab ?? [], mes);

  // Custos de laboratório são saídas já realizadas, então entram junto das
  // despesas pagas no caixa realizado.
  const caixa = caixaRealizado(receitaTotal, despPagas + custosLaboratorio);

  return {
    recebidoBruto,
    recebidoLiquido,
    ganhos,
    receitaTotal,
    despesasPagas: despPagas,
    despesasPendentes: despPendentes,
    custosLaboratorio,
    caixaRealizado: caixa,
    resultadoPrevisto: resultadoPrevisto(caixa, despPendentes),
  };
}
