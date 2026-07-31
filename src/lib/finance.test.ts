import { describe, it, expect } from "vitest";
import {
  receitasRecebidas,
  recebimentosNoMes,
  totalDespesasPagasNoMes,
  totalDespesasPendentesNoMes,
  caixaRealizado,
  resultadoPrevisto,
  contasAReceber,
} from "./finance";

// Atendimento parcelado usado como fonte de recebimentos livres.
const atendParcelado = {
  id: "at-1",
  paciente: "Ana",
  procedimento: "Restauração",
  parcelado: true,
  valor_bruto: 1000,
  valor_liquido: 1000,
  taxa: 0,
  forma_pagamento: "pix",
  data: "2026-05-01",
  status_pagamento: "pendente",
};

// Recebimentos em meses distintos para o mesmo atendimento.
const recebimentos = [
  {
    id: "r-jul",
    atendimento_id: "at-1",
    data: "2026-07-10",
    valor: 300,
    valor_liquido: 300,
    forma_pagamento: "pix",
  },
  {
    id: "r-jun",
    atendimento_id: "at-1",
    data: "2026-06-15",
    valor: 200,
    valor_liquido: 200,
    forma_pagamento: "pix",
  },
];

describe("recebimentos entram pela data do recebimento", () => {
  it("recebimento entra no mês pela data do recebimento", () => {
    const jul = recebimentosNoMes([atendParcelado], recebimentos, [], "2026-07");
    expect(jul).toHaveLength(1);
    expect(jul[0].data).toBe("2026-07-10");
    expect(jul[0].valor_liquido).toBe(300);
  });

  it("recebimento de mês anterior não entra no mês atual", () => {
    const jul = recebimentosNoMes([atendParcelado], recebimentos, [], "2026-07");
    // O recebimento de junho não deve aparecer em julho.
    expect(jul.some((e) => e.data === "2026-06-15")).toBe(false);

    const jun = recebimentosNoMes([atendParcelado], recebimentos, [], "2026-06");
    expect(jun).toHaveLength(1);
    expect(jun[0].data).toBe("2026-06-15");
  });

  it("cada recebimento é contabilizado na sua própria data", () => {
    const todas = receitasRecebidas([atendParcelado], recebimentos, []);
    expect(todas).toHaveLength(2);
    const datas = todas.map((e) => e.data).sort();
    expect(datas).toEqual(["2026-06-15", "2026-07-10"]);
  });
});

// Despesas: uma paga em julho, uma pendente em julho.
const despesas = [
  {
    id: "d-paga",
    status: "pago",
    data_pagamento: "2026-07-05",
    vencimento: "2026-07-01",
    valor: 100,
  },
  { id: "d-pend", status: "pendente", data_pagamento: null, vencimento: "2026-07-20", valor: 50 },
];

describe("despesas seguem a regra de data por status", () => {
  it("despesa paga entra no mês por data_pagamento", () => {
    expect(totalDespesasPagasNoMes(despesas, "2026-07")).toBe(100);
    // Não entra em outro mês pela data de pagamento.
    expect(totalDespesasPagasNoMes(despesas, "2026-06")).toBe(0);
  });

  it("despesa pendente entra por vencimento", () => {
    expect(totalDespesasPendentesNoMes(despesas, "2026-07")).toBe(50);
    expect(totalDespesasPendentesNoMes(despesas, "2026-06")).toBe(0);
  });

  it("despesa pendente não reduz o caixa realizado", () => {
    const entradas = 300; // recebimento efetivo de julho
    const pagas = totalDespesasPagasNoMes(despesas, "2026-07"); // 100
    const pendentes = totalDespesasPendentesNoMes(despesas, "2026-07"); // 50
    const caixa = caixaRealizado(entradas, pagas);
    // 300 - 100 = 200; os 50 pendentes não podem afetar este valor.
    expect(caixa).toBe(200);
    expect(caixa).not.toBe(entradas - pagas - pendentes);
  });
});

describe("fórmulas de caixa e resultado", () => {
  it("caixa realizado = recebimentos efetivos − despesas pagas", () => {
    expect(caixaRealizado(300, 100)).toBe(200);
    expect(caixaRealizado(0, 100)).toBe(-100);
    expect(caixaRealizado(500, 0)).toBe(500);
  });

  it("resultado previsto = caixa realizado − despesas pendentes", () => {
    const caixa = caixaRealizado(300, 100); // 200
    expect(resultadoPrevisto(caixa, 50)).toBe(150);
    expect(resultadoPrevisto(caixa, 0)).toBe(200);
  });
});

