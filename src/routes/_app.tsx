import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useGerarRecorrentes } from "@/hooks/use-recurring";
import { currentMonthKey } from "@/lib/format";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { routeLabel } from "@/lib/nav";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChevronRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const { gerar } = useGerarRecorrentes();
  const gerouRef = useRef(false);

  // Checagem automática, uma vez por sessão e SEMPRE no mês corrente. A tela de
  // Despesas já teve um efeito equivalente disparado a cada troca de `?mes`:
  // navegar para um mês passado criava as recorrências daquele mês no banco,
  // em silêncio. Gerar competência diferente da atual é ação explícita, pelo
  // botão "Gerar recorrentes".
  useEffect(() => {
    if (session && !gerouRef.current) {
      gerouRef.current = true;
      gerar(currentMonthKey(), false);
    }
  }, [session, gerar]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" search={{ next: "" }} />;

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 min-w-0 pb-20 md:pb-0">
        <TopBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function TopBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const label = routeLabel(path);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-8">
      {/* No mobile a sidebar some, então a marca vive aqui. */}
      <div className="flex items-center gap-2 md:hidden">
        <BrandMark size={26} />
        <span className="font-brand text-[15px] font-semibold">Anna Julia Leduc</span>
      </div>
      <nav aria-label="Trilha" className="hidden items-center gap-1.5 text-sm md:flex">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
          Início
        </Link>
        {label && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">{label}</span>
          </>
        )}
      </nav>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
