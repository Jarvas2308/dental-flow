import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable, useCreate, useDelete, useUpdate } from "@/hooks/use-data";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Trash2, FileCheck2 } from "lucide-react";

export const Route = createFileRoute("/_app/consultorio")({
  component: Consultorio,
});

function NewAtendimentoDialog() {
  const procedimentos = useTable<any>("procedimentos", "nome", true);
  const formas = useTable<any>("formas_pagamento", "nome", true);
  const create = useCreate("atendimentos");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<any>({
    paciente: "", procedimento: "", forma_pagamento: "",
    valor_bruto: "", taxa: 0, data: new Date().toISOString().slice(0, 10),
    nota_fiscal: false,
  });

  const onForma = (val: string) => {
    const f = (formas.data ?? []).find((x) => x.nome === val);
    setV((p: any) => ({ ...p, forma_pagamento: val, taxa: f?.taxa ?? 0 }));
  };

  const valorLiquido = Math.max(0, Number(v.valor_bruto || 0) * (1 - Number(v.taxa || 0) / 100));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      ...v,
      valor_bruto: Number(v.valor_bruto),
      taxa: Number(v.taxa),
      valor_liquido: Number(valorLiquido.toFixed(2)),
    });
    setOpen(false);
    setV({ paciente: "", procedimento: "", forma_pagamento: "", valor_bruto: "", taxa: 0,
      data: new Date().toISOString().slice(0, 10), nota_fiscal: false });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Novo atendimento</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Novo atendimento</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Paciente</Label>
              <Input required value={v.paciente} onChange={(e) => setV({ ...v, paciente: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Procedimento</Label>
              <Select value={v.procedimento} onValueChange={(val) => setV({ ...v, procedimento: val })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(procedimentos.data ?? []).map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
                  {(procedimentos.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">Cadastre em Cadastros</div>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" required value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={v.forma_pagamento} onValueChange={onForma}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(formas.data ?? []).map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome} ({p.taxa}%)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Taxa (%)</Label>
              <Input type="number" step="0.01" value={v.taxa} onChange={(e) => setV({ ...v, taxa: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor bruto (R$)</Label>
              <Input type="number" step="0.01" required value={v.valor_bruto}
                onChange={(e) => setV({ ...v, valor_bruto: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor líquido</Label>
              <div className="h-9 px-3 rounded-md border bg-muted/30 flex items-center text-sm font-medium">{brl(valorLiquido)}</div>
            </div>
            <div className="space-y-1.5 sm:col-span-2 flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <Label className="cursor-pointer">Nota fiscal emitida</Label>
                <p className="text-xs text-muted-foreground">Marque se a NF já foi gerada</p>
              </div>
              <Switch checked={v.nota_fiscal} onCheckedChange={(c) => setV({ ...v, nota_fiscal: c })} />
            </div>
          </div>
          <DialogFooter><Button type="submit" disabled={create.isPending}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Consultorio() {
  const [mes, setMes] = useState(currentMonthKey());
  const [q, setQ] = useState("");
  const list = useTable<any>("atendimentos", "data");
  const upd = useUpdate("atendimentos");
  const del = useDelete("atendimentos");

  const rows = useMemo(
    () => (list.data ?? [])
      .filter((r) => monthKey(r.data) === mes)
      .filter((r) => !q || r.paciente.toLowerCase().includes(q.toLowerCase())),
    [list.data, mes, q],
  );

  const totBruto = rows.reduce((s, r) => s + Number(r.valor_bruto || 0), 0);
  const totLiq = rows.reduce((s, r) => s + Number(r.valor_liquido || 0), 0);
  const totNF = rows.filter((r) => r.nota_fiscal).length;

  return (
    <>
      <PageHeader title="Consultório" description="Atendimentos e procedimentos realizados"
        actions={<NewAtendimentoDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label={`Bruto · ${monthLabel(mes)}`} value={brl(totBruto)} tone="primary" />
        <StatCard label="Líquido" value={brl(totLiq)} tone="success" hint="Após taxas" />
        <StatCard label="NFs emitidas" value={`${totNF} de ${rows.length}`} icon={<FileCheck2 className="h-4 w-4" />} />
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
          <Input placeholder="Buscar paciente..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Procedimento</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead>NF</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Nenhum atendimento neste mês.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{r.paciente}</TableCell>
                <TableCell>{r.procedimento}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.forma_pagamento} · {r.taxa}%</TableCell>
                <TableCell className="text-right">{brl(r.valor_bruto)}</TableCell>
                <TableCell className="text-right font-medium">{brl(r.valor_liquido)}</TableCell>
                <TableCell>
                  <button onClick={() => upd.mutate({ id: r.id, values: { nota_fiscal: !r.nota_fiscal } })}>
                    {r.nota_fiscal
                      ? <Badge className="bg-success text-success-foreground hover:bg-success/90">Emitida</Badge>
                      : <Badge variant="outline">Pendente</Badge>}
                  </button>
                </TableCell>
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
    </>
  );
}
