import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTable, useCreate, useDelete } from "@/hooks/use-data";
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
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/cadastros")({
  component: Cadastros,
});

type T = "procedimentos" | "formas_pagamento" | "laboratorios" | "tipos_trabalho";

function CrudList({ table, label, withTaxa = false }: { table: T; label: string; withTaxa?: boolean }) {
  const list = useTable<any>(table, "nome", true);
  const create = useCreate(table);
  const del = useDelete(table);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [taxa, setTaxa] = useState("0");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { nome };
    if (withTaxa) payload.taxa = Number(taxa);
    await create.mutateAsync(payload);
    setNome(""); setTaxa("0"); setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Novo</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Cadastrar {label}</DialogTitle></DialogHeader>
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
              <DialogFooter><Button type="submit" disabled={create.isPending}>Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              {withTaxa && <TableHead className="text-right">Taxa</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={withTaxa ? 3 : 2} className="text-center text-muted-foreground py-12">Nenhum cadastro ainda.</TableCell></TableRow>
            )}
            {(list.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                {withTaxa && <TableCell className="text-right">{r.taxa}%</TableCell>}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
