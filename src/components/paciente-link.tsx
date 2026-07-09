import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

// Atalho de navegação para a tela de pacientes já filtrada pelo nome.
// Aparece somente quando há um paciente vinculado. Não altera dados — apenas UX.
export function VerPacienteButton({
  nome,
  label = "Ver paciente",
  className,
}: {
  nome?: string | null;
  label?: string;
  className?: string;
}) {
  const nomeTrim = (nome ?? "").trim();
  if (!nomeTrim) return null;
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={className ?? "h-8 gap-1 text-muted-foreground"}
    >
      <Link to="/pacientes" search={{ q: nomeTrim }} aria-label={`Ver paciente ${nomeTrim}`}>
        <User className="h-4 w-4" /> {label}
      </Link>
    </Button>
  );
}
