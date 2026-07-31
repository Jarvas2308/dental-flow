import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, getRouteComponent } from "@/test/harness";
import { resetSupabaseMock, setTableData } from "@/test/supabase-mock";

import { Route as ContasReceberRoute } from "@/routes/_app/contas-receber";

// Cenário real relatado: tratamento parcelado, 1ª parcela paga no sistema
// legado (tabela `parcelas`), 2ª parcela paga no fluxo atual (tabela
// `recebimentos`), ainda restando saldo. A tela "Contas a Receber" precisa
// mostrar esse saldo corretamente — o bug anterior fazia esse atendimento
// sumir inteiro da lista, porque a única parcela legada já estava paga.
describe("Contas a Receber — atendimento com parcela legada + recebimento novo", () => {
  const atendimentoMisto = {
    id: "at-misto-ui",
    user_id: "test-user",
    data: "2026-06-01",
    paciente: "Fernanda Estado Misto",
    procedimento: "Ortodontia",
    valor_bruto: 1000,
    valor_liquido: 1000,
    taxa: 0,
    forma_pagamento: "Pix",
    status_pagamento: "pendente",
    parcelado: true,
    parcelas_total: 2,
    nota_fiscal_status: "pendente",
  };

  beforeEach(() => {
    resetSupabaseMock();
    setTableData("atendimentos", [atendimentoMisto]);
    setTableData("parcelas", [
      {
        id: "p-1-ui",
        atendimento_id: "at-misto-ui",
        numero: 1,
        total: 2,
        status: "pago",
        data_pagamento: "2026-06-05",
        vencimento: "2026-06-05",
        valor_bruto: 500,
        valor_liquido: 500,
        paciente: "Fernanda Estado Misto",
        procedimento: "Ortodontia",
      },
    ]);
    setTableData("recebimentos", [
      {
        id: "r-2-ui",
        atendimento_id: "at-misto-ui",
        data: "2026-07-08",
        valor: 300,
        valor_liquido: 300,
        forma_pagamento: "Pix",
      },
    ]);
  });

  it("mostra o atendimento com o saldo correto, não some da lista", async () => {
    const Component = getRouteComponent(ContasReceberRoute);
    renderWithProviders(<Component />);

    expect(await screen.findByText("Fernanda Estado Misto")).toBeInTheDocument();
    // Saldo esperado: 1000 - (500 da parcela + 300 do recebimento) = 200.
    // Aparece tanto no card "Total a receber" quanto no card do tratamento.
    expect(screen.getAllByText("R$ 200,00").length).toBeGreaterThan(0);
    // Recebido combinando as duas fontes: 500 + 300 = 800.
    expect(screen.getByText(/Recebido R\$ 800,00/)).toBeInTheDocument();
  });
});
