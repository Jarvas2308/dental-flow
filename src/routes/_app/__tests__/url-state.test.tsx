import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { renderRoute } from "@/test/harness";
import { navigateSpy } from "@/test/router-mock";
import { resetSupabaseMock } from "@/test/supabase-mock";

import { Route as DashboardRoute } from "@/routes/_app/dashboard";
import { Route as ConsultorioRoute } from "@/routes/_app/consultorio";

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

// O atrito original: olhar julho no Dashboard, clicar num card de despesa e
// cair em /contas no mês corrente. Os cards de recorte mensal precisam levar o
// mês junto; os de recorte "todos os meses" não podem levar.
describe("Dashboard — drill-down preserva o mês", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  const hrefDoCard = (rotulo: string) => {
    const card = screen.getByText(rotulo).closest("a");
    return card?.getAttribute("href") ?? "";
  };

  it("leva o mês para as telas de recorte mensal", () => {
    renderRoute(DashboardRoute, { search: { mes: "2026-05" } });

    expect(hrefDoCard("Despesas Pagas")).toBe("/contas?mes=2026-05");
    expect(hrefDoCard("Despesas Pendentes")).toBe("/contas?mes=2026-05");
    expect(hrefDoCard("Receitas Extras")).toBe("/ganhos?mes=2026-05");
    expect(hrefDoCard("Laboratório")).toBe("/laboratorio?mes=2026-05");
    expect(hrefDoCard("Receita de Atendimentos")).toBe("/consultorio?mes=2026-05");
  });

  it("não leva o mês para telas que são de todos os meses", () => {
    renderRoute(DashboardRoute, { search: { mes: "2026-05" } });

    expect(hrefDoCard("Valores em Aberto")).toBe("/contas-receber");
    expect(hrefDoCard("Consultas hoje")).toBe("/consultas");
    expect(hrefDoCard("Follow-up hoje")).toBe("/followup");
  });
});

// O Consultório é a maior superfície: seis filtros que antes viviam só em
// memória e sumiam em qualquer refresh ou navegação.
describe("Consultório — filtros vindos da URL", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("aplica os filtros do search e mostra os chips ativos", async () => {
    renderRoute(ConsultorioRoute, {
      search: { mes: "2026-07", f: "pendentes", proc: "Limpeza", status: "abertos" },
    });

    expect(await screen.findByText("NF Pendentes")).toBeInTheDocument();
    expect(screen.getByText("Somente pendentes")).toBeInTheDocument();
    expect(screen.getByText("Limpeza")).toBeInTheDocument();
  });

  it("semeia a busca a partir da URL", async () => {
    renderRoute(ConsultorioRoute, { search: { q: "sophia" } });

    const busca = await screen.findByPlaceholderText(/Buscar paciente ou procedimento/i);
    expect(busca).toHaveValue("sophia");
  });

  it("limpa todos os filtros numa navegação só", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderRoute(ConsultorioRoute, {
      search: { mes: "2026-07", f: "pendentes", proc: "Limpeza", status: "abertos" },
    });

    await user.click(await screen.findByRole("button", { name: /Limpar/i }));

    // Uma navegação, não quatro — os setters individuais empilhariam chamadas.
    expect(navigateSpy).toHaveBeenCalledTimes(1);

    const arg = navigateSpy.mock.calls[0][0] as {
      search: (prev: Record<string, unknown>) => Record<string, unknown>;
    };
    // O mês sobrevive ao "Limpar": ele é recorte de período, não filtro.
    expect(
      arg.search({ mes: "2026-07", f: "pendentes", proc: "Limpeza", status: "abertos" }),
    ).toEqual({ mes: "2026-07", f: undefined, proc: undefined, q: undefined, status: undefined });
  });
});
