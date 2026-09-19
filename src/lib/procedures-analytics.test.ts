import { describe, it, expect } from "vitest";
import {
  linhasDeProcedimento,
  agruparPorProcedimento,
  type AtendimentoAnalise,
  type ItemProcedimento,
  type CustoLab,
} from "./procedures-analytics";

const atendimento = (over: Partial<AtendimentoAnalise> = {}): AtendimentoAnalise => ({
  id: "at-1",
  procedimento: "Restauração",
  valor_bruto: 1000,
  valor_liquido: 900,
  data: "2026-07-10",
  ...over,
});

describe("linhasDeProcedimento", () => {
  it("rateia o líquido do atendimento entre os itens, na proporção do bruto", () => {
    const itens: ItemProcedimento[] = [
      { atendimento_id: "at-1", procedimento: "Canal", valor: 750 },
      { atendimento_id: "at-1", procedimento: "Restauração", valor: 250 },
    ];
    const linhas = linhasDeProcedimento([atendimento()], itens, ["2026-07"]);

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ procedimento: "Canal", bruto: 750, ratio: 0.75 });
    expect(linhas[0].liquido).toBeCloseTo(675, 2);
    expect(linhas[1].liquido).toBeCloseTo(225, 2);
    // O rateio não cria nem destrói dinheiro.
    expect(linhas.reduce((s, l) => s + l.liquido, 0)).toBeCloseTo(900, 2);
  });

  it("usa o procedimento de texto do atendimento quando não há itens", () => {
    const linhas = linhasDeProcedimento([atendimento()], [], ["2026-07"]);

    expect(linhas).toEqual([
      {
        procedimento: "Restauração",
        bruto: 1000,
        liquido: 900,
        data: "2026-07-10",
        atendimentoId: "at-1",
        ratio: 1,
      },
    ]);
  });

  it("ignora atendimentos fora dos meses do período", () => {
    const linhas = linhasDeProcedimento(
      [atendimento(), atendimento({ id: "at-2", data: "2026-06-10" })],
      [],
      ["2026-07"],
    );

    expect(linhas.map((l) => l.atendimentoId)).toEqual(["at-1"]);
  });

  it("não divide por zero quando os itens somam zero", () => {
    const itens: ItemProcedimento[] = [
      { atendimento_id: "at-1", procedimento: "Cortesia", valor: 0 },
    ];
    const linhas = linhasDeProcedimento([atendimento()], itens, ["2026-07"]);

    expect(linhas[0].ratio).toBe(0);
    expect(linhas[0].liquido).toBe(0);
    expect(Number.isFinite(linhas[0].liquido)).toBe(true);
  });

  it("aceita valores em texto, como vêm de numeric do Postgres", () => {
    const linhas = linhasDeProcedimento(
      [atendimento({ valor_bruto: "1000.00", valor_liquido: "900.00" })],
      [{ atendimento_id: "at-1", procedimento: "Canal", valor: "1000.00" }],
      ["2026-07"],
    );

    expect(linhas[0].bruto).toBe(1000);
    expect(linhas[0].liquido).toBeCloseTo(900, 2);
  });
});

describe("agruparPorProcedimento", () => {
  it("desconta o laboratório do próprio atendimento, rateado pelo peso do item", () => {
    const itens: ItemProcedimento[] = [
      { atendimento_id: "at-1", procedimento: "Prótese", valor: 750 },
      { atendimento_id: "at-1", procedimento: "Limpeza", valor: 250 },
    ];
    const linhas = linhasDeProcedimento([atendimento()], itens, ["2026-07"]);
    const lab: CustoLab[] = [{ atendimento_id: "at-1", valor: 400, data: "2026-07-12" }];

    const [protese, limpeza] = agruparPorProcedimento(linhas, lab);

    // 75% do custo vai para a prótese, 25% para a limpeza.
    expect(protese).toMatchObject({ nome: "Prótese", qtd: 1, bruto: 750 });
    expect(protese.lab).toBeCloseTo(300, 2);
    expect(protese.lucro).toBeCloseTo(375, 2); // 675 líquido - 300 lab
    expect(protese.margem).toBeCloseTo(50, 2); // 375 / 750
    expect(limpeza.lab).toBeCloseTo(100, 2);
    expect(limpeza.lucro).toBeCloseTo(125, 2);
  });

  it("ignora custo de laboratório sem atendimento_id", () => {
    const linhas = linhasDeProcedimento([atendimento()], [], ["2026-07"]);
    const lab: CustoLab[] = [{ atendimento_id: null, valor: 400, data: "2026-07-12" }];

    expect(agruparPorProcedimento(linhas, lab)[0].lab).toBe(0);
  });

  it("não atribui a um procedimento o laboratório de outro atendimento", () => {
    const linhas = linhasDeProcedimento(
      [atendimento(), atendimento({ id: "at-2", procedimento: "Clareamento" })],
      [],
      ["2026-07"],
    );
    const lab: CustoLab[] = [{ atendimento_id: "at-2", valor: 200, data: "2026-07-12" }];

    const porNome = new Map(agruparPorProcedimento(linhas, lab).map((r) => [r.nome, r]));
    expect(porNome.get("Restauração")!.lab).toBe(0);
    expect(porNome.get("Clareamento")!.lab).toBe(200);
  });

  it("soma quantidade e valores de procedimentos repetidos", () => {
    const linhas = linhasDeProcedimento(
      [atendimento(), atendimento({ id: "at-2", valor_bruto: 500, valor_liquido: 500 })],
      [],
      ["2026-07"],
    );

    const [r] = agruparPorProcedimento(linhas, []);
    expect(r).toMatchObject({ nome: "Restauração", qtd: 2, bruto: 1500, liquido: 1400 });
  });

  it("margem é zero quando o bruto é zero, sem gerar Infinity", () => {
    const linhas = linhasDeProcedimento(
      [atendimento({ valor_bruto: 0, valor_liquido: 0 })],
      [],
      ["2026-07"],
    );

    expect(agruparPorProcedimento(linhas, [])[0].margem).toBe(0);
  });
});
