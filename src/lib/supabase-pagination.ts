// Paginação de leituras do Supabase.
//
// O PostgREST aplica um teto de linhas por resposta (`max-rows`, 1000 por
// padrão) e NÃO sinaliza erro quando corta: a consulta volta com sucesso e
// menos linhas do que existem. Num app financeiro isso é a pior falha
// possível, porque o total exibido fica menor que o real sem nenhum aviso.
//
// `fetchAllPages` percorre a consulta em blocos com `.range()` até receber um
// bloco VAZIO.
//
// O avanço é pelo tamanho do bloco recebido, não por `PAGE_SIZE`. Parar no
// primeiro bloco menor que `PAGE_SIZE` pareceria mais direto, mas assume que o
// servidor nunca devolve menos do que foi pedido — e o `max-rows` do PostgREST
// é configurável: se ele for menor que `PAGE_SIZE`, toda página vem curta e a
// paginação encerraria já na primeira, reintroduzindo o corte silencioso que
// esta função existe para evitar. O custo é uma requisição extra no fim.
//
// Requisito de uso: a consulta paginada precisa de ordenação total. Um
// `.order()` com empates permite que o banco devolva a mesma linha em duas
// páginas (ou nenhuma), então adicione sempre um desempate estável — por
// convenção, `.order("id")`.

export const PAGE_SIZE = 1000;

// Teto defensivo de iterações. O laço para quando um bloco volta vazio, mas
// isso depende de o servidor respeitar `Range`. Um backend que ignore o
// cabeçalho devolve sempre a mesma página cheia e o laço nunca termina — a aba
// congela sem erro. Com o teto, a mesma falha vira exceção visível. 500 páginas
// de PAGE_SIZE são 500 mil linhas, muito acima de qualquer volume real aqui.
export const MAX_PAGES = 500;

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const todas: T[] = [];
  let from = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const lote = data ?? [];
    if (lote.length === 0) return todas;
    todas.push(...lote);
    from += lote.length;
  }
  throw new Error(
    `Paginação excedeu ${MAX_PAGES} requisições (${todas.length} linhas lidas). ` +
      "Provável falha do servidor em respeitar o cabeçalho Range.",
  );
}

// Busca por lista de ids (`.in(...)`). O filtro vai na query string, então uma
// lista grande estoura o limite de tamanho da URL e o servidor responde 414
// antes de a consulta rodar. Os ids são divididos em blocos e cada bloco é
// paginado por `fetchAllPages`.
export const ID_CHUNK_SIZE = 200;

export async function fetchAllPorIds<T>(
  ids: string[],
  page: (
    idsDoBloco: string[],
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const bloco = ids.slice(i, i + ID_CHUNK_SIZE);
    todas.push(...(await fetchAllPages<T>((from, to) => page(bloco, from, to))));
  }
  return todas;
}
