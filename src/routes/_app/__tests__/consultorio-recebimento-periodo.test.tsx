import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderRoute } from "@/test/harness";
import { resetSupabaseMock, setTableData } from "@/test/supabase-mock";
import { toISODate } from "@/lib/format";

import { Route as ConsultorioRoute } from "@/routes/_app/consultorio";

// Cenário real relatado: tratamento parcelado feito em um mês, com a 2ª parcela
// paga no mês seguinte. Ao abrir o Consultório no mês do PAGAMENTO, o dinheiro
// precisa entrar no card "Recebido no período" E a linha de origem precisa
// aparecer na tabela — o atendimento é de outro mês e já está quitado, então
// nenhum dos filtros por data do atendimento o alcança.
describe("Consultório — recebimento no período de atendimento de outro mês", () => {
  const hoje = new Date();
  const dataAtual = toISODate(hoje);
  // Dia 10 do mês anterior, para não esbarrar em meses de 28/30/31 dias.
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 10);
  const dataAnterior = toISODate(mesAnterior);

  const atendimentoDoMes = {
    id: "at-mes",
    user_id: "test-user",
    data: dataAtual,
    paciente: "Joao Do Mes",
    procedimento: "Profilaxia",
    valor_bruto: 280,
    valor_liquido: 280,
    taxa: 0,
    forma_pagamento: "Pix",
    status_pagamento: "pago",
    parcelado: false,
    parcelas_total: 1,
    nota_fiscal_status: "pendente",
  };

  // Atendimento parcelado do mês anterior, JÁ QUITADO (900 + 900 = 1800).
  const atendimentoParceladoAnterior = {
    id: "at-parcelado",
    user_id: "test-user",
    data: dataAnterior,
    paciente: "Sophia Parcelada",
    procedimento: "Dispositivo Estabilizador",
    valor_bruto: 1800,
    valor_liquido: 1800,
    taxa: 0,
    forma_pagamento: "Dinheiro",
    status_pagamento: "pago",
    parcelado: true,
    parcelas_total: 2,
    nota_fiscal_status: "pendente",
  };

  beforeEach(() => {
    resetSupabaseMock();
    setTableData("atendimentos", [atendimentoDoMes, atendimentoParceladoAnterior]);
    setTableData("recebimentos", [
      // Recebimento à vista do próprio mês.
      {
        id: "r-mes",
        atendimento_id: "at-mes",
        data: dataAtual,
        valor: 280,
        valor_liquido: 280,
        forma_pagamento: "Pix",
      },
      // 1ª parcela, paga no mês anterior.
      {
        id: "r-p1",
        atendimento_id: "at-parcelado",
        data: dataAnterior,
        valor: 900,
        valor_liquido: 900,
        forma_pagamento: "Dinheiro",
      },
      // 2ª parcela, paga NESTE mês — é a que precisa aparecer.
      {
        id: "r-p2",
        atendimento_id: "at-parcelado",
        data: dataAtual,
        valor: 900,
        valor_liquido: 900,
        forma_pagamento: "Dinheiro",
      },
    ]);
    setTableData("parcelas", []);
  });

  it("mostra na tabela o atendimento de outro mês que recebeu neste mês", async () => {
    renderRoute(ConsultorioRoute);

    // O atendimento do próprio mês aparece (comportamento já existente).
    expect(await screen.findByText("Joao Do Mes")).toBeInTheDocument();

    // O atendimento parcelado do mês anterior, já quitado, também precisa
    // aparecer — porque a 2ª parcela foi recebida dentro deste período.
    expect(await screen.findByText("Sophia Parcelada")).toBeInTheDocument();
  });

  it("soma no card do período apenas os recebimentos com data no mês", async () => {
    renderRoute(ConsultorioRoute);

    await screen.findByText("Sophia Parcelada");

    // 280 (à vista do mês) + 900 (2ª parcela paga no mês) = 1180.
    // Os 900 da 1ª parcela (mês anterior) NÃO podem entrar.
    expect(screen.getByText("2 recebimentos · bruto R$ 1.180,00")).toBeInTheDocument();
  });
});
