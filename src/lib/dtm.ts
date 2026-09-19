// Utilidades do módulo Acompanhamento DTM.
// Regra de ordenação: data_inicio ASC (mais antigo primeiro); vazios/nulos
// vão para o final; empate desempata por created_at ASC.
// Não altera banco, cálculos ou regras financeiras — apenas ordena em memória.

type DtmSortable = {
  data_inicio: string | null;
  created_at?: string | null;
};

export function sortDtmAcompanhamentos<T extends DtmSortable>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const aEmpty = !a.data_inicio;
    const bEmpty = !b.data_inicio;
    if (aEmpty && !bEmpty) return 1;
    if (!aEmpty && bEmpty) return -1;
    if (!aEmpty && !bEmpty) {
      if (a.data_inicio! < b.data_inicio!) return -1;
      if (a.data_inicio! > b.data_inicio!) return 1;
    }
    const ac = a.created_at ?? "";
    const bc = b.created_at ?? "";
    if (ac < bc) return -1;
    if (ac > bc) return 1;
    return 0;
  });
}

// Consultas agrupadas por acompanhamento, cada grupo ordenado por `numero`.
// A tela de DTM e a linha do tempo do paciente mantinham cópias idênticas
// disso; o genérico aceita tanto a linha completa de `dtm_consultas` quanto a
// projeção reduzida que a tela do paciente carrega.
type DtmConsultaAgrupavel = {
  acompanhamento_id: string;
  numero: number;
};

export function consultasPorAcompanhamento<T extends DtmConsultaAgrupavel>(
  consultas: readonly T[] = [],
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const c of consultas ?? []) {
    const list = m.get(c.acompanhamento_id) ?? [];
    list.push(c);
    m.set(c.acompanhamento_id, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.numero - b.numero);
  }
  return m;
}
