import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTable, useCreate, useDelete, useUpdate } from "@/hooks/use-data";
import { PageHeader } from "@/components/ui-kit";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cadastros")({
  component: Cadastros,
});

type T = "procedimentos" | "formas_pagamento" | "laboratorios" | "tipos_trabalho";

function CadastroForm({
  table, label, withTaxa, editing, onClose,
}: {
  table: T;
  label: string;
  withTaxa?: boolean;
  editing?: any;
  onClose?: () => void;
}) {
  const create = useCreate(table);
  const update = useUpdate(table);
  const [open, setOpen] = useState(!!editing);
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [taxa, setTaxa] = useState(String(editing?.taxa ?? "0"));

  useEffect(() => {
    if (open) {
      setNome(editing?.nome ?? "");
      setTaxa(String(editing?.taxa ?? "0"));
    }
  }, [open, editing]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return toast.error("Informe o nome");
    const payload: any = { nome: nome.trim() };
    if (withTaxa) payload.taxa = Number(taxa) || 0;
    if (isEdit) await update.mutateAsync({ id: editing.id, values: payload });
    else await create.mutateAsync(payload);
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose?.(); }}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4" /> Novo</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${label}` : `Cadastrar ${label}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          {withTaxa && (
            <div className="space-y-1.5">
              <Label>Taxa padrão (%)</Label>
              <Input type="number" step="0.01" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
            </div>
          )}
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

function CrudList({ table, label, withTaxa = false }: { table: T; label: string; withTaxa?: boolean }) {
  const list = useTable<any>(table, "nome", true);
  const del = useDelete(table);
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CadastroForm table={table} label={label} withTaxa={withTaxa} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              {withTaxa && <TableHead className="text-right">Taxa</TableHead>}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={withTaxa ? 3 : 2} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            )}
            {!list.isLoading && (list.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={withTaxa ? 3 : 2} className="text-center text-muted-foreground py-12">Nenhum cadastro ainda.</TableCell></TableRow>
            )}
            {(list.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                {withTaxa && <TableCell className="text-right">{r.taxa}%</TableCell>}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(r)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <ConfirmDelete
                      title={`Excluir ${label}?`}
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
        <CadastroForm
          table={table} label={label} withTaxa={withTaxa}
          editing={editing} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Cadastros() {
  return (
    <>
      <PageHeader title="Cadastros" description="Procedimentos, pagamentos, laboratórios e tipos de trabalho" />
      <Tabs defaultValue="procedimentos">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="procedimentos">Procedimentos</TabsTrigger>
          <TabsTrigger value="formas">Formas de pagamento</TabsTrigger>
          <TabsTrigger value="laboratorios">Laboratórios</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de trabalho</TabsTrigger>
        </TabsList>
        <TabsContent value="procedimentos" className="mt-4"><CrudList table="procedimentos" label="procedimento" /></TabsContent>
        <TabsContent value="formas" className="mt-4"><CrudList table="formas_pagamento" label="forma de pagamento" withTaxa /></TabsContent>
        <TabsContent value="laboratorios" className="mt-4"><CrudList table="laboratorios" label="laboratório" /></TabsContent>
        <TabsContent value="tipos" className="mt-4"><CrudList table="tipos_trabalho" label="tipo de trabalho" /></TabsContent>
      </Tabs>
    </>
  );
}
