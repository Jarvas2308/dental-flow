import { describe, it, expect } from "vitest";
import {
  fetchAllPages,
  fetchAllPorIds,
  PAGE_SIZE,
  ID_CHUNK_SIZE,
  MAX_PAGES,
} from "./supabase-pagination";

// Simula uma tabela do PostgREST: responde no máximo PAGE_SIZE linhas por vez,
// sem sinalizar que houve corte — o comportamento que a paginação existe para
// contornar.
function tabelaFake(total: number, maxRows = PAGE_SIZE) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: `id-${i}` }));
  const chamadas: [number, number][] = [];
  const page = async (from: number, to: number) => {
    chamadas.push([from, to]);
    return { data: linhas.slice(from, to + 1).slice(0, maxRows), error: null };
  };
  return { linhas, chamadas, page };
}

describe("fetchAllPages", () => {
  it("traz todas as linhas quando o total passa do teto de uma página", async () => {
    const t = tabelaFake(PAGE_SIZE * 2 + 7);
    const out = await fetchAllPages(t.page);
    expect(out).toEqual(t.linhas);
    // Três páginas cheias/parciais + a página vazia que encerra o laço.
    expect(t.chamadas).toHaveLength(4);
  });

  it("encerra com uma página vazia quando o total cabe na primeira", async () => {
    const t = tabelaFake(3);
    const out = await fetchAllPages(t.page);
    expect(out).toHaveLength(3);
    expect(t.chamadas).toHaveLength(2);
  });

  it("não para cedo quando o total é múltiplo exato do tamanho da página", async () => {
    const t = tabelaFake(PAGE_SIZE);
    const out = await fetchAllPages(t.page);
    expect(out).toHaveLength(PAGE_SIZE);
  });

  it("traz tudo mesmo com teto do servidor menor que o tamanho da página", async () => {
    // `max-rows` é configurável. Com 10, toda página vem curta; parar no
    // primeiro bloco incompleto devolveria 10 linhas de 45, em silêncio.
    const t = tabelaFake(45, 10);
    const out = await fetchAllPages(t.page);
    expect(out).toEqual(t.linhas);
  });

  it("propaga o erro em vez de devolver resultado parcial", async () => {
    let n = 0;
    const page = async () => {
      n += 1;
      if (n === 2) return { data: null, error: new Error("falha na página 2") };
      return { data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `${i}` })), error: null };
    };
    await expect(fetchAllPages(page)).rejects.toThrow("falha na página 2");
  });
});

describe("fetchAllPorIds", () => {
  it("divide a lista de ids em blocos e concatena os resultados", async () => {
    const ids = Array.from({ length: ID_CHUNK_SIZE * 2 + 5 }, (_, i) => `id-${i}`);
    const blocos: string[][] = [];
    const out = await fetchAllPorIds(ids, async (bloco, from, to) => {
      if (from === 0) blocos.push(bloco);
      return { data: bloco.slice(from, to + 1).map((id) => ({ id })), error: null };
    });

    expect(blocos).toHaveLength(3);
    expect(blocos[0]).toHaveLength(ID_CHUNK_SIZE);
    expect(blocos[2]).toHaveLength(5);
    expect(out.map((r) => r.id)).toEqual(ids);
  });

  it("não consulta nada com lista de ids vazia", async () => {
    let chamou = false;
    const out = await fetchAllPorIds([], async () => {
      chamou = true;
      return { data: [], error: null };
    });
    expect(chamou).toBe(false);
    expect(out).toEqual([]);
  });
});

describe("teto de iterações", () => {
  it("falha com erro explícito quando o servidor ignora o Range", async () => {
    // Backend defeituoso: devolve sempre a mesma página cheia. Sem o teto, o
    // laço nunca terminaria e a aba congelaria sem nenhum erro.
    const pagina = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `id-${i}` }));
    let chamadas = 0;
    const page = async () => {
      chamadas++;
      return { data: pagina, error: null };
    };

    await expect(fetchAllPages(page)).rejects.toThrow(/Range/);
    expect(chamadas).toBe(MAX_PAGES);
  });
});
