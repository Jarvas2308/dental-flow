import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { createElement } from "react";
import { renderWithProviders, getRouteComponent } from "@/test/harness";
import { resetSupabaseMock, setTableData, spies } from "@/test/supabase-mock";

// Mock do combobox de paciente para evitar dependência do Radix Popover no jsdom.
vi.mock("@/components/atendimento-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/atendimento-form")>();
  return {
    ...actual,
    PacienteCombobox: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (nome: string, id: string | null) => void;
    }) =>
      createElement("input", {
        "data-testid": "paciente-input",
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value, null),
      }),
  };
});

import { Route as DtmRoute } from "@/routes/_app/dtm";
import { Route as PacientesRoute } from "@/routes/_app/pacientes";

describe("Módulo DTM — Acompanhamento", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("renderiza a tela sem quebrar (estado vazio)", async () => {
    const Dtm = getRouteComponent(DtmRoute);
    renderWithProviders(<Dtm />);
    expect(await screen.findByText(/Acompanhamento DTM/i)).toBeInTheDocument();
    expect(await screen.findByText(/Nenhum acompanhamento DTM ainda/i)).toBeInTheDocument();
  });

  it("cria acompanhamento com total de consultas", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const Dtm = getRouteComponent(DtmRoute);
    renderWithProviders(<Dtm />);

    await user.click(screen.getByRole("button", { name: /Novo acompanhamento/i }));
    const pacInput = (await screen.findByTestId("paciente-input")) as HTMLInputElement;
    fireEvent.change(pacInput, { target: { value: "Maria DTM" } });

    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "8" } });

    // Submete o formulário diretamente para evitar problemas de pointer-events
    // do Radix Dialog no jsdom.
    const form = pacInput.closest("form")!;
    fireEvent.submit(form);

    await waitFor(
      () => {
        expect(spies.insert).toHaveBeenCalledWith(
          "dtm_acompanhamentos",
          expect.objectContaining({ paciente: "Maria DTM", total_consultas: 8 }),
        );
      },
      { timeout: 2000 },
    );
  });

  it("registra consulta realizada com o próximo número da sequência", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setTableData("dtm_acompanhamentos", [
      {
        id: "a-1",
        user_id: "test-user",
        paciente: "João",
        paciente_id: null,
        total_consultas: 5,
        status: "em_acompanhamento",
        data_inicio: "2026-07-01",
        created_at: "2026-07-01",
        updated_at: "2026-07-01",
      },
    ]);
    setTableData("dtm_consultas", [
      {
        id: "c-1",
        user_id: "test-user",
        acompanhamento_id: "a-1",
        numero: 1,
        data_realizada: "2026-07-02",
        created_at: "2026-07-02",
      },
    ]);

    const Dtm = getRouteComponent(DtmRoute);
    renderWithProviders(<Dtm />);

    await user.click(await screen.findByRole("button", { name: /Expandir/i }));
    await user.click(await screen.findByRole("button", { name: /Registrar consulta realizada/i }));

    // Título indica próximo número = 2
    expect(await screen.findByText(/Registrar consulta #2/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Salvar$/i }));

    await waitFor(() =>
      expect(spies.insert).toHaveBeenCalledWith(
        "dtm_consultas",
        expect.objectContaining({ acompanhamento_id: "a-1", numero: 2 }),
      ),
    );
  });

  it("bloqueia registrar consulta acima do total (botão desabilitado + sugestão de conclusão)", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setTableData("dtm_acompanhamentos", [
      {
        id: "a-1",
        user_id: "test-user",
        paciente: "Ana",
        paciente_id: null,
        total_consultas: 2,
        status: "em_acompanhamento",
        data_inicio: null,
        created_at: "2026-07-01",
        updated_at: "2026-07-01",
      },
    ]);
    setTableData("dtm_consultas", [
      {
        id: "c-1",
        user_id: "test-user",
        acompanhamento_id: "a-1",
        numero: 1,
        data_realizada: "2026-07-02",
        created_at: "2026-07-02",
      },
      {
        id: "c-2",
        user_id: "test-user",
        acompanhamento_id: "a-1",
        numero: 2,
        data_realizada: "2026-07-05",
        created_at: "2026-07-05",
      },
    ]);

    const Dtm = getRouteComponent(DtmRoute);
    renderWithProviders(<Dtm />);

    await user.click(await screen.findByRole("button", { name: /Expandir/i }));

    // Sugestão de conclusão aparece.
    expect(
      await screen.findByText(/Todas as consultas foram realizadas/i),
    ).toBeInTheDocument();

    const btn = screen.getByRole("button", { name: /Registrar consulta realizada/i });
    expect(btn).toBeDisabled();
  });

  it("concluir manualmente muda o status para concluido", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setTableData("dtm_acompanhamentos", [
      {
        id: "a-1",
        user_id: "test-user",
        paciente: "Ana",
        paciente_id: null,
        total_consultas: 1,
        status: "em_acompanhamento",
        data_inicio: null,
        created_at: "2026-07-01",
        updated_at: "2026-07-01",
      },
    ]);
    setTableData("dtm_consultas", [
      {
        id: "c-1",
        user_id: "test-user",
        acompanhamento_id: "a-1",
        numero: 1,
        data_realizada: "2026-07-02",
        created_at: "2026-07-02",
      },
    ]);

    const Dtm = getRouteComponent(DtmRoute);
    renderWithProviders(<Dtm />);

    await user.click(await screen.findByRole("button", { name: /Expandir/i }));
    await user.click(
      await screen.findByRole("button", { name: /Concluir acompanhamento/i }),
    );

    await waitFor(() =>
      expect(spies.update).toHaveBeenCalledWith(
        "dtm_acompanhamentos",
        expect.objectContaining({ status: "concluido" }),
      ),
    );
  });

  it("exibe acompanhamento DTM na expansão do paciente", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    setTableData("pacientes", [{ id: "p-1", user_id: "test-user", nome: "Carlos", created_at: "x" }]);
    setTableData("dtm_acompanhamentos", [
      {
        id: "a-1",
        user_id: "test-user",
        paciente: "Carlos",
        paciente_id: "p-1",
        total_consultas: 4,
        status: "em_acompanhamento",
        data_inicio: "2026-07-01",
        created_at: "2026-07-01",
        updated_at: "2026-07-01",
      },
    ]);
    setTableData("dtm_consultas", [
      {
        id: "c-1",
        user_id: "test-user",
        acompanhamento_id: "a-1",
        numero: 1,
        data_realizada: "2026-07-02",
        created_at: "2026-07-02",
      },
    ]);

    // Silencia useSearch — a rota tem validateSearch, mas o harness ignora o router.
    vi.spyOn(PacientesRoute, "useSearch" as never).mockReturnValue({} as never);
    const Pacientes = getRouteComponent(PacientesRoute);
    renderWithProviders(<Pacientes />);

    await user.click(await screen.findByRole("button", { name: /Expandir/i }));
    const secao = await screen.findByText(/Acompanhamentos DTM/i);
    const container = secao.closest("div")?.parentElement as HTMLElement;
    expect(within(container).getByText(/1\/4 consultas/)).toBeInTheDocument();
  });
});
