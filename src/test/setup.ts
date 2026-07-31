import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Substitui o cliente Supabase real pelo mock seguro em todos os testes.
vi.mock("@/integrations/supabase/client", async () => {
  const mod = await import("./supabase-mock");
  return { supabase: mod.supabase };
});

// Mock leve do @tanstack/react-router: mantém a API real, mas troca a
// navegação por elementos inertes para renderizar componentes de rota sem
// precisar de um router completo. Não altera comportamento das telas.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  const mock = await import("./router-mock");
  return {
    ...actual,
    Link: mock.LinkStub,
    Navigate: () => null,
    // Spy compartilhado (não um vi.fn() novo a cada chamada), para que os
    // testes consigam afirmar que a tela navegou com o search esperado.
    useNavigate: () => mock.navigateSpy,
    useRouter: () => ({ navigate: mock.navigateSpy, invalidate: vi.fn() }),
  };
});

// jsdom não implementa estes recursos usados por componentes Radix/recharts.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// PointerEvent APIs usadas por Radix (Select/Dialog) e ausentes no jsdom.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

afterEach(async () => {
  cleanup();
  const { resetRouterMock } = await import("./router-mock");
  resetRouterMock();
});
