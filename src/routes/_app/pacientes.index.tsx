import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTable, useCreate, useDelete, useUpdate } from "@/hooks/use-data";
import { buildPacienteHistoryCounter, normalizePacienteNome } from "@/lib/pacientes";
import type { AtendimentoFull, ConsultaFull, PropostaFull } from "@/lib/paciente-detalhe";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Loader2, Search, Users } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
type PacienteRow = Tables<"pacientes">;

export const Route = createFileRoute("/_app/pacientes/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: Pacientes,
});

function PacienteForm({
  pacientes,
  editing,
  onClose,
}: {
  pacientes: PacienteRow[];
  editing?: PacienteRow;
  onClose?: () => void;
}) {
  const create = useCreate("pacientes");
  const update = useUpdate("pacientes");
  const [open, setOpen] = useState(!!editing);
  const [nome, setNome] = useState(editing?.nome ?? "");

  useEffect(() => {
    if (open) setNome(editing?.nome ?? "");
  }, [open, editing]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = normalizePacienteNome(nome);
    if (!nomeTrim) return toast.error("Informe o nome");
    const dup = pacientes.some(
      (p) =>
        normalizePacienteNome(p.nome ?? "").toLowerCase() === nomeTrim.toLowerCase() &&
        (!isEdit || p.id !== editing.id),
    );
    if (dup) return toast.error("Já existe um paciente com esse nome");
    if (isEdit) await update.mutateAsync({ id: editing.id, values: { nome: nomeTrim } });
    else await create.mutateAsync({ nome: nomeTrim });
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose?.();
      }}
    >
      {!isEdit && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" /> Novo paciente
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar paciente" : "Cadastrar paciente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Pacientes() {
  const list = useTable<PacienteRow>("pacientes", "nome", true);
  // O detalhe do paciente virou rota própria (/pacientes/$id) e busca só os
  // dados dele. Aqui restam apenas as três tabelas que alimentam o contador
  // "{n} reg." de cada linha — antes eram nove, com todo o histórico da
  // clínica sendo baixado para renderizar uma lista de nomes.
  const atendimentos = useTable<AtendimentoFull>("atendimentos", "data");
  const consultas = useTable<ConsultaFull>("consultas_previstas", "data_prevista");
  const propostas = useTable<PropostaFull>("tratamentos_propostos", "data_proposta");
  const del = useDelete("pacientes");
  const { q: qParam } = Route.useSearch();
  const [editing, setEditing] = useState<PacienteRow | null>(null);
  const [q, setQ] = useState(qParam ?? "");

  // Ao chegar via "Ver paciente" (com ?q=), sincroniza a busca.
  useEffect(() => {
    if (qParam) setQ(qParam);
  }, [qParam]);

  const pacientes = useMemo(() => list.data ?? [], [list.data]);

  // Histórico completo do paciente: atendimentos + consultas + propostas/follow-ups.
  // Prioriza paciente_id e usa o nome normalizado apenas como fallback para
  // registros antigos sem id, sem duplicar registros que já têm paciente_id.
  const countFor = useMemo(
    () => buildPacienteHistoryCounter([atendimentos.data, consultas.data, propostas.data]),
    [atendimentos.data, consultas.data, propostas.data],
  );

  const rows = useMemo(
    () => pacientes.filter((p) => !q || p.nome?.toLowerCase().includes(q.toLowerCase())),
    [pacientes, q],
  );
  const pag = usePagination(rows, 20, q);

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Cadastro, histórico e pendências de cada paciente"
        actions={<PacienteForm pacientes={pacientes} />}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div
        className="rounded-2xl border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={2} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="p-0">
                  <EmptyState
                    icon={<Users className="h-8 w-8" />}
                    title={q ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
                    description={
                      q
                        ? "Ajuste o termo buscado."
                        : "Use o botão 'Novo paciente' para cadastrar o primeiro."
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {pag.pageItems.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {/* Link de verdade, não onClick na linha: assim ctrl+clique
                          e botão do meio abrem o paciente em outra aba — que é
                          justamente o que uma rota própria passa a permitir. */}
                  <Link
                    to="/pacientes/$id"
                    params={{ id: r.id }}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {r.nome}
                    <Badge variant="secondary">{countFor(r)} reg.</Badge>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => setEditing(r)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <ConfirmDelete
                      title="Excluir paciente?"
                      description={`"${r.nome}" será removido permanentemente.`}
                      onConfirm={() => del.mutate(r.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          page={pag.page}
          totalPages={pag.totalPages}
          from={pag.from}
          to={pag.to}
          total={pag.total}
          canPrev={pag.canPrev}
          canNext={pag.canNext}
          onPrev={pag.prev}
          onNext={pag.next}
          unitLabel="pacientes"
        />
      </div>

      {editing && (
        <PacienteForm pacientes={pacientes} editing={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
