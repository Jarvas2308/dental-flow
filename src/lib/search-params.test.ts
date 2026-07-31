import { describe, it, expect } from "vitest";
import { parseMes, parseTexto, parseOpcao } from "./search-params";
import { monthOptions, monthOptionsIncluding } from "./format";

// O search da URL é entrada externa (link compartilhado, favorito antigo,
// alguém editando a barra de endereços). Estes testes travam o contrato de que
// lixo vira `undefined` em vez de derrubar a tela.
describe("parseMes", () => {
  it("aceita YYYY-MM válido", () => {
    expect(parseMes("2026-07")).toBe("2026-07");
    expect(parseMes("2024-01")).toBe("2024-01");
    expect(parseMes("2024-12")).toBe("2024-12");
  });

  it("rejeita mês fora de 01–12", () => {
    expect(parseMes("2026-13")).toBeUndefined();
    expect(parseMes("2026-00")).toBeUndefined();
  });

  it("rejeita formatos e tipos inválidos", () => {
    expect(parseMes("banana")).toBeUndefined();
    expect(parseMes("")).toBeUndefined();
    expect(parseMes("2026-7")).toBeUndefined();
    expect(parseMes("2026/07")).toBeUndefined();
    // Um param repetido na URL (?mes=a&mes=b) chega como array.
    expect(parseMes(["2026-07"])).toBeUndefined();
    expect(parseMes(202607)).toBeUndefined();
    expect(parseMes(null)).toBeUndefined();
    expect(parseMes(undefined)).toBeUndefined();
  });
});

describe("parseTexto", () => {
  it("aceita texto não vazio dentro do limite", () => {
    expect(parseTexto("Sophia")).toBe("Sophia");
  });

  it("rejeita vazio, tipos errados e texto longo demais", () => {
    expect(parseTexto("")).toBeUndefined();
    expect(parseTexto(123)).toBeUndefined();
    expect(parseTexto(["a"])).toBeUndefined();
    expect(parseTexto("x".repeat(121))).toBeUndefined();
    expect(parseTexto("x".repeat(120))).toHaveLength(120);
  });
});

describe("parseOpcao", () => {
  const OPCOES = ["todos", "pagos", "pendentes"] as const;

  it("aceita apenas membros do conjunto", () => {
    expect(parseOpcao("pagos", OPCOES)).toBe("pagos");
    expect(parseOpcao("inexistente", OPCOES)).toBeUndefined();
    expect(parseOpcao(1, OPCOES)).toBeUndefined();
    expect(parseOpcao(null, OPCOES)).toBeUndefined();
  });
});

describe("monthOptionsIncluding", () => {
  it("mantém a lista padrão quando o mês já está nela", () => {
    const atual = monthOptions(12)[0];
    expect(monthOptionsIncluding(atual, 12)).toEqual(monthOptions(12));
  });

  it("inclui mês fora da janela para não deixar o Select em branco", () => {
    const antigo = "2019-03";
    const opcoes = monthOptionsIncluding(antigo, 12);
    expect(opcoes).toContain(antigo);
    expect(opcoes).toHaveLength(13);
    // Continua em ordem decrescente, então o mês antigo vai para o fim.
    expect(opcoes[opcoes.length - 1]).toBe(antigo);
  });
});
