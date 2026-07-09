import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, getRouteComponent } from "@/test/harness";
import { resetSupabaseMock } from "@/test/supabase-mock";

import { Route as DashboardRoute } from "@/routes/_app/dashboard";
import { Route as ConsultorioRoute } from "@/routes/_app/consultorio";
import { Route as ContasRoute } from "@/routes/_app/contas";
import { Route as ConsultasRoute } from "@/routes/_app/consultas";
import { Route as FollowupRoute } from "@/routes/_app/followup";

// Testes de fumaça: cada tela principal deve montar sem lançar exceção mesmo
// com o backend mockado retornando listas vazias. Protege contra regressões que
// quebrem a renderização inicial dos fluxos já validados manualmente.
describe("telas principais renderizam sem quebrar", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  const telas: [string, unknown][] = [
    ["Dashboard", DashboardRoute],
    ["Consultório", ConsultorioRoute],
    ["Contas/Despesas", ContasRoute],
    ["Consultas", ConsultasRoute],
    ["Follow-up", FollowupRoute],
  ];

  it.each(telas)("%s monta sem lançar", (_nome, route) => {
    const Component = getRouteComponent(route);
    expect(() => renderWithProviders(<Component />)).not.toThrow();
  });
});
