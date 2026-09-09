import { vi } from "vitest";

// Mock seguro e isolado do cliente Supabase para testes de interface.
// Não faz nenhuma chamada de rede: devolve dados configuráveis por tabela e
// registra as operações de escrita em spies, sem alterar nenhuma lógica real.

type Row = Record<string, unknown>;

// Armazenamento mutável de dados por tabela, alimentado por cada teste.
const store: Record<string, Row[]> = {};

// Spies das operações de escrita, para asserções de fluxo.
//
// `or` é de leitura, mas fica registrado porque o mock não aplica filtros —
// devolve a tabela inteira. Sem gravar o argumento, nenhum teste conseguiria
// verificar QUAL recorte a tela pediu ao banco.
export const spies = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  rpc: vi.fn(),
  or: vi.fn(),
};

export function setTableData(table: string, rows: Row[]) {
  store[table] = rows;
}

export function resetSupabaseMock() {
  for (const k of Object.keys(store)) delete store[k];
  spies.insert.mockReset();
  spies.update.mockReset();
  spies.delete.mockReset();
  spies.rpc.mockReset();
  spies.or.mockReset();
}

function makeChain(table: string) {
  // `.range()` é o único filtro de leitura aplicado de verdade. As telas leem
  // por `fetchAllPages`, que só para quando uma página volta vazia; um mock que
  // devolvesse a tabela inteira a cada faixa deixaria esse laço sem fim.
  let faixa: [number, number] | null = null;
  const rows = () => {
    const todas = store[table] ?? [];
    return faixa ? todas.slice(faixa[0], faixa[1] + 1) : todas;
  };
  const result = () => ({ data: rows(), error: null as null });

  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => chain,
    or: (filtro: unknown) => {
      spies.or(table, filtro);
      return chain;
    },
    in: () => chain,
    eq: () => chain,
    ilike: () => chain,
    like: () => chain,
    not: () => chain,
    is: () => chain,
    gte: () => chain,
    lte: () => chain,
    limit: () => chain,
    range: (from: number, to: number) => {
      faixa = [from, to];
      return chain;
    },
    insert: (payload: unknown) => {
      spies.insert(table, payload);
      return chain;
    },
    update: (values: unknown) => {
      spies.update(table, values);
      return chain;
    },
    delete: () => {
      spies.delete(table);
      return chain;
    },
    single: () => Promise.resolve({ data: rows()[0] ?? { id: "mock-id" }, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    // Torna a cadeia "awaitable": awaits resolvem para { data, error }.
    then: (
      onFulfilled: (value: { data: Row[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result()).then(onFulfilled, onRejected),
  };
  return chain;
}

export const supabase = {
  from: (table: string) => makeChain(table),
  rpc: (fn: string, params?: unknown) => {
    spies.rpc(fn, params);
    return Promise.resolve({ data: {}, error: null });
  },
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.resolve({ error: null }),
    signUp: () => Promise.resolve({ error: null }),
    signOut: () => Promise.resolve({ error: null }),
  },
};
