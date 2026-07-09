import { type ReactElement, type ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