describe("atendimento com parcela legada + recebimento novo (regressão)", () => {
  // Atendimento que tem uma parcela antiga (sistema legado, 1ª parcela paga
  // em junho) e um recebimento novo registrado no fluxo atual (2ª parcela,
  // paga em julho). O recebimento novo não pode ser ignorado só porque o
  // atendimento também tem parcelas legadas.
  const atendComLegado = {
    id: "at-legado",
    paciente: "Bruno",
    procedimento: "Canal",
    parcelado: true,
    valor_bruto: 1000,
    valor_liquido: 1000,
    taxa: 0,
    forma_pagamento: "pix",
    data: "2026-06-01",
    status_pagamento: "pendente",
    parcelas_total: 2,
  };
  const parcelaLegadaPaga = [
    {
      id: "p-1",
      atendimento_id: "at-legado",
      numero: 1,
      total: 2,
      status: "pago",
      data_pagamento: "2026-06-05",
      vencimento: "2026-06-05",
      valor_bruto: 500,
      valor_liquido: 500,
      paciente: "Bruno",
      procedimento: "Canal",
    },
  ];
  const recebimentoNovoJulho = [
    {
      id: "r-2",
      atendimento_id: "at-legado",
      data: "2026-07-08",
      valor: 500,
      valor_liquido: 500,
      forma_pagamento: "pix",
    },
  ];

  it("recebimento novo de julho aparece em julho, não fica invisível", () => {
    const jul = receitasRecebidas([atendComLegado], recebimentoNovoJulho, parcelaLegadaPaga).filter(
      (e) => e.data.startsWith("2026-07"),
    );
    expect(jul).toHaveLength(1);
    expect(jul[0].valor_bruto).toBe(500);
  });

  it("parcela legada de junho continua aparecendo em junho", () => {
    const jun = receitasRecebidas([atendComLegado], recebimentoNovoJulho, parcelaLegadaPaga).filter(
      (e) => e.data.startsWith("2026-06"),
    );
    expect(jun).toHaveLength(1);
    expect(jun[0].valor_bruto).toBe(500);
  });
});

describe("contasAReceber com atendimento em estado misto (regressão)", () => {
  // Mesmo atendimento base das suítes acima: total 1000, dividido em 2x.
  const base = {
    id: "at-misto",
    paciente: "Carla",
    procedimento: "Ortodontia",
    parcelado: true,
    valor_bruto: 1000,
    valor_liquido: 1000,
    taxa: 0,
    forma_pagamento: "pix",
    data: "2026-06-01",
    status_pagamento: "pendente",
    parcelas_total: 2,
  };
  const parcela1Paga = {
    id: "p-1",
    atendimento_id: "at-misto",
    numero: 1,
    total: 2,
    status: "pago",
    data_pagamento: "2026-06-05",
    vencimento: "2026-06-05",
    valor_bruto: 500,
    valor_liquido: 500,
    paciente: "Carla",
    procedimento: "Ortodontia",
  };
  const parcela2Pendente = {
    id: "p-2",
    atendimento_id: "at-misto",
    numero: 2,
    total: 2,
    status: "pendente",
    data_pagamento: null,
    vencimento: "2026-07-05",
    valor_bruto: 500,
    valor_liquido: 500,
    paciente: "Carla",
    procedimento: "Ortodontia",
  };

  it("só parcela legada, ainda com parcela pendente: comportamento atual não muda", () => {
    // Sem nenhum recebimento novo — cai inteiro no fallback legado.
    const contas = contasAReceber([base], [], [parcela1Paga, parcela2Pendente]);
    expect(contas).toHaveLength(1);
    expect(contas[0].recebido).toBe(500);
    expect(contas[0].saldo).toBe(500);
  });

  it("parcela legada paga + recebimento novo que ainda deixa saldo: aparece com saldo correto", () => {
    // Bug anterior: esse atendimento desaparecia inteiro da lista, pois a
    // única parcela legada já estava paga (pend.length === 0 no fallback),
    // e o recebimento novo nunca era somado.
    const recebimentoNovoParcial = [
      {
        id: "r-parcial",
        atendimento_id: "at-misto",
        data: "2026-07-08",
        valor: 300,
        valor_liquido: 300,
        forma_pagamento: "pix",
      },
    ];
    const contas = contasAReceber([base], recebimentoNovoParcial, [parcela1Paga]);
    expect(contas).toHaveLength(1);
    expect(contas[0].recebido).toBe(800); // 500 (parcela) + 300 (recebimento)
    expect(contas[0].saldo).toBe(200);
    // Não pode haver entrada duplicada vinda do fallback legado.
    expect(contas.filter((c) => c.atendimento_id === "at-misto")).toHaveLength(1);
  });

  it("parcela legada paga + recebimento novo que quita o saldo: não aparece (quitado)", () => {
    const recebimentoNovoQuita = [
      {
        id: "r-quita",
        atendimento_id: "at-misto",
        data: "2026-07-08",
        valor: 500,
        valor_liquido: 500,
        forma_pagamento: "pix",
      },
    ];
    const contas = contasAReceber([base], recebimentoNovoQuita, [parcela1Paga]);
    expect(contas.find((c) => c.atendimento_id === "at-misto")).toBeUndefined();
  });
});

describe("despesa vencida em um mês e paga no mês seguinte", () => {
  // Vence em junho, mas só é paga em julho.
  const despesaAtravessada = [
    {
      id: "d-cross",
      status: "pago",
      data_pagamento: "2026-07-05",
      vencimento: "2026-06-30",
      valor: 100,
    },
  ];

  it("só entra no caixa realizado no mês do pagamento", () => {
    // Junho: não é pendente (já está paga) e não foi paga em junho.
    expect(totalDespesasPagasNoMes(despesaAtravessada, "2026-06")).toBe(0);
    expect(totalDespesasPendentesNoMes(despesaAtravessada, "2026-06")).toBe(0);

    // Julho: entra como despesa paga pela data_pagamento.
    expect(totalDespesasPagasNoMes(despesaAtravessada, "2026-07")).toBe(100);

    const caixaJunho = caixaRealizado(0, totalDespesasPagasNoMes(despesaAtravessada, "2026-06"));
    const caixaJulho = caixaRealizado(0, totalDespesasPagasNoMes(despesaAtravessada, "2026-07"));
    expect(caixaJunho).toBe(0);
    expect(caixaJulho).toBe(-100);
  });
});
