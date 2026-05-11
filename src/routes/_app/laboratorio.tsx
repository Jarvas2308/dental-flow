import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable, useCreate, useDelete } from "@/hooks/use-data";
import { brl, currentMonthKey, monthKey, monthLabel, monthOptions } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/laboratorio")({
  component: Laboratorio,
});

function NewCustoDialog() {
  const labs = useTable<any>("laboratorios", "nome", true);
  const tipos = useTable<any>("tipos_trabalho", "nome", true);
  const atendimentos = useTable<any>("atendimentos", "data");
  const create = useCreate("custos_laboratorio");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<any>({
    laboratorio: "", tipo_trabalho: "", paciente: "", procedimento: "",
    atendimento_id: "", valor: "", data: new Date().toISOString().slice(0, 10),
  });

  const onAtendimento = (id: string) => {
    const a = (atendimentos.data ?? []).find((x) => x.id === id);
    setV((p: any) => ({
      ...p,
      atendimento_id: id,
      paciente: a?.paciente ?? p.paciente,
      procedimento: a?.procedimento ?? p.procedimento,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      ...v,
      valor: Number(v.valor),
      atendimento_id: v.atendimento_id || null,
    });
    setOpen(false);
    setV({ laboratorio: "", tipo_trabalho: "", paciente: "", procedimento: "",
      atendimento_id: "", valor: "", data: new Date().toISOString().slice(0, 10) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Novo custo</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Novo custo de laboratório</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Laboratório</Label>
              <Select value={v.laboratorio} onValueChange={(x) => setV({ ...v, laboratorio: x })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(labs.data ?? []).map((l) => <SelectItem key={l.id} value={l.nome}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de trabalho</Label>
              <Select value={v.tipo_trabalho} onValueChange={(x) => setV({ ...v, tipo_trabalho: x })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(tipos.data ?? []).map((l) => <SelectItem key={l.id} value={l.nome}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vincular ao atendimento (opcional)</Label>
              <Select value={v.atendimento_id} onValueChange={onAtendimento}>
                <SelectTrigger><SelectValue placeholder="Selecione um atendimento" /></SelectTrigger>
                <SelectContent>
                  {(atendimentos.data ?? []).slice(0, 50).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {new Date(a.data).toLocaleDateString("pt-BR")} · {a.paciente} · {a.procedimento}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <Input required value={v.paciente} onChange={(e) => setV({ ...v, paciente: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Procedimento</Label>
              <Input value={v.procedimento} onChange={(e) => setV({ ...v, procedimento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" required value={v.valor} onChange={(e) => setV({ ...v, valor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" required value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button type="submit" disabled={create.isPending}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Laboratorio() {
  const [mes, setMes] = useState(currentMonthKey());
  const [q, setQ] = useState("");
  const list = useTable<any>("custos_laboratorio", "data");
  const del = useDelete("custos_laboratorio");

  const rows = useMemo(
    () => (list.data ?? [])
      .filter((r) => monthKey(r.data) === mes)
      .filter((r) => !q || r.paciente.toLowerCase().includes(q.toLowerCase()) || r.laboratorio.toLowerCase().includes(q.toLowerCase())),
    [list.data, mes, q],
  );

  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <>
      <PageHeader title="Laboratório" description="Custos laboratoriais por paciente e procedimento"
        actions={<NewCustoDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard label={`Total · ${monthLabel(mes)}`} value={brl(total)} tone="primary" />
        <StatCard label="Trabalhos" value={String(rows.length)} hint="No mês selecionado" />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions(12).map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente ou laboratório..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Laboratório</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Procedimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Nenhum custo neste mês.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{r.laboratorio}</TableCell>
                <TableCell>{r.tipo_trabalho}</TableCell>
                <TableCell>{r.paciente}</TableCell>
                <TableCell className="text-muted-foreground">{r.procedimento || "—"}</TableCell>
                <TableCell className="text-right font-medium">{brl(r.valor)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/30">
          <span className="text-sm text-muted-foreground">{rows.length} item(s)</span>
          <span className="font-semibold">Total: {brl(total)}</span>
        </div>
      </div>
    </>
  );
}
