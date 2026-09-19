import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
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
  // O tom colore o número e a pastilha do ícone. A faixa colorida na borda
  // esquerda saiu: com quatro cartões lado a lado ela virava uma cerca.
  const valueCls = {
    default: "text-foreground",
    primary: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  const iconCls = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    destructive: "bg-destructive-soft text-destructive",
  }[tone];

  return (
    <div
      className="rounded-xl border bg-card p-4 transition-[box-shadow,border-color,translate] hover:-translate-y-px hover:border-primary-border hover:shadow-[var(--shadow-card)]"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <div className={cn("grid size-[26px] shrink-0 place-items-center rounded-md", iconCls)}>
            {icon}
          </div>
        )}
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
      </div>
      <div className={cn("mt-2.5 text-[25px] font-semibold tracking-tight tabular-nums", valueCls)}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</div>}
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
    warning: "border-warning/30 bg-warning-soft text-warning",
    destructive: "border-destructive/30 bg-destructive-soft text-destructive",
    primary: "border-primary-border bg-primary-soft text-primary",
  }[tone];

  return (
    <div
      className={cn("mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3", toneCls)}
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

// Estado de erro de carregamento. Sem isto, uma falha de rede era renderizada
// como lista vazia — indistinguível de "não há nada", o que num app financeiro
// comunica um número errado (R$ 0,00 em vez de "não sei").
export function ErrorState({
  title = "Não foi possível carregar",
  description = "Verifique sua conexão e tente novamente.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <div className="text-destructive">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="max-w-sm text-xs text-muted-foreground">{description}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Tentar de novo
        </button>
      )}
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
