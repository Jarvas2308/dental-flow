import { vi } from "vitest";

// Mock seguro e isolado do cliente Supabase para testes de interface.
// Não faz nenhuma chamada de rede: devolve dados configuráveis por tabela e
// registra as operações de escrita em spies, sem alterar nenhuma lógica real.

type Row = Record<string, unknown>;

// Armazenamento mutável de dados por tabela, alimentado por cada teste.
const store: Record<string, Row[]> = {};

// Spies das operações de escrita, para asserções de fluxo.
export const spies = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  rpc: vi.fn(),
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
}

function makeChain(table: string) {
  const rows = () => store[table] ?? [];
  const result = () => ({ data: rows(), error: null as null });

  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => chain,
    or: () => chain,
    in: () => chain,
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
    limit: () => chain,
    range: () => chain,
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
