import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTable, useCreate, useDelete, useUpdate } from "@/hooks/use-data";
import { PageHeader } from "@/components/ui-kit";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Loader2, Search } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pacientes")({
  component: Pacientes,
});

function PacienteForm({
  pacientes, editing, onClose,
}: {
  pacientes: any[];
  editing?: any;
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
    const nomeTrim = nome.trim();
    if (!nomeTrim) return toast.error("Informe o nome");
    const dup = pacientes.some(
      (p) => p.nome?.toLowerCase() === nomeTrim.toLowerCase() && (!isEdit || p.id !== editing.id),
    );
    if (dup) return toast.error("Já existe um paciente com esse nome");
    if (isEdit) await update.mutateAsync({ id: editing.id, values: { nome: nomeTrim } });
    else await create.mutateAsync({ nome: nomeTrim });
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose?.(); }}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4" /> Novo paciente</Button>
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
  const list = useTable<any>("pacientes", "nome", true);
  const atendimentos = useTable<any>("atendimentos", "data");
  const del = useDelete("pacientes");
  const [editing, setEditing] = useState<any | null>(null);
  const [q, setQ] = useState("");

  const pacientes = list.data ?? [];

  const countByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of atendimentos.data ?? []) {
      const k = a.paciente ?? "";
      if (!k) continue;
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [atendimentos.data]);

  const rows = useMemo(
    () => pacientes.filter((p) => !q || p.nome?.toLowerCase().includes(q.toLowerCase())),
    [pacientes, q],
  );

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Cadastro de pacientes do consultório"
        actions={<PacienteForm pacientes={pacientes} />}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={2} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-12">Nenhum paciente ainda.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {r.nome}
                    <Badge variant="secondary">{countByName[r.nome] ?? 0} atend.</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(r)}>
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
      </div>

      {editing && (
        <PacienteForm
          pacientes={pacientes}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
