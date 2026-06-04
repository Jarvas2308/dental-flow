import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Stethoscope,
  FlaskConical,
  Settings,
  LogOut,
  TrendingUp,
  PiggyBank,
  HandCoins,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/fluxo-caixa", label: "Fluxo", icon: TrendingUp },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/contas-receber", label: "A Receber", icon: HandCoins },
  { to: "/ganhos", label: "Ganhos", icon: PiggyBank },
  { to: "/consultorio", label: "Consultório", icon: Stethoscope },
  { to: "/consultas", label: "Consultas", icon: CalendarClock },
  { to: "/laboratorio", label: "Laboratório", icon: FlaskConical },
  { to: "/cadastros", label: "Cadastros", icon: Settings },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user } = useAuth();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-xl grid place-items-center text-primary-foreground font-bold"
            style={{ background: "var(--gradient-primary)" }}
          >
            O
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Odonto</div>
            <div className="text-xs text-muted-foreground">Financeiro</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t mt-2">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">
          {user?.email}
        </div>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur">
      <div className="grid grid-cols-9">
        {items.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
