import {
  Activity,
  CalendarClock,
  FileText,
  FlaskConical,
  HandCoins,
  LayoutDashboard,
  PhoneCall,
  PiggyBank,
  Settings,
  Stethoscope,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/fluxo-caixa", label: "Fluxo", icon: TrendingUp },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/contas-receber", label: "A Receber", icon: HandCoins },
  { to: "/ganhos", label: "Ganhos", icon: PiggyBank },
  { to: "/nota-fiscal", label: "Nota Fiscal", icon: FileText },
  { to: "/consultorio", label: "Consultório", icon: Stethoscope },
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/consultas", label: "Consultas", icon: CalendarClock },
  { to: "/followup", label: "Follow-up", icon: PhoneCall },
  { to: "/dtm", label: "DTM", icon: Activity },
  { to: "/laboratorio", label: "Laboratório", icon: FlaskConical },
  { to: "/cadastros", label: "Cadastros", icon: Settings },
] as const;

export const navGroups = [
  { label: null, paths: ["/dashboard"] },
  { label: "Clínico", paths: ["/consultorio", "/pacientes", "/consultas", "/followup", "/dtm"] },
  {
    label: "Financeiro",
    paths: ["/fluxo-caixa", "/contas", "/contas-receber", "/ganhos", "/nota-fiscal"],
  },
  { label: "Gestão", paths: ["/laboratorio", "/cadastros"] },
] as const;

export const mobilePrimaryPaths = [
  "/dashboard",
  "/consultorio",
  "/fluxo-caixa",
  "/contas",
  "/contas-receber",
] as const;

// Rótulo da rota atual para a trilha do topo — mesma lista da navegação, para
// não haver dois lugares nomeando as mesmas telas.
export function routeLabel(path: string) {
  return items.find((i) => path === i.to || path.startsWith(i.to + "/"))?.label ?? "";
}
