import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderRoute } from "@/test/harness";
import { resetSupabaseMock, setTableData } from "@/test/supabase-mock";
import { Route as NotaFiscalRoute } from "@/routes/_app/nota-fiscal";

// O relatório de NF responde duas perguntas: quanto falta emitir no mês
// selecionado e o que ficou para trás em meses anteriores — esta última é a
// que nenhuma outra tela mostra.
describe("Nota Fiscal", () => {
  const base = {
    user_id: "test-user",
    procedimento: "Restauração",
    taxa: 0,
    forma_pagamento: "Pix",
    status_pagamento: "pago",
    parcelado: false,
    parcelas_total: 1,
  };

  const atendimentos = [
    {
      ...base,
      id: "at-1",
      data: "2026-07-05",
      paciente: "Ana",
      valor_bruto: 1000,
      valor_liquido: 1000,
      nota_fiscal_status: "pendente",
    },
    {
      ...base,
      id: "at-2",
      data: "2026-07-20",
      paciente: "Bruno",
      valor_bruto: 500,
      valor_liquido: 500,
      nota_fiscal_status: "emitida",
    },
    {
      ...base,
      id: "at-3",
      data: "2026-07-22",
      paciente: "Carla",
      valor_bruto: 300,
      valor_liquido: 300,
      // Linha antiga, sem o campo: conta como pendente.
      nota_fiscal_status: null,
    },
    {
      ...base,
      id: "at-4",
      data: "2026-05-10",
      paciente: "Dora",
      valor_bruto: 700,
      valor_liquido: 700,
      nota_fiscal_status: "pendente",
    },
    {
      ...base,
      id: "at-5",
      data: "2026-08-03",
      paciente: "Elias",
      valor_bruto: 999,
      valor_liquido: 999,
      nota_fiscal_status: "pendente",
    },
  ];

  beforeEach(() => {
    resetSupabaseMock();
    setTableData("atendimentos", atendimentos);
    setTableData("recebimentos", [
      { id: "r-1", atendimento_id: "at-1", data: "2026-07-06", valor: 400, valor_liquido: 400 },
    ]);
    setTableData("parcelas", []);
  });

  // Os cards repetem valores que também aparecem nas tabelas, então cada
  // asserção olha o card pelo próprio rótulo. A consulta é refeita dentro do
  // waitFor porque o primeiro render mostra zero, antes de os dados chegarem.
  const esperaNoCard = (label: string, texto: string) =>
    waitFor(() => {
      const card = screen.getByText(label).closest("div.rounded-xl") as HTMLElement;
      expect(within(card).getByText(texto)).toBeInTheDocument();
    });

  it("soma a emitir no mês, tratando status ausente como pendente", async () => {
    renderRoute(NotaFiscalRoute, { search: { mes: "2026-07" } });

    // 1000 (Ana) + 300 (Carla, sem status) — o de agosto e o de maio ficam fora.
    await esperaNoCard("A emitir no mês", "R$ 1.300,00");
    await esperaNoCard("A emitir no mês", "2 atendimento(s)");
  });

  it("mostra o quanto já foi recebido dos atendimentos ainda sem nota", async () => {
    renderRoute(NotaFiscalRoute, { search: { mes: "2026-07" } });

    // 400 do recebimento registrado da Ana + 300 da Carla, que é um
    // atendimento à vista já marcado como pago e sem linha de recebimento —
    // o caso legado que `resumoAtendimento` resolve pelo status.
    await esperaNoCard("Recebido nos pendentes", "R$ 700,00");
  });

  it("alerta sobre notas pendentes de meses anteriores ao selecionado", async () => {
    renderRoute(NotaFiscalRoute, { search: { mes: "2026-07" } });

    expect(
      await screen.findByText(/1 nota\(s\) pendente\(s\) de meses anteriores/i),
    ).toBeInTheDocument();
    // O de agosto é posterior, então não entra no atraso.
    expect(screen.getByText(/R\$ 700,00 em atendimentos anteriores/i)).toBeInTheDocument();
  });

  it("lista apenas os pendentes do mês na aba padrão", async () => {
    renderRoute(NotaFiscalRoute, { search: { mes: "2026-07" } });

    const tabela = (await screen.findAllByRole("table"))[0];
    expect(within(tabela).getByText("Ana")).toBeInTheDocument();
    expect(within(tabela).getByText("Carla")).toBeInTheDocument();
    expect(within(tabela).queryByText("Bruno")).toBeNull();
  });

  it("a aba de emitidas mostra a outra face do mesmo mês", async () => {
    renderRoute(NotaFiscalRoute, { search: { mes: "2026-07", aba: "emitida" } });

    const tabela = (await screen.findAllByRole("table"))[0];
    expect(within(tabela).getByText("Bruno")).toBeInTheDocument();
    expect(within(tabela).queryByText("Ana")).toBeNull();
  });

  it("filtra pela busca vinda da URL", async () => {
    renderRoute(NotaFiscalRoute, { search: { mes: "2026-07", aba: "todas", q: "bru" } });

    const tabela = (await screen.findAllByRole("table"))[0];
    expect(within(tabela).getByText("Bruno")).toBeInTheDocument();
    expect(within(tabela).queryByText("Ana")).toBeNull();
  });
});
