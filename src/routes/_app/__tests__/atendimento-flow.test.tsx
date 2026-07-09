import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { renderWithProviders, getRouteComponent } from "@/test/harness";
import { resetSupabaseMock, setTableData, spies } from "@/test/supabase-mock";

// Mock do formulário de atendimento: expõe um botão que dispara `onSaved`,
// simulando a conclusão do fluxo de atendimento SEM executá-lo de verdade.
// Assim conseguimos verificar que a mudança de status só acontece através
// desse callback (ou seja, depois do fluxo de atendimento), nunca antes.
vi.mock("@/components/atendimento-form", () => ({
  AtendimentoForm: ({
    onSaved,
    trigger,
  }: {
    onSaved?: () => void | Promise<void>;
    trigger?: React.ReactNode;
  }) =>
    createElement(
      "div",
      null,
      trigger,
      createElement(
        "button",
        { type: "button", "data-testid": "mock-atendimento-save", onClick: () => onSaved?.() },
        "salvar atendimento (mock)",
      ),
    ),
  EditAtendimentoButton: () => null,
}));

import { Route as ConsultasRoute } from "@/routes/_app/consultas";
import { Route as FollowupRoute } from "@/routes/_app/followup";

describe("fluxo de atendimento precede a mudança de status", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("consulta só é marcada como realizada após o fluxo de atendimento", async () => {
    const user = userEvent.setup();
    setTableData("consultas_previstas", [
      {
        id: "c-1",
        paciente: "Ana",
        data_prevista: "2026-07-20",
        valor_estimado: 500,
        realizada: false,
        observacao: null,
        paciente_id: null,
      },
    ]);

    const Consultas = getRouteComponent(ConsultasRoute);
    renderWithProviders(<Consultas />);

    // Aguarda a linha da consulta carregar.
    await screen.findByText("Ana");

    // Antes de concluir o fluxo de atendimento, nada é atualizado.
    expect(spies.update).not.toHaveBeenCalled();

    // Conclui o fluxo de atendimento (mock) → só então a consulta é marcada.
    await user.click(screen.getByTestId("mock-atendimento-save"));

    await waitFor(() =>
      expect(spies.update).toHaveBeenCalledWith("consultas_previstas", { realizada: true }),
    );
  });

  it("proposta de follow-up só é fechada após o fluxo de atendimento", async () => {
    const user = userEvent.setup();
    setTableData("tratamentos_propostos", [
      {
        id: "p-1",
        paciente: "Bruno",
        tratamento: "Clareamento",
        valor_estimado: 800,
        data_proposta: "2026-07-01",
        status: "acompanhando",
        tentativas_feitas: 0,
      },
    ]);
    setTableData("tentativas_contato", []);

    const Followup = getRouteComponent(FollowupRoute);
    renderWithProviders(<Followup />);

    await screen.findByText("Bruno");

    expect(spies.update).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("mock-atendimento-save"));

    await waitFor(() =>
      expect(spies.update).toHaveBeenCalledWith("tratamentos_propostos", { status: "fechado" }),
    );
  });
});
