/* eslint-disable react-refresh/only-export-components */
import { type ReactElement, type ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import { AuthContext, type AuthCtx } from "@/hooks/use-auth-context";

// Usuário/sessão falsos: habilitam as queries (que dependem de `user`) sem
// tocar em autenticação real. RLS/DB não são exercidos — o Supabase é mockado.
const fakeUser = { id: "test-user", email: "teste@exemplo.com" } as unknown as User;
const fakeSession = { user: fakeUser, access_token: "x" } as unknown as Session;

const authValue: AuthCtx = {
  session: fakeSession,
  user: fakeUser,
  loading: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
};

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(ui, { wrapper: Providers });
}

// Extrai o componente registrado em uma rota (createFileRoute) para renderizá-lo
// isoladamente, sem depender do router completo.
export function getRouteComponent(route: unknown): () => ReactElement {
  const comp = (route as { options?: { component?: unknown } })?.options?.component;
  if (typeof comp !== "function") {
    throw new Error("Rota sem componente renderizável");
  }
  return comp as () => ReactElement;
}

// Renderiza o componente de uma rota já com `Route.useSearch()` e
// `Route.useParams()` respondendo valores controlados. Esses são métodos do
// objeto de rota, e não do módulo do router — o mock de `@tanstack/react-router`
// em setup.ts não os alcança, então precisam ser stubados aqui.
export function renderRoute(
  route: unknown,
  opts: { search?: Record<string, unknown>; params?: Record<string, unknown> } = {},
): RenderResult {
  const alvo = route as Record<string, unknown>;
  if (typeof alvo.useSearch === "function") {
    vi.spyOn(alvo as never, "useSearch" as never).mockReturnValue((opts.search ?? {}) as never);
  }
  if (typeof alvo.useParams === "function") {
    vi.spyOn(alvo as never, "useParams" as never).mockReturnValue((opts.params ?? {}) as never);
  }
  const Component = getRouteComponent(route);
  return renderWithProviders(<Component />);
}
