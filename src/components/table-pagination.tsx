import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Rodapé de paginação enxuto: informa o intervalo exibido e navega entre
// páginas. Não interfere no layout geral das telas — apenas uma barra sutil.
export function TablePagination({
  page,
  totalPages,
  from,
  to,
  total,
  canPrev,
  canNext,
  onPrev,
  onNext,
  unitLabel = "itens",
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  unitLabel?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
      <span className="text-sm text-muted-foreground">
        {from}–{to} de {total} {unitLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!canPrev} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext} className="gap-1">
          Próxima <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
