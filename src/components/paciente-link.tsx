import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

// Atalho para a ficha do paciente. Quando o registro tem `paciente_id`, vai
// direto para /pacientes/$id. Registros legados sem vínculo caem na lista
// filtrada pelo nome, que é o comportamento antigo.
//
// Não tente resolver o nome para um id aqui: o único resolvedor existente
// (resolvePacienteId) CRIA um paciente quando não encontra correspondência, e
// isso transformaria a renderização de uma tabela em escrita no banco.
export function VerPacienteButton({
  nome,
  pacienteId,
  label = "Ver paciente",
  className,
}: {
  nome?: string | null;
  pacienteId?: string | null;
  label?: string;
  className?: string;
}) {
  const nomeTrim = (nome ?? "").trim();
  if (!nomeTrim && !pacienteId) return null;

  const conteudo = (
    <>
      <User className="h-4 w-4" /> {label}
    </>
  );
  const aria = `Ver paciente ${nomeTrim}`;

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={className ?? "h-8 gap-1 text-muted-foreground"}
    >
      {pacienteId ? (
        <Link to="/pacientes/$id" params={{ id: pacienteId }} aria-label={aria}>
          {conteudo}
        </Link>
      ) : (
        <Link to="/pacientes" search={{ q: nomeTrim }} aria-label={aria}>
          {conteudo}
        </Link>
      )}
    </Button>
  );
}
