import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

// Spy único de navegação usado pelo mock do @tanstack/react-router. Os testes
// inspecionam suas chamadas para verificar que uma tela grava o estado (mês,
// filtros) na URL em vez de guardá-lo apenas em memória.
export const navigateSpy = vi.fn();

export function resetRouterMock() {
  navigateSpy.mockReset();
}

// Monta o href como o router real faria: interpola os params na rota
// ("/pacientes/$id" + { id: "p-1" } vira "/pacientes/p-1") e serializa o
// search. Sem isso o stub de <Link> renderiza "/pacientes/$id" cru e nenhum
// teste consegue afirmar para onde um link aponta.
export function hrefDe(
  to?: string,
  params?: Record<string, unknown>,
  search?: unknown,
): string {
  let href = typeof to === "string" ? to : "#";
  for (const [chave, valor] of Object.entries(params ?? {})) {
    href = href.replace(`$${chave}`, encodeURIComponent(String(valor)));
  }
  // `search` também aceita função no router real; nesse caso não há como
  // resolver sem o estado anterior, então o stub ignora.
  const entradas = search && typeof search === "object" ? Object.entries(search) : [];
  const qs = new URLSearchParams();
  for (const [chave, valor] of entradas) {
    if (valor !== undefined && valor !== null && valor !== "") qs.set(chave, String(valor));
  }
  const query = qs.toString();
  return query ? `${href}?${query}` : href;
}

type LinkProps = {
  children?: ReactNode;
  to?: string;
  params?: Record<string, unknown>;
  search?: unknown;
};

export const LinkStub = ({ children, to, params, search, ...rest }: LinkProps) =>
  createElement("a", { href: hrefDe(to, params, search), ...rest }, children);
