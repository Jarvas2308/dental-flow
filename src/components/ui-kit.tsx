import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { monthLabel, monthOptionsIncluding } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Seletor de mês compartilhado pelas telas com recorte mensal. Antes o mesmo
// bloco de <Select> estava copiado em seis rotas, com larguras divergentes.
export function MonthSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (mes: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const opcoes = monthOptionsIncluding(value, 12);
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className ?? "w-[200px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((m) => (
          <SelectItem key={m} value={m} className="capitalize">
            {monthLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
  icon?: ReactNode;
}) {
  const toneCls = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  return (
    <div
      className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-card)]"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {icon && <div className={cn("opacity-70", toneCls)}>{icon}</div>}
      </div>
      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", toneCls)}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

// Faixa de alerta operacional para destacar pendências (consultas atrasadas,
// follow-ups do dia, contas vencidas). Apenas visual — não altera dados.
export function AlertBanner({
  tone = "warning",
  icon,
  title,
  description,
  action,
}: {
  tone?: "warning" | "destructive" | "primary";
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const toneCls = {
    warning: "border-warning/30 bg-warning/10 text-warning",
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    primary: "border-primary/30 bg-primary/10 text-primary",
  }[tone];

  return (
    <div
      className={cn("mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3", toneCls)}
      role="status"
    >
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {description && <div className="text-xs opacity-80">{description}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Estado vazio consistente para tabelas/listas das telas principais.
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      {icon && <div className="text-muted-foreground/70">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="max-w-sm text-xs text-muted-foreground">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
