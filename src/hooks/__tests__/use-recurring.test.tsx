import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resetSupabaseMock } from "@/test/supabase-mock";
import { useGerarRecorrentes } from "@/hooks/use-recurring";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

let qc: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function rpcResolvendo(resultado: { criadas?: number; existentes?: number }) {
  return vi
    .spyOn(supabase, "rpc")
    .mockImplementation(() => Promise.resolve({ data: resultado, error: null }));
}

beforeEach(() => {
  resetSupabaseMock();
  vi.restoreAllMocks();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});

describe("useGerarRecorrentes", () => {
  it("chama a RPC com a competência no primeiro dia do mês", async () => {
    const rpc = rpcResolvendo({ criadas: 2, existentes: 1 });
    const { result } = renderHook(() => useGerarRecorrentes(), { wrapper });

    await act(async () => {
      await result.current.gerar("2026-07");
    });

    expect(rpc).toHaveBeenCalledWith("gerar_despesas_recorrentes", {
      p_competencia: "2026-07-01",
    });
  });

  it("invalida as despesas e avisa quantas foram criadas", async () => {
    rpcResolvendo({ criadas: 2, existentes: 1 });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useGerarRecorrentes(), { wrapper });

    await act(async () => {
      await result.current.gerar("2026-07");
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["despesas"] });
    expect(toast.success).toHaveBeenCalledWith("2 criada(s), 1 já existente(s)");
  });

  it("dispara a RPC uma única vez quando duas chamadas saem no mesmo tick", async () => {
    // O caso real: a checagem automática do layout e a da tela montam juntas.
    // A trava é um useRef porque `loading` é estado e só valeria no render
    // seguinte — as duas chamadas passariam.
    const rpc = rpcResolvendo({ criadas: 1, existentes: 0 });
    const { result } = renderHook(() => useGerarRecorrentes(), { wrapper });

    await act(async () => {
      await Promise.all([result.current.gerar("2026-07"), result.current.gerar("2026-07")]);
    });

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("libera a trava depois de terminar, permitindo gerar outro mês", async () => {
    const rpc = rpcResolvendo({ criadas: 0, existentes: 3 });
    const { result } = renderHook(() => useGerarRecorrentes(), { wrapper });

    await act(async () => {
      await result.current.gerar("2026-07");
    });
    await act(async () => {
      await result.current.gerar("2026-08");
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith("gerar_despesas_recorrentes", {
      p_competencia: "2026-08-01",
    });
  });

  it("mostra a mensagem do erro da RPC", async () => {
    vi.spyOn(supabase, "rpc").mockImplementation(() =>
      Promise.resolve({ data: null, error: new Error("permission denied") }),
    );
    const { result } = renderHook(() => useGerarRecorrentes(), { wrapper });

    await act(async () => {
      await result.current.gerar("2026-07");
    });

    expect(toast.error).toHaveBeenCalledWith("permission denied");
  });

  it("na checagem automática não exibe toast nenhum, nem no erro", async () => {
    vi.spyOn(supabase, "rpc").mockImplementation(() =>
      Promise.resolve({ data: null, error: new Error("falhou") }),
    );
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useGerarRecorrentes(), { wrapper });

    await act(async () => {
      await result.current.gerar("2026-07", false);
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(erroNoConsole).toHaveBeenCalled();
  });

  it("mantém `loading` verdadeiro durante a chamada e falso ao final", async () => {
    let liberar: (v: { data: unknown; error: null }) => void = () => {};
    vi.spyOn(supabase, "rpc").mockImplementation(
      () => new Promise((res) => (liberar = res as typeof liberar)),
    );
    const { result } = renderHook(() => useGerarRecorrentes(), { wrapper });

    let chamada!: Promise<void>;
    act(() => {
      chamada = result.current.gerar("2026-07");
    });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      liberar({ data: { criadas: 0, existentes: 0 }, error: null });
      await chamada;
    });
    expect(result.current.loading).toBe(false);
  });
});
