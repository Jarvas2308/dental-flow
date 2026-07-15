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
