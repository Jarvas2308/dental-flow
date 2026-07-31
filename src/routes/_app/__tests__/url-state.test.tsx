import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { renderRoute } from "@/test/harness";
import { navigateSpy } from "@/test/router-mock";
import { resetSupabaseMock } from "@/test/supabase-mock";

import { Route as DashboardRoute } from "@/routes/_app/dashboard";

// O mês de cada tela mora na URL, não em useState. Isso é o que faz um link
// compartilhado abrir o mesmo período e o drill-down do Dashboard levar o mês
// junto, em vez de cair sempre no mês corrente.
describe("Dashboard — mês vindo da URL", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("usa o mês do search em vez do mês corrente", () => {
    renderRoute(DashboardRoute, { search: { mes: "2026-05" } });

    // Os hints dos cards de despesa carimbam o mês selecionado.
    expect(screen.getAllByText(/maio de 2026/i).length).toBeGreaterThan(0);
  });

  it("cai no mês corrente quando a URL não traz mês", () => {
    expect(() => renderRoute(DashboardRoute, { search: {} })).not.toThrow();
    expect(screen.queryByText(/maio de 2026/i)).not.toBeInTheDocument();
  });

  it("grava o mês na URL preservando os demais params", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderRoute(DashboardRoute, { search: { mes: "2026-05" } });

    // O Dashboard tem outros combobox (a seção de procedimentos traz os seus),
    // então localiza pelo mês exibido no gatilho.
    const seletorMes = screen
      .getAllByRole("combobox")
      .find((el) => /maio de 2026/i.test(el.textContent ?? ""));
    expect(seletorMes).toBeDefined();
    await user.click(seletorMes!);

    const opcoes = await screen.findAllByRole("option");
    await user.click(opcoes[0]);

    expect(navigateSpy).toHaveBeenCalled();
    const arg = navigateSpy.mock.calls.at(-1)?.[0] as {
      replace?: boolean;
      search: (prev: Record<string, unknown>) => Record<string, unknown>;
    };

    // `replace` evita empilhar uma entrada de histórico por troca de mês.
    expect(arg.replace).toBe(true);

    // O updater precisa ser funcional: a forma literal (search: {mes}) apagaria
    // silenciosamente os outros filtros da tela. Este é o erro mais fácil de
    // cometer ao migrar as demais rotas, então fica travado aqui.
    expect(typeof arg.search).toBe("function");
    const resultado = arg.search({ q: "sophia", f: "pendentes" });
    expect(resultado).toMatchObject({ q: "sophia", f: "pendentes" });
    expect(resultado.mes).toBeTruthy();
    expect(resultado.mes).not.toBe("2026-05");
  });
});
