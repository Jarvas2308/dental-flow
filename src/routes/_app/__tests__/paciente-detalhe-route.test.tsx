import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderRoute } from "@/test/harness";
import { resetSupabaseMock, setTableData, spies } from "@/test/supabase-mock";

import { Route as PacienteDetalheRoute } from "@/routes/_app/pacientes.$id";

const carlos = { id: "p-1", user_id: "test-user", nome: "Carlos Legado", created_at: "x" };

const baseAtendimento = {
  user_id: "test-user",
  procedimento: "Restauração",
  taxa: 0,
  forma_pagamento: "Pix",
  status_pagamento: "pago",
  parcelado: false,
  parcelas_total: 1,
  nota_fiscal_status: "pendente",
  created_at: "x",
};

describe("Ficha do paciente — registros legados sem paciente_id", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setTableData("pacientes", [carlos]);
    setTableData("atendimentos", [
      // Registro atual, vinculado por id.
      {
        ...baseAtendimento,
        id: "at-novo",
        paciente_id: "p-1",
        paciente: "Carlos Legado",
        data: "2026-07-10",
        valor_bruto: 300,
        valor_liquido: 300,
      },
      // Registro legado: sem paciente_id, casa só pelo nome normalizado.
      // Um filtro server-side apenas por paciente_id perderia esta linha —
      // e a ficha mostraria menos dinheiro do que a realidade.
      {
        ...baseAtendimento,
        id: "at-legado",
        paciente_id: null,
        paciente: "Carlos Legado",
        data: "2026-06-01",
        valor_bruto: 500,
        valor_liquido: 500,
      },
      // Registro legado de OUTRO paciente: não pode entrar na conta, mesmo
      // vindo no superset trazido do banco.
      {
        ...baseAtendimento,
        id: "at-outro",
        paciente_id: null,
        paciente: "Outra Pessoa",
        data: "2026-06-02",
        valor_bruto: 999,
        valor_liquido: 999,
      },
    ]);
    setTableData("recebimentos", [
      {
        id: "r-1",
        atendimento_id: "at-novo",
        data: "2026-07-10",
        valor: 300,
        valor_liquido: 300,
        forma_pagamento: "Pix",
      },
      {
        id: "r-2",
        atendimento_id: "at-legado",
        data: "2026-06-01",
        valor: 500,
        valor_liquido: 500,
        forma_pagamento: "Pix",
      },
      // Recebimento do atendimento alheio — não pode ser somado.
      {
        id: "r-3",
        atendimento_id: "at-outro",
        data: "2026-06-02",
        valor: 999,
        valor_liquido: 999,
        forma_pagamento: "Pix",
      },
    ]);
    setTableData("parcelas", []);
    setTableData("consultas_previstas", []);
    setTableData("tratamentos_propostos", []);
    setTableData("tentativas_contato", []);
    setTableData("dtm_acompanhamentos", []);
    setTableData("dtm_consultas", []);
  });

  it("conta o atendimento legado junto com o atual", async () => {
    renderRoute(PacienteDetalheRoute, { params: { id: "p-1" } });

    expect(await screen.findByText("Carlos Legado")).toBeInTheDocument();
    // 2 atendimentos do Carlos — o de "Outra Pessoa" fica de fora.
    expect(screen.getByText("2")).toBeInTheDocument();
    // 300 (novo) + 500 (legado) = 800. Sem os 999 do atendimento alheio.
    expect(screen.getByText("R$ 800,00")).toBeInTheDocument();
  });

  it("não mistura registros legados de outro paciente", async () => {
    renderRoute(PacienteDetalheRoute, { params: { id: "p-1" } });

    await screen.findByText("Carlos Legado");
    expect(screen.queryByText("R$ 999,00")).not.toBeInTheDocument();
    expect(screen.queryByText("Outra Pessoa")).not.toBeInTheDocument();
  });

  // O mock do Supabase devolve a tabela inteira e ignora filtros, então os
  // testes acima exercitam só a filtragem no cliente. Este trava a outra
  // metade: o recorte pedido ao banco precisa ser um SUPERSET, incluindo os
  // registros sem paciente_id. Um `.eq("paciente_id", id)` sozinho passaria
  // nos testes anteriores e ainda assim perderia dados legados em produção.
  it("pede ao banco um superset que inclui registros sem paciente_id", async () => {
    renderRoute(PacienteDetalheRoute, { params: { id: "p-1" } });
    await screen.findByText("Carlos Legado");

    const filtroAtendimentos = spies.or.mock.calls.find((c) => c[0] === "atendimentos")?.[1];
    expect(filtroAtendimentos).toContain("paciente_id.eq.p-1");
    expect(filtroAtendimentos).toContain("paciente_id.is.null");
  });
});

describe("Ficha do paciente — estados e ações", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("mostra saída amigável quando o paciente não existe", async () => {
    setTableData("pacientes", []);
    renderRoute(PacienteDetalheRoute, { params: { id: "inexistente" } });

    expect(await screen.findByText(/Paciente não encontrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Voltar para a lista/i)).toBeInTheDocument();
  });

  it("oferece as ações de novo atendimento e agendar consulta", async () => {
    setTableData("pacientes", [carlos]);
    setTableData("atendimentos", []);
    setTableData("recebimentos", []);
    setTableData("parcelas", []);
    setTableData("consultas_previstas", []);
    setTableData("tratamentos_propostos", []);
    setTableData("tentativas_contato", []);
    setTableData("dtm_acompanhamentos", []);
    setTableData("dtm_consultas", []);

    renderRoute(PacienteDetalheRoute, { params: { id: "p-1" } });

    await screen.findByText("Carlos Legado");
    expect(screen.getByRole("button", { name: /Novo atendimento/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova consulta/i })).toBeInTheDocument();
    // Abrir a ficha nunca pode gravar nada no banco.
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("oferece receber saldo em atendimento ainda em aberto", async () => {
    setTableData("pacientes", [carlos]);
    setTableData("atendimentos", [
      {
        ...baseAtendimento,
        id: "at-aberto",
        paciente_id: "p-1",
        paciente: "Carlos Legado",
        data: "2026-07-01",
        status_pagamento: "pendente",
        valor_bruto: 1000,
        valor_liquido: 1000,
      },
    ]);
    setTableData("recebimentos", [
      {
        id: "r-1",
        atendimento_id: "at-aberto",
        data: "2026-07-01",
        valor: 400,
        valor_liquido: 400,
        forma_pagamento: "Pix",
      },
    ]);
    setTableData("parcelas", []);
    setTableData("consultas_previstas", []);
    setTableData("tratamentos_propostos", []);
    setTableData("tentativas_contato", []);
    setTableData("dtm_acompanhamentos", []);
    setTableData("dtm_consultas", []);

    renderRoute(PacienteDetalheRoute, { params: { id: "p-1" } });

    expect(await screen.findByText(/Tratamentos com saldo em aberto/i)).toBeInTheDocument();
    // 1000 - 400 = 600 de saldo.
    expect(screen.getAllByText("R$ 600,00").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Receber/i })).toBeInTheDocument();
  });
});
