import { useEffect, useMemo, useState } from "react";

// Paginação client-side simples e reutilizável.
// - Fatia uma lista já filtrada/ordenada em páginas de tamanho fixo.
// - Reseta para a primeira página sempre que a lista muda de tamanho
//   (efeito de mudar busca/filtros) ou quando a página atual fica fora do range.
// Não altera cálculos: apenas decide o recorte exibido.
export function usePagination<T>(items: T[], pageSize = 20, resetKey?: unknown) {
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Volta à primeira página quando o conjunto filtrado muda de tamanho
  // (troca de busca/filtro/aba), quando o resetKey muda (mesmo tamanho, outro
  // filtro) ou quando a página some do range.
  useEffect(() => {
    setPage(1);
  }, [total, pageSize, resetKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const current = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (current - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, current, pageSize]);

  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return {
    page: current,
    setPage,
    totalPages,
    total,
    from,
    to,
    pageItems,
    canPrev: current > 1,
    canNext: current < totalPages,
    prev: () => setPage((p) => Math.max(1, p - 1)),
    next: () => setPage((p) => Math.min(totalPages, p + 1)),
  };
}
