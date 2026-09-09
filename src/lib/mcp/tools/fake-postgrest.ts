// Fake do PostgREST para testar as consultas das ferramentas MCP.
//
// O mock de `src/test/supabase-mock.ts` devolve a tabela inteira e ignora os
// filtros — serve para testes de interface, mas não prova nada sobre QUAIS
// linhas uma consulta traz. Aqui os filtros são aplicados de verdade, porque é
// exatamente o recorte das consultas que fez a ferramenta `resumo_financeiro`
// divergir do Dashboard.
//
// Cobre só o subconjunto de PostgREST usado por `carregarDadosDoMes`:
// select / gte / lt / in / or / order / range, e o teto de linhas por resposta.

export type Row = Record<string, unknown>;

// Teto de linhas por resposta, como o `max-rows` do PostgREST. Um valor baixo
// deixa o corte observável em testes com poucas linhas.
const MAX_ROWS_PADRAO = 1000;

type Predicado = (r: Row) => boolean;

const valor = (r: Row, col: string) => r[col];

function comparaSimples(expr: string): Predicado {
  // Formato `coluna.operador.valor`, com o valor podendo conter pontos.
  const [col, op, ...resto] = expr.split(".");
  const alvo = resto.join(".");
  switch (op) {
    case "gte":
      return (r) => valor(r, col) != null && String(valor(r, col)) >= alvo;
    case "lt":
      return (r) => valor(r, col) != null && String(valor(r, col)) < alvo;
    case "lte":
      return (r) => valor(r, col) != null && String(valor(r, col)) <= alvo;
    case "eq":
      return (r) => String(valor(r, col)) === alvo;
    case "is":
      return alvo === "null" ? (r) => valor(r, col) == null : (r) => valor(r, col) != null;
    default:
      throw new Error(`fake-postgrest: operador não suportado em "${expr}"`);
  }
}

// Divide por vírgulas de nível superior, preservando os grupos `and(...)`.
function separaTermos(expr: string): string[] {
  const termos: string[] = [];
  let profundidade = 0;
  let atual = "";
  for (const ch of expr) {
    if (ch === "(") profundidade++;
    if (ch === ")") profundidade--;
    if (ch === "," && profundidade === 0) {
      termos.push(atual);
      atual = "";
      continue;
    }
    atual += ch;
  }
  if (atual) termos.push(atual);
  return termos;
}

function compilaTermo(termo: string): Predicado {
  const grupo = /^and\((.*)\)$/s.exec(termo.trim());
  if (grupo) {
    const partes = separaTermos(grupo[1]).map(compilaTermo);
    return (r) => partes.every((p) => p(r));
  }
  return comparaSimples(termo.trim());
}

// `.or("a,b")` é verdadeiro quando qualquer termo de nível superior casa.
function compilaOr(expr: string): Predicado {
  const termos = separaTermos(expr).map(compilaTermo);
  return (r) => termos.some((p) => p(r));
}

class Consulta implements PromiseLike<{ data: Row[]; error: null }> {
  private predicados: Predicado[] = [];
  private ordenacoes: { col: string; asc: boolean }[] = [];
  private faixa: [number, number] | null = null;

  constructor(
    private linhas: Row[],
    private maxRows: number,
  ) {}

  select() {
    return this;
  }
  gte(col: string, v: string) {
    return this.filtra((r) => valor(r, col) != null && String(valor(r, col)) >= v);
  }
  lt(col: string, v: string) {
    return this.filtra((r) => valor(r, col) != null && String(valor(r, col)) < v);
  }
  lte(col: string, v: string) {
    return this.filtra((r) => valor(r, col) != null && String(valor(r, col)) <= v);
  }
  eq(col: string, v: unknown) {
    return this.filtra((r) => valor(r, col) === v);
  }
  in(col: string, valores: unknown[]) {
    const conjunto = new Set(valores);
    return this.filtra((r) => conjunto.has(valor(r, col)));
  }
  or(expr: string) {
    return this.filtra(compilaOr(expr));
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.ordenacoes.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.faixa = [from, to];
    return this;
  }

  private filtra(p: Predicado) {
    this.predicados.push(p);
    return this;
  }

  private resolve() {
    let out = this.linhas.filter((r) => this.predicados.every((p) => p(r)));
    for (const { col, asc } of [...this.ordenacoes].reverse()) {
      out = [...out].sort((a, b) => {
        const x = String(valor(a, col) ?? "");
        const y = String(valor(b, col) ?? "");
        return asc ? x.localeCompare(y) : y.localeCompare(x);
      });
    }
    const [from, to] = this.faixa ?? [0, out.length - 1];
    // O corte por `maxRows` acontece DEPOIS da faixa pedida, como no PostgREST:
    // pedir mil linhas e receber menos não gera erro nenhum.
    return { data: out.slice(from, to + 1).slice(0, this.maxRows), error: null as null };
  }

  then<R1 = { data: Row[]; error: null }, R2 = never>(
    onFulfilled?: ((v: { data: Row[]; error: null }) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.resolve()).then(onFulfilled, onRejected);
  }
}

export function fakeSupabase(tabelas: Record<string, Row[]>, maxRows = MAX_ROWS_PADRAO) {
  return {
    from: (tabela: string) => new Consulta(tabelas[tabela] ?? [], maxRows),
  };
}
