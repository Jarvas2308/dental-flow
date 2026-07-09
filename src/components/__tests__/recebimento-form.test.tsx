import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { renderWithProviders } from "@/test/harness";
import { resetSupabaseMock, setTableData, spies } from "@/test/supabase-mock";
import { RegistrarRecebimento } from "@/components/recebimento-form";
import type { AtendimentoRow } from "@/lib/finance";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Atendimento pendente à vista → saldo em aberto de R$ 1.000.
const atendimentoEmAberto: AtendimentoRow = {
  id: "at-1",
  data: "2026-07-01",
  paciente: "Ana",
  procedimento: "Restauração",
  parcelado: false,
  valor_bruto: 1000,
  valor_liquido: 1000,
  taxa: 0,
  forma_pagamento: "pix",
  status_pagamento: "pendente",
};

describe("registrar recebimento", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setTableData("formas_pagamento", [{ id: "f1", nome: "pix", taxa: 0 }]);
    setTableData("recebimentos", []);
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("mostra o botão de registrar quando há saldo em aberto", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegistrarRecebimento atendimento={atendimentoEmAberto} />);

    await user.click(screen.getByRole("button", { name: /Receber/i }));

    // Com saldo em aberto, o formulário e seu botão de submit aparecem.
    expect(
      await screen.findByRole("button", { name: /Registrar recebimento/i }),
    ).toBeInTheDocument();
  });

  it("não mostra o formulário quando o tratamento está quitado", async () => {
    const user = userEvent.setup();
    const quitado: AtendimentoRow = { ...atendimentoEmAberto, status_pagamento: "pago" };
    renderWithProviders(<RegistrarRecebimento atendimento={quitado} />);

    await user.click(screen.getByRole("button", { name: /Receber/i }));

    expect(await screen.findByText(/Tratamento quitado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar recebimento/i })).toBeNull();
  });

  it("bloqueia recebimento acima do saldo pendente", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegistrarRecebimento atendimento={atendimentoEmAberto} />);

    await user.click(screen.getByRole("button", { name: /Receber/i }));

    const valor = await screen.findByPlaceholderText("0,00");
    await user.clear(valor);
    await user.type(valor, "5000"); // muito acima do saldo de 1000

    await user.click(screen.getByRole("button", { name: /Registrar recebimento/i }));

    // Deve alertar e NÃO inserir nada no banco.
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("permite recebimento dentro do saldo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegistrarRecebimento atendimento={atendimentoEmAberto} />);

    await user.click(screen.getByRole("button", { name: /Receber/i }));

    const valor = await screen.findByPlaceholderText("0,00");
    await user.clear(valor);
    await user.type(valor, "300"); // dentro do saldo

    await user.click(screen.getByRole("button", { name: /Registrar recebimento/i }));

    await waitFor(() => expect(spies.insert).toHaveBeenCalledWith("recebimentos", expect.any(Object)));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
